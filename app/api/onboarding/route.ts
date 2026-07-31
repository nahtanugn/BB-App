import {
  ensureAuthSchema,
  getCurrentUser,
  getRuntimeEnv,
  passwordDigest,
} from "../../../lib/auth";

const runtime = getRuntimeEnv();
const squads = ["Alpha", "Bravo", "Charlie", "Delta"];
const sections = ["senior", "junior"];

type MemberProfile = {
  id: number;
  name: string;
  rank: string;
  squad: string;
  section: string;
  joined_at: string;
  school: string;
  contact_number: string;
  emergency_contact_number: string;
  email: string;
  parents_name: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function validYear(value: string) {
  const year = Number(value);
  return /^\d{4}$/.test(value) && year >= 1950 && year <= new Date().getFullYear();
}

function profileComplete(member: MemberProfile | null) {
  return Boolean(
    member &&
      member.name.trim() &&
      member.joined_at.trim() &&
      member.school.trim() &&
      member.contact_number.trim() &&
      member.emergency_contact_number.trim() &&
      member.email.trim() &&
      member.parents_name.trim() &&
      squads.includes(member.squad) &&
      sections.includes(member.section),
  );
}

async function privacyNotice() {
  return runtime.DB.prepare(
    "SELECT setting_value, version, updated_at FROM app_settings WHERE setting_key = 'privacy_notice'",
  ).first<{ setting_value: string; version: number; updated_at: string }>();
}

async function memberForEmail(email: string) {
  return runtime.DB.prepare(
    `SELECT id, name, rank, squad, section, joined_at, school, contact_number,
      emergency_contact_number, email, parents_name
    FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1`,
  )
    .bind(email)
    .first<MemberProfile>();
}

async function audit(
  action: string,
  actor: { id?: number; name: string },
  subjectUserId: number | null,
  subjectMemberId: number | null,
  details: unknown,
) {
  await runtime.DB.prepare(
    `INSERT INTO onboarding_audit_log
      (action, subject_user_id, subject_member_id, actor_user_id, actor_name, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      action,
      subjectUserId,
      subjectMemberId,
      actor.id ?? null,
      actor.name,
      JSON.stringify(details),
      new Date().toISOString(),
    )
    .run();
}

async function finalizeOnboarding(userId: number) {
  const state = await runtime.DB.prepare(
    `SELECT role, must_change_password, profile_confirmed_at, tour_completed_at,
      privacy_notice_version,
      COALESCE((SELECT version FROM app_settings WHERE setting_key = 'privacy_notice'), 1) AS current_privacy_version
    FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{
      role: string;
      must_change_password: number;
      profile_confirmed_at: string | null;
      tour_completed_at: string | null;
      privacy_notice_version: number;
      current_privacy_version: number;
    }>();
  if (
    state &&
    !state.must_change_password &&
    (state.role !== "member" || state.profile_confirmed_at) &&
    state.tour_completed_at &&
    state.privacy_notice_version >= state.current_privacy_version
  )
    await runtime.DB.prepare(
      "UPDATE users SET onboarding_completed_at = COALESCE(onboarding_completed_at, ?) WHERE id = ?",
    )
      .bind(new Date().toISOString(), userId)
      .run();
}

function roleChecklist(role: string, section: string) {
  if (role === "admin")
    return [
      "Review accounts and access requests in Admin Centre",
      "Check member data quality and incomplete profiles",
      "Use Export Centre for regular company backups",
    ];
  if (role === "officer")
    return [
      "Review members, awards and attendance",
      "Process award and profile-correction submissions",
      "Check announcements, resources and subscriptions",
    ];
  if (role === "nco" || role === "squad_leader")
    return [
      "Review your squad’s member details",
      "Update your squad’s attendance",
      "Check announcements and submit your own award applications",
    ];
  if (role === "viewer")
    return [
      "Use the navigation menu to inspect each area",
      "Remember that Viewer access cannot change records",
    ];
  return [
    "Review your attendance percentage and award matrix",
    "Open member resources and company announcements",
    ...(section === "senior" ? ["Use My submissions for award applications"] : []),
    "Use Uniform requests when you need a uniform part",
  ];
}

export async function GET(request: Request) {
  try {
    await ensureAuthSchema();
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    const url = new URL(request.url);
    if (url.searchParams.get("management") === "1") {
      const canReviewCorrections = ["admin", "officer", "nco", "squad_leader", "viewer"].includes(user.role);
      if (!canReviewCorrections)
        return Response.json({ error: "Staff access required" }, { status: 403 });
      const requests = ["admin", "viewer"].includes(user.role)
        ? await runtime.DB.prepare(
            `SELECT users.id AS user_id, users.name, users.email, users.account_status,
              users.created_at, registration_details.*, members.name AS suggested_member_name
            FROM users
            JOIN registration_details ON registration_details.user_id = users.id
            LEFT JOIN members ON members.id = registration_details.suggested_member_id
            ORDER BY CASE users.account_status WHEN 'pending' THEN 0 ELSE 1 END, registration_details.updated_at DESC`,
          ).all()
        : { results: [] };
      const correctionSql = `SELECT profile_correction_requests.*, users.name AS requester_name,
          users.email AS requester_email, members.name AS member_name, members.squad, members.section
        FROM profile_correction_requests
        JOIN users ON users.id = profile_correction_requests.user_id
        JOIN members ON members.id = profile_correction_requests.member_id
        ${["nco", "squad_leader"].includes(user.role) ? "WHERE members.squad = ?" : ""}
        ORDER BY CASE profile_correction_requests.status WHEN 'pending' THEN 0 ELSE 1 END,
          profile_correction_requests.updated_at DESC`;
      const corrections = ["nco", "squad_leader"].includes(user.role)
        ? await runtime.DB.prepare(correctionSql).bind(user.squad).all()
        : await runtime.DB.prepare(correctionSql).all();
      const incomplete = user.role === "admin"
        ? await runtime.DB.prepare(
            `SELECT users.id, users.name, users.email, users.role, users.squad,
              users.must_change_password, users.onboarding_completed_at
            FROM users WHERE users.account_status = 'active'
              AND (users.must_change_password = 1 OR users.onboarding_completed_at IS NULL)
            ORDER BY users.name COLLATE NOCASE`,
          ).all()
        : { results: [] };
      const auditRows = user.role === "admin"
        ? await runtime.DB.prepare(
            `SELECT id, action, actor_name, details, created_at
            FROM onboarding_audit_log ORDER BY created_at DESC LIMIT 50`,
          ).all()
        : { results: [] };
      return Response.json({
        requests: requests.results,
        corrections: corrections.results,
        incomplete: incomplete.results,
        audit: auditRows.results,
        privacy: await privacyNotice(),
        permissions: {
          manageRegistrations: user.role === "admin",
          reviewCorrections: user.role !== "viewer",
          editPrivacy: user.role === "admin",
          readOnly: user.role === "viewer",
        },
      });
    }

    const member = await memberForEmail(user.email);
    const correction = member
      ? await runtime.DB.prepare(
          `SELECT id, status, review_notes, proposed_values, created_at, reviewed_at
          FROM profile_correction_requests WHERE user_id = ? AND member_id = ?
          ORDER BY created_at DESC LIMIT 1`,
        )
          .bind(user.id, member.id)
          .first()
      : null;
    return Response.json({
      member,
      profileComplete: profileComplete(member),
      correction,
      privacy: await privacyNotice(),
      checklist: roleChecklist(user.role, member?.section ?? user.member_section),
      steps: {
        password: !user.must_change_password,
        profile: user.role !== "member" || Boolean(user.profile_confirmed_at),
        privacy: user.privacy_notice_version >= user.current_privacy_version,
        tour: Boolean(user.tour_completed_at),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load onboarding" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureAuthSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = clean(body.action);

    if (action === "request_access") {
      const name = clean(body.name);
      const email = clean(body.email).toLowerCase();
      const password = String(body.password ?? "");
      const section = clean(body.section).toLowerCase();
      const squad = clean(body.squad);
      const joinedYear = clean(body.joinedYear);
      const school = clean(body.school);
      const contactNumber = clean(body.contactNumber);
      const emergencyContactNumber = clean(body.emergencyContactNumber);
      const parentsName = clean(body.parentsName);
      if (
        !name || !validEmail(email) || password.length < 10 ||
        !sections.includes(section) || !squads.includes(squad) ||
        !validYear(joinedYear) || !school || !contactNumber ||
        !emergencyContactNumber || !parentsName
      )
        return Response.json(
          { error: "Complete every field with valid member information and a password of at least 10 characters." },
          { status: 400 },
        );
      const count = await runtime.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND account_status = 'active'")
        .first<{ total: number }>();
      if (!count?.total)
        return Response.json({ error: "Company setup must be completed before access can be requested." }, { status: 409 });
      const existing = await runtime.DB.prepare(
        "SELECT id, account_status FROM users WHERE LOWER(email) = LOWER(?)",
      ).bind(email).first<{ id: number; account_status: string }>();
      if (existing?.account_status === "active")
        return Response.json({ error: "An active account already uses this email. Sign in instead." }, { status: 409 });
      if (existing?.account_status === "pending")
        return Response.json({ error: "This access request is already awaiting review." }, { status: 409 });
      const digest = await passwordDigest(password);
      const suggested = await memberForEmail(email);
      const now = new Date().toISOString();
      let userId = existing?.id;
      if (userId) {
        await runtime.DB.prepare(
          `UPDATE users SET name = ?, role = 'member', squad = ?, password_hash = ?,
            password_salt = ?, active = 0, account_status = 'pending',
            must_change_password = 1, onboarding_completed_at = NULL,
            profile_confirmed_at = NULL, tour_completed_at = NULL,
            privacy_notice_version = 0 WHERE id = ?`,
        ).bind(name, squad, digest.hash, digest.salt, userId).run();
      } else {
        const result = await runtime.DB.prepare(
          `INSERT INTO users
            (email, name, role, squad, password_hash, password_salt, active,
             account_status, must_change_password, privacy_notice_version, created_at)
          VALUES (?, ?, 'member', ?, ?, ?, 0, 'pending', 1, 0, ?)`,
        ).bind(email, name, squad, digest.hash, digest.salt, now).run();
        userId = Number(result.meta.last_row_id);
      }
      await runtime.DB.prepare(
        `INSERT INTO registration_details
          (user_id, section, squad, joined_year, school, contact_number,
           emergency_contact_number, parents_name, suggested_member_id,
           review_notes, reviewed_by, reviewed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', NULL, NULL, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          section = excluded.section, squad = excluded.squad,
          joined_year = excluded.joined_year, school = excluded.school,
          contact_number = excluded.contact_number,
          emergency_contact_number = excluded.emergency_contact_number,
          parents_name = excluded.parents_name,
          suggested_member_id = excluded.suggested_member_id,
          review_notes = '', reviewed_by = NULL, reviewed_at = NULL,
          updated_at = excluded.updated_at`,
      ).bind(
        userId, section, squad, joinedYear, school, contactNumber,
        emergencyContactNumber, parentsName, suggested?.id ?? null, now,
      ).run();
      await audit("access_requested", { name }, userId, suggested?.id ?? null, { email, section, squad });
      return Response.json({
        ok: true,
        message: existing
          ? "Your access request was updated and resubmitted."
          : "Your access request was submitted for administrator review.",
      });
    }

    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

    if (action === "confirm_profile") {
      const member = await memberForEmail(user.email);
      if (!profileComplete(member))
        return Response.json({ error: "Complete or correct every required profile field before confirming." }, { status: 409 });
      const now = new Date().toISOString();
      await runtime.DB.prepare("UPDATE users SET profile_confirmed_at = ? WHERE id = ?")
        .bind(now, user.id).run();
      await finalizeOnboarding(user.id);
      await audit("profile_confirmed", user, user.id, member?.id ?? null, {});
      return Response.json({ ok: true });
    }

    if (action === "accept_privacy") {
      const notice = await privacyNotice();
      await runtime.DB.prepare("UPDATE users SET privacy_notice_version = ? WHERE id = ?")
        .bind(notice?.version ?? 1, user.id).run();
      await finalizeOnboarding(user.id);
      await audit("privacy_accepted", user, user.id, null, { version: notice?.version ?? 1 });
      return Response.json({ ok: true });
    }

    if (action === "complete_tour") {
      const now = new Date().toISOString();
      await runtime.DB.prepare("UPDATE users SET tour_completed_at = ? WHERE id = ?")
        .bind(now, user.id).run();
      await finalizeOnboarding(user.id);
      await audit("role_guide_completed", user, user.id, null, { role: user.role });
      return Response.json({ ok: true });
    }

    if (action === "submit_correction") {
      if (user.role !== "member")
        return Response.json({ error: "Member profile required" }, { status: 403 });
      const member = await memberForEmail(user.email);
      if (!member) return Response.json({ error: "Linked member profile not found" }, { status: 404 });
      const proposed = {
        name: clean(body.name),
        section: clean(body.section).toLowerCase(),
        squad: clean(body.squad),
        joined_at: clean(body.joinedYear),
        school: clean(body.school),
        contact_number: clean(body.contactNumber),
        emergency_contact_number: clean(body.emergencyContactNumber),
        email: user.email,
        parents_name: clean(body.parentsName),
      };
      if (
        !proposed.name || !sections.includes(proposed.section) ||
        !squads.includes(proposed.squad) || !validYear(proposed.joined_at) ||
        !proposed.school || !proposed.contact_number ||
        !proposed.emergency_contact_number || !proposed.parents_name
      )
        return Response.json({ error: "Complete every proposed profile field." }, { status: 400 });
      const now = new Date().toISOString();
      const pending = await runtime.DB.prepare(
        "SELECT id FROM profile_correction_requests WHERE user_id = ? AND member_id = ? AND status = 'pending'",
      ).bind(user.id, member.id).first<{ id: number }>();
      if (pending)
        await runtime.DB.prepare(
          "UPDATE profile_correction_requests SET proposed_values = ?, updated_at = ? WHERE id = ?",
        ).bind(JSON.stringify(proposed), now, pending.id).run();
      else
        await runtime.DB.prepare(
          `INSERT INTO profile_correction_requests
            (user_id, member_id, proposed_values, status, created_at, updated_at)
          VALUES (?, ?, ?, 'pending', ?, ?)`,
        ).bind(user.id, member.id, JSON.stringify(proposed), now, now).run();
      await audit("profile_correction_submitted", user, user.id, member.id, proposed);
      return Response.json({ ok: true, message: "Correction request submitted for staff review." });
    }

    if (action === "review_registration") {
      if (user.role !== "admin")
        return Response.json({ error: "Administrator access required" }, { status: 403 });
      const targetId = Number(body.userId);
      const decision = clean(body.decision);
      const reviewNotes = clean(body.reviewNotes);
      const registration = await runtime.DB.prepare(
        `SELECT users.id, users.name, users.email, users.account_status,
          registration_details.* FROM users
        JOIN registration_details ON registration_details.user_id = users.id
        WHERE users.id = ?`,
      ).bind(targetId).first<Record<string, string | number | null>>();
      if (!registration || registration.account_status !== "pending")
        return Response.json({ error: "Pending request not found" }, { status: 404 });
      const now = new Date().toISOString();
      if (decision === "reject") {
        await runtime.DB.batch([
          runtime.DB.prepare("UPDATE users SET account_status = 'rejected', active = 0 WHERE id = ?").bind(targetId),
          runtime.DB.prepare("UPDATE registration_details SET review_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE user_id = ?")
            .bind(reviewNotes, user.id, now, now, targetId),
        ]);
        await audit("access_rejected", user, targetId, null, { reviewNotes });
        return Response.json({ ok: true, message: "Access request rejected." });
      }
      if (decision !== "approve")
        return Response.json({ error: "Choose approve or reject" }, { status: 400 });
      const section = sections.includes(clean(body.section)) ? clean(body.section) : String(registration.section);
      const squad = squads.includes(clean(body.squad)) ? clean(body.squad) : String(registration.squad);
      const confirmedMemberId = Number(body.memberId || 0);
      let member: MemberProfile | null = null;
      if (confirmedMemberId) {
        member = await runtime.DB.prepare(
          `SELECT id, name, rank, squad, section, joined_at, school, contact_number,
            emergency_contact_number, email, parents_name FROM members WHERE id = ?`,
        ).bind(confirmedMemberId).first<MemberProfile>();
        if (!member || member.email.toLowerCase() !== String(registration.email).toLowerCase())
          return Response.json({ error: "The confirmed member must use the same email address." }, { status: 409 });
        await runtime.DB.prepare("UPDATE members SET squad = ?, section = ? WHERE id = ?")
          .bind(squad, section, member.id).run();
      } else {
        const result = await runtime.DB.prepare(
          `INSERT INTO members
            (name, rank, squad, section, joined_at, service_years, school,
             contact_number, emergency_contact_number, email, parents_name,
             is_demo, created_at)
          VALUES (?, 'Private', ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?)`,
        ).bind(
          registration.name, squad, section, registration.joined_year,
          registration.school, registration.contact_number,
          registration.emergency_contact_number, registration.email,
          registration.parents_name, now,
        ).run();
        member = await runtime.DB.prepare(
          `SELECT id, name, rank, squad, section, joined_at, school, contact_number,
            emergency_contact_number, email, parents_name FROM members WHERE id = ?`,
        ).bind(Number(result.meta.last_row_id)).first<MemberProfile>();
      }
      await runtime.DB.batch([
        runtime.DB.prepare(
          `UPDATE users SET role = 'member', squad = ?, active = 1,
            account_status = 'active', must_change_password = 1,
            onboarding_completed_at = NULL, profile_confirmed_at = NULL,
            tour_completed_at = NULL, privacy_notice_version = 0 WHERE id = ?`,
        ).bind(squad, targetId),
        runtime.DB.prepare(
          "UPDATE registration_details SET section = ?, squad = ?, suggested_member_id = ?, review_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE user_id = ?",
        ).bind(section, squad, member?.id ?? null, reviewNotes, user.id, now, now, targetId),
      ]);
      await audit("access_approved", user, targetId, member?.id ?? null, { section, squad, reviewNotes });
      return Response.json({ ok: true, message: "Member access approved and onboarding activated." });
    }

    if (action === "review_correction") {
      const correctionId = Number(body.correctionId);
      const decision = clean(body.decision);
      const reviewNotes = clean(body.reviewNotes);
      const correction = await runtime.DB.prepare(
        `SELECT profile_correction_requests.*, members.squad
        FROM profile_correction_requests
        JOIN members ON members.id = profile_correction_requests.member_id
        WHERE profile_correction_requests.id = ?`,
      ).bind(correctionId).first<Record<string, string | number | null>>();
      const mayReview =
        Boolean(correction) &&
        (["admin", "officer"].includes(user.role) ||
          (["nco", "squad_leader"].includes(user.role) && correction?.squad === user.squad));
      if (!mayReview)
        return Response.json({ error: "You cannot review this correction request." }, { status: 403 });
      if (correction?.status !== "pending")
        return Response.json({ error: "This correction has already been reviewed." }, { status: 409 });
      const now = new Date().toISOString();
      if (decision === "approve") {
        const proposed = JSON.parse(String(correction.proposed_values)) as Record<string, string>;
        const before = await runtime.DB.prepare(
          `SELECT name, squad, section, joined_at, school, contact_number,
            emergency_contact_number, email, parents_name FROM members WHERE id = ?`,
        ).bind(correction.member_id).first();
        await runtime.DB.batch([
          runtime.DB.prepare(
            `UPDATE members SET name = ?, squad = ?, section = ?, joined_at = ?,
              school = ?, contact_number = ?, emergency_contact_number = ?,
              parents_name = ? WHERE id = ?`,
          ).bind(
            proposed.name, proposed.squad, proposed.section, proposed.joined_at,
            proposed.school, proposed.contact_number,
            proposed.emergency_contact_number, proposed.parents_name,
            correction.member_id,
          ),
          runtime.DB.prepare(
            "UPDATE users SET name = ?, squad = ?, profile_confirmed_at = NULL, onboarding_completed_at = NULL WHERE id = ?",
          ).bind(proposed.name, proposed.squad, correction.user_id),
          runtime.DB.prepare(
            "UPDATE profile_correction_requests SET status = 'approved', review_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
          ).bind(reviewNotes, user.id, now, now, correctionId),
        ]);
        await audit("profile_correction_approved", user, Number(correction.user_id), Number(correction.member_id), {
          reviewNotes,
          before,
          after: proposed,
        });
      } else if (decision === "reject") {
        await runtime.DB.prepare(
          "UPDATE profile_correction_requests SET status = 'rejected', review_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        ).bind(reviewNotes, user.id, now, now, correctionId).run();
        await audit("profile_correction_rejected", user, Number(correction.user_id), Number(correction.member_id), {
          reviewNotes,
        });
      } else return Response.json({ error: "Choose approve or reject" }, { status: 400 });
      return Response.json({ ok: true, message: `Correction request ${decision}d.` });
    }

    if (action === "update_privacy") {
      if (user.role !== "admin")
        return Response.json({ error: "Administrator access required" }, { status: 403 });
      const text = clean(body.text);
      if (text.length < 40)
        return Response.json({ error: "Enter a clear privacy notice of at least 40 characters." }, { status: 400 });
      const current = await privacyNotice();
      const version = (current?.version ?? 0) + 1;
      const now = new Date().toISOString();
      await runtime.DB.prepare(
        `UPDATE app_settings SET setting_value = ?, version = ?, updated_by = ?, updated_at = ?
        WHERE setting_key = 'privacy_notice'`,
      ).bind(text, version, user.id, now).run();
      await runtime.DB.prepare(
        `INSERT INTO privacy_notice_versions
          (version, notice_text, require_reacknowledgement, created_by, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      ).bind(version, text, Boolean(body.requireReacknowledgement) ? 1 : 0, user.id, now).run();
      if (Boolean(body.requireReacknowledgement))
        await runtime.DB.prepare(
          "UPDATE users SET onboarding_completed_at = NULL WHERE account_status = 'active'",
        ).run();
      else
        await runtime.DB.prepare(
          `UPDATE users SET privacy_notice_version = ?
          WHERE account_status = 'active' AND onboarding_completed_at IS NOT NULL`,
        ).bind(version).run();
      await audit("privacy_notice_updated", user, null, null, { version, requireReacknowledgement: Boolean(body.requireReacknowledgement) });
      return Response.json({ ok: true, message: `Privacy notice updated to version ${version}.` });
    }

    return Response.json({ error: "Unknown onboarding action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete onboarding";
    if (message.includes("UNIQUE constraint failed"))
      return Response.json({ error: "That email already belongs to another member or account." }, { status: 409 });
    return Response.json({ error: message }, { status: 500 });
  }
}
