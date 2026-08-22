import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { DEFAULT_BRANDING, ensureBrandingSchema, getBranding } from "../../../lib/branding";
import { writeAuditEvent } from "../../../lib/audit";

function clean(value: unknown, fallback: string, max: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max) || fallback;
}

function decodeLogo(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2]);
  if (binary.length > 750_000) return null;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, type: match[1] };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("logo") === "1") {
    try {
      await ensureBrandingSchema(env.DB);
      const row = await env.DB.prepare("SELECT logo_data_url FROM app_branding WHERE id = 1").first<{ logo_data_url: string | null }>();
      const logo = row?.logo_data_url ? decodeLogo(row.logo_data_url) : null;
      if (!logo) return Response.redirect(new URL(DEFAULT_BRANDING.logoUrl, request.url), 302);
      return new Response(logo.bytes, { headers: { "Content-Type": logo.type, "Cache-Control": "public, max-age=3600" } });
    } catch {
      return Response.redirect(new URL(DEFAULT_BRANDING.logoUrl, request.url), 302);
    }
  }
  return Response.json(await getBranding(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });
  await ensureBrandingSchema(env.DB);
  const body = await request.json() as Record<string, unknown>;
  const before = await env.DB.prepare("SELECT app_name, short_name, company_name, subtitle, logo_data_url IS NOT NULL AS has_custom_logo FROM app_branding WHERE id = 1").first();
  const appName = clean(body.appName, DEFAULT_BRANDING.appName, 60);
  const shortName = clean(body.shortName, appName, 24);
  const companyName = clean(body.companyName, DEFAULT_BRANDING.companyName, 100);
  const subtitle = clean(body.subtitle, DEFAULT_BRANDING.subtitle, 100);
  const logoDataUrl = typeof body.logoDataUrl === "string" ? body.logoDataUrl : null;
  if (logoDataUrl && !decodeLogo(logoDataUrl)) return Response.json({ error: "Use a PNG, JPEG or WebP logo smaller than 750 KB" }, { status: 400 });
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(`UPDATE app_branding SET app_name = ?, short_name = ?, company_name = ?, subtitle = ?,
    logo_data_url = CASE WHEN ? = 1 THEN ? ELSE logo_data_url END,
    updated_by_user_id = ?, updated_at = ? WHERE id = 1`)
    .bind(appName, shortName, companyName, subtitle, body.removeLogo || logoDataUrl ? 1 : 0, body.removeLogo ? null : logoDataUrl, user.id, updatedAt)
    .run();
  await writeAuditEvent({ actor: user, action: "app_branding_updated", entityType: "app_branding", entityId: 1, before, after: { appName, shortName, companyName, subtitle, logoChanged: Boolean(body.removeLogo || logoDataUrl) } });
  return Response.json({ ok: true, branding: await getBranding(), message: "App branding updated." });
}
