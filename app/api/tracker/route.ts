import { env } from "cloudflare:workers";
import {
  getCurrentUser,
  hasOperationalAdminAccess,
  hasTemporaryAdminAccess,
} from "../../../lib/auth";

type AwardSeed = {
  code: string;
  name: string;
  category: string;
  basic: number;
  advanced: number;
};

const awards: AwardSeed[] = [
  {
    code: "target",
    name: "Target",
    category: "Compulsory",
    basic: 1,
    advanced: 0,
  },
  {
    code: "christian_education",
    name: "Christian Education",
    category: "Compulsory",
    basic: 1,
    advanced: 1,
  },
  {
    code: "drill",
    name: "Drill",
    category: "Compulsory",
    basic: 1,
    advanced: 1,
  },
  {
    code: "recruitment",
    name: "Recruitment",
    category: "Compulsory",
    basic: 1,
    advanced: 1,
  },
  {
    code: "arts",
    name: "Arts",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "crafts",
    name: "Crafts",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "hobbies",
    name: "Hobbies",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "bandsman",
    name: "Bandsman",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "bugler",
    name: "Bugler",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "drummer",
    name: "Drummer",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "piper",
    name: "Piper",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "communication",
    name: "Communication",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "computer_knowledge",
    name: "Computer Knowledge",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "international_relations",
    name: "International Relations",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "nature_awareness",
    name: "Nature Awareness",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "financial_stewardship",
    name: "Financial Stewardship",
    category: "A · Interest",
    basic: 1,
    advanced: 1,
  },
  {
    code: "camping",
    name: "Camping",
    category: "B · Adventure",
    basic: 1,
    advanced: 1,
  },
  {
    code: "expedition",
    name: "Expedition",
    category: "B · Adventure",
    basic: 1,
    advanced: 1,
  },
  {
    code: "water_adventure",
    name: "Water Adventure",
    category: "B · Adventure",
    basic: 1,
    advanced: 1,
  },
  {
    code: "citizenship",
    name: "Citizenship",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "community_service",
    name: "Community Service",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "environmental_conservation",
    name: "Environmental Conservation",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "fire_rescue",
    name: "Fire & Rescue",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "first_aid",
    name: "First Aid",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "life_saving",
    name: "Life Saving",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "safety",
    name: "Safety",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "sustainability",
    name: "Sustainability",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "social_entrepreneurship",
    name: "Social Entrepreneurship",
    category: "C · Community",
    basic: 1,
    advanced: 1,
  },
  {
    code: "athletics",
    name: "Athletics",
    category: "D · Physical",
    basic: 1,
    advanced: 1,
  },
  {
    code: "gymnastics",
    name: "Gymnastics",
    category: "D · Physical",
    basic: 1,
    advanced: 1,
  },
  {
    code: "physical_training",
    name: "Physical Training",
    category: "D · Physical",
    basic: 1,
    advanced: 1,
  },
  {
    code: "sports",
    name: "Sports",
    category: "D · Physical",
    basic: 1,
    advanced: 1,
  },
  {
    code: "swimming",
    name: "Swimming",
    category: "D · Physical",
    basic: 1,
    advanced: 1,
  },
  {
    code: "nco_proficiency",
    name: "NCO Proficiency Star",
    category: "Special",
    basic: 1,
    advanced: 1,
  },
  {
    code: "presidents_award",
    name: "President's Award",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "founders_award",
    name: "Founder's Award",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "gold_award",
    name: "Gold Award",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "scholastics_bronze",
    name: "Scholastics Bronze",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "scholastics_silver",
    name: "Scholastics Silver",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "scholastics_gold",
    name: "Scholastics Gold",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "duke_of_edinburgh_bronze",
    name: "Duke of Edinburgh Bronze",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "duke_of_edinburgh_silver",
    name: "Duke of Edinburgh Silver",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "duke_of_edinburgh_gold",
    name: "Duke of Edinburgh Gold",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "cross_of_heroism",
    name: "Cross of Heroism",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "gallant_conduct",
    name: "Diploma for Gallant Conduct",
    category: "Special",
    basic: 1,
    advanced: 0,
  },
  {
    code: "one_year_service",
    name: "One-Year Service Awards",
    category: "Service",
    basic: 1,
    advanced: 0,
  },
  {
    code: "three_year_service",
    name: "Three-Year Service",
    category: "Service",
    basic: 1,
    advanced: 0,
  },
  {
    code: "long_year_service",
    name: "Long-Year Service",
    category: "Service",
    basic: 1,
    advanced: 0,
  },
];
const juniorAwards: AwardSeed[] = [
  "White",
  "Green",
  "Purple",
  "Blue",
  "Red",
  "Silver",
  "Gold",
].map((name) => ({
  code: `junior_${name.toLowerCase()}`,
  name: `${name} Award`,
  category: "Junior Awards",
  basic: 1,
  advanced: 0,
}));
const allowedSquads = ["Alpha", "Bravo", "Charlie", "Delta"];
const allowedSections = ["senior", "junior"];

function calculateServiceYears(joinedAt: string, today = new Date()) {
  const match = /^(\d{4})/.exec(joinedAt);
  if (!match) return 0;
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Kuching",
      year: "numeric",
    }).format(today),
  );
  return Math.max(0, currentYear - Number(match[1]));
}

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
      section TEXT NOT NULL DEFAULT 'senior',
      joined_at TEXT NOT NULL,
      service_years INTEGER NOT NULL DEFAULT 0,
      service_award_count INTEGER NOT NULL DEFAULT 0,
      band_member INTEGER NOT NULL DEFAULT 0,
      school TEXT NOT NULL DEFAULT '',
      contact_number TEXT NOT NULL DEFAULT '',
      emergency_contact_number TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      parents_name TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS award_definitions (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT 'senior',
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
    db.prepare(
      "CREATE INDEX IF NOT EXISTS member_awards_member_idx ON member_awards(member_id)",
    ),
    db.prepare(`CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_date TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Weekly Parade',
      section TEXT NOT NULL DEFAULT 'senior',
      audience TEXT NOT NULL DEFAULT 'section_members',
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
    db.prepare(
      "CREATE INDEX IF NOT EXISTS attendance_records_member_idx ON attendance_records(member_id)",
    ),
    db.prepare(`CREATE TABLE IF NOT EXISTS member_subscriptions (
      member_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (member_id, year),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS member_subscriptions_year_idx ON member_subscriptions(year)",
    ),
    db.prepare(`CREATE TABLE IF NOT EXISTS band_subscriptions (
      member_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (member_id, year),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS band_subscriptions_year_idx ON band_subscriptions(year)",
    ),
  ]);

  const memberColumns = await db
    .prepare("PRAGMA table_info(members)")
    .all<{ name: string }>();
  const existingMemberColumns = new Set(
    memberColumns.results.map((column) => column.name),
  );
  const missingMemberColumns = [
    [
      "school",
      "ALTER TABLE members ADD COLUMN school TEXT NOT NULL DEFAULT ''",
    ],
    [
      "contact_number",
      "ALTER TABLE members ADD COLUMN contact_number TEXT NOT NULL DEFAULT ''",
    ],
    [
      "emergency_contact_number",
      "ALTER TABLE members ADD COLUMN emergency_contact_number TEXT NOT NULL DEFAULT ''",
    ],
    ["email", "ALTER TABLE members ADD COLUMN email TEXT NOT NULL DEFAULT ''"],
    [
      "parents_name",
      "ALTER TABLE members ADD COLUMN parents_name TEXT NOT NULL DEFAULT ''",
    ],
    [
      "service_award_count",
      "ALTER TABLE members ADD COLUMN service_award_count INTEGER NOT NULL DEFAULT 0",
    ],
    [
      "band_member",
      "ALTER TABLE members ADD COLUMN band_member INTEGER NOT NULL DEFAULT 0",
    ],
  ].filter(([column]) => !existingMemberColumns.has(column));
  if (missingMemberColumns.length) {
    await db.batch(
      missingMemberColumns.map(([, statement]) => db.prepare(statement)),
    );
  }

  // Preserve completed legacy service records when moving to a numeric count.
  await db
    .prepare(
      `UPDATE members SET service_award_count = MAX(
        service_award_count,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM member_awards
            WHERE member_awards.member_id = members.id
              AND member_awards.award_code = 'three_year_service'
              AND member_awards.status = 'awarded'
          ) THEN 3
          WHEN EXISTS (
            SELECT 1 FROM member_awards
            WHERE member_awards.member_id = members.id
              AND member_awards.award_code = 'one_year_service'
              AND member_awards.status = 'awarded'
          ) THEN 1
          ELSE 0
        END
      )`,
    )
    .run();

  const sectionColumns = await Promise.all([
    db.prepare("PRAGMA table_info(members)").all<{ name: string }>(),
    db.prepare("PRAGMA table_info(award_definitions)").all<{ name: string }>(),
    db
      .prepare("PRAGMA table_info(attendance_sessions)")
      .all<{ name: string }>(),
  ]);
  const sectionMigrations = [
    [
      sectionColumns[0],
      "ALTER TABLE members ADD COLUMN section TEXT NOT NULL DEFAULT 'senior'",
    ],
    [
      sectionColumns[1],
      "ALTER TABLE award_definitions ADD COLUMN section TEXT NOT NULL DEFAULT 'senior'",
    ],
    [
      sectionColumns[2],
      "ALTER TABLE attendance_sessions ADD COLUMN section TEXT NOT NULL DEFAULT 'senior'",
    ],
  ] as const;
  for (const [columns, statement] of sectionMigrations) {
    if (!columns.results.some((column) => column.name === "section"))
      await db.prepare(statement).run();
  }
  const attendanceColumns = sectionColumns[2];
  if (!attendanceColumns.results.some((column) => column.name === "audience"))
    await db.prepare("ALTER TABLE attendance_sessions ADD COLUMN audience TEXT NOT NULL DEFAULT 'section_members'").run();

  await db.batch(
    awards.map((award, index) =>
      db
        .prepare(
          `INSERT INTO award_definitions
          (code, name, category, section, sort_order, basic_available, advanced_available)
          VALUES (?, ?, ?, 'senior', ?, ?, ?)
          ON CONFLICT(code) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            sort_order = excluded.sort_order,
            basic_available = excluded.basic_available,
            advanced_available = excluded.advanced_available`,
        )
        .bind(
          award.code,
          award.name,
          award.category,
          index,
          award.basic,
          award.advanced,
        ),
    ),
  );

  await db.batch(
    juniorAwards.map((award, index) =>
      db
        .prepare(
          `INSERT INTO award_definitions
        (code, name, category, section, sort_order, basic_available, advanced_available)
        VALUES (?, ?, ?, 'junior', ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET name = excluded.name, category = excluded.category,
          section = excluded.section, sort_order = excluded.sort_order,
          basic_available = excluded.basic_available, advanced_available = excluded.advanced_available`,
        )
        .bind(
          award.code,
          award.name,
          award.category,
          index,
          award.basic,
          award.advanced,
        ),
    ),
  );

  // Preserve legacy Duke of Edinburgh progress when splitting it into
  // Bronze, Silver, and Gold records. Existing new-format records win.
  await db.batch([
    db.prepare(
      `INSERT INTO member_awards
      (member_id, award_code, level, status, updated_at, updated_by)
      SELECT member_id, 'duke_of_edinburgh_bronze', 'basic', status, updated_at, updated_by
      FROM member_awards
      WHERE award_code = 'duke_of_edinburgh' AND level = 'basic'
      ON CONFLICT(member_id, award_code, level) DO NOTHING`,
    ),
    db.prepare(
      `INSERT INTO member_awards
      (member_id, award_code, level, status, updated_at, updated_by)
      SELECT member_id, 'duke_of_edinburgh_silver', 'basic', status, updated_at, updated_by
      FROM member_awards
      WHERE award_code = 'duke_of_edinburgh' AND level = 'advanced'
      ON CONFLICT(member_id, award_code, level) DO NOTHING`,
    ),
  ]);

  await db
    .prepare(
      `DELETE FROM award_definitions
    WHERE code IN ('arts_crafts_hobbies', 'band_proficiency', 'scholastic', 'duke_of_edinburgh')
    AND NOT EXISTS (SELECT 1 FROM member_awards WHERE member_awards.award_code = award_definitions.code)`,
    )
    .run();

  initialized = true;
}

async function getSubmissionNotifications(section: string) {
  try {
    const submissionColumns = await env.DB.prepare(
      "PRAGMA table_info(award_submissions)",
    ).all<{ name: string }>();
    if (
      submissionColumns.results.length &&
      !submissionColumns.results.some((column) => column.name === "archived_at")
    ) {
      try {
        await env.DB.prepare(
          "ALTER TABLE award_submissions ADD COLUMN archived_at TEXT",
        ).run();
      } catch {
        // Another request may have added the column concurrently.
      }
    }
    const result = await env.DB.prepare(
      `SELECT
      members.id AS member_id,
      members.name AS member_name,
      COUNT(award_submissions.id) AS pending_count,
      MAX(award_submissions.submitted_at) AS latest_submitted_at
      FROM award_submissions
      INNER JOIN members ON members.id = award_submissions.member_id
      WHERE award_submissions.status = 'pending'
      AND award_submissions.archived_at IS NULL
      AND members.section = ?
      GROUP BY members.id, members.name
      ORDER BY latest_submitted_at DESC`,
    )
      .bind(section)
      .all();
    return result.results;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const hasTemporaryAccess = hasTemporaryAdminAccess(user);
    const trackerPermissions = user.custom_permissions.filter((permission) =>
      ["members.", "attendance.", "awards.", "subscriptions.", "exports."].some(
        (prefix) => permission.startsWith(prefix),
      ),
    );
    if (
      user.role === "member" &&
      !hasTemporaryAccess &&
      !trackerPermissions.length
    )
      return Response.json(
        { error: "Member accounts can access resources only" },
        { status: 403 },
      );
    await ensureSchema();
    const db = env.DB;
    const requestedSection =
      new URL(request.url).searchParams.get("section") ?? "senior";
    const section = allowedSections.includes(requestedSection)
      ? requestedSection
      : "senior";
    const [memberResult, sessionResult, attendanceResult, subscriptionResult, bandSubscriptionResult] =
      await Promise.all([
      db
        .prepare(
          `SELECT members.*, COALESCE(users.role, '') AS account_role FROM members
           LEFT JOIN users ON LOWER(users.email) = LOWER(members.email)
           WHERE members.section = ? ORDER BY members.name COLLATE NOCASE`,
        )
        .bind(section)
        .all<{
          joined_at: string;
          service_years: number;
          [key: string]: unknown;
        }>(),
      db
        .prepare(
          "SELECT * FROM attendance_sessions WHERE section = ? ORDER BY meeting_date ASC, id ASC",
        )
        .bind(section)
        .all(),
      ["nco", "squad_leader"].includes(user.role) && !hasTemporaryAccess
        ? db
            .prepare(
              `SELECT ar.session_id, ar.member_id, ar.status
              FROM attendance_records ar
              INNER JOIN attendance_sessions s ON s.id = ar.session_id
              INNER JOIN members m ON m.id = ar.member_id
              WHERE s.section = ? AND m.section = ? AND m.squad = ?`,
            )
            .bind(section, section, user.squad)
            .all()
        : db
            .prepare(
              "SELECT ar.* FROM attendance_records ar INNER JOIN attendance_sessions s ON s.id = ar.session_id WHERE s.section = ?",
            )
            .bind(section)
            .all(),
      db
        .prepare(
          "SELECT ms.member_id, ms.year, ms.paid FROM member_subscriptions ms INNER JOIN members m ON m.id = ms.member_id WHERE m.section = ? ORDER BY ms.year DESC, m.name COLLATE NOCASE",
        )
        .bind(section)
        .all(),
      db
        .prepare(
          "SELECT bs.member_id, bs.year, bs.status FROM band_subscriptions bs INNER JOIN members m ON m.id = bs.member_id WHERE m.section = ? ORDER BY bs.year DESC, m.name COLLATE NOCASE",
        )
        .bind(section)
        .all(),
    ]);
    const members = memberResult.results.map((member) => ({
      ...member,
      service_years: calculateServiceYears(member.joined_at),
    }));
    const [awardResult, progressResult, submissionNotifications] =
      await Promise.all([
        db
          .prepare(
            "SELECT * FROM award_definitions WHERE section = ? AND code NOT IN ('arts_crafts_hobbies', 'band_proficiency', 'scholastic', 'duke_of_edinburgh', 'three_year_service', 'long_year_service') ORDER BY sort_order",
          )
          .bind(section)
          .all(),
        db
          .prepare(
            "SELECT ma.member_id, ma.award_code, ma.level, ma.status FROM member_awards ma INNER JOIN members m ON m.id = ma.member_id WHERE m.section = ? AND ma.award_code != 'duke_of_edinburgh'",
          )
          .bind(section)
          .all(),
        getSubmissionNotifications(section),
      ]);
    return Response.json({
      members,
      awards: awardResult.results,
      progress: progressResult.results,
      submissionNotifications,
      attendanceSessions: sessionResult.results,
      attendance: attendanceResult.results,
      subscriptions: subscriptionResult.results,
      bandSubscriptions: bandSubscriptionResult.results,
      syllabus:
        section === "junior"
          ? "BB Malaysia Junior Section"
          : "BB Malaysia Members' Handbook · August 2024",
      section,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load tracker",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.role === "viewer")
      return Response.json(
        { error: "Viewer accounts have read-only access" },
        { status: 403 },
      );
    const hasTemporaryAccess = hasTemporaryAdminAccess(user);
    await ensureSchema();
    const db = env.DB;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const requiredPermission: Record<string, string> = {
      create_member: "members.create",
      update_member: "members.edit",
      delete_member: "members.delete",
      create_attendance_session: "attendance.manage",
      delete_attendance_session: "attendance.manage",
      update_attendance: "attendance.manage",
      update_award: "awards.manage",
      update_service_award_count: "awards.manage",
      update_subscription: "subscriptions.company.manage",
      update_band_subscription: "subscriptions.band.manage",
    };
    const customAllowsAction = Boolean(
      requiredPermission[action] &&
        user.custom_permissions.includes(requiredPermission[action]),
    );
    if (
      user.role === "member" &&
      !hasTemporaryAccess &&
      !customAllowsAction
    )
      return Response.json(
        { error: "This action has not been granted to your custom role" },
        { status: 403 },
      );
    const requestedSection = String(body.section ?? "senior");
    const section = allowedSections.includes(requestedSection)
      ? requestedSection
      : "senior";
    const canOverrideMemberDetails = hasOperationalAdminAccess(user);
    const overrideRequiredDetails =
      canOverrideMemberDetails && body.overrideRequiredDetails === true;
    if (
      ["nco", "squad_leader"].includes(user.role) &&
      !hasTemporaryAccess &&
      !customAllowsAction &&
      ![
        "create_member",
        "create_attendance_session",
        "update_attendance",
        "update_member",
      ].includes(action)
    ) {
      return Response.json(
        {
          error:
            "NCO and Squad Leader accounts can add or edit members and manage attendance only",
        },
        { status: 403 },
      );
    }

    if (action === "create_member") {
      const name = String(body.name ?? "").trim();
      const squad = String(body.squad ?? "Alpha");
      const joinedAt = String(
        body.joinedAt ?? new Date().getUTCFullYear(),
      );
      const school = String(body.school ?? "").trim();
      const contactNumber = String(body.contactNumber ?? "").trim();
      const emergencyContactNumber = String(
        body.emergencyContactNumber ?? "",
      ).trim();
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const parentsName = String(body.parentsName ?? "").trim();
      const bandMember = body.bandMember === true;
      if (!name)
        return Response.json(
          { error: "Member name is required" },
          { status: 400 },
        );
      if (!allowedSquads.includes(squad))
        return Response.json(
          { error: "Select Alpha, Bravo, Charlie, or Delta squad" },
          { status: 400 },
        );
      if (!/^\d{4}$/.test(joinedAt))
        return Response.json(
          { error: "Select a valid joining year" },
          { status: 400 },
        );
      const missingDetails = [
        ["School", school],
        ["Contact Number", contactNumber],
        ["Emergency Contact Number", emergencyContactNumber],
        ["Email", email],
        ["Parents Name", parentsName],
      ].filter(([, value]) => !value);
      if (missingDetails.length && !overrideRequiredDetails)
        return Response.json(
          {
            error: `Complete all member details. Missing: ${missingDetails.map(([label]) => label).join(", ")}. Only Admins, Temporary Admins and Officers can override this requirement.`,
          },
          { status: 400 },
        );
      await db
        .prepare(
          `INSERT INTO members
        (name, rank, squad, section, joined_at, service_years, band_member, school, contact_number, emergency_contact_number, email, parents_name, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .bind(
          name,
          String(body.rank ?? "Private"),
          squad,
          section,
          joinedAt,
          calculateServiceYears(joinedAt),
          bandMember ? 1 : 0,
          school,
          contactNumber,
          emergencyContactNumber,
          email,
          parentsName,
          new Date().toISOString(),
        )
        .run();
    } else if (action === "update_member") {
      const memberId = Number(body.memberId);
      const name = String(body.name ?? "").trim();
      const squad = String(body.squad ?? "Alpha");
      const joinedAt = String(
        body.joinedAt ?? new Date().getUTCFullYear(),
      );
      const school = String(body.school ?? "").trim();
      const contactNumber = String(body.contactNumber ?? "").trim();
      const emergencyContactNumber = String(
        body.emergencyContactNumber ?? "",
      ).trim();
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const parentsName = String(body.parentsName ?? "").trim();
      const bandMember = body.bandMember === true;
      if (!memberId || !name)
        return Response.json(
          { error: "Valid member details are required" },
          { status: 400 },
        );
      if (!allowedSquads.includes(squad))
        return Response.json(
          { error: "Select Alpha, Bravo, Charlie, or Delta squad" },
          { status: 400 },
        );
      if (!/^\d{4}$/.test(joinedAt))
        return Response.json(
          { error: "Select a valid joining year" },
          { status: 400 },
        );
      const missingDetails = [
        ["School", school],
        ["Contact Number", contactNumber],
        ["Emergency Contact Number", emergencyContactNumber],
        ["Email", email],
        ["Parents Name", parentsName],
      ].filter(([, value]) => !value);
      if (missingDetails.length && !overrideRequiredDetails)
        return Response.json(
          {
            error: `Complete all member details. Missing: ${missingDetails.map(([label]) => label).join(", ")}. Only Admins, Temporary Admins and Officers can override this requirement.`,
          },
          { status: 400 },
        );
      await db
        .prepare(
          `UPDATE members SET name = ?, rank = ?, squad = ?, joined_at = ?, service_years = ?, band_member = ?, school = ?, contact_number = ?, emergency_contact_number = ?, email = ?, parents_name = ? WHERE id = ? AND section = ?`,
        )
        .bind(
          name,
          String(body.rank ?? "Private"),
          squad,
          joinedAt,
          calculateServiceYears(joinedAt),
          bandMember ? 1 : 0,
          school,
          contactNumber,
          emergencyContactNumber,
          email,
          parentsName,
          memberId,
          section,
        )
        .run();
    } else if (action === "update_service_award_count") {
      const memberId = Number(body.memberId);
      const count = Number(body.count);
      if (!memberId || !Number.isInteger(count) || count < 0 || count > 20)
        return Response.json(
          { error: "Service award count must be between 0 and 20" },
          { status: 400 },
        );
      const result = await db
        .prepare(
          "UPDATE members SET service_award_count = ? WHERE id = ? AND section = ?",
        )
        .bind(count, memberId, section)
        .run();
      if (!result.meta.changes)
        return Response.json(
          { error: "Member not found in the selected section" },
          { status: 404 },
        );
    } else if (action === "update_subscription") {
      const memberId = Number(body.memberId);
      const year = Number(body.year);
      const paid = Boolean(body.paid);
      const currentYear = Number(
        new Intl.DateTimeFormat("en", {
          timeZone: "Asia/Kuching",
          year: "numeric",
        }).format(new Date()),
      );
      if (
        !memberId ||
        !Number.isInteger(year) ||
        year < 2000 ||
        year > currentYear + 1
      )
        return Response.json(
          { error: "Select a valid subscription year and member" },
          { status: 400 },
        );
      const validMember = await db
        .prepare("SELECT id FROM members WHERE id = ? AND section = ?")
        .bind(memberId, section)
        .first();
      if (!validMember)
        return Response.json(
          { error: "Member not found in the selected section" },
          { status: 404 },
        );
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO member_subscriptions
          (member_id, year, paid, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(member_id, year) DO UPDATE SET
            paid = excluded.paid,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by`,
        )
        .bind(memberId, year, paid ? 1 : 0, now, user.email)
        .run();
    } else if (action === "update_band_subscription") {
      const memberId = Number(body.memberId);
      const year = Number(body.year);
      const status = String(body.status ?? "unpaid");
      const currentYear = new Date().getUTCFullYear();
      if (
        !memberId ||
        !Number.isInteger(year) ||
        year < 2000 ||
        year > currentYear + 1 ||
        !["unpaid", "paid", "exempt"].includes(status)
      )
        return Response.json(
          { error: "Select a valid band subscription record" },
          { status: 400 },
        );
      const validMember = await db
        .prepare("SELECT id FROM members WHERE id = ? AND section = ? AND band_member = 1")
        .bind(memberId, section)
        .first();
      if (!validMember)
        return Response.json(
          { error: "This person is not marked as a band member" },
          { status: 400 },
        );
      const now = new Date().toISOString();
      await db.prepare(`INSERT INTO band_subscriptions
        (member_id, year, status, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(member_id, year) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by`)
        .bind(memberId, year, status, now, user.email)
        .run();
    } else if (action === "update_award") {
      const memberId = Number(body.memberId);
      const awardCode = String(body.awardCode ?? "");
      const level = String(body.level ?? "basic");
      const status = String(body.status ?? "not_started");
      const allowed = [
        "not_started",
        "in_progress",
        "submitted",
        "verified",
        "awarded",
      ];
      if (!memberId || !awardCode || !allowed.includes(status)) {
        return Response.json(
          { error: "Invalid award update" },
          { status: 400 },
        );
      }
      if (
        [
          "one_year_service",
          "three_year_service",
          "long_year_service",
        ].includes(awardCode)
      )
        return Response.json(
          { error: "Use the service award count for service awards" },
          { status: 400 },
        );
      const validAwardTarget = await db
        .prepare(
          `SELECT m.id FROM members m
        INNER JOIN award_definitions a ON a.code = ?
        WHERE m.id = ? AND m.section = ? AND a.section = ?`,
        )
        .bind(awardCode, memberId, section, section)
        .first();
      if (!validAwardTarget)
        return Response.json(
          { error: "Award and member must belong to the selected section" },
          { status: 400 },
        );
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO member_awards
        (member_id, award_code, level, status, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(member_id, award_code, level) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by`,
        )
        .bind(
          memberId,
          awardCode,
          level,
          status,
          now,
          user.email,
        )
        .run();
    } else if (action === "delete_member") {
      const memberId = Number(body.memberId);
      if (!memberId)
        return Response.json({ error: "Invalid member" }, { status: 400 });
      const validMember = await db
        .prepare("SELECT id FROM members WHERE id = ? AND section = ?")
        .bind(memberId, section)
        .first();
      if (!validMember)
        return Response.json(
          { error: "Member not found in the selected section" },
          { status: 404 },
        );
      await db
        .prepare("DELETE FROM member_awards WHERE member_id = ?")
        .bind(memberId)
        .run();
      await db
        .prepare("DELETE FROM attendance_records WHERE member_id = ?")
        .bind(memberId)
        .run();
      await db
        .prepare("DELETE FROM member_subscriptions WHERE member_id = ?")
        .bind(memberId)
        .run();
      await db
        .prepare("DELETE FROM band_subscriptions WHERE member_id = ?")
        .bind(memberId)
        .run();
      await db
        .prepare("DELETE FROM members WHERE id = ? AND section = ?")
        .bind(memberId, section)
        .run();
    } else if (action === "create_attendance_session") {
      const meetingDate = String(body.meetingDate ?? "");
      const title =
        String(body.title ?? "Weekly Parade").trim() || "Weekly Parade";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate))
        return Response.json(
          { error: "A valid meeting date is required" },
          { status: 400 },
        );
      await db
        .prepare(
          "INSERT INTO attendance_sessions (meeting_date, title, section, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(meetingDate, title, section, new Date().toISOString())
        .run();
    } else if (action === "update_attendance") {
      const sessionId = Number(body.sessionId);
      const memberId = Number(body.memberId);
      const status = String(body.status ?? "unmarked");
      const allowed = ["unmarked", "present", "absent", "excused"];
      if (!sessionId || !memberId || !allowed.includes(status))
        return Response.json(
          { error: "Invalid attendance update" },
          { status: 400 },
        );
      if (
        ["nco", "squad_leader"].includes(user.role) &&
        !hasTemporaryAccess &&
        !allowedSquads.includes(user.squad)
      )
        return Response.json(
          {
            error:
              "Your account must be assigned to Alpha, Bravo, Charlie, or Delta before taking attendance",
          },
          { status: 403 },
        );
      const validAttendanceTarget = await db
        .prepare(
          `SELECT m.id, m.squad, s.audience, COALESCE(users.role, '') AS account_role FROM members m
        INNER JOIN attendance_sessions s ON s.id = ?
        LEFT JOIN users ON LOWER(users.email) = LOWER(m.email)
        WHERE m.id = ? AND m.section = ? AND s.section = ?`,
        )
        .bind(sessionId, memberId, section, section)
        .first<{ id: number; squad: string; audience: string; account_role: string }>();
      if (!validAttendanceTarget)
        return Response.json(
          { error: "Meeting and member must belong to the selected section" },
          { status: 400 },
        );
      if (validAttendanceTarget.audience === "nco_council" && !["nco", "squad_leader"].includes(validAttendanceTarget.account_role))
        return Response.json({ error: "Only NCOs and Squad Leaders are required for this meeting" }, { status: 403 });
      if (
        ["nco", "squad_leader"].includes(user.role) &&
        !hasTemporaryAccess &&
        validAttendanceTarget.squad !== user.squad
      )
        return Response.json(
          { error: "You can only update attendance for your assigned squad" },
          { status: 403 },
        );
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO attendance_records (session_id, member_id, status, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id, member_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        )
        .bind(sessionId, memberId, status, now, user.email)
        .run();
    } else if (action === "delete_attendance_session") {
      const sessionId = Number(body.sessionId);
      if (!sessionId)
        return Response.json(
          { error: "Invalid attendance session" },
          { status: 400 },
        );
      const validSession = await db
        .prepare(
          "SELECT id FROM attendance_sessions WHERE id = ? AND section = ?",
        )
        .bind(sessionId, section)
        .first();
      if (!validSession)
        return Response.json(
          { error: "Meeting not found in the selected section" },
          { status: 404 },
        );
      await db
        .prepare("DELETE FROM attendance_records WHERE session_id = ?")
        .bind(sessionId)
        .run();
      await db
        .prepare("DELETE FROM attendance_sessions WHERE id = ? AND section = ?")
        .bind(sessionId, section)
        .run();
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save changes",
      },
      { status: 500 },
    );
  }
}
