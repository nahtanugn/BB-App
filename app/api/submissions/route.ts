import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";

async function ensureSubmissionSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS award_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,
    submitted_by_user_id INTEGER NOT NULL,
    submitted_by_email TEXT NOT NULL,
    member_name TEXT NOT NULL,
    award_code TEXT NOT NULL,
    award_name TEXT NOT NULL,
    level TEXT NOT NULL,
    evidence_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    submitted_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT
  )`).run();
  const columns = await env.DB.prepare("PRAGMA table_info(award_submissions)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "member_id")) {
    await env.DB.prepare("ALTER TABLE award_submissions ADD COLUMN member_id INTEGER").run();
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role === "nco") return Response.json({ error: "NCO accounts cannot access award submissions" }, { status: 403 });
    await ensureSubmissionSchema();
    const awards = await env.DB.prepare("SELECT code, name, category, basic_available, advanced_available FROM award_definitions WHERE code NOT IN ('arts_crafts_hobbies', 'band_proficiency', 'scholastic') ORDER BY sort_order").all();
    if (user.role === "member") {
      const member = await env.DB.prepare("SELECT id, name FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(user.email).first<{ id: number; name: string }>();
      if (!member) return Response.json({ error: "Your account is not linked to a member profile" }, { status: 409 });
      const submissions = await env.DB.prepare("SELECT * FROM award_submissions WHERE member_id = ? ORDER BY submitted_at DESC").bind(member.id).all();
      return Response.json({ awards: awards.results, submissions: submissions.results, member });
    }
    const memberId = Number(new URL(request.url).searchParams.get("memberId"));
    if (!memberId) return Response.json({ error: "Select a member to view submissions" }, { status: 400 });
    const member = await env.DB.prepare("SELECT id, name FROM members WHERE id = ?").bind(memberId).first<{ id: number; name: string }>();
    if (!member) return Response.json({ error: "Member profile not found" }, { status: 404 });
    const submissions = await env.DB.prepare("SELECT * FROM award_submissions WHERE member_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, submitted_at DESC").bind(member.id).all();
    return Response.json({ awards: awards.results, submissions: submissions.results, member });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load award submissions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role === "nco") return Response.json({ error: "NCO accounts cannot access award submissions" }, { status: 403 });
    await ensureSubmissionSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create_submission") {
      if (user.role !== "member") return Response.json({ error: "Only member accounts can submit award applications" }, { status: 403 });
      const memberName = user.name.trim();
      const awardCode = String(body.awardCode ?? "");
      const level = String(body.level ?? "basic");
      const evidenceUrl = String(body.evidenceUrl ?? "").trim();
      const notes = String(body.notes ?? "").trim();
      if (!memberName || !awardCode || !["basic", "advanced"].includes(level)) {
        return Response.json({ error: "Member name, award, and level are required" }, { status: 400 });
      }
      if (evidenceUrl) {
        let parsed: URL;
        try { parsed = new URL(evidenceUrl); } catch { return Response.json({ error: "Enter a valid evidence link" }, { status: 400 }); }
        if (!["http:", "https:"].includes(parsed.protocol)) return Response.json({ error: "Enter a valid web link" }, { status: 400 });
      }
      const award = await env.DB.prepare("SELECT code, name, basic_available, advanced_available FROM award_definitions WHERE code = ?")
        .bind(awardCode).first<{ code: string; name: string; basic_available: number; advanced_available: number }>();
      if (!award || (level === "basic" ? !award.basic_available : !award.advanced_available)) {
        return Response.json({ error: "That award level is not available" }, { status: 400 });
      }
      const member = await env.DB.prepare("SELECT id, name FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1").bind(user.email).first<{ id: number; name: string }>();
      if (!member) return Response.json({ error: "Your account is not linked to a member profile" }, { status: 409 });
      const pending = await env.DB.prepare("SELECT id FROM award_submissions WHERE member_id = ? AND award_code = ? AND level = ? AND status = 'pending'")
        .bind(member.id, awardCode, level).first();
      if (pending) return Response.json({ error: "You already have a pending submission for this award level" }, { status: 409 });
      await env.DB.prepare(`INSERT INTO award_submissions
        (member_id, submitted_by_user_id, submitted_by_email, member_name, award_code, award_name, level, evidence_url, notes, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
        .bind(member.id, user.id, user.email, member.name || memberName, award.code, award.name, level, evidenceUrl, notes, new Date().toISOString()).run();
      return Response.json({ ok: true });
    }

    if (action === "review_submission") {
      if (user.role !== "admin" && user.role !== "officer") return Response.json({ error: "Officer access required" }, { status: 403 });
      const submissionId = Number(body.submissionId);
      const status = String(body.status ?? "");
      if (!submissionId || !["approved", "rejected"].includes(status)) return Response.json({ error: "Invalid review" }, { status: 400 });
      await env.DB.prepare("UPDATE award_submissions SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?")
        .bind(status, new Date().toISOString(), user.email, submissionId).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update award submissions" }, { status: 500 });
  }
}
