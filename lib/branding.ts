import { env } from "cloudflare:workers";

export type AppBranding = {
  appName: string;
  shortName: string;
  companyName: string;
  subtitle: string;
  logoUrl: string;
  updatedAt: string;
};

export const DEFAULT_BRANDING: AppBranding = {
  appName: "BB App",
  shortName: "BB App",
  companyName: "Your BB Company",
  subtitle: "BB Section Tracker",
  logoUrl: "/default-bb-logo.png",
  updatedAt: "",
};

export async function ensureBrandingSchema(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS app_branding (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    app_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    logo_data_url TEXT,
    updated_by_user_id INTEGER,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare(`INSERT INTO app_branding
    (id, app_name, short_name, company_name, subtitle, updated_at)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`)
    .bind(DEFAULT_BRANDING.appName, DEFAULT_BRANDING.shortName, DEFAULT_BRANDING.companyName, DEFAULT_BRANDING.subtitle, new Date().toISOString())
    .run();
}

export async function getBranding(): Promise<AppBranding> {
  try {
    await ensureBrandingSchema(env.DB);
    const row = await env.DB.prepare("SELECT app_name, short_name, company_name, subtitle, logo_data_url, updated_at FROM app_branding WHERE id = 1")
      .first<{ app_name: string; short_name: string; company_name: string; subtitle: string; logo_data_url: string | null; updated_at: string }>();
    if (!row) return DEFAULT_BRANDING;
    return {
      appName: row.app_name,
      shortName: row.short_name,
      companyName: row.company_name,
      subtitle: row.subtitle,
      logoUrl: row.logo_data_url ? `/api/branding?logo=1&v=${encodeURIComponent(row.updated_at)}` : DEFAULT_BRANDING.logoUrl,
      updatedAt: row.updated_at,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}
