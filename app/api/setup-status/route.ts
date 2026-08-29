import { env } from "cloudflare:workers";

const allowedOrigin = "https://nahtanugn.github.io";

function headers(request: Request) {
  const origin = request.headers.get("origin");
  return {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin === allowedOrigin ? allowedOrigin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: headers(request) });
}

export async function GET(request: Request) {
  try {
    await env.DB.prepare("SELECT 1 AS healthy").first();
    const usersTable = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .first<{ name: string }>();
    const count = usersTable
      ? await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>()
      : null;
    return Response.json({
      status: "ok",
      app: "available",
      database: "available",
      setupRequired: !Number(count?.total ?? 0),
      readiness: !Number(count?.total ?? 0) ? "administrator_required" : "configured",
    }, { headers: headers(request) });
  } catch {
    return Response.json({ status: "unavailable", app: "available", database: "unavailable", setupRequired: null, readiness: "database_unavailable" }, {
      status: 503,
      headers: headers(request),
    });
  }
}
