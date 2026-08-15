import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { writeAuditEvent } from "../../../lib/audit";

async function ensureSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS school_directory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT '')`).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO school_directory (name, created_at, updated_at) SELECT DISTINCT TRIM(school), ?, ? FROM members WHERE TRIM(school) != ''`).bind(new Date().toISOString(), new Date().toISOString()).run();
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureSchema();
  const rows = await env.DB.prepare("SELECT id, name, active FROM school_directory WHERE active = 1 ORDER BY name COLLATE NOCASE").all();
  return Response.json({ schools: rows.results });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });
  await ensureSchema();
  const body = await request.json() as { action?: string; id?: number; name?: string };
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  if (body.action === "archive") { if (!body.id) return Response.json({ error: "School id required" }, { status: 400 }); await env.DB.prepare("UPDATE school_directory SET active = 0, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), body.id).run(); await writeAuditEvent({ actor: user, action: "school_archived", entityType: "school", entityId: body.id }); return Response.json({ ok: true }); }
  if (!name) return Response.json({ error: "School name is required" }, { status: 400 });
  try { await env.DB.prepare("INSERT INTO school_directory (name, created_at, updated_at, created_by) VALUES (?, ?, ?, ?)").bind(name, new Date().toISOString(), new Date().toISOString(), user.email).run(); } catch { return Response.json({ error: "That school already exists" }, { status: 409 }); }
  await writeAuditEvent({ actor: user, action: "school_created", entityType: "school", after: { name } });
  return Response.json({ ok: true });
}
