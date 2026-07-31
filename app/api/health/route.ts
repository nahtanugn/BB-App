import { env } from "cloudflare:workers";

export async function GET() {
  try {
    await env.DB.prepare("SELECT 1 AS healthy").first();
    return Response.json(
      { status: "ok", service: "11kchbb-app", checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", service: "11kchbb-app" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
