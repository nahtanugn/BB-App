import { PDFDocument } from "pdf-lib";
import type { AppUser } from "./auth";
import { ensurePresidentsBadgeSchema, memberIdForUser, presidentsBadgeRuntime, sha256Bytes } from "./presidents-badge";

export const JUNIOR_GOLD_PROFILE = {
  id: "AWA-JR01-2010-9",
  formCode: "AWA-JR01/2010-9",
  sha256: "a466daca54cffaaaa558a07752282e68eed7a114ba74e6368d4f21f6f88e6c82",
  fileSize: 82_506,
  pageCount: 2,
  pageWidth: 595.2,
  pageHeight: 841.68,
} as const;

export const JUNIOR_GOLD_STATUSES = ["requested", "preparing", "ready", "finalised", "submitted", "returned", "approved", "rejected", "cancelled"] as const;
const activeStatuses = JUNIOR_GOLD_STATUSES.filter((value) => !["approved", "rejected", "cancelled"].includes(value));

let schemaReady = false;
export async function ensureJuniorGoldSchema() {
  await ensurePresidentsBadgeSchema();
  if (schemaReady) return;
  const db = presidentsBadgeRuntime.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS junior_gold_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, layout_profile TEXT NOT NULL, form_code TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, file_size INTEGER NOT NULL, page_count INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, uploaded_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(layout_profile,sha256))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS junior_gold_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'requested', application_year INTEGER NOT NULL, exco_meeting_date TEXT NOT NULL DEFAULT '', owner_user_id INTEGER, awards_officer_user_id INTEGER, captain_user_id INTEGER, template_id INTEGER, project_completed INTEGER NOT NULL DEFAULT 0, include_company_stamp INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finalised_at TEXT, submitted_at TEXT, closed_at TEXT, FOREIGN KEY(member_id) REFERENCES members(id), FOREIGN KEY(template_id) REFERENCES junior_gold_templates(id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS junior_gold_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL, version_number INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, input_snapshot_json TEXT NOT NULL, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, superseded_at TEXT, UNIQUE(application_id,version_number), FOREIGN KEY(application_id) REFERENCES junior_gold_applications(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS junior_gold_outcomes (id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL, outcome TEXT NOT NULL, outcome_date TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', confirmed_external_decision INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', recorded_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(application_id) REFERENCES junior_gold_applications(id) ON DELETE CASCADE)`),
    db.prepare("CREATE INDEX IF NOT EXISTS junior_gold_member_status_idx ON junior_gold_applications(member_id,status)"),
  ]);
  schemaReady = true;
}

export function hasJuniorGoldPermission(user: AppUser, permission: string) {
  if (permission === "junior_gold.template") return user.role === "admin";
  if (["admin", "officer"].includes(user.role)) return true;
  return user.role !== "viewer" && user.custom_permissions.includes(permission);
}

export const mayManageJuniorGold = (user: AppUser) => hasJuniorGoldPermission(user, "junior_gold.manage");
export { memberIdForUser };
export function activeJuniorGoldSql() { return activeStatuses.map(() => "?").join(","); }
export function activeJuniorGoldValues() { return [...activeStatuses]; }

export async function validateJuniorGoldTemplate(bytes: Uint8Array) {
  if (bytes.byteLength !== JUNIOR_GOLD_PROFILE.fileSize) throw new Error(`The official ${JUNIOR_GOLD_PROFILE.formCode} file must be exactly ${JUNIOR_GOLD_PROFILE.fileSize.toLocaleString()} bytes.`);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("The uploaded file is not a PDF.");
  const hash = await sha256Bytes(bytes);
  if (hash !== JUNIOR_GOLD_PROFILE.sha256) throw new Error("This PDF is not the mapped official AWA-JR01/2010-9 master.");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (pdf.getPageCount() !== JUNIOR_GOLD_PROFILE.pageCount) throw new Error("The official Junior Gold Award form must contain two pages.");
  for (const [index, page] of pdf.getPages().entries()) {
    const { width, height } = page.getSize();
    if (Math.abs(width - JUNIOR_GOLD_PROFILE.pageWidth) > 1 || Math.abs(height - JUNIOR_GOLD_PROFILE.pageHeight) > 1) throw new Error(`Page ${index + 1} is not the mapped A4 portrait page.`);
  }
  return { hash, pageCount: pdf.getPageCount() };
}

function ageOnFirstJanuary(birthDate: string, year: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const born = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const onDate = new Date(Date.UTC(year, 0, 1));
  let age = onDate.getUTCFullYear() - born.getUTCFullYear();
  if (onDate.getUTCMonth() < born.getUTCMonth() || (onDate.getUTCMonth() === born.getUTCMonth() && onDate.getUTCDate() < born.getUTCDate())) age--;
  return age;
}

export async function calculateJuniorGoldEligibility(memberId: number, applicationYear: number, excoMeetingDate = "", projectCompleted = false) {
  const db = presidentsBadgeRuntime.DB;
  const member = await db.prepare(`SELECT id,name,rank,squad,section,email,gender,joined_at,birth_date,nric,passport_photo_object_key,contact_number FROM members WHERE id=?`).bind(memberId).first<Record<string, string | number | null>>();
  if (!member) throw new Error("Member not found.");
  const awards = await db.prepare(`SELECT ma.award_code,COALESCE(ad.name,ma.award_code) award_name,ma.awarded_at FROM member_awards ma LEFT JOIN award_definitions ad ON ad.code=ma.award_code WHERE ma.member_id=? AND ma.status='awarded' AND ma.award_code IN ('junior_white','junior_green','junior_purple','junior_blue','junior_red','junior_silver') ORDER BY ad.sort_order`).bind(memberId).all<{ award_code:string; award_name:string; awarded_at:string }>();
  const required = ["junior_white", "junior_green", "junior_purple", "junior_blue", "junior_red", "junior_silver"];
  const owned = new Set(awards.results.map((award) => award.award_code));
  const attendance = await db.prepare(`SELECT substr(s.meeting_date,1,4) year,SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) present,SUM(CASE WHEN ar.status IN ('present','absent') THEN 1 ELSE 0 END) counted FROM attendance_sessions s JOIN attendance_records ar ON ar.session_id=s.id WHERE ar.member_id=? AND s.section='junior' AND s.meeting_date<=date('now') GROUP BY substr(s.meeting_date,1,4) ORDER BY year DESC`).bind(memberId).all<{ year:string; present:number; counted:number }>();
  const attendanceYears = attendance.results.map((row) => ({ year: Number(row.year), present: Number(row.present), counted: Number(row.counted), percentage: Number(row.counted) ? Math.round(Number(row.present) * 100 / Number(row.counted)) : 0 }));
  const qualifyingAttendance = attendanceYears.filter((row) => row.counted > 0 && row.percentage >= 90);
  const age = ageOnFirstJanuary(String(member.birth_date ?? ""), applicationYear);
  const deadlineMet = !excoMeetingDate || new Date(excoMeetingDate).getTime() - Date.now() >= 14 * 86_400_000;
  const checks = [
    { label: "All six preliminary Junior Section badges", met: required.every((code) => owned.has(code)) },
    { label: "BBM HQ assignment / project / test completed", met: projectCompleted },
    { label: "Age 11 to 13 on 1 January", met: age !== null && age >= 11 && age <= 13 },
    { label: "Current Junior or Senior Section member", met: ["junior", "senior"].includes(String(member.section)) },
    { label: "Two Junior sessions with at least 90% attendance", met: qualifyingAttendance.length >= 2 },
    { label: "EXCO deadline is at least two weeks away", met: deadlineMet },
  ];
  return { member, awards: awards.results, attendanceYears, qualifyingAttendance, age, checks, eligible: checks.every((check) => check.met) };
}
