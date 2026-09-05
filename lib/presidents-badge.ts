import { env } from "cloudflare:workers";
import { PDFDocument } from "pdf-lib";
import type { AppUser } from "./auth";

export const PRESIDENTS_BADGE_PROFILE = {
  id: "AWA-SR01-2010-9",
  formCode: "AWA-SR01/2010-9",
  sha256: "54e68dcc5536f389fce23a562b32b4b5c7103fc52f323ed17c9b852ee381664b",
  fileSize: 133_566,
  pageCount: 5,
  pageWidth: 595.2,
  pageHeight: 841.68,
} as const;

export const PRESIDENTS_BADGE_STATUSES = [
  "requested", "preparing", "assessments_pending", "captain_review", "ready",
  "finalised", "submitted", "returned", "approved", "rejected", "cancelled",
] as const;

export type PresidentsBadgeStatus = typeof PRESIDENTS_BADGE_STATUSES[number];

type RuntimeEnv = { DB: D1Database; DOCUMENTS?: R2Bucket };
export const presidentsBadgeRuntime = env as unknown as RuntimeEnv;

// Deliberately below Cloudflare's included R2 allowance. These are application
// guardrails, not a replacement for a Cloudflare account budget alert.
export const PRIVATE_DOCUMENT_LIMITS = { bytes: 8 * 1024 * 1024 * 1024, objects: 5_000, writes: 100_000 } as const;

export async function reservePrivateDocument(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 25 * 1024 * 1024) throw new Error("Private document is outside the allowed size limit.");
  const result = await presidentsBadgeRuntime.DB.prepare(`UPDATE private_document_usage SET bytes=bytes+?,objects=objects+1,writes=writes+1,updated_at=? WHERE id=1 AND bytes+?<=? AND objects+1<=? AND writes+1<=?`).bind(bytes, new Date().toISOString(), bytes, PRIVATE_DOCUMENT_LIMITS.bytes, PRIVATE_DOCUMENT_LIMITS.objects, PRIVATE_DOCUMENT_LIMITS.writes).run();
  if (!Number(result.meta?.changes ?? 0)) throw new Error("Private document storage is at its safety limit. Remove old documents or ask an administrator to review storage.");
}

export async function releasePrivateDocument(bytes: number) {
  await presidentsBadgeRuntime.DB.prepare(`UPDATE private_document_usage SET bytes=MAX(0,bytes-?),objects=MAX(0,objects-1),updated_at=? WHERE id=1`).bind(bytes, new Date().toISOString()).run();
}

let schemaReady = false;
export async function ensurePresidentsBadgeSchema() {
  if (schemaReady) return;
  const db = presidentsBadgeRuntime.DB;
  const additions = [
    "ALTER TABLE members ADD COLUMN nric TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE members ADD COLUMN birth_date TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE members ADD COLUMN passport_photo_object_key TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE members ADD COLUMN sensitive_verified_at TEXT",
    "ALTER TABLE members ADD COLUMN sensitive_verified_by_user_id INTEGER",
    "ALTER TABLE users ADD COLUMN contact_number TEXT NOT NULL DEFAULT ''",
  ];
  for (const sql of additions) {
    try { await db.prepare(sql).run(); } catch { /* additive migration may already be applied */ }
  }
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS presidents_badge_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, layout_profile TEXT NOT NULL, form_code TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, file_size INTEGER NOT NULL, page_count INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, uploaded_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(layout_profile, sha256))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS presidents_badge_settings (id INTEGER PRIMARY KEY CHECK(id=1), company_number TEXT NOT NULL DEFAULT '', official_company_name TEXT NOT NULL DEFAULT '', malaysian_state TEXT NOT NULL DEFAULT '', company_stamp_object_key TEXT NOT NULL DEFAULT '', updated_by_user_id INTEGER, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS company_annual_compliance (id INTEGER PRIMARY KEY AUTOINCREMENT, reporting_year INTEGER NOT NULL UNIQUE, brigade_dues_date TEXT NOT NULL DEFAULT '', ros_return_date TEXT NOT NULL DEFAULT '', statistics_return_date TEXT NOT NULL DEFAULT '', updated_by_user_id INTEGER NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS member_camp_history (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, camp_year INTEGER NOT NULL, camp_level TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS presidents_badge_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'requested', application_year INTEGER NOT NULL, exco_meeting_date TEXT NOT NULL DEFAULT '', owner_user_id INTEGER, awards_officer_user_id INTEGER, captain_user_id INTEGER, template_id INTEGER, include_company_stamp INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finalised_at TEXT, submitted_at TEXT, closed_at TEXT, FOREIGN KEY(member_id) REFERENCES members(id), FOREIGN KEY(template_id) REFERENCES presidents_badge_templates(id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS presidents_badge_assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL, assessor_type TEXT NOT NULL, completion_mode TEXT NOT NULL DEFAULT 'web', assessor_name TEXT NOT NULL DEFAULT '', assessor_relationship TEXT NOT NULL DEFAULT '', ratings_json TEXT NOT NULL DEFAULT '{}', reasons_json TEXT NOT NULL DEFAULT '[]', remarks TEXT NOT NULL DEFAULT '', signature_object_key TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', submitted_at TEXT, updated_at TEXT NOT NULL, UNIQUE(application_id, assessor_type), FOREIGN KEY(application_id) REFERENCES presidents_badge_applications(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS private_document_usage (id INTEGER PRIMARY KEY CHECK(id=1), bytes INTEGER NOT NULL DEFAULT 0, objects INTEGER NOT NULL DEFAULT 0, writes INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`),
    db.prepare(`INSERT OR IGNORE INTO private_document_usage(id,bytes,objects,writes,updated_at) VALUES(1,0,0,0,?)`).bind(new Date().toISOString()),
    db.prepare(`CREATE TABLE IF NOT EXISTS presidents_badge_assessment_invitations (id INTEGER PRIMARY KEY AUTOINCREMENT, assessment_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, revoked_at TEXT, last_accessed_at TEXT, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(assessment_id) REFERENCES presidents_badge_assessments(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS staff_signature_profiles (user_id INTEGER PRIMARY KEY, object_key TEXT NOT NULL, sha256 TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS presidents_badge_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL, version_number INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, input_snapshot_json TEXT NOT NULL, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, superseded_at TEXT, UNIQUE(application_id, version_number), FOREIGN KEY(application_id) REFERENCES presidents_badge_applications(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS presidents_badge_outcomes (id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL, outcome TEXT NOT NULL, outcome_date TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', returned_document_object_key TEXT NOT NULL DEFAULT '', confirmed_external_decision INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', recorded_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(application_id) REFERENCES presidents_badge_applications(id) ON DELETE CASCADE)`),
    db.prepare("CREATE INDEX IF NOT EXISTS presidents_badge_application_member_idx ON presidents_badge_applications(member_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS presidents_badge_camp_member_idx ON member_camp_history(member_id, camp_year)"),
  ]);
  schemaReady = true;
}

export function hasPresidentPermission(user: AppUser, permission: string) {
  if (permission === "presidents_badge.template") return user.role === "admin";
  if (user.role === "admin") return true;
  if (user.role === "officer") return true;
  return user.role !== "viewer" && user.custom_permissions.includes(permission);
}

export function mayManagePresidentApplication(user: AppUser) {
  return hasPresidentPermission(user, "presidents_badge.manage");
}

export async function sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function validateOfficialTemplate(bytes: Uint8Array) {
  if (bytes.byteLength !== PRESIDENTS_BADGE_PROFILE.fileSize)
    throw new Error(`The official ${PRESIDENTS_BADGE_PROFILE.formCode} file must be exactly ${PRESIDENTS_BADGE_PROFILE.fileSize.toLocaleString()} bytes.`);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("The uploaded file is not a PDF.");
  const hash = await sha256Bytes(bytes);
  if (hash !== PRESIDENTS_BADGE_PROFILE.sha256) throw new Error("This PDF is not the mapped official AWA-SR01/2010-9 master.");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (pdf.getPageCount() !== PRESIDENTS_BADGE_PROFILE.pageCount) throw new Error("The official form must contain five pages.");
  for (const [index, page] of pdf.getPages().entries()) {
    const { width, height } = page.getSize();
    if (Math.abs(width - PRESIDENTS_BADGE_PROFILE.pageWidth) > 1 || Math.abs(height - PRESIDENTS_BADGE_PROFILE.pageHeight) > 1)
      throw new Error(`Page ${index + 1} is not A4 portrait.`);
  }
  return { hash, pageCount: pdf.getPageCount() };
}

export function validateOverlayText(value: string, label: string, limit: number) {
  const text = value.trim();
  if (text.length > limit) throw new Error(`${label} is too long for the official form (${limit} characters maximum).`);
  if (!/^[\x20-\x7E]*$/.test(text)) throw new Error(`${label} contains characters that the official PDF font cannot safely encode.`);
  return text;
}

export async function memberIdForUser(user: AppUser) {
  const row = await presidentsBadgeRuntime.DB.prepare("SELECT id FROM members WHERE LOWER(email)=LOWER(?) LIMIT 1").bind(user.email).first<{ id: number }>();
  return row?.id ?? null;
}

const activeStatuses = PRESIDENTS_BADGE_STATUSES.filter((value) => !["approved", "rejected", "cancelled"].includes(value));
export function activeStatusSql() { return activeStatuses.map(() => "?").join(","); }
export function activeStatusValues() { return [...activeStatuses]; }

type AwardRow = { award_code: string; award_name: string; level: string; awarded_at: string; category: string };
export async function calculateEligibility(memberId: number, excoMeetingDate = "") {
  const db = presidentsBadgeRuntime.DB;
  const member = await db.prepare(`SELECT id,name,rank,section,joined_at,birth_date,nric,passport_photo_object_key FROM members WHERE id=?`).bind(memberId).first<Record<string, string | number | null>>();
  if (!member) throw new Error("Member not found.");
  const awards = await db.prepare(`SELECT ma.award_code,COALESCE(ad.name,ma.award_code) award_name,ma.level,ma.awarded_at,COALESCE(ad.category,'') category FROM member_awards ma LEFT JOIN award_definitions ad ON ad.code=ma.award_code WHERE ma.member_id=? AND ma.status='awarded'`).bind(memberId).all<AwardRow>();
  const owned = new Map(awards.results.map((row) => [row.award_code, row]));
  const age = member.birth_date ? Math.floor((Date.now() - new Date(String(member.birth_date)).getTime()) / 31_556_952_000) : null;
  const rankEligible = ["Lance Corporal", "Corporal", "Sergeant", "Staff Sergeant"].includes(String(member.rank));
  const required = [
    ["nco_proficiency", "advanced", "NCO Proficiency Star Advanced"],
    ["christian_education", "advanced", "Christian Education Advanced"],
    ["drill", "advanced", "Drill Advanced"],
    ["recruitment", "basic", "Recruitment Basic"],
    ["three_year_service", "", "Three-Year Service Award"],
  ] as const;
  const compulsory = required.map(([code, level, label]) => ({ label, met: Boolean(owned.get(code) && (!level || owned.get(code)?.level === level)) }));
  const groupAwards = awards.results.filter((row) => /^[A-D]/.test(row.category));
  const distinctGroups = new Set(groupAwards.map((row) => row.category.slice(0, 1)));
  const deadlineMet = !excoMeetingDate || new Date(excoMeetingDate).getTime() - Date.now() >= 14 * 86_400_000;
  const checks = [
    { label: "Senior Section member", met: member.section === "senior" },
    { label: "Lance Corporal or higher", met: rankEligible },
    { label: "At least 15 years old", met: age !== null && age >= 15 },
    { label: "Active membership", met: true },
    ...compulsory,
    { label: "Six Group A–D awards", met: groupAwards.length >= 6 },
    { label: "At least one award from each group", met: ["A", "B", "C", "D"].every((group) => distinctGroups.has(group)) },
    { label: "At least four Advanced group awards", met: groupAwards.filter((row) => row.level === "advanced").length >= 4 },
    { label: "EXCO deadline is at least two weeks away", met: deadlineMet },
  ];
  return { member, awards: awards.results, checks, eligible: checks.every((check) => check.met), age };
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
