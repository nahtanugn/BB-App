import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";

let initialized = false;

async function ensureResourcesSchema() {
  if (initialized) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL
  )`).run();
  initialized = true;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureResourcesSchema();
    const fields = user.role === "admin" || user.role === "officer" ? "*" : "id, title, description, category, url, created_at";
    const result = await env.DB.prepare(`SELECT ${fields} FROM resources ORDER BY category COLLATE NOCASE, title COLLATE NOCASE`).all();
    return Response.json({ resources: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load resources" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role === "member" || user.role === "nco" || user.role === "squad_leader") return Response.json({ error: "Resources are read-only for this account" }, { status: 403 });
    await ensureResourcesSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create_resource") {
      const title = String(body.title ?? "").trim();
      const description = String(body.description ?? "").trim();
      const category = String(body.category ?? "General").trim() || "General";
      const url = String(body.url ?? "").trim();
      let parsed: URL;
      try { parsed = new URL(url); } catch { return Response.json({ error: "Enter a valid resource link" }, { status: 400 }); }
      if (!title || !["http:", "https:"].includes(parsed.protocol)) return Response.json({ error: "A title and secure web link are required" }, { status: 400 });
      await env.DB.prepare("INSERT INTO resources (title, description, category, url, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(title, description, category, parsed.toString(), new Date().toISOString(), user.email).run();
      return Response.json({ ok: true });
    }

    if (action === "delete_resource") {
      const resourceId = Number(body.resourceId);
      if (!resourceId) return Response.json({ error: "Invalid resource" }, { status: 400 });
      await env.DB.prepare("DELETE FROM resources WHERE id = ?").bind(resourceId).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update resources" }, { status: 500 });
  }
}
