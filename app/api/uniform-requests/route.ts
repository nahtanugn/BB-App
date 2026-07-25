import { getCurrentUser, getRuntimeEnv } from "../../../lib/auth";
import { ensureStockSchema, getStockPermissions } from "../../../lib/stock";

const runtime = getRuntimeEnv();
const requestStatuses = ["pending", "approved", "ready", "issued", "rejected", "cancelled"];

async function memberForUser(email: string) {
  return runtime.DB.prepare(
    "SELECT id, name, section, squad FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
  ).bind(email).first<{ id: number; name: string; section: string; squad: string }>();
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureStockSchema(runtime.DB);
    const permissions = await getStockPermissions(runtime.DB, user);
    const canManage = permissions.includes("stock.manage_uniform_requests");
    const canViewAll = canManage || user.role === "viewer";
    const member = await memberForUser(user.email);
    const ownRequests = member
      ? await runtime.DB.prepare(`SELECT r.*, i.name AS item_name, i.variant, i.section AS item_section,
          i.category, i.condition
        FROM uniform_requests r
        JOIN stock_items i ON i.id = r.item_id
        WHERE r.member_id = ?
        ORDER BY r.submitted_at DESC`).bind(member.id).all()
      : { results: [] };
    const items = member
      ? await runtime.DB.prepare(`SELECT i.id, i.name, i.variant, i.section, i.category, i.condition,
          COALESCE(SUM(t.quantity_delta), 0) AS quantity
        FROM stock_items i
        LEFT JOIN stock_transactions t ON t.item_id = i.id
        WHERE i.stock_type = 'uniform' AND i.active = 1 AND i.condition != 'defective'
          AND i.section IN (?, 'shared')
        GROUP BY i.id
        HAVING quantity > 0
        ORDER BY i.section, i.category, i.name, i.variant`)
          .bind(member.section === "junior" ? "junior" : "senior").all()
      : { results: [] };
    const reviewRequests = canViewAll
      ? await runtime.DB.prepare(`SELECT r.*, i.name AS item_name, i.variant, i.section AS item_section,
          i.category, i.condition, m.name AS member_name, m.section AS member_section, m.squad,
          COALESCE((SELECT SUM(t.quantity_delta) FROM stock_transactions t WHERE t.item_id = i.id), 0) AS stock_quantity
        FROM uniform_requests r
        JOIN stock_items i ON i.id = r.item_id
        JOIN members m ON m.id = r.member_id
        ORDER BY CASE r.status
          WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'ready' THEN 2
          WHEN 'issued' THEN 3 WHEN 'rejected' THEN 4 ELSE 5 END,
          r.submitted_at DESC`).all()
      : { results: [] };
    return Response.json({
      member: member ?? null,
      canManage,
      canViewAll,
      canRequest: user.role !== "viewer",
      items: items.results,
      ownRequests: ownRequests.results,
      reviewRequests: reviewRequests.results,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load uniform requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role === "viewer")
      return Response.json({ error: "Viewer accounts have read-only access" }, { status: 403 });
    await ensureStockSchema(runtime.DB);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const member = await memberForUser(user.email);

    if (action === "create_request") {
      if (!member) return Response.json({ error: "Your account is not linked to a member profile" }, { status: 409 });
      const itemId = Number(body.itemId);
      const quantity = Math.max(1, Math.min(10, Math.floor(Number(body.quantity) || 0)));
      const reason = String(body.reason ?? "").trim();
      const notes = String(body.notes ?? "").trim();
      if (!itemId || !reason) return Response.json({ error: "Select an item and a reason" }, { status: 400 });
      const item = await runtime.DB.prepare(`SELECT i.id, i.name, i.variant, i.section, i.condition,
          COALESCE(SUM(t.quantity_delta), 0) AS quantity
        FROM stock_items i LEFT JOIN stock_transactions t ON t.item_id = i.id
        WHERE i.id = ? AND i.stock_type = 'uniform' AND i.active = 1 GROUP BY i.id`)
        .bind(itemId).first<{ id: number; name: string; variant: string; section: string; condition: string; quantity: number }>();
      if (!item || item.condition === "defective" || ![member.section, "shared"].includes(item.section)) {
        return Response.json({ error: "That uniform item is not available for your section" }, { status: 409 });
      }
      if (Number(item.quantity) < quantity) return Response.json({ error: "There is not enough stock available for this request" }, { status: 409 });
      const duplicate = await runtime.DB.prepare(`SELECT id FROM uniform_requests
        WHERE member_id = ? AND item_id = ? AND status IN ('pending', 'approved', 'ready') LIMIT 1`)
        .bind(member.id, itemId).first<{ id: number }>();
      if (duplicate) return Response.json({ error: "You already have an active request for this item" }, { status: 409 });
      await runtime.DB.prepare(`INSERT INTO uniform_requests
        (member_id, submitted_by_user_id, item_id, quantity, reason, notes, status, review_notes, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', '', ?)`)
        .bind(member.id, user.id, itemId, quantity, reason, notes, new Date().toISOString()).run();
      return Response.json({ ok: true });
    }

    if (action === "cancel_request") {
      if (!member) return Response.json({ error: "Member profile not found" }, { status: 404 });
      const requestId = Number(body.requestId);
      const row = await runtime.DB.prepare("SELECT status FROM uniform_requests WHERE id = ? AND member_id = ?")
        .bind(requestId, member.id).first<{ status: string }>();
      if (!row) return Response.json({ error: "Request not found" }, { status: 404 });
      if (row.status !== "pending") return Response.json({ error: "Only pending requests can be cancelled" }, { status: 409 });
      await runtime.DB.prepare("UPDATE uniform_requests SET status = 'cancelled', cancelled_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), requestId).run();
      return Response.json({ ok: true });
    }

    if (action === "review_request") {
      const permissions = await getStockPermissions(runtime.DB, user);
      if (!permissions.includes("stock.manage_uniform_requests")) {
        return Response.json({ error: "Uniform request management permission required" }, { status: 403 });
      }
      const requestId = Number(body.requestId);
      const status = String(body.status ?? "");
      const reviewNotes = String(body.reviewNotes ?? "").trim();
      if (!requestId || !requestStatuses.includes(status) || ["pending", "cancelled"].includes(status)) {
        return Response.json({ error: "Choose a valid review result" }, { status: 400 });
      }
      const row = await runtime.DB.prepare(`SELECT r.*, i.name AS item_name, i.condition,
          COALESCE((SELECT SUM(t.quantity_delta) FROM stock_transactions t WHERE t.item_id = i.id), 0) AS stock_quantity
        FROM uniform_requests r JOIN stock_items i ON i.id = r.item_id WHERE r.id = ?`)
        .bind(requestId).first<{ id: number; item_id: number; member_id: number; quantity: number; status: string; item_name: string; condition: string; stock_quantity: number }>();
      if (!row) return Response.json({ error: "Request not found" }, { status: 404 });
      if (["issued", "rejected", "cancelled"].includes(row.status)) {
        return Response.json({ error: "This request is already closed" }, { status: 409 });
      }
      const allowedTransitions: Record<string, string[]> = {
        pending: ["approved", "rejected"],
        approved: ["ready", "issued", "rejected"],
        ready: ["issued", "rejected"],
      };
      if (!(allowedTransitions[row.status] ?? []).includes(status)) {
        return Response.json({ error: "That status change is not allowed for this request" }, { status: 409 });
      }
      const now = new Date().toISOString();
      if (status === "issued") {
        if (!["approved", "ready"].includes(row.status)) return Response.json({ error: "Approve the request before issuing stock" }, { status: 409 });
        if (row.condition === "defective" || Number(row.stock_quantity) < Number(row.quantity)) {
          return Response.json({ error: "There is not enough usable stock to issue this request" }, { status: 409 });
        }
        await runtime.DB.batch([
          runtime.DB.prepare(`INSERT INTO stock_transactions
            (item_id, transaction_type, quantity_delta, member_id, notes, created_by, created_by_name, created_at)
            VALUES (?, 'issued', ?, ?, ?, ?, ?, ?)`)
            .bind(row.item_id, -Number(row.quantity), row.member_id, `Uniform request #${row.id}`, user.id, user.name, now),
          runtime.DB.prepare(`UPDATE uniform_requests SET status = 'issued', review_notes = ?,
            reviewed_at = COALESCE(reviewed_at, ?), reviewed_by = ?,
            issued_at = ?, issued_by = ? WHERE id = ?`)
            .bind(reviewNotes, now, user.name, now, user.name, requestId),
        ]);
      } else {
        const readyAt = status === "ready" ? now : null;
        await runtime.DB.prepare(`UPDATE uniform_requests SET status = ?, review_notes = ?,
          reviewed_at = ?, reviewed_by = ?, ready_at = COALESCE(?, ready_at) WHERE id = ?`)
          .bind(status, reviewNotes, now, user.name, readyAt, requestId).run();
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown uniform request action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update uniform request" }, { status: 500 });
  }
}
