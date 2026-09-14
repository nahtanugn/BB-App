import { getCurrentUser, ensureAuthSchema, getRuntimeEnv, passwordDigest } from "../../../lib/auth";
import { writeAuditEvent } from "../../../lib/audit";

const runtime = getRuntimeEnv();

async function canManage(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  if (user.role === "admin" || user.role === "officer") return true;
  const role = await runtime.DB.prepare(`SELECT 1 FROM user_custom_roles ur JOIN custom_roles r ON r.id=ur.role_id
    WHERE ur.user_id=? AND r.name COLLATE NOCASE='Band Chairman' AND (ur.expires_at IS NULL OR ur.expires_at>?) LIMIT 1`)
    .bind(user.id, new Date().toISOString()).first();
  return Boolean(role);
}

function expiry(value: unknown) {
  const date = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T15:59:59.999Z` : null;
}

export async function GET(request: Request) {
  await ensureAuthSchema();
  const user = await getCurrentUser(request);
  if (!user || !(await canManage(user))) return Response.json({ error: "Band access manager permission required" }, { status: 403 });
  const rows = await runtime.DB.prepare(`SELECT id,name,email,active,access_expires_at,created_at FROM users WHERE access_scope='band_external' ORDER BY name COLLATE NOCASE`).all();
  return Response.json({ accounts: rows.results });
}

export async function POST(request: Request) {
  await ensureAuthSchema();
  const actor = await getCurrentUser(request);
  if (!actor || !(await canManage(actor))) return Response.json({ error: "Band access manager permission required" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  const targetId = Number(body.userId ?? 0);
  if (["set_active", "reset_password", "revoke"].includes(action) && !targetId) return Response.json({ error: "Account id required" }, { status: 400 });
  if (action === "create") {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const accessExpiresAt = expiry(body.expiresOn);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return Response.json({ error: "Enter a valid name, email, and password of at least 10 characters" }, { status: 400 });
    const digest = await passwordDigest(password);
    try {
      const result = await runtime.DB.prepare(`INSERT INTO users (email,name,role,temporary_access_role,access_expires_at,access_scope,password_hash,password_salt,active,account_status,must_change_password,created_at)
        VALUES (?,?, 'viewer','',?,'band_external',?,?,1,'active',1,?)`).bind(email,name,accessExpiresAt,digest.hash,digest.salt,new Date().toISOString()).run();
      await writeAuditEvent({ actor, action: "band_external_created", entityType: "user", entityId: Number(result.meta.last_row_id), after: { name, email, access_scope: "band_external", access_expires_at: accessExpiresAt } });
      return Response.json({ ok: true });
    } catch { return Response.json({ error: "That email already has an account" }, { status: 409 }); }
  }
  const target = await runtime.DB.prepare("SELECT id,name,email,access_scope FROM users WHERE id=?").bind(targetId).first<{ id:number; name:string; email:string; access_scope:string }>();
  if (!target || target.access_scope !== "band_external") return Response.json({ error: "Band external account not found" }, { status: 404 });
  if (action === "set_active") {
    const active = body.active ? 1 : 0;
    await runtime.DB.prepare("UPDATE users SET active=? WHERE id=?").bind(active,targetId).run();
    if (!active) await runtime.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(targetId).run();
    await writeAuditEvent({ actor, action: active ? "band_external_enabled" : "band_external_disabled", entityType: "user", entityId: targetId, after: { active } });
    return Response.json({ ok: true });
  }
  if (action === "revoke") {
    await runtime.DB.prepare("UPDATE users SET access_scope='', active=0 WHERE id=?").bind(targetId).run();
    await runtime.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(targetId).run();
    await writeAuditEvent({ actor, action: "band_external_revoked", entityType: "user", entityId: targetId, after: { access_scope: "", active: 0 } });
    return Response.json({ ok: true });
  }
  if (action === "reset_password") {
    const password = String(body.password ?? "");
    if (password.length < 10) return Response.json({ error: "Password must be at least 10 characters" }, { status: 400 });
    const digest = await passwordDigest(password);
    await runtime.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,must_change_password=1,onboarding_completed_at=NULL WHERE id=?").bind(digest.hash,digest.salt,targetId).run();
    await runtime.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(targetId).run();
    await writeAuditEvent({ actor, action: "band_external_password_reset", entityType: "user", entityId: targetId });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
