import { env } from "cloudflare:workers";

export async function GET() {
  try {
    await env.DB.prepare("SELECT 1 AS healthy").first();
    return Response.json(
      { status: "ok", service: "bb-company-app", privateDocuments: Boolean((env as unknown as { DOCUMENTS?: unknown }).DOCUMENTS), checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", service: "bb-company-app" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
