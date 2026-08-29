import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { DEFAULT_BRANDING, getBranding } from "../../../lib/branding";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });

    const [first, branding, privacy, schoolTable, officerCount] = await Promise.all([
      env.DB.prepare("SELECT MIN(id) AS id FROM users").first<{ id: number }>(),
      getBranding(),
      env.DB.prepare("SELECT setting_value, version FROM app_settings WHERE setting_key = 'privacy_notice'").first<{ setting_value: string; version: number }>(),
      env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'school_directory'").first<{ name: string }>(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE active = 1 AND account_status = 'active' AND role = 'officer'").first<{ total: number }>(),
    ]);
    const schoolCount = schoolTable
      ? await env.DB.prepare("SELECT COUNT(*) AS total FROM school_directory WHERE active = 1").first<{ total: number }>()
      : null;
    const status = {
      privacy: user.privacy_notice_version >= user.current_privacy_version,
      branding: branding.companyName.trim() !== "" && branding.companyName !== DEFAULT_BRANDING.companyName,
      tour: Boolean(user.tour_completed_at),
    };
    return Response.json({
      eligible: Number(first?.id) === user.id && !user.onboarding_completed_at,
      status,
      requiredComplete: status.privacy && status.branding && status.tour,
      privacy: { text: privacy?.setting_value ?? "", version: Number(privacy?.version ?? 1) },
      branding,
      optional: { schoolCount: Number(schoolCount?.total ?? 0), officerCount: Number(officerCount?.total ?? 0) },
      companyAddress: new URL(request.url).origin,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load company setup" }, { status: 500 });
  }
}
