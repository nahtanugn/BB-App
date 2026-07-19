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
const allowedRoles = ["admin", "officer", "nco", "squad_leader", "member"];
const allowedSquads = ["Alpha", "Bravo", "Charlie", "Delta"];

async function createOrLinkMemberProfile(
  name: string,
  email: string,
  previousEmail?: string,
  section = "senior",
) {
  const previousProfile = previousEmail
    ? await runtime.DB.prepare(
        "SELECT id FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
      )
        .bind(previousEmail)
        .first<{ id: number }>()
    : null;
  if (previousProfile) {
    await runtime.DB.prepare(
      "UPDATE members SET name = ?, email = ? WHERE id = ?",
    )
      .bind(name, email, previousProfile.id)
      .run();
    return;
  }
  const existingProfile = await runtime.DB.prepare(
    "SELECT id FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1",
  )
    .bind(email)
    .first<{ id: number }>();
  if (existingProfile) return;
  await runtime.DB.prepare(
    `INSERT INTO members
    (name, rank, squad, section, joined_at, service_years, school, contact_number, emergency_contact_number, email, parents_name, is_demo, created_at)
    VALUES (?, 'Private', 'Alpha', ?, ?, 0, '', '', '', ?, '', 0, ?)`,
  )
    .bind(
      name,
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
      if (user?.role !== "admin")
        return Response.json(
          { error: "Administrator access required" },
          { status: 403 },
        );
      const users = await runtime.DB.prepare(
        "SELECT id, email, name, role, squad, active, created_at FROM users ORDER BY name COLLATE NOCASE",
      ).all();
      return Response.json({ user, users: users.results });
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
        "SELECT id, password_hash, password_salt, active FROM users WHERE email = ?",
      )
        .bind(email)
        .first<{
          id: number;
          password_hash: string;
          password_salt: string;
          active: number;
        }>();
      if (
        !row?.active ||
        !(await verifyPassword(password, row.password_salt, row.password_hash))
      ) {
        await recordFailedAttempt(identity);
        return Response.json(
          { error: "Email or password is incorrect" },
          { status: 401 },
        );
      }
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
        "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
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
      const requestedSquad = String(body.squad ?? "");
      const squad =
        role === "squad_leader" && allowedSquads.includes(requestedSquad)
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
      if (role === "squad_leader" && !squad)
        return Response.json(
          {
            error:
              "Select Alpha, Bravo, Charlie, or Delta for the squad leader",
          },
          { status: 400 },
        );
      const result = await runtime.DB.prepare(
        `INSERT INTO users (email, name, role, squad, password_hash, password_salt, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      )
        .bind(
          email,
          name,
          role,
          squad,
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
      const memberSection =
        String(body.memberSection ?? "senior") === "junior"
          ? "junior"
          : "senior";
      const requestedSquad = String(body.squad ?? "");
      const squad =
        requestedRole === "squad_leader" &&
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
      if (requestedRole === "squad_leader" && !squad)
        return Response.json(
          {
            error:
              "Select Alpha, Bravo, Charlie, or Delta for the squad leader",
          },
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
        "UPDATE users SET name = ?, email = ?, role = ?, squad = ? WHERE id = ?",
      )
        .bind(name, email, requestedRole, squad, targetId)
        .run();
      if (requestedRole === "member")
        await createOrLinkMemberProfile(
          name,
          email,
          target.role === "member" ? target.email : undefined,
          memberSection,
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
