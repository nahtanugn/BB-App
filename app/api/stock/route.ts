import {
  getCurrentUser,
  getRuntimeEnv,
  hasAdminOrTemporaryAccess,
} from "../../../lib/auth";
import {
  canViewStockType,
  ensureStockSchema,
  getStockPermissions,
  STOCK_PERMISSIONS,
} from "../../../lib/stock";

const runtime = getRuntimeEnv();
const validTransactionTypes = [
  "received",
  "issued",
  "returned",
  "adjustment",
  "damaged",
  "repaired",
  "written_off",
];

function jsonPermissions(value: unknown) {
  const requested = Array.isArray(value) ? value.map(String) : [];
  return STOCK_PERMISSIONS.filter((permission) => requested.includes(permission));
}

async function audit(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, action: string, details: string) {
  await runtime.DB.prepare(`INSERT INTO stock_audit_log
    (action, details, actor_user_id, actor_name, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(action, details, user.id, user.name, new Date().toISOString())
    .run();
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureStockSchema(runtime.DB);
    const permissions = await getStockPermissions(runtime.DB, user);
    const url = new URL(request.url);
    if (url.searchParams.get("access") === "1") {
      return Response.json({ permissions, canOpen: permissions.some((value) => value.startsWith("stock.view_")) });
    }
    if (!permissions.some((value) => value.startsWith("stock.view_"))) {
      return Response.json({ error: "Stock access has not been assigned to this account" }, { status: 403 });
    }
    const allowedTypes = ["uniform", "award"].filter((type) => canViewStockType(permissions, type));
    const placeholders = allowedTypes.map(() => "?").join(",");
    const items = await runtime.DB.prepare(`SELECT i.*,
      COALESCE(SUM(t.quantity_delta), 0) AS quantity
      FROM stock_items i
      LEFT JOIN stock_transactions t ON t.item_id = i.id
      WHERE i.active = 1 AND i.stock_type IN (${placeholders})
      GROUP BY i.id
      ORDER BY i.stock_type, i.section, i.category, i.name, i.variant, i.condition`)
      .bind(...allowedTypes)
      .all();
    const transactions = permissions.includes("stock.view_history")
      ? await runtime.DB.prepare(`SELECT t.*, i.name AS item_name, i.variant, i.condition, i.stock_type,
          m.name AS member_name
        FROM stock_transactions t
        JOIN stock_items i ON i.id = t.item_id
        LEFT JOIN members m ON m.id = t.member_id
        WHERE i.stock_type IN (${placeholders})
        ORDER BY t.created_at DESC LIMIT 250`)
          .bind(...allowedTypes)
          .all()
      : { results: [] };
    const members = await runtime.DB.prepare(
      "SELECT id, name, section, squad FROM members ORDER BY name COLLATE NOCASE",
    ).all();
    const response: Record<string, unknown> = {
      permissions,
      items: items.results,
      transactions: transactions.results,
      members: members.results,
    };
    if (hasAdminOrTemporaryAccess(user)) {
      const roles = await runtime.DB.prepare("SELECT * FROM custom_roles ORDER BY name COLLATE NOCASE").all();
      const assignments = await runtime.DB.prepare(`SELECT ur.user_id, ur.role_id, ur.expires_at,
        u.name AS user_name, u.email, r.name AS role_name, r.color
        FROM user_custom_roles ur
        JOIN users u ON u.id = ur.user_id
        JOIN custom_roles r ON r.id = ur.role_id
        ORDER BY u.name COLLATE NOCASE, r.name COLLATE NOCASE`).all();
      response.roles = roles.results;
      response.assignments = assignments.results;
    }
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load stock" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureStockSchema(runtime.DB);
    const permissions = await getStockPermissions(runtime.DB, user);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (["create_role", "update_role", "delete_role", "assign_role", "remove_role"].includes(action)) {
      if (user.role !== "admin") return Response.json({ error: "Only administrators can manage custom roles" }, { status: 403 });
      if (action === "create_role" || action === "update_role") {
        const name = String(body.name ?? "").trim();
        const description = String(body.description ?? "").trim();
        const color = /^#[0-9a-f]{6}$/i.test(String(body.color ?? "")) ? String(body.color) : "#2878d4";
        const rolePermissions = jsonPermissions(body.permissions);
        if (!name) return Response.json({ error: "Enter a role name" }, { status: 400 });
        if (action === "create_role") {
          await runtime.DB.prepare(`INSERT INTO custom_roles
            (name, color, description, permissions, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .bind(name, color, description, JSON.stringify(rolePermissions), user.id, new Date().toISOString(), new Date().toISOString())
            .run();
          await audit(user, "custom_role_created", name);
        } else {
          const roleId = Number(body.roleId);
          await runtime.DB.prepare(`UPDATE custom_roles SET name = ?, color = ?, description = ?,
            permissions = ?, updated_at = ? WHERE id = ?`)
            .bind(name, color, description, JSON.stringify(rolePermissions), new Date().toISOString(), roleId)
            .run();
          await audit(user, "custom_role_updated", `${roleId}: ${name}`);
        }
      } else if (action === "delete_role") {
        const roleId = Number(body.roleId);
        const role = await runtime.DB.prepare("SELECT name FROM custom_roles WHERE id = ?").bind(roleId).first<{ name: string }>();
        await runtime.DB.prepare("DELETE FROM custom_roles WHERE id = ?").bind(roleId).run();
        await audit(user, "custom_role_deleted", role?.name ?? String(roleId));
      } else if (action === "assign_role") {
        const targetUserId = Number(body.userId);
        const roleId = Number(body.roleId);
        const expiresOn = String(body.expiresOn ?? "");
        const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresOn) ? `${expiresOn}T15:59:59.999Z` : null;
        if (!targetUserId || !roleId) return Response.json({ error: "Select an account and a role" }, { status: 400 });
        await runtime.DB.prepare(`INSERT INTO user_custom_roles
          (user_id, role_id, expires_at, assigned_by, assigned_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, role_id) DO UPDATE SET expires_at = excluded.expires_at,
            assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at`)
          .bind(targetUserId, roleId, expiresAt, user.id, new Date().toISOString()).run();
        await audit(user, "custom_role_assigned", `Role ${roleId} assigned to user ${targetUserId}${expiresAt ? ` until ${expiresAt}` : ""}`);
      } else {
        const targetUserId = Number(body.userId);
        const roleId = Number(body.roleId);
        await runtime.DB.prepare("DELETE FROM user_custom_roles WHERE user_id = ? AND role_id = ?")
          .bind(targetUserId, roleId).run();
        await audit(user, "custom_role_removed", `Role ${roleId} removed from user ${targetUserId}`);
      }
      return Response.json({ ok: true });
    }

    if (action === "create_item") {
      if (!permissions.includes("stock.adjust")) return Response.json({ error: "Stock catalogue permission required" }, { status: 403 });
      const stockType = String(body.stockType) === "award" ? "award" : "uniform";
      if (!canViewStockType(permissions, stockType)) return Response.json({ error: "You cannot manage this stock type" }, { status: 403 });
      const name = String(body.name ?? "").trim();
      if (!name) return Response.json({ error: "Enter an item name" }, { status: 400 });
      const now = new Date().toISOString();
      const result = await runtime.DB.prepare(`INSERT INTO stock_items
        (source_key, name, stock_type, section, category, variant, condition, reorder_level, notes, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .bind(`custom-${crypto.randomUUID()}`, name, stockType, String(body.section ?? "shared"), String(body.category ?? ""), String(body.variant ?? ""), String(body.condition ?? "current"), Math.max(0, Number(body.reorderLevel) || 0), String(body.notes ?? ""), now, now).run();
      const opening = Math.max(0, Number(body.quantity) || 0);
      await runtime.DB.prepare(`INSERT INTO stock_transactions
        (item_id, transaction_type, quantity_delta, notes, created_by, created_by_name, created_at)
        VALUES (?, 'opening_balance', ?, 'New catalogue item', ?, ?, ?)`)
        .bind(Number(result.meta.last_row_id), opening, user.id, user.name, now).run();
      await audit(user, "stock_item_created", name);
      return Response.json({ ok: true });
    }

    if (action === "transaction") {
      const itemId = Number(body.itemId);
      const transactionType = String(body.transactionType ?? "");
      const quantity = Math.max(1, Math.floor(Number(body.quantity) || 0));
      if (!itemId || !validTransactionTypes.includes(transactionType)) return Response.json({ error: "Choose a valid item and transaction type" }, { status: 400 });
      const item = await runtime.DB.prepare(`SELECT i.*, COALESCE(SUM(t.quantity_delta), 0) AS quantity
        FROM stock_items i LEFT JOIN stock_transactions t ON t.item_id = i.id
        WHERE i.id = ? GROUP BY i.id`).bind(itemId).first<{
          id: number;
          name: string;
          stock_type: string;
          section: string;
          category: string;
          variant: string;
          condition: string;
          reorder_level: number;
          notes: string;
          quantity: number;
        }>();
      if (!item || !canViewStockType(permissions, item.stock_type)) return Response.json({ error: "Stock item not available" }, { status: 404 });
      const managePermission = item.stock_type === "award" ? "stock.manage_awards" : "stock.manage_uniform";
      const issuePermission = item.stock_type === "award" ? "stock.issue_awards" : "stock.issue_uniform";
      const isIssue = transactionType === "issued";
      if (isIssue && !permissions.includes(issuePermission)) return Response.json({ error: "Issue permission required" }, { status: 403 });
      if (!isIssue && !permissions.includes(managePermission) && !permissions.includes("stock.adjust")) return Response.json({ error: "Stock management permission required" }, { status: 403 });
      if (isIssue && item.condition === "defective") return Response.json({ error: "Defective stock cannot be issued" }, { status: 409 });
      if (transactionType === "damaged" || transactionType === "repaired") {
        const targetCondition = transactionType === "damaged" ? "defective" : "current";
        if (transactionType === "repaired" && item.condition !== "defective") {
          return Response.json({ error: "Only defective stock can be marked as repaired" }, { status: 409 });
        }
        if (transactionType === "damaged" && item.condition === "defective") {
          return Response.json({ error: "This stock is already recorded as defective" }, { status: 409 });
        }
        if (Number(item.quantity) < quantity) {
          return Response.json({ error: "There is not enough stock for this transaction" }, { status: 409 });
        }
        let target = await runtime.DB.prepare(`SELECT id FROM stock_items
          WHERE name = ? AND stock_type = ? AND section = ? AND category = ?
            AND variant = ? AND condition = ? AND active = 1 LIMIT 1`)
          .bind(item.name, item.stock_type, item.section, item.category, item.variant, targetCondition)
          .first<{ id: number }>();
        if (!target) {
          const now = new Date().toISOString();
          const created = await runtime.DB.prepare(`INSERT INTO stock_items
            (source_key, name, stock_type, section, category, variant, condition, reorder_level, notes, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
            .bind(`reclassified-${crypto.randomUUID()}`, item.name, item.stock_type, item.section, item.category, item.variant, targetCondition, item.reorder_level, item.notes, now, now)
            .run();
          target = { id: Number(created.meta.last_row_id) };
        }
        const now = new Date().toISOString();
        const note = String(body.notes ?? "") || (transactionType === "damaged" ? "Moved to defective stock" : "Returned to usable stock after repair");
        await runtime.DB.batch([
          runtime.DB.prepare(`INSERT INTO stock_transactions
            (item_id, transaction_type, quantity_delta, member_id, notes, created_by, created_by_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(item.id, transactionType, -quantity, body.memberId ? Number(body.memberId) : null, note, user.id, user.name, now),
          runtime.DB.prepare(`INSERT INTO stock_transactions
            (item_id, transaction_type, quantity_delta, member_id, notes, created_by, created_by_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(target.id, `reclassified_${targetCondition}`, quantity, body.memberId ? Number(body.memberId) : null, note, user.id, user.name, now),
        ]);
        return Response.json({ ok: true });
      }
      const negative = ["issued", "damaged", "written_off"].includes(transactionType);
      const delta = negative ? -quantity : transactionType === "adjustment" ? Number(body.quantityDelta) || 0 : quantity;
      if (delta === 0) return Response.json({ error: "Enter a quantity change" }, { status: 400 });
      if (Number(item.quantity) + delta < 0) return Response.json({ error: "This transaction would make the stock balance negative" }, { status: 409 });
      const memberId = body.memberId ? Number(body.memberId) : null;
      await runtime.DB.prepare(`INSERT INTO stock_transactions
        (item_id, transaction_type, quantity_delta, member_id, notes, created_by, created_by_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(itemId, transactionType, delta, memberId, String(body.notes ?? ""), user.id, user.name, new Date().toISOString()).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown stock action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update stock";
    return Response.json({ error: message.includes("UNIQUE") ? "That role name already exists" : message }, { status: 500 });
  }
}
