import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import {
  guideAccessSummary,
  guideForRoute,
  guideUiCopy,
  normaliseGuideLanguage,
} from "../../../lib/bb-guide";

async function ensureGuideSchema() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bb_guide_preferences (
      user_id INTEGER PRIMARY KEY,
      language TEXT NOT NULL DEFAULT 'en',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bb_guide_progress (
      user_id INTEGER NOT NULL,
      guide_key TEXT NOT NULL,
      completed_step INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, guide_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_bb_guide_progress_user ON bb_guide_progress(user_id, updated_at)"),
  ]);
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureGuideSchema();
    const url = new URL(request.url);
    const preference = await env.DB.prepare("SELECT language FROM bb_guide_preferences WHERE user_id = ?")
      .bind(user.id).first<{ language: string }>();
    const language = normaliseGuideLanguage(url.searchParams.get("language") ?? preference?.language);
    const guide = guideForRoute(url.searchParams.get("route") ?? "home", language);
    const progress = await env.DB.prepare("SELECT completed_step, completed_at FROM bb_guide_progress WHERE user_id = ? AND guide_key = ?")
      .bind(user.id, guide.key).first<{ completed_step: number; completed_at: string | null }>();
    return Response.json({
      language,
      guide,
      ui: guideUiCopy[language],
      accessSummary: guideAccessSummary(user.role, language, {
        squad: user.squad,
        section: user.member_section,
        hasCustomAccess: user.custom_permissions.length > 0,
      }),
      completedStep: Math.min(Number(progress?.completed_step ?? 0), guide.steps.length),
      completedAt: progress?.completed_at ?? null,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load BB Guide" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureGuideSchema();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date().toISOString();
    if (action === "set_language") {
      const language = normaliseGuideLanguage(body.language);
      await env.DB.prepare(`INSERT INTO bb_guide_preferences (user_id, language, updated_at)
        VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET language = excluded.language, updated_at = excluded.updated_at`)
        .bind(user.id, language, now).run();
      return Response.json({ ok: true, language, message: "Guide language saved." });
    }
    const route = String(body.route ?? "home");
    const language = normaliseGuideLanguage(body.language);
    const guide = guideForRoute(route, language);
    if (action === "complete_step") {
      const requested = Math.max(0, Math.min(guide.steps.length, Number(body.step) || 0));
      const current = await env.DB.prepare("SELECT completed_step FROM bb_guide_progress WHERE user_id = ? AND guide_key = ?")
        .bind(user.id, guide.key).first<{ completed_step: number }>();
      const completedStep = Math.max(Number(current?.completed_step ?? 0), requested);
      await env.DB.prepare(`INSERT INTO bb_guide_progress
        (user_id, guide_key, completed_step, completed_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, guide_key) DO UPDATE SET
          completed_step = excluded.completed_step,
          completed_at = excluded.completed_at,
          updated_at = excluded.updated_at`)
        .bind(user.id, guide.key, completedStep, completedStep >= guide.steps.length ? now : null, now).run();
      return Response.json({ ok: true, completedStep, message: "Guide progress updated." });
    }
    if (action === "reset_guide") {
      await env.DB.prepare("DELETE FROM bb_guide_progress WHERE user_id = ? AND guide_key = ?")
        .bind(user.id, guide.key).run();
      return Response.json({ ok: true, completedStep: 0, message: "Guide restarted." });
    }
    return Response.json({ error: "Unknown guide action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update BB Guide" }, { status: 500 });
  }
}
