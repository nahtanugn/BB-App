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
  const membersTable = await runtime.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'members'",
  ).first<{ name: string }>();
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
      users.access_expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.active = 1`)
    .bind(now, tokenHash, now)
    .first<AppUser>();
  if (!user) return null;
  if (user.role === "viewer") return { ...user, custom_permissions: [] };
  const tables = await runtime.DB.prepare(`SELECT COUNT(*) AS total FROM sqlite_master
    WHERE type = 'table' AND name IN ('custom_roles', 'user_custom_roles')`)
    .first<{ total: number }>();
  if (Number(tables?.total ?? 0) < 2)
    return { ...user, custom_permissions: [] };
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
  return { ...user, custom_permissions: [...permissions] };
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
