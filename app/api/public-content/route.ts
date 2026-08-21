import { env } from "cloudflare:workers";
import { getCurrentUser, hasAdminOrTemporaryAccess } from "../../../lib/auth";

async function ensurePublicContent() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS public_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT, content_type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0, updated_by_user_id INTEGER NOT NULL, updated_at TEXT NOT NULL)`).run();
}

export async function GET(request: Request) {
  await ensurePublicContent();
  const rows = await env.DB.prepare("SELECT id, content_type, title, body, updated_at FROM public_content WHERE published = 1 ORDER BY updated_at DESC").all();
  const user = await getCurrentUser(request);
  return Response.json({ content: rows.results, authenticated: Boolean(user) }, { headers: { "Cache-Control": "public, max-age=60" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || !hasAdminOrTemporaryAccess(user)) return Response.json({ error: "Administrator access required" }, { status: 403 });
  await ensurePublicContent();
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  if (action === "publish") {
    const title = String(body.title ?? "").trim().slice(0, 160); const content = String(body.body ?? "").trim().slice(0, 10_000);
    if (!title || !content) return Response.json({ error: "Title and content are required" }, { status: 400 });
    const result = await env.DB.prepare("INSERT INTO public_content (content_type, title, body, published, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(String(body.contentType ?? "notice"), title, content, body.published === false ? 0 : 1, user.id, new Date().toISOString()).run();
    return Response.json({ ok: true, id: Number(result.meta.last_row_id), message: "Public content saved." });
  }
  if (action === "unpublish") {
    const id = Number(body.id); await env.DB.prepare("UPDATE public_content SET published = 0, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return Response.json({ ok: true, message: "Public content unpublished." });
  }
  return Response.json({ error: "Unknown public-content action" }, { status: 400 });
}
