import { env } from "cloudflare:workers";

export async function ensureAuditSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    actor_email TEXT NOT NULL DEFAULT '',
    actor_role TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL DEFAULT '',
    before_json TEXT,
    after_json TEXT,
    created_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at DESC)").run();
}

export async function writeAuditEvent(input: {
  actor: { id: number; email: string; role: string };
  action: string;
  entityType: string;
  entityId?: string | number;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await ensureAuditSchema();
    await env.DB.prepare(`INSERT INTO audit_events (actor_user_id, actor_email, actor_role, action, entity_type, entity_id, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(input.actor.id, input.actor.email, input.actor.role, input.action, input.entityType, String(input.entityId ?? ""), input.before == null ? null : JSON.stringify(input.before), input.after == null ? null : JSON.stringify(input.after), new Date().toISOString()).run();
  } catch {
    // Auditing must never prevent the requested operation from completing.
  }
}
