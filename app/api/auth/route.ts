import {
  createSession,
  destroySession,
  ensureAuthSchema,
  getCurrentUser,
  getRuntimeEnv,
  passwordDigest,
  verifyPassword,
} from "../../../lib/auth";

const runtime = getRuntimeEnv();
const allowedRoles = [
  "admin",
  "officer",
  "nco",
  "squad_leader",
  "viewer",
  "member",
];
const allowedSquads = ["Alpha", "Bravo", "Charlie", "Delta"];
const officerRanks = ["Staff Sergeant", "Warrant Officer", "Lieutenant", "Captain", "Honorary Captain", "Chaplain"];
const officerProfileRoles = ["admin", "officer"];
const spiritualStatuses = ["accepted_christ", "baptised", "non_believer"];

function temporaryAccessExpiry(accessRole: string, value: unknown) {
  if (accessRole !== "temporary_admin") return null;
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return `${date}T15:59:59.999Z`;
}

async function createOrLinkMemberProfile(
  name: string,
  email: string,
  previousEmail?: string,
  section = "senior",
  squad = "Alpha",
) {
  const memberSquad = allowedSquads.includes(squad) ? squad : "Alpha";
  const previousProfile = previousEmail
    ? await runtime.DB.prepare(
        "SELECT id FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
      )
        .bind(previousEmail)
        .first<{ id: number }>()
    : null;
  if (previousProfile) {
    await runtime.DB.prepare(
      "UPDATE members SET name = ?, email = ?, squad = ? WHERE id = ?",
    )
      .bind(name, email, memberSquad, previousProfile.id)
      .run();
    return;
  }
  const existingProfile = await runtime.DB.prepare(
    "SELECT id FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
  )
    .bind(email)
    .first<{ id: number }>();
  if (existingProfile) {
    await runtime.DB.prepare(
      "UPDATE members SET name = ?, squad = ? WHERE id = ?",
    )
      .bind(name, memberSquad, existingProfile.id)
      .run();
    return;
  }
  await runtime.DB.prepare(
    `INSERT INTO members
    (name, rank, squad, section, joined_at, service_years, school, contact_number, emergency_contact_number, email, parents_name, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, 0, '', '', '', ?, '', 0, ?)`,
  )
    .bind(
      name,
      section === "junior" ? "Pre-Junior" : "Private",
      memberSquad,
      section === "junior" ? "junior" : "senior",
      String(new Date().getUTCFullYear()),
      email,
      new Date().toISOString(),
    )
    .run();
}

export async function GET(request: Request) {
  try {
    await ensureAuthSchema();
    const user = await getCurrentUser(request);
    const count = await runtime.DB.prepare(
      "SELECT COUNT(*) AS total FROM users",
    ).first<{ total: number }>();
    const url = new URL(request.url);
    if (url.searchParams.get("users") === "1") {
      if (!user || !["admin", "viewer"].includes(user.role))
        return Response.json(
          { error: "Administrator or Viewer access required" },
          { status: 403 },
        );
      const users = await runtime.DB.prepare(
        `SELECT users.id, users.email, users.name, users.role, users.squad,
          users.officer_rank, users.gender, users.ethnicity, users.religion,
          users.spiritual_status, users.officer_work_status,
          users.temporary_access_role, users.access_expires_at, users.active, users.created_at,
          users.account_status, users.must_change_password, users.onboarding_completed_at,
          (SELECT members.section FROM members
            WHERE LOWER(members.email) = LOWER(users.email) LIMIT 1) AS member_section
        FROM users ORDER BY users.name COLLATE NOCASE`,
      ).all();
      const pendingMembers = await runtime.DB.prepare(
        `SELECT m.id, m.email, m.name, m.squad, m.section, m.created_at
        FROM members m
        LEFT JOIN users u ON LOWER(u.email) = LOWER(m.email)
        WHERE TRIM(m.email) != '' AND u.id IS NULL
        ORDER BY m.name COLLATE NOCASE`,
      ).all();
      return Response.json({
        user,
        users: users.results,
        pendingMembers: pendingMembers.results,
      });
    }
    return Response.json({
      user,
      setupRequired: !count?.total,
      adminEmail: !count?.total ? (runtime.ADMIN_EMAIL ?? "") : undefined,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to check sign-in",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureAuthSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "setup") {
      const count = await runtime.DB.prepare(
        "SELECT COUNT(*) AS total FROM users",
      ).first<{ total: number }>();
      if (count?.total)
        return Response.json(
          { error: "Initial setup is already complete" },
          { status: 409 },
        );
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const name = String(body.name ?? "").trim();
      const password = String(body.password ?? "");
      const setupToken = String(body.setupToken ?? "");
      if (
        !runtime.ADMIN_EMAIL ||
        email !== runtime.ADMIN_EMAIL.toLowerCase() ||
        !runtime.SETUP_TOKEN ||
        setupToken !== runtime.SETUP_TOKEN
      ) {
        return Response.json(
          { error: "The administrator email or setup code is incorrect" },
          { status: 403 },
        );
      }
      if (!name || password.length < 10)
        return Response.json(
          { error: "Enter your name and a password of at least 10 characters" },
          { status: 400 },
        );
      const digest = await passwordDigest(password);
      const result = await runtime.DB.prepare(
        `INSERT INTO users (email, name, role, password_hash, password_salt, active, created_at)
        VALUES (?, ?, 'admin', ?, ?, 1, ?)`,
      )
        .bind(email, name, digest.hash, digest.salt, new Date().toISOString())
        .run();
      const cookie = await createSession(Number(result.meta.last_row_id));
      return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
    }

    if (action === "login") {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(body.password ?? "");
      const identity = `${request.headers.get("cf-connecting-ip") ?? "unknown"}:${email}`;
      if (await isRateLimited(identity))
        return Response.json(
          { error: "Too many attempts. Try again in 15 minutes." },
          { status: 429 },
        );
      const row = await runtime.DB.prepare(
        `SELECT users.id, users.password_hash, users.password_salt, users.active,
          users.account_status, registration_details.review_notes
        FROM users
        LEFT JOIN registration_details ON registration_details.user_id = users.id
        WHERE users.email = ?`,
      )
        .bind(email)
        .first<{
          id: number;
          password_hash: string;
          password_salt: string;
          active: number;
          account_status: string;
          review_notes: string | null;
        }>();
      if (
        !row ||
        !(await verifyPassword(password, row.password_salt, row.password_hash))
      ) {
        await recordFailedAttempt(identity);
        return Response.json(
          { error: "Email or password is incorrect" },
          { status: 401 },
        );
      }
      if (row.account_status === "pending")
        return Response.json(
          {
            status: "pending",
            error: "Your access request is awaiting administrator review.",
          },
          { status: 202 },
        );
      if (row.account_status === "rejected")
        return Response.json(
          {
            status: "rejected",
            error: row.review_notes
              ? `Your request was not approved: ${row.review_notes}`
              : "Your access request was not approved. You may update and resubmit it.",
          },
          { status: 403 },
        );
      if (!row.active)
        return Response.json(
          { error: "This account is currently disabled." },
          { status: 403 },
        );
      await runtime.DB.prepare("DELETE FROM auth_attempts WHERE identity = ?")
        .bind(identity)
        .run();
      const cookie = await createSession(row.id);
      return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
    }

    if (action === "logout") {
      const cookie = await destroySession(request);
      return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
    }

    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });

    if (action === "change_password") {
      const currentPassword = String(body.currentPassword ?? "");
      const newPassword = String(body.newPassword ?? "");
      if (newPassword.length < 10)
        return Response.json(
          { error: "New password must be at least 10 characters" },
          { status: 400 },
        );
      const row = await runtime.DB.prepare(
        "SELECT password_hash, password_salt FROM users WHERE id = ?",
      )
        .bind(user.id)
        .first<{ password_hash: string; password_salt: string }>();
      if (
        !row ||
        !(await verifyPassword(
          currentPassword,
          row.password_salt,
          row.password_hash,
        ))
      ) {
        return Response.json(
          { error: "Current password is incorrect" },
          { status: 403 },
        );
      }
      const digest = await passwordDigest(newPassword);
      await runtime.DB.prepare(
        "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?",
      )
        .bind(digest.hash, digest.salt, user.id)
        .run();
      await runtime.DB.prepare(
        "DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)",
      )
        .bind(user.id, user.id)
        .run();
      return Response.json({ ok: true });
    }

    if (user.role !== "admin")
      return Response.json(
        { error: "Administrator access required" },
        { status: 403 },
      );

    if (action === "create_user") {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const name = String(body.name ?? "").trim();
      const password = String(body.password ?? "");
      const requestedRole = String(body.role ?? "officer");
      const memberSection =
        String(body.memberSection ?? "senior") === "junior"
          ? "junior"
          : "senior";
      const role = allowedRoles.includes(requestedRole)
        ? requestedRole
        : "officer";
      const hasOfficerProfile = officerProfileRoles.includes(role);
      const officerRank = hasOfficerProfile && officerRanks.includes(String(body.officerRank ?? "")) ? String(body.officerRank) : "";
      const gender = hasOfficerProfile && ["M", "F"].includes(String(body.gender ?? "").toUpperCase()) ? String(body.gender).toUpperCase() : "";
      const ethnicity = hasOfficerProfile ? String(body.ethnicity ?? "").trim().slice(0, 60) : "";
      const religion = hasOfficerProfile ? String(body.religion ?? "").trim().slice(0, 60) : "";
      const spiritualStatus = hasOfficerProfile && spiritualStatuses.includes(String(body.spiritualStatus ?? "")) ? String(body.spiritualStatus) : "";
      const officerWorkStatus = hasOfficerProfile && ["working", "studying"].includes(String(body.officerWorkStatus ?? "")) ? String(body.officerWorkStatus) : "";
      const temporaryAccessRole =
        role === "viewer"
          ? ""
          :
        String(body.temporaryAccessRole ?? "") === "temporary_admin"
          ? "temporary_admin"
          : "";
      const accessExpiresAt = temporaryAccessExpiry(
        temporaryAccessRole,
        body.accessExpiresOn,
      );
      const requestedSquad = String(body.squad ?? "");
      const squad =
        ["nco", "squad_leader", "member"].includes(role) &&
        allowedSquads.includes(requestedSquad)
          ? requestedSquad
          : "";
      if (!/^\S+@\S+\.\S+$/.test(email) || !name || password.length < 10) {
        return Response.json(
          {
            error:
              "Enter a valid email, name, and temporary password of at least 10 characters",
          },
          { status: 400 },
        );
      }
      const digest = await passwordDigest(password);
      if (["nco", "squad_leader", "member"].includes(role) && !squad)
        return Response.json(
          {
            error:
              "Select Alpha, Bravo, Charlie, or Delta for the account",
          },
          { status: 400 },
        );
      if (
        temporaryAccessRole === "temporary_admin" &&
        (!accessExpiresAt || accessExpiresAt <= new Date().toISOString())
      )
        return Response.json(
          { error: "Select a future expiry date for temporary admin access" },
          { status: 400 },
        );
      const result = await runtime.DB.prepare(
        `INSERT INTO users (email, name, role, squad, officer_rank, gender, ethnicity, religion, spiritual_status, officer_work_status, temporary_access_role, access_expires_at, password_hash, password_salt, active, account_status, must_change_password, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', 1, ?)`,
      )
        .bind(
          email,
          name,
          role,
          squad,
          officerRank,
          gender,
          ethnicity,
          religion,
          spiritualStatus,
          officerWorkStatus,
          temporaryAccessRole,
          accessExpiresAt,
          digest.hash,
          digest.salt,
          new Date().toISOString(),
        )
        .run();
      if (role === "member") {
        try {
          await createOrLinkMemberProfile(
            name,
            email,
            undefined,
            memberSection,
            squad,
          );
        } catch (error) {
          await runtime.DB.prepare("DELETE FROM users WHERE id = ?")
            .bind(Number(result.meta.last_row_id))
            .run();
          throw error;
        }
      }
      return Response.json({ ok: true });
    }

    if (action === "set_user_active") {
      const targetId = Number(body.userId);
      const active = body.active ? 1 : 0;
      if (!targetId || targetId === user.id)
        return Response.json(
          { error: "You cannot disable your own account" },
          { status: 400 },
        );
      await runtime.DB.prepare("UPDATE users SET active = ? WHERE id = ?")
        .bind(active, targetId)
        .run();
      if (!active)
        await runtime.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
          .bind(targetId)
          .run();
      return Response.json({ ok: true });
    }

    if (action === "reset_password") {
      const targetId = Number(body.userId);
      const temporaryPassword = String(body.temporaryPassword ?? "");
      if (!targetId || targetId === user.id)
        return Response.json(
          { error: "Use Change my password for your own account" },
          { status: 400 },
        );
      if (temporaryPassword.length < 10)
        return Response.json(
          { error: "Temporary password must be at least 10 characters" },
          { status: 400 },
        );
      const target = await runtime.DB.prepare(
        "SELECT id FROM users WHERE id = ?",
      )
        .bind(targetId)
        .first<{ id: number }>();
      if (!target)
        return Response.json(
          { error: "User account not found" },
          { status: 404 },
        );
      const digest = await passwordDigest(temporaryPassword);
      await runtime.DB.batch([
        runtime.DB.prepare(
          "UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1, onboarding_completed_at = NULL WHERE id = ?",
        ).bind(digest.hash, digest.salt, targetId),
        runtime.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(
          targetId,
        ),
      ]);
      return Response.json({ ok: true });
    }

    if (action === "delete_user") {
      const targetId = Number(body.userId);
      if (!targetId || targetId === user.id)
        return Response.json(
          { error: "You cannot delete your own account" },
          { status: 400 },
        );
      const target = await runtime.DB.prepare(
        "SELECT id FROM users WHERE id = ?",
      )
        .bind(targetId)
        .first<{ id: number }>();
      if (!target)
        return Response.json(
          { error: "User account not found" },
          { status: 404 },
        );
      await runtime.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
        .bind(targetId)
        .run();
      await runtime.DB.prepare("DELETE FROM users WHERE id = ?")
        .bind(targetId)
        .run();
      return Response.json({ ok: true });
    }

    if (action === "update_user") {
      const targetId = Number(body.userId);
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const name = String(body.name ?? "").trim();
      const requestedRole = String(body.role ?? "");
      const hasOfficerProfile = officerProfileRoles.includes(requestedRole);
      const officerRank = hasOfficerProfile && officerRanks.includes(String(body.officerRank ?? "")) ? String(body.officerRank) : "";
      const gender = hasOfficerProfile && ["M", "F"].includes(String(body.gender ?? "").toUpperCase()) ? String(body.gender).toUpperCase() : "";
      const ethnicity = hasOfficerProfile ? String(body.ethnicity ?? "").trim().slice(0, 60) : "";
      const religion = hasOfficerProfile ? String(body.religion ?? "").trim().slice(0, 60) : "";
      const spiritualStatus = hasOfficerProfile && spiritualStatuses.includes(String(body.spiritualStatus ?? "")) ? String(body.spiritualStatus) : "";
      const officerWorkStatus = hasOfficerProfile && ["working", "studying"].includes(String(body.officerWorkStatus ?? "")) ? String(body.officerWorkStatus) : "";
      const memberSection =
        String(body.memberSection ?? "senior") === "junior"
          ? "junior"
          : "senior";
      const requestedSquad = String(body.squad ?? "");
      const temporaryAccessRole =
        requestedRole === "viewer"
          ? ""
          :
        String(body.temporaryAccessRole ?? "") === "temporary_admin"
          ? "temporary_admin"
          : "";
      const accessExpiresAt = temporaryAccessExpiry(
        temporaryAccessRole,
        body.accessExpiresOn,
      );
      const squad =
        ["nco", "squad_leader", "member"].includes(requestedRole) &&
        allowedSquads.includes(requestedSquad)
          ? requestedSquad
          : "";
      if (
        !targetId ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        !name ||
        !allowedRoles.includes(requestedRole)
      ) {
        return Response.json(
          { error: "Enter a valid name, email, and role" },
          { status: 400 },
        );
      }
      if (targetId === user.id && requestedRole !== "admin") {
        return Response.json(
          { error: "You cannot remove your own administrator role" },
          { status: 400 },
        );
      }
      if (
        ["nco", "squad_leader", "member"].includes(requestedRole) &&
        !squad
      )
        return Response.json(
          {
            error:
              "Select Alpha, Bravo, Charlie, or Delta for the account",
          },
          { status: 400 },
        );
      if (
        temporaryAccessRole === "temporary_admin" &&
        (!accessExpiresAt || accessExpiresAt <= new Date().toISOString())
      )
        return Response.json(
          { error: "Select a future expiry date for temporary admin access" },
          { status: 400 },
        );
      const target = await runtime.DB.prepare(
        "SELECT id, email, role FROM users WHERE id = ?",
      )
        .bind(targetId)
        .first<{ id: number; email: string; role: string }>();
      if (!target)
        return Response.json(
          { error: "User account not found" },
          { status: 404 },
        );
      await runtime.DB.prepare(
        "UPDATE users SET name = ?, email = ?, role = ?, squad = ?, officer_rank = ?, gender = ?, ethnicity = ?, religion = ?, spiritual_status = ?, officer_work_status = ?, temporary_access_role = ?, access_expires_at = ? WHERE id = ?",
      )
        .bind(
          name,
          email,
          requestedRole,
          squad,
          officerRank,
          gender,
          ethnicity,
          religion,
          spiritualStatus,
          officerWorkStatus,
          temporaryAccessRole,
          accessExpiresAt,
          targetId,
        )
        .run();
      if (requestedRole === "member")
        await createOrLinkMemberProfile(
          name,
          email,
          target.role === "member" ? target.email : undefined,
          memberSection,
          squad,
        );
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to complete authentication";
    if (message.includes("UNIQUE constraint failed"))
      return Response.json(
        { error: "That email already has an account" },
        { status: 409 },
      );
    return Response.json({ error: message }, { status: 500 });
  }
}

async function isRateLimited(identity: string) {
  const row = await runtime.DB.prepare(
    "SELECT attempts, window_started_at FROM auth_attempts WHERE identity = ?",
  )
    .bind(identity)
    .first<{ attempts: number; window_started_at: string }>();
  if (!row) return false;
  const windowAge = Date.now() - new Date(row.window_started_at).getTime();
  return windowAge < 15 * 60 * 1000 && row.attempts >= 8;
}

async function recordFailedAttempt(identity: string) {
  const now = new Date().toISOString();
  await runtime.DB.prepare(
    `INSERT INTO auth_attempts (identity, attempts, window_started_at) VALUES (?, 1, ?)
    ON CONFLICT(identity) DO UPDATE SET
      attempts = CASE WHEN datetime(auth_attempts.window_started_at) < datetime('now', '-15 minutes') THEN 1 ELSE auth_attempts.attempts + 1 END,
      window_started_at = CASE WHEN datetime(auth_attempts.window_started_at) < datetime('now', '-15 minutes') THEN excluded.window_started_at ELSE auth_attempts.window_started_at END`,
  )
    .bind(identity, now)
    .run();
}
