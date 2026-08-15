import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { ensureAuditSchema, writeAuditEvent } from "../../../lib/audit";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!["admin", "officer", "viewer"].includes(user.role)) return Response.json({ error: "Administrator or Officer access required" }, { status: 403 });
  await ensureAuditSchema();
  const rows = await env.DB.prepare("SELECT id, actor_email, actor_role, action, entity_type, entity_id, before_json, after_json, created_at FROM audit_events ORDER BY id DESC LIMIT 250").all();
  return Response.json({ events: rows.results });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as { action?: string; entityType?: string; entityId?: string | number; metadata?: unknown };
  if (body.action !== "export_created") return Response.json({ error: "Unsupported audit action" }, { status: 400 });
  await writeAuditEvent({ actor: user, action: body.action, entityType: body.entityType ?? "export", entityId: body.entityId, after: body.metadata });
  return Response.json({ ok: true });
}
