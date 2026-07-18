import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";

type AwardSeed = {
  code: string;
  name: string;
  category: string;
  basic: number;
  advanced: number;
};

const awards: AwardSeed[] = [
  { code: "target", name: "Target", category: "Compulsory", basic: 1, advanced: 0 },
  { code: "christian_education", name: "Christian Education", category: "Compulsory", basic: 1, advanced: 1 },
  { code: "drill", name: "Drill", category: "Compulsory", basic: 1, advanced: 1 },
  { code: "recruitment", name: "Recruitment", category: "Compulsory", basic: 1, advanced: 1 },
  { code: "arts_crafts_hobbies", name: "Arts, Crafts & Hobbies", category: "A · Interest", basic: 1, advanced: 1 },
  { code: "band_proficiency", name: "Band Proficiency", category: "A · Interest", basic: 1, advanced: 1 },
  { code: "communication", name: "Communication", category: "A · Interest", basic: 1, advanced: 1 },
  { code: "computer_knowledge", name: "Computer Knowledge", category: "A · Interest", basic: 1, advanced: 1 },
  { code: "international_relations", name: "International Relations", category: "A · Interest", basic: 1, advanced: 1 },
  { code: "nature_awareness", name: "Nature Awareness", category: "A · Interest", basic: 1, advanced: 1 },
  { code: "financial_stewardship", name: "Financial Stewardship", category: "A · Interest", basic: 1, advanced: 1 },
  { code: "camping", name: "Camping", category: "B · Adventure", basic: 1, advanced: 1 },
  { code: "expedition", name: "Expedition", category: "B · Adventure", basic: 1, advanced: 1 },
  { code: "water_adventure", name: "Water Adventure", category: "B · Adventure", basic: 1, advanced: 1 },
  { code: "citizenship", name: "Citizenship", category: "C · Community", basic: 1, advanced: 1 },
  { code: "community_service", name: "Community Service", category: "C · Community", basic: 1, advanced: 1 },
  { code: "environmental_conservation", name: "Environmental Conservation", category: "C · Community", basic: 1, advanced: 1 },
  { code: "fire_rescue", name: "Fire & Rescue", category: "C · Community", basic: 1, advanced: 1 },
  { code: "first_aid", name: "First Aid", category: "C · Community", basic: 1, advanced: 1 },
  { code: "life_saving", name: "Life Saving", category: "C · Community", basic: 1, advanced: 1 },
  { code: "safety", name: "Safety", category: "C · Community", basic: 1, advanced: 1 },
  { code: "sustainability", name: "Sustainability", category: "C · Community", basic: 1, advanced: 1 },
  { code: "social_entrepreneurship", name: "Social Entrepreneurship", category: "C · Community", basic: 1, advanced: 1 },
  { code: "athletics", name: "Athletics", category: "D · Physical", basic: 1, advanced: 1 },
  { code: "gymnastics", name: "Gymnastics", category: "D · Physical", basic: 1, advanced: 1 },
  { code: "physical_training", name: "Physical Training", category: "D · Physical", basic: 1, advanced: 1 },
  { code: "sports", name: "Sports", category: "D · Physical", basic: 1, advanced: 1 },
  { code: "swimming", name: "Swimming", category: "D · Physical", basic: 1, advanced: 1 },
  { code: "nco_proficiency", name: "NCO Proficiency", category: "Special", basic: 1, advanced: 1 },
  { code: "presidents_award", name: "President's Award", category: "Special", basic: 1, advanced: 0 },
  { code: "founders_award", name: "Founder's Award", category: "Special", basic: 1, advanced: 0 },
  { code: "scholastic", name: "Scholastic Award", category: "Special", basic: 1, advanced: 1 },
  { code: "duke_of_edinburgh", name: "Duke of Edinburgh Award", category: "Special", basic: 1, advanced: 1 },
  { code: "cross_of_heroism", name: "Cross of Heroism", category: "Special", basic: 1, advanced: 0 },
  { code: "gallant_conduct", name: "Diploma for Gallant Conduct", category: "Special", basic: 1, advanced: 0 },
  { code: "one_year_service", name: "One-Year Service", category: "Service", basic: 1, advanced: 0 },
  { code: "three_year_service", name: "Three-Year Service", category: "Service", basic: 1, advanced: 0 },
  { code: "long_year_service", name: "Long-Year Service", category: "Service", basic: 1, advanced: 0 },
];

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  const db = env.DB;
  if (!db) throw new Error("The shared database is not available.");

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rank TEXT NOT NULL DEFAULT 'Private',
      squad TEXT NOT NULL DEFAULT 'Unassigned',
      joined_at TEXT NOT NULL,
      service_years INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS award_definitions (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      basic_available INTEGER NOT NULL DEFAULT 1,
      advanced_available INTEGER NOT NULL DEFAULT 1
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS member_awards (
      member_id INTEGER NOT NULL,
      award_code TEXT NOT NULL,
      level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      awarded_at TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (member_id, award_code, level),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (award_code) REFERENCES award_definitions(code) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS member_awards_member_idx ON member_awards(member_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_date TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Weekly Parade',
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS attendance_records (
      session_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unmarked',
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (session_id, member_id),
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS attendance_records_member_idx ON attendance_records(member_id)"),
  ]);

  await db.batch(
    awards.map((award, index) =>
      db
        .prepare(`INSERT OR IGNORE INTO award_definitions
          (code, name, category, sort_order, basic_available, advanced_available)
          VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(award.code, award.name, award.category, index, award.basic, award.advanced),
    ),
  );

  const count = await db.prepare("SELECT COUNT(*) AS total FROM members").first<{ total: number }>();
  if (!count?.total) {
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO members (name, rank, squad, joined_at, service_years, is_demo, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
        .bind("Alicia Tan", "Sergeant", "Anchor", "2022-01-15", 4, now),
      db.prepare("INSERT INTO members (name, rank, squad, joined_at, service_years, is_demo, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
        .bind("Daniel Lim", "Corporal", "Anchor", "2023-02-04", 3, now),
      db.prepare("INSERT INTO members (name, rank, squad, joined_at, service_years, is_demo, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
        .bind("Megan Lee", "Lance Corporal", "Stedfast", "2024-01-20", 2, now),
      db.prepare("INSERT INTO members (name, rank, squad, joined_at, service_years, is_demo, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
        .bind("Joshua Wong", "Private", "Stedfast", "2025-01-18", 1, now),
    ]);
  }
  initialized = true;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureSchema();
    const db = env.DB;
    const [memberResult, awardResult, progressResult, sessionResult, attendanceResult] = await Promise.all([
      db.prepare("SELECT * FROM members ORDER BY name COLLATE NOCASE").all(),
      db.prepare("SELECT * FROM award_definitions ORDER BY sort_order").all(),
      db.prepare("SELECT * FROM member_awards").all(),
      db.prepare("SELECT * FROM attendance_sessions ORDER BY meeting_date DESC, id DESC").all(),
      db.prepare("SELECT * FROM attendance_records").all(),
    ]);
    return Response.json({
      members: memberResult.results,
      awards: awardResult.results,
      progress: progressResult.results,
      attendanceSessions: sessionResult.results,
      attendance: attendanceResult.results,
      syllabus: "BB Malaysia Members' Handbook · August 2024",
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load tracker" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureSchema();
    const db = env.DB;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create_member") {
      const name = String(body.name ?? "").trim();
      if (!name) return Response.json({ error: "Member name is required" }, { status: 400 });
      await db.prepare(`INSERT INTO members
        (name, rank, squad, joined_at, service_years, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)`)
        .bind(
          name,
          String(body.rank ?? "Private"),
          String(body.squad ?? "Unassigned"),
          String(body.joinedAt ?? new Date().toISOString().slice(0, 10)),
          Math.max(0, Number(body.serviceYears ?? 0)),
          new Date().toISOString(),
        ).run();
    } else if (action === "update_member") {
      const memberId = Number(body.memberId);
      const name = String(body.name ?? "").trim();
      if (!memberId || !name) return Response.json({ error: "Valid member details are required" }, { status: 400 });
      await db.prepare(`UPDATE members SET name = ?, rank = ?, squad = ?, joined_at = ?, service_years = ? WHERE id = ?`)
        .bind(
          name,
          String(body.rank ?? "Private"),
          String(body.squad ?? "Unassigned"),
          String(body.joinedAt ?? new Date().toISOString().slice(0, 10)),
          Math.max(0, Number(body.serviceYears ?? 0)),
          memberId,
        ).run();
    } else if (action === "update_award") {
      const memberId = Number(body.memberId);
      const awardCode = String(body.awardCode ?? "");
      const level = String(body.level ?? "basic");
      const status = String(body.status ?? "not_started");
      const allowed = ["not_started", "in_progress", "submitted", "verified", "awarded"];
      if (!memberId || !awardCode || !allowed.includes(status)) {
        return Response.json({ error: "Invalid award update" }, { status: 400 });
      }
      const now = new Date().toISOString();
      await db.prepare(`INSERT INTO member_awards
        (member_id, award_code, level, status, awarded_at, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(member_id, award_code, level) DO UPDATE SET
          status = excluded.status,
          awarded_at = excluded.awarded_at,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by`)
        .bind(memberId, awardCode, level, status, status === "awarded" ? now : null, now, user.email).run();
    } else if (action === "delete_member") {
      const memberId = Number(body.memberId);
      if (!memberId) return Response.json({ error: "Invalid member" }, { status: 400 });
      await db.prepare("DELETE FROM member_awards WHERE member_id = ?").bind(memberId).run();
      await db.prepare("DELETE FROM attendance_records WHERE member_id = ?").bind(memberId).run();
      await db.prepare("DELETE FROM members WHERE id = ?").bind(memberId).run();
    } else if (action === "create_attendance_session") {
      const meetingDate = String(body.meetingDate ?? "");
      const title = String(body.title ?? "Weekly Parade").trim() || "Weekly Parade";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) return Response.json({ error: "A valid meeting date is required" }, { status: 400 });
      await db.prepare("INSERT INTO attendance_sessions (meeting_date, title, created_at) VALUES (?, ?, ?)")
        .bind(meetingDate, title, new Date().toISOString()).run();
    } else if (action === "update_attendance") {
      const sessionId = Number(body.sessionId);
      const memberId = Number(body.memberId);
      const status = String(body.status ?? "unmarked");
      const allowed = ["unmarked", "present", "absent", "excused"];
      if (!sessionId || !memberId || !allowed.includes(status)) return Response.json({ error: "Invalid attendance update" }, { status: 400 });
      const now = new Date().toISOString();
      await db.prepare(`INSERT INTO attendance_records (session_id, member_id, status, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id, member_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
        .bind(sessionId, memberId, status, now, user.email).run();
    } else if (action === "delete_attendance_session") {
      const sessionId = Number(body.sessionId);
      if (!sessionId) return Response.json({ error: "Invalid attendance session" }, { status: 400 });
      await db.prepare("DELETE FROM attendance_records WHERE session_id = ?").bind(sessionId).run();
      await db.prepare("DELETE FROM attendance_sessions WHERE id = ?").bind(sessionId).run();
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save changes" }, { status: 500 });
  }
}
