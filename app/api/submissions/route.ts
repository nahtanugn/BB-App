import { env } from "cloudflare:workers";
import {
  getCurrentUser,
  hasAdminOrTemporaryAccess,
  hasOperationalAdminAccess,
  hasTemporaryAdminAccess,
} from "../../../lib/auth";

async function ensureSubmissionSchema() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS award_submissions (
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
    review_notes TEXT NOT NULL DEFAULT '',
    submitted_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT,
    archived_at TEXT,
    archived_by TEXT
  )`,
  ).run();
  const columns = await env.DB.prepare(
    "PRAGMA table_info(award_submissions)",
  ).all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "member_id")) {
    await env.DB.prepare(
      "ALTER TABLE award_submissions ADD COLUMN member_id INTEGER",
    ).run();
  }
  if (!columns.results.some((column) => column.name === "archived_at")) {
    await env.DB.prepare(
      "ALTER TABLE award_submissions ADD COLUMN archived_at TEXT",
    ).run();
  }
  if (!columns.results.some((column) => column.name === "archived_by")) {
    await env.DB.prepare(
      "ALTER TABLE award_submissions ADD COLUMN archived_by TEXT",
    ).run();
  }
  if (!columns.results.some((column) => column.name === "review_notes")) {
    await env.DB.prepare(
      "ALTER TABLE award_submissions ADD COLUMN review_notes TEXT NOT NULL DEFAULT ''",
    ).run();
  }
}

async function getAwardsForSection(section: string) {
  return env.DB.prepare(
    "SELECT code, name, category, basic_available, advanced_available FROM award_definitions WHERE section = ? AND code NOT IN ('arts_crafts_hobbies', 'band_proficiency', 'scholastic', 'duke_of_edinburgh', 'one_year_service', 'three_year_service', 'long_year_service') ORDER BY sort_order",
  )
    .bind(section)
    .all();
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const hasTemporaryAccess = hasTemporaryAdminAccess(user);
    const url = new URL(request.url);
    const isPersonalRequest =
      !hasTemporaryAccess &&
      (user.role === "member" ||
        (["nco", "squad_leader"].includes(user.role) &&
          url.searchParams.get("all") !== "1" &&
          !url.searchParams.has("memberId")));
    if (user.role === "nco" && !hasTemporaryAccess && !isPersonalRequest)
      return Response.json(
        { error: "This account cannot access award submissions" },
        { status: 403 },
      );
    await ensureSubmissionSchema();
    if (isPersonalRequest) {
      const member = await env.DB.prepare(
        "SELECT id, name, section FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
      )
        .bind(user.email)
        .first<{ id: number; name: string; section: string }>();
      if (!member)
        return Response.json(
          { error: "Your account is not linked to a member profile" },
          { status: 409 },
        );
      if (member.section === "junior")
        return Response.json(
          { error: "Award submissions are not available for the Junior Section" },
          { status: 403 },
        );
      const submissions = await env.DB.prepare(
        "SELECT * FROM award_submissions WHERE member_id = ? AND archived_at IS NULL ORDER BY submitted_at DESC",
      )
        .bind(member.id)
        .all();
      const awards = await getAwardsForSection(member.section);
      return Response.json({
        awards: awards.results,
        submissions: submissions.results,
        member,
      });
    }
    if (url.searchParams.get("all") === "1") {
      if (!hasOperationalAdminAccess(user) && user.role !== "viewer")
        return Response.json(
          { error: "Admin, Temporary Admin or Officer access required" },
          { status: 403 },
        );
      const showArchived = url.searchParams.get("archived") === "1";
      const requestedSection = url.searchParams.get("section") ?? "senior";
      if (requestedSection === "junior")
        return Response.json(
          { error: "The Junior Section submission portal has been removed" },
          { status: 404 },
        );
      const section = "senior";
      if (
        showArchived &&
        !hasAdminOrTemporaryAccess(user) &&
        user.role !== "viewer"
      )
        return Response.json(
          { error: "Administrator access required" },
          { status: 403 },
        );
      const submissions = await env.DB.prepare(
        `SELECT s.* FROM award_submissions s
        INNER JOIN members m ON m.id = s.member_id
        WHERE m.section = ? AND s.archived_at IS ${showArchived ? "NOT NULL" : "NULL"}
        ORDER BY s.${showArchived ? "archived_at" : "submitted_at"} DESC`,
      )
        .bind(section)
        .all();
      return Response.json({ submissions: submissions.results, section });
    }
    const memberId = Number(url.searchParams.get("memberId"));
    if (!memberId)
      return Response.json(
        { error: "Select a member to view submissions" },
        { status: 400 },
      );
    const member = await env.DB.prepare(
      "SELECT id, name, section FROM members WHERE id = ?",
    )
      .bind(memberId)
      .first<{ id: number; name: string; section: string }>();
    if (!member)
      return Response.json(
        { error: "Member profile not found" },
        { status: 404 },
      );
    if (member.section === "junior")
      return Response.json(
        { error: "Award submissions are not available for the Junior Section" },
        { status: 403 },
      );
    const submissions = await env.DB.prepare(
      "SELECT * FROM award_submissions WHERE member_id = ? AND archived_at IS NULL ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, submitted_at DESC",
    )
      .bind(member.id)
      .all();
    const awards = await getAwardsForSection(member.section);
    return Response.json({
      awards: awards.results,
      submissions: submissions.results,
      member,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load award submissions",
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
    const hasTemporaryAccess = hasTemporaryAdminAccess(user);
    await ensureSubmissionSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create_submission") {
      if (
        !["member", "nco", "squad_leader"].includes(user.role) ||
        hasTemporaryAccess
      )
        return Response.json(
          {
            error:
              "Only linked member, NCO or squad leader accounts can submit award applications",
          },
          { status: 403 },
        );
      const memberName = user.name.trim();
      const awardCode = String(body.awardCode ?? "");
      const level = String(body.level ?? "basic");
      const evidenceUrl = String(body.evidenceUrl ?? "").trim();
      const notes = String(body.notes ?? "").trim();
      if (!memberName || !awardCode || !["basic", "advanced"].includes(level)) {
        return Response.json(
          { error: "Member name, award, and level are required" },
          { status: 400 },
        );
      }
      if (evidenceUrl) {
        let parsed: URL;
        try {
          parsed = new URL(evidenceUrl);
        } catch {
          return Response.json(
            { error: "Enter a valid evidence link" },
            { status: 400 },
          );
        }
        if (!["http:", "https:"].includes(parsed.protocol))
          return Response.json(
            { error: "Enter a valid web link" },
            { status: 400 },
          );
      }
      const award = await env.DB.prepare(
        "SELECT a.code, a.name, a.basic_available, a.advanced_available FROM award_definitions a INNER JOIN members m ON LOWER(m.email) = LOWER(?) WHERE a.code = ? AND a.section = m.section LIMIT 1",
      )
        .bind(user.email, awardCode)
        .first<{
          code: string;
          name: string;
          basic_available: number;
          advanced_available: number;
        }>();
      if (
        !award ||
        (level === "basic" ? !award.basic_available : !award.advanced_available)
      ) {
        return Response.json(
          { error: "That award level is not available" },
          { status: 400 },
        );
      }
      const member = await env.DB.prepare(
        "SELECT id, name, section FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
      )
        .bind(user.email)
        .first<{ id: number; name: string; section: string }>();
      if (member?.section === "junior")
        return Response.json(
          { error: "Award submissions are not available for the Junior Section" },
          { status: 403 },
        );
      if (!member)
        return Response.json(
          { error: "Your account is not linked to a member profile" },
          { status: 409 },
        );
      const pending = await env.DB.prepare(
        "SELECT id FROM award_submissions WHERE member_id = ? AND award_code = ? AND level = ? AND status = 'pending' AND archived_at IS NULL",
      )
        .bind(member.id, awardCode, level)
        .first();
      if (pending)
        return Response.json(
          {
            error: "You already have a pending submission for this award level",
          },
          { status: 409 },
        );
      const submittedAt = new Date().toISOString();
      const submissionInsert = env.DB.prepare(
        `INSERT INTO award_submissions
        (member_id, submitted_by_user_id, submitted_by_email, member_name, award_code, award_name, level, evidence_url, notes, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
        .bind(
          member.id,
          user.id,
          user.email,
          member.name || memberName,
          award.code,
          award.name,
          level,
          evidenceUrl,
          notes,
          submittedAt,
        );
      const matrixUpdate = env.DB.prepare(
        `INSERT INTO member_awards
        (member_id, award_code, level, status, awarded_at, updated_at, updated_by)
        VALUES (?, ?, ?, 'in_progress', NULL, ?, ?)
        ON CONFLICT(member_id, award_code, level) DO UPDATE SET
          status = CASE
            WHEN member_awards.status IN ('verified', 'awarded') THEN member_awards.status
            ELSE 'in_progress'
          END,
          updated_at = CASE
            WHEN member_awards.status IN ('verified', 'awarded') THEN member_awards.updated_at
            ELSE excluded.updated_at
          END,
          updated_by = CASE
            WHEN member_awards.status IN ('verified', 'awarded') THEN member_awards.updated_by
            ELSE excluded.updated_by
          END`,
      ).bind(member.id, award.code, level, submittedAt, user.email);
      await env.DB.batch([submissionInsert, matrixUpdate]);
      return Response.json({ ok: true, matrixStatus: "in_progress" });
    }

    if (action === "review_submission") {
      if (!hasOperationalAdminAccess(user))
        return Response.json(
          { error: "Admin, Temporary Admin or Officer access required" },
          { status: 403 },
        );
      const submissionId = Number(body.submissionId);
      const status = String(body.status ?? "");
      const reviewNotes = String(body.reviewNotes ?? "").trim();
      if (!submissionId || !["approved", "rejected"].includes(status))
        return Response.json({ error: "Invalid review" }, { status: 400 });
      if (reviewNotes.length > 2000)
        return Response.json(
          { error: "Review notes must be 2,000 characters or fewer" },
          { status: 400 },
        );
      const submission = await env.DB.prepare(
        `SELECT status, archived_at, member_id, submitted_by_email,
        award_code, level FROM award_submissions WHERE id = ?`,
      )
        .bind(submissionId)
        .first<{
          status: string;
          archived_at: string | null;
          member_id: number | null;
          submitted_by_email: string;
          award_code: string;
          level: string;
        }>();
      if (!submission)
        return Response.json(
          { error: "Award submission not found" },
          { status: 404 },
        );
      if (submission.archived_at)
        return Response.json(
          { error: "Restore this submission before reviewing it" },
          { status: 409 },
        );
      let memberId = submission.member_id;
      if (!memberId) {
        const linkedMember = await env.DB.prepare(
          "SELECT id FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
        )
          .bind(submission.submitted_by_email)
          .first<{ id: number }>();
        memberId = linkedMember?.id ?? null;
      }
      if (!memberId)
        return Response.json(
          { error: "Link this account to a member profile before reviewing" },
          { status: 409 },
        );
      const reviewedAt = new Date().toISOString();
      const reviewUpdate = env.DB.prepare(
        "UPDATE award_submissions SET member_id = ?, status = ?, review_notes = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?",
      ).bind(
        memberId,
        status,
        reviewNotes,
        reviewedAt,
        user.email,
        submissionId,
      );
      const matrixUpdate =
        status === "approved"
          ? env.DB.prepare(
              `INSERT INTO member_awards
              (member_id, award_code, level, status, awarded_at, updated_at, updated_by)
              VALUES (?, ?, ?, 'verified', NULL, ?, ?)
              ON CONFLICT(member_id, award_code, level) DO UPDATE SET
                status = CASE
                  WHEN member_awards.status = 'awarded' THEN member_awards.status
                  ELSE 'verified'
                END,
                updated_at = CASE
                  WHEN member_awards.status = 'awarded' THEN member_awards.updated_at
                  ELSE excluded.updated_at
                END,
                updated_by = CASE
                  WHEN member_awards.status = 'awarded' THEN member_awards.updated_by
                  ELSE excluded.updated_by
                END`,
            ).bind(
              memberId,
              submission.award_code,
              submission.level,
              reviewedAt,
              user.email,
            )
          : env.DB.prepare(
              `UPDATE member_awards
              SET status = 'not_started', awarded_at = NULL, updated_at = ?, updated_by = ?
              WHERE member_id = ? AND award_code = ? AND level = ?
              AND status != 'awarded'`,
            ).bind(
              reviewedAt,
              user.email,
              memberId,
              submission.award_code,
              submission.level,
            );
      await env.DB.batch([reviewUpdate, matrixUpdate]);
      return Response.json({
        ok: true,
        matrixStatus: status === "approved" ? "verified" : "not_started",
      });
    }

    if (action === "archive_submission" || action === "restore_submission") {
      if (!hasAdminOrTemporaryAccess(user))
        return Response.json(
          { error: "Administrator or Temporary Administrator access required" },
          { status: 403 },
        );
      const submissionId = Number(body.submissionId);
      if (!submissionId)
        return Response.json({ error: "Invalid submission" }, { status: 400 });
      const submission = await env.DB.prepare(
        "SELECT id FROM award_submissions WHERE id = ?",
      )
        .bind(submissionId)
        .first();
      if (!submission)
        return Response.json(
          { error: "Award submission not found" },
          { status: 404 },
        );
      if (action === "archive_submission") {
        await env.DB.prepare(
          "UPDATE award_submissions SET archived_at = ?, archived_by = ? WHERE id = ?",
        )
          .bind(new Date().toISOString(), user.email, submissionId)
          .run();
      } else {
        await env.DB.prepare(
          "UPDATE award_submissions SET archived_at = NULL, archived_by = NULL WHERE id = ?",
        )
          .bind(submissionId)
          .run();
      }
      return Response.json({ ok: true });
    }

    if (action === "delete_submission") {
      if (user.role !== "admin")
        return Response.json(
          { error: "Administrator access required" },
          { status: 403 },
        );
      const submissionId = Number(body.submissionId);
      if (!submissionId)
        return Response.json({ error: "Invalid submission" }, { status: 400 });
      const result = await env.DB.prepare(
        "DELETE FROM award_submissions WHERE id = ?",
      )
        .bind(submissionId)
        .run();
      if (!result.meta.changes)
        return Response.json(
          { error: "Award submission not found" },
          { status: 404 },
        );
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update award submissions",
      },
      { status: 500 },
    );
  }
}
