import { env } from "cloudflare:workers";

export type AppUser = {
  id: number;
  email: string;
  name: string;
  role:
    | "admin"
    | "officer"
    | "nco"
    | "squad_leader"
    | "viewer"
    | "member";
  squad: string;
  member_section: string;
  temporary_access_role: string;
  access_expires_at: string | null;
  custom_permissions: string[];
  account_status: "pending" | "active" | "rejected";
  must_change_password: number;
  onboarding_completed_at: string | null;
  profile_confirmed_at: string | null;
  tour_completed_at: string | null;
  privacy_notice_version: number;
  current_privacy_version: number;
  onboarding_required: boolean;
};

type RuntimeEnv = {
  DB: D1Database;
  ADMIN_EMAIL?: string;
  SETUP_TOKEN?: string;
};

const runtime = env as unknown as RuntimeEnv;
const encoder = new TextEncoder();
let authInitialized = false;

export async function ensureAuthSchema() {
  if (authInitialized) return;
  await runtime.DB.batch([
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS members (
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
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'officer',
      squad TEXT NOT NULL DEFAULT '',
      temporary_access_role TEXT NOT NULL DEFAULT '',
      access_expires_at TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      account_status TEXT NOT NULL DEFAULT 'active',
      must_change_password INTEGER NOT NULL DEFAULT 0,
      onboarding_completed_at TEXT,
      profile_confirmed_at TEXT,
      tour_completed_at TEXT,
      privacy_notice_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash)"),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_attempts (
      identity TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      window_started_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS registration_details (
      user_id INTEGER PRIMARY KEY,
      section TEXT NOT NULL,
      squad TEXT NOT NULL,
      joined_year TEXT NOT NULL,
      school TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      emergency_contact_number TEXT NOT NULL,
      parents_name TEXT NOT NULL,
      suggested_member_id INTEGER,
      review_notes TEXT NOT NULL DEFAULT '',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS profile_correction_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      proposed_values TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      review_notes TEXT NOT NULL DEFAULT '',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS onboarding_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      subject_user_id INTEGER,
      subject_member_id INTEGER,
      actor_user_id INTEGER,
      actor_name TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by INTEGER,
      updated_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS privacy_notice_versions (
      version INTEGER PRIMARY KEY,
      notice_text TEXT NOT NULL,
      require_reacknowledgement INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at TEXT NOT NULL
    )`),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_profile_corrections_status_member ON profile_correction_requests(status, member_id)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_onboarding_audit_created ON onboarding_audit_log(created_at)"),
  ]);
  const userColumns = await runtime.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  if (!userColumns.results.some((column) => column.name === "squad")) {
    await runtime.DB.prepare("ALTER TABLE users ADD COLUMN squad TEXT NOT NULL DEFAULT ''").run();
  }
  if (!userColumns.results.some((column) => column.name === "access_expires_at")) {
    await runtime.DB.prepare("ALTER TABLE users ADD COLUMN access_expires_at TEXT").run();
  }
  if (!userColumns.results.some((column) => column.name === "temporary_access_role")) {
    await runtime.DB.prepare(
      "ALTER TABLE users ADD COLUMN temporary_access_role TEXT NOT NULL DEFAULT ''",
    ).run();
  }
  const onboardingColumns = [
    ["account_status", "ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'"],
    ["must_change_password", "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"],
    ["onboarding_completed_at", "ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT"],
    ["profile_confirmed_at", "ALTER TABLE users ADD COLUMN profile_confirmed_at TEXT"],
    ["tour_completed_at", "ALTER TABLE users ADD COLUMN tour_completed_at TEXT"],
    ["privacy_notice_version", "ALTER TABLE users ADD COLUMN privacy_notice_version INTEGER NOT NULL DEFAULT 0"],
  ].filter(([column]) => !userColumns.results.some((existing) => existing.name === column));
  for (const [, statement] of onboardingColumns)
    await runtime.DB.prepare(statement).run();
  await runtime.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)",
  ).run();
  const now = new Date().toISOString();
  await runtime.DB.prepare(`INSERT INTO app_settings
    (setting_key, setting_value, version, updated_at)
    VALUES ('privacy_notice', ?, 1, ?)
    ON CONFLICT(setting_key) DO NOTHING`)
    .bind(
      "11KCHBB uses your submitted information only for company administration, attendance, awards, subscriptions, resources and member safety. Access is limited according to each account’s role. Please confirm that your details are accurate.",
      now,
    )
    .run();
  await runtime.DB.prepare(`INSERT INTO privacy_notice_versions
    (version, notice_text, require_reacknowledgement, created_at)
    SELECT version, setting_value, 0, updated_at FROM app_settings
    WHERE setting_key = 'privacy_notice'
    ON CONFLICT(version) DO NOTHING`)
    .run();
  const membersTable = await runtime.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'members'",
  ).first<{ name: string }>();
  const onboardingInitialized = await runtime.DB.prepare(
    "SELECT setting_key FROM app_settings WHERE setting_key = 'onboarding_initialized_v1'",
  ).first<{ setting_key: string }>();
  if (!onboardingInitialized && membersTable) {
    await runtime.DB.prepare(`UPDATE users SET
      onboarding_completed_at = ?,
      profile_confirmed_at = ?,
      tour_completed_at = ?,
      privacy_notice_version = 1
      WHERE account_status = 'active' AND (
        role != 'member' OR EXISTS (
          SELECT 1 FROM members
          WHERE LOWER(members.email) = LOWER(users.email)
            AND TRIM(members.name) != ''
            AND TRIM(members.joined_at) != ''
            AND TRIM(members.school) != ''
            AND TRIM(members.contact_number) != ''
            AND TRIM(members.emergency_contact_number) != ''
            AND TRIM(members.parents_name) != ''
        )
      )`).bind(now, now, now).run();
  } else if (!onboardingInitialized) {
    await runtime.DB.prepare(`UPDATE users SET
      onboarding_completed_at = ?,
      profile_confirmed_at = ?,
      tour_completed_at = ?,
      privacy_notice_version = 1
      WHERE account_status = 'active' AND role != 'member'`)
      .bind(now, now, now)
      .run();
  }
  if (!onboardingInitialized)
    await runtime.DB.prepare(`INSERT INTO app_settings
      (setting_key, setting_value, version, updated_at)
      VALUES ('onboarding_initialized_v1', 'complete', 1, ?)`)
      .bind(now)
      .run();
  if (membersTable) {
    await runtime.DB.prepare(`UPDATE users
      SET temporary_access_role = 'temporary_admin',
          role = CASE
            WHEN EXISTS (
              SELECT 1 FROM members
              WHERE LOWER(members.email) = LOWER(users.email)
            ) THEN 'member'
            ELSE 'officer'
          END
      WHERE role = 'temporary_admin'`).run();
  } else {
    await runtime.DB.prepare(`UPDATE users
      SET temporary_access_role = 'temporary_admin', role = 'officer'
      WHERE role = 'temporary_admin'`).run();
  }
  authInitialized = true;
}

export function getRuntimeEnv() {
  return runtime;
}

export function hasTemporaryAdminAccess(user: AppUser | null | undefined) {
  return Boolean(
    user?.role !== "viewer" &&
      user?.temporary_access_role === "temporary_admin" &&
      user.access_expires_at &&
      user.access_expires_at > new Date().toISOString(),
  );
}

export function hasOperationalAdminAccess(
  user: AppUser | null | undefined,
) {
  return Boolean(
    user &&
      (["admin", "officer"].includes(user.role) ||
        hasTemporaryAdminAccess(user)),
  );
}

export function hasAdminOrTemporaryAccess(
  user: AppUser | null | undefined,
) {
  return Boolean(
    user && (user.role === "admin" || hasTemporaryAdminAccess(user)),
  );
}

export async function passwordDigest(password: string, salt?: string) {
  const saltBytes = salt ? fromHex(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    // Cloudflare Workers supports up to 100,000 PBKDF2 iterations.
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 100_000 },
    key,
    256,
  );
  return { hash: toHex(new Uint8Array(bits)), salt: toHex(saltBytes) };
}

export async function verifyPassword(password: string, salt: string, expected: string) {
  const { hash } = await passwordDigest(password, salt);
  if (hash.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < hash.length; index += 1) difference |= hash.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export async function getCurrentUser(request: Request): Promise<AppUser | null> {
  await ensureAuthSchema();
  const token = cookieValue(request.headers.get("cookie"), "anchor_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const user = await runtime.DB.prepare(`SELECT users.id, users.email, users.name, users.role, users.squad,
      COALESCE((SELECT members.section FROM members
        WHERE LOWER(members.email) = LOWER(users.email) LIMIT 1), '') AS member_section,
      CASE
        WHEN users.temporary_access_role = 'temporary_admin'
          AND users.access_expires_at IS NOT NULL
          AND users.access_expires_at > ?
        THEN users.temporary_access_role
        ELSE ''
      END AS temporary_access_role,
      users.access_expires_at,
      users.account_status, users.must_change_password,
      users.onboarding_completed_at, users.profile_confirmed_at, users.tour_completed_at,
      users.privacy_notice_version,
      COALESCE((SELECT version FROM app_settings WHERE setting_key = 'privacy_notice'), 1) AS current_privacy_version
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1
      AND users.account_status = 'active'`)
    .bind(now, tokenHash, now)
    .first<AppUser>();
  if (!user) return null;
  const withOnboarding = {
    ...user,
    onboarding_required: Boolean(
      user.must_change_password ||
      !user.onboarding_completed_at ||
      user.privacy_notice_version < user.current_privacy_version
    ),
  };
  if (user.role === "viewer") return { ...withOnboarding, custom_permissions: [] };
  const tables = await runtime.DB.prepare(`SELECT COUNT(*) AS total FROM sqlite_master
    WHERE type = 'table' AND name IN ('custom_roles', 'user_custom_roles')`)
    .first<{ total: number }>();
  if (Number(tables?.total ?? 0) < 2)
    return { ...withOnboarding, custom_permissions: [] };
  const roleRows = await runtime.DB.prepare(`SELECT r.permissions
    FROM user_custom_roles ur
    JOIN custom_roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND (ur.expires_at IS NULL OR ur.expires_at > ?)`)
    .bind(user.id, now)
    .all<{ permissions: string }>();
  const permissions = new Set<string>();
  for (const row of roleRows.results) {
    try {
      const values = JSON.parse(row.permissions);
      if (Array.isArray(values))
        values.forEach((value) => permissions.add(String(value)));
    } catch {
      // Ignore malformed legacy permission data.
    }
  }
  return { ...withOnboarding, custom_permissions: [...permissions] };
}

export async function createSession(userId: number) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64Url(tokenBytes);
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await runtime.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expires.toISOString(), now.toISOString()).run();
  return `anchor_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

export async function destroySession(request: Request) {
  const token = cookieValue(request.headers.get("cookie"), "anchor_session");
  if (token) await runtime.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return "anchor_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function cookieValue(header: string | null, name: string) {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
