import { getCurrentUser, verifyPassword } from "../../../lib/auth";
import { writeAuditEvent } from "../../../lib/audit";
import { activeUserIdsForRoles, createNotifications } from "../../../lib/notifications";
import {
  activeStatusSql, activeStatusValues, calculateEligibility, ensurePresidentsBadgeSchema,
  hasPresidentPermission, mayManagePresidentApplication, memberIdForUser,
  PRESIDENTS_BADGE_PROFILE, PRESIDENTS_BADGE_STATUSES, presidentsBadgeRuntime, reservePrivateDocument, releasePrivateDocument,
  randomToken, sha256Bytes, validateOfficialTemplate, validateOverlayText,
} from "../../../lib/presidents-badge";
import { AWA_SR01_COORDINATES, generatePresidentsBadgePdf, type OverlayText } from "../../../lib/presidents-badge-pdf";
import { ensureAutomationSchema } from "../../../lib/automation";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, { ...init, headers: { ...noStore, ...(init.headers ?? {}) } });
const asId = (value: unknown) => Number.parseInt(String(value ?? "0"), 10);
const now = () => new Date().toISOString();
const terminal = ["approved", "rejected", "cancelled"];

async function applicationAccess(user: Awaited<ReturnType<typeof getCurrentUser>>, applicationId: number) {
  if (!user) return null;
  const row = await presidentsBadgeRuntime.DB.prepare(`SELECT a.*,m.email member_email,m.name member_name FROM presidents_badge_applications a JOIN members m ON m.id=a.member_id WHERE a.id=?`).bind(applicationId).first<Record<string, string | number | null>>();
  if (!row) return null;
  const own = String(row.member_email).toLowerCase() === user.email.toLowerCase();
  if (!own && !mayManagePresidentApplication(user) && !hasPresidentPermission(user, "presidents_badge.view_sensitive")) return null;
  return { row, own };
}

async function r2Required() {
  const bucket = presidentsBadgeRuntime.DOCUMENTS;
  if (!bucket) throw new Error("Private document storage is unavailable. Redeploy the app with the DOCUMENTS R2 binding.");
  return bucket;
}

async function storePrivateFile(prefix: string, bytes: Uint8Array, contentType: string) {
  const bucket = await r2Required();
  await reservePrivateDocument(bytes.byteLength);
  const hash = await sha256Bytes(bytes);
  const key = `presidents-badge/${prefix}/${crypto.randomUUID()}`;
  try { await bucket.put(key, bytes, { httpMetadata: { contentType }, customMetadata: { sha256: hash } }); } catch (error) { await releasePrivateDocument(bytes.byteLength); throw error; }
  return { key, hash };
}

function validateImage(file: File, bytes: Uint8Array, max = 5 * 1024 * 1024) {
  if (file.size < 20 || file.size > max) throw new Error("Image must be between 20 bytes and 5 MB.");
  if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("Use a PNG or JPEG image. WebP images should be converted before upload.");
  const png = bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
  const jpeg = bytes[0]===0xff&&bytes[1]===0xd8&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9;
  if ((file.type==="image/png"&&!png)||(file.type==="image/jpeg"&&!jpeg)) throw new Error("The image contents do not match its file type.");
}

async function notifyStaff(entityKey: string, title: string, body: string, targetUrl: string) {
  const recipients = await activeUserIdsForRoles(["admin", "officer"]);
  await createNotifications({ recipientUserIds: recipients, type: "award", title, body, targetUrl, entityKey });
}

async function actionItem(key:string,recipients:number[],title:string,description:string,applicationId:number,priority="important"){
  await ensureAutomationSchema(presidentsBadgeRuntime.DB);
  const created=now();
  for(const recipient of [...new Set(recipients)])await presidentsBadgeRuntime.DB.prepare(`INSERT INTO automation_action_items(dedupe_key,rule_key,recipient_user_id,title,description,target_url,priority,source_type,source_id,status,first_seen_at,last_seen_at) VALUES(?,'presidents_badge',?,?,?,?,?,'presidents_badge',?,'open',?,?) ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title,description=excluded.description,target_url=excluded.target_url,status='open',last_seen_at=excluded.last_seen_at,resolved_at=NULL`).bind(`${key}:${recipient}`,recipient,title,description,`/?open=presidents-badge&application=${applicationId}`,priority,String(applicationId),created,created).run();
}

async function resolveAction(key:string){await ensureAutomationSchema(presidentsBadgeRuntime.DB);await presidentsBadgeRuntime.DB.prepare("UPDATE automation_action_items SET status='resolved',resolved_at=? WHERE dedupe_key LIKE ? AND status IN ('open','snoozed')").bind(now(),`${key}:%`).run();}

export async function GET(request: Request) {
  await ensurePresidentsBadgeSchema();
  const user = await getCurrentUser(request);
  if (!user) return json({ error: "Sign in required" }, { status: 401 });
  const url = new URL(request.url);
  const applicationId = asId(url.searchParams.get("applicationId"));
  const ownMemberId = await memberIdForUser(user);
  const canManage = mayManagePresidentApplication(user);
  if (applicationId) {
    const access = await applicationAccess(user, applicationId);
    if (!access) return json({ error: "Application not found or access is not permitted" }, { status: 404 });
    const [member, assessments, versions, camps, outcomes, officers] = await Promise.all([
      presidentsBadgeRuntime.DB.prepare(`SELECT id,name,rank,squad,section,joined_at,school,contact_number,email,parents_name,nric,birth_date,passport_photo_object_key FROM members WHERE id=?`).bind(access.row.member_id).first(),
      presidentsBadgeRuntime.DB.prepare("SELECT id,assessor_type,completion_mode,assessor_name,assessor_relationship,status,submitted_at,updated_at FROM presidents_badge_assessments WHERE application_id=? ORDER BY assessor_type").bind(applicationId).all(),
      presidentsBadgeRuntime.DB.prepare("SELECT id,version_number,sha256,created_at,superseded_at FROM presidents_badge_versions WHERE application_id=? ORDER BY version_number DESC").bind(applicationId).all(),
      presidentsBadgeRuntime.DB.prepare("SELECT * FROM member_camp_history WHERE member_id=? ORDER BY camp_year DESC,id DESC").bind(access.row.member_id).all(),
      presidentsBadgeRuntime.DB.prepare("SELECT * FROM presidents_badge_outcomes WHERE application_id=? ORDER BY id DESC").bind(applicationId).all(),
      presidentsBadgeRuntime.DB.prepare("SELECT id,name,email,officer_rank,contact_number FROM users WHERE active=1 AND role IN ('admin','officer') ORDER BY name").all(),
    ]);
    return json({ application: access.row, member, assessments: assessments.results, versions: versions.results, camps: camps.results, outcomes: outcomes.results, officers: officers.results, eligibility: await calculateEligibility(Number(access.row.member_id), String(access.row.exco_meeting_date ?? "")), permissions: { canManage, canTemplate: hasPresidentPermission(user, "presidents_badge.template"), canEndorse: hasPresidentPermission(user, "presidents_badge.endorse"), canOutcome: hasPresidentPermission(user, "presidents_badge.outcome") }, r2Available: Boolean(presidentsBadgeRuntime.DOCUMENTS) });
  }
  const filter = canManage ? "1=1" : "LOWER(m.email)=LOWER(?)";
  const statement = presidentsBadgeRuntime.DB.prepare(`SELECT a.id,a.member_id,a.status,a.application_year,a.exco_meeting_date,a.owner_user_id,a.updated_at,m.name member_name,m.rank FROM presidents_badge_applications a JOIN members m ON m.id=a.member_id WHERE ${filter} ORDER BY a.updated_at DESC`);
  const applications = canManage ? await statement.all() : await statement.bind(user.email).all();
  const members = canManage
    ? await presidentsBadgeRuntime.DB.prepare("SELECT id,name,rank,squad,section,email FROM members WHERE section='senior' ORDER BY name").all()
    : { results: ownMemberId ? (await presidentsBadgeRuntime.DB.prepare("SELECT id,name,rank,squad,section,email FROM members WHERE id=?").bind(ownMemberId).all()).results : [] };
  const template = await presidentsBadgeRuntime.DB.prepare("SELECT id,layout_profile,form_code,sha256,file_size,page_count,created_at FROM presidents_badge_templates WHERE active=1 ORDER BY id DESC LIMIT 1").first();
  const settings = await presidentsBadgeRuntime.DB.prepare("SELECT * FROM presidents_badge_settings WHERE id=1").first();
  return json({ applications: applications.results, members: members.results, template, settings, profile: PRESIDENTS_BADGE_PROFILE, r2Available: Boolean(presidentsBadgeRuntime.DOCUMENTS), permissions: { canManage, canTemplate: hasPresidentPermission(user, "presidents_badge.template"), canEndorse: hasPresidentPermission(user, "presidents_badge.endorse"), canOutcome: hasPresidentPermission(user, "presidents_badge.outcome") } });
}

export async function POST(request: Request) {
  await ensurePresidentsBadgeSchema();
  const user = await getCurrentUser(request);
  if (!user) return json({ error: "Sign in required" }, { status: 401 });
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action") ?? "");
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Choose a file first.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (action === "upload_template") {
        if (!hasPresidentPermission(user, "presidents_badge.template")) return json({ error: "Administrator template permission required" }, { status: 403 });
        const checked = await validateOfficialTemplate(bytes);
        const stored = await storePrivateFile("templates", bytes, "application/pdf");
        const created = now();
        await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_templates SET active=0 WHERE layout_profile=?").bind(PRESIDENTS_BADGE_PROFILE.id).run();
        await presidentsBadgeRuntime.DB.prepare(`INSERT INTO presidents_badge_templates(layout_profile,form_code,object_key,sha256,file_size,page_count,active,uploaded_by_user_id,created_at) VALUES(?,?,?,?,?,?,1,?,?) ON CONFLICT(layout_profile,sha256) DO UPDATE SET object_key=excluded.object_key,active=1,uploaded_by_user_id=excluded.uploaded_by_user_id,created_at=excluded.created_at`).bind(PRESIDENTS_BADGE_PROFILE.id, PRESIDENTS_BADGE_PROFILE.formCode, stored.key, checked.hash, bytes.byteLength, checked.pageCount, user.id, created).run();
        await writeAuditEvent({ actor: user, action: "presidents_badge.template_uploaded", entityType: "presidents_badge_template", after: { profile: PRESIDENTS_BADGE_PROFILE.id, sha256: stored.hash, size: bytes.byteLength } });
        return json({ ok: true });
      }
      if (action === "upload_photo") {
        const memberId = asId(form.get("memberId"));
        const own = memberId === await memberIdForUser(user);
        if (!own && !mayManagePresidentApplication(user)) return json({ error: "Permission denied" }, { status: 403 });
        validateImage(file, bytes);
        const stored = await storePrivateFile(`members/${memberId}/photo`, bytes, file.type);
        await presidentsBadgeRuntime.DB.prepare("UPDATE members SET passport_photo_object_key=? WHERE id=?").bind(stored.key, memberId).run();
        await writeAuditEvent({ actor: user, action: "member.passport_photo_updated", entityType: "member", entityId: memberId, after: { sha256: stored.hash } });
        return json({ ok: true });
      }
      if (action === "upload_signature") {
        if (!mayManagePresidentApplication(user)) return json({ error: "Officer access required" }, { status: 403 });
        validateImage(file, bytes, 2 * 1024 * 1024);
        const stored = await storePrivateFile(`staff/${user.id}/signature`, bytes, file.type);
        await presidentsBadgeRuntime.DB.prepare("INSERT INTO staff_signature_profiles(user_id,object_key,sha256,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET object_key=excluded.object_key,sha256=excluded.sha256,updated_at=excluded.updated_at").bind(user.id, stored.key, stored.hash, now()).run();
        await writeAuditEvent({ actor: user, action: "presidents_badge.signature_profile_updated", entityType: "user", entityId: user.id, after: { sha256: stored.hash } });
        return json({ ok: true });
      }
      if (action === "upload_stamp") {
        if (user.role !== "admin") return json({ error: "Administrator access required" }, { status: 403 });
        validateImage(file, bytes, 2 * 1024 * 1024);
        const stored = await storePrivateFile("company/stamp", bytes, file.type);
        await presidentsBadgeRuntime.DB.prepare("INSERT INTO presidents_badge_settings(id,company_stamp_object_key,updated_by_user_id,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET company_stamp_object_key=excluded.company_stamp_object_key,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at").bind(stored.key, user.id, now()).run();
        await writeAuditEvent({ actor: user, action: "presidents_badge.company_stamp_updated", entityType: "presidents_badge_settings", entityId: 1, after: { sha256: stored.hash } });
        return json({ ok: true });
      }
      if (action === "upload_outcome_document") {
        const applicationId=asId(form.get("applicationId"));
        const access=await applicationAccess(user,applicationId);
        if(!access||!hasPresidentPermission(user,"presidents_badge.outcome"))return json({error:"Outcome permission required"},{status:403});
        if(file.size<20||file.size>10*1024*1024)throw new Error("Supporting document must be 10 MB or smaller.");
        const pdf=bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46;
        const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
        const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9;
        if(!pdf&&!png&&!jpeg)throw new Error("Use a genuine PDF, PNG or JPEG supporting document.");
        const contentType=pdf?"application/pdf":png?"image/png":"image/jpeg";
        const latest=await presidentsBadgeRuntime.DB.prepare("SELECT id FROM presidents_badge_outcomes WHERE application_id=? ORDER BY id DESC LIMIT 1").bind(applicationId).first<{id:number}>();
        if(!latest)throw new Error("Record the external outcome before attaching its supporting document.");
        const stored=await storePrivateFile(`applications/${applicationId}/outcomes`,bytes,contentType);
        await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_outcomes SET returned_document_object_key=? WHERE id=?").bind(stored.key,latest.id).run();
        await writeAuditEvent({actor:user,action:"presidents_badge.outcome_document_uploaded",entityType:"presidents_badge_outcome",entityId:latest.id,after:{sha256:stored.hash,contentType}});
        return json({ok:true});
      }
      throw new Error("Unknown upload action.");
    }

    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "create") {
      const ownMemberId = await memberIdForUser(user);
      const memberId = asId(body.memberId || ownMemberId);
      if (!memberId || (memberId !== ownMemberId && !mayManagePresidentApplication(user))) return json({ error: "Permission denied" }, { status: 403 });
      const existing = await presidentsBadgeRuntime.DB.prepare(`SELECT id FROM presidents_badge_applications WHERE member_id=? AND status IN (${activeStatusSql()}) LIMIT 1`).bind(memberId, ...activeStatusValues()).first<{ id: number }>();
      if (existing) return json({ error: "This member already has an active President’s Badge application.", applicationId: existing.id }, { status: 409 });
      const template = await presidentsBadgeRuntime.DB.prepare("SELECT id FROM presidents_badge_templates WHERE active=1 ORDER BY id DESC LIMIT 1").first<{ id: number }>();
      const created = now();
      const status = mayManagePresidentApplication(user) ? "preparing" : "requested";
      const result = await presidentsBadgeRuntime.DB.prepare(`INSERT INTO presidents_badge_applications(member_id,status,application_year,owner_user_id,template_id,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(memberId, status, new Date().getFullYear(), mayManagePresidentApplication(user) ? user.id : null, template?.id ?? null, user.id, created, created).run();
      const id = Number(result.meta.last_row_id);
      for (const type of ["parent", "teacher", "captain"]) await presidentsBadgeRuntime.DB.prepare("INSERT INTO presidents_badge_assessments(application_id,assessor_type,updated_at) VALUES(?,?,?)").bind(id, type, created).run();
      await writeAuditEvent({ actor: user, action: "presidents_badge.application_created", entityType: "presidents_badge_application", entityId: id, after: { memberId, status } });
      if (status === "requested") { const recipients=await activeUserIdsForRoles(["admin","officer"]); await notifyStaff(`presidents-badge-owner-${id}`, "President’s Badge application needs an Officer", "A member-created request is waiting for an Officer to take ownership.", `/?open=presidents-badge&application=${id}`); await actionItem(`presidents-badge-owner-${id}`,recipients,"Take ownership of President’s Badge application","A member-created application is waiting for an Officer.",id); }
      return json({ ok: true, applicationId: id });
    }
    const applicationId = asId(body.applicationId);
    const access = applicationId ? await applicationAccess(user, applicationId) : null;
    if (applicationId && !access) return json({ error: "Application not found or access is not permitted" }, { status: 404 });
    if (action === "delete_application") {
      if (!access || (!access.own && !mayManagePresidentApplication(user))) return json({ error: "Only the member or an Officer can delete this application" }, { status: 403 });
      if (["finalised", "submitted", "approved"].includes(String(access.row.status))) return json({ error: "Finalised or submitted applications cannot be deleted. Reopen or cancel them instead." }, { status: 409 });
      await presidentsBadgeRuntime.DB.prepare("DELETE FROM presidents_badge_applications WHERE id=?").bind(applicationId).run();
      await writeAuditEvent({ actor:user, action:"presidents_badge.application_deleted", entityType:"presidents_badge_application", entityId:applicationId });
      return json({ ok:true, deleted:true });
    }
    if (action === "save_member_details") {
      if (!access) throw new Error("Application required.");
      const nric = validateOverlayText(String(body.nric ?? ""), "NRIC", 20);
      const birthDate = String(body.birthDate ?? "");
      if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new Error("Enter a valid birth date.");
      await presidentsBadgeRuntime.DB.prepare("UPDATE members SET nric=?,birth_date=? WHERE id=?").bind(nric, birthDate, access.row.member_id).run();
      await writeAuditEvent({ actor: user, action: "member.sensitive_details_updated", entityType: "member", entityId: access.row.member_id, after: { nric: nric ? "••••" + nric.slice(-4) : "", birthDate } });
      return json({ ok: true });
    }
    if (action === "save_settings") {
      if (!mayManagePresidentApplication(user)) return json({ error: "Officer access required" }, { status: 403 });
      const companyNumber = validateOverlayText(String(body.companyNumber ?? ""), "Company number", 12);
      const companyName = validateOverlayText(String(body.companyName ?? ""), "Company name", 44);
      const state = validateOverlayText(String(body.state ?? ""), "State", 30);
      await presidentsBadgeRuntime.DB.prepare(`INSERT INTO presidents_badge_settings(id,company_number,official_company_name,malaysian_state,updated_by_user_id,updated_at) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_number=excluded.company_number,official_company_name=excluded.official_company_name,malaysian_state=excluded.malaysian_state,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`).bind(companyNumber, companyName, state, user.id, now()).run();
      await writeAuditEvent({actor:user,action:"presidents_badge.company_settings_updated",entityType:"presidents_badge_settings",entityId:1,after:{companyNumber,companyName,state}});
      return json({ ok: true });
    }
    if (action === "save_compliance") {
      if (!mayManagePresidentApplication(user)) return json({ error: "Officer access required" }, { status: 403 });
      const year=asId(body.year);if(year<2000||year>2100)throw new Error("Choose a valid reporting year.");
      await presidentsBadgeRuntime.DB.prepare(`INSERT INTO company_annual_compliance(reporting_year,brigade_dues_date,ros_return_date,statistics_return_date,updated_by_user_id,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(reporting_year) DO UPDATE SET brigade_dues_date=excluded.brigade_dues_date,ros_return_date=excluded.ros_return_date,statistics_return_date=excluded.statistics_return_date,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`).bind(year,String(body.brigadeDuesDate??""),String(body.rosReturnDate??""),String(body.statisticsReturnDate??""),user.id,now()).run();
      await writeAuditEvent({actor:user,action:"presidents_badge.compliance_updated",entityType:"company_annual_compliance",entityId:year});
      return json({ok:true});
    }
    if (!access || !mayManagePresidentApplication(user)) return json({ error: "Officer preparation permission required" }, { status: 403 });
    if (["finalised", "submitted", "approved"].includes(String(access.row.status)) && !["reopen", "record_outcome"].includes(action)) return json({ error: "This version is locked. Reopen it before editing." }, { status: 409 });
    if (action === "claim") {
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET owner_user_id=?,status='preparing',updated_at=? WHERE id=?").bind(user.id, now(), applicationId).run();
      await resolveAction(`presidents-badge-owner-${applicationId}`);
      await writeAuditEvent({ actor: user, action: "presidents_badge.application_claimed", entityType: "presidents_badge_application", entityId: applicationId });
      return json({ ok: true });
    }
    if (action === "save") {
      const exco = String(body.excoMeetingDate ?? "");
      const status = PRESIDENTS_BADGE_STATUSES.includes(String(body.status) as never) ? String(body.status) : "preparing";
      await presidentsBadgeRuntime.DB.prepare(`UPDATE presidents_badge_applications SET exco_meeting_date=?,awards_officer_user_id=?,captain_user_id=?,include_company_stamp=?,notes=?,status=?,updated_at=? WHERE id=?`).bind(exco, asId(body.awardsOfficerId) || null, asId(body.captainId) || null, body.includeCompanyStamp ? 1 : 0, String(body.notes ?? ""), status, now(), applicationId).run();
      await writeAuditEvent({ actor: user, action: "presidents_badge.application_updated", entityType: "presidents_badge_application", entityId: applicationId, after: { exco, status } });
      return json({ ok: true });
    }
    if (action === "save_camp") {
      const level = String(body.level ?? "");
      if (!["CO", "ST", "NAT", "INT"].includes(level)) throw new Error("Choose CO, ST, NAT or INT.");
      await presidentsBadgeRuntime.DB.prepare("INSERT INTO member_camp_history(member_id,camp_year,camp_level,description,created_at) VALUES(?,?,?,?,?)").bind(access.row.member_id, asId(body.year), level, validateOverlayText(String(body.description ?? ""), "Camp description", 60), now()).run();
      return json({ ok: true });
    }
    if (action === "set_assessment_mode") {
      const type = String(body.assessorType ?? ""); const mode = String(body.mode ?? "");
      if (!["parent", "teacher"].includes(type) || !["web", "paper"].includes(mode)) throw new Error("Invalid assessment choice.");
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_assessments SET completion_mode=?,status=?,updated_at=? WHERE application_id=? AND assessor_type=?").bind(mode, mode === "paper" ? "paper_selected" : "pending", now(), applicationId, type).run();
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status='assessments_pending',updated_at=? WHERE id=?").bind(now(),applicationId).run();
      return json({ ok: true });
    }
    if (action === "submit_captain_assessment") {
      if (!hasPresidentPermission(user, "presidents_badge.endorse")) return json({ error: "Captain endorsement permission required" }, { status: 403 });
      if (Number(access.row.captain_user_id) !== user.id) return json({ error: "Only the selected Captain may complete this assessment" }, { status: 403 });
      const ratings = body.ratings && typeof body.ratings === "object" ? body.ratings as Record<string,unknown> : {};
      const qualities = ["trustworthiness", "respect", "responsibility", "fairness", "caring", "good_example", "self_discipline", "humility", "attitude"];
      if (qualities.some((key) => ![1,3,5].includes(Number(ratings[key])))) throw new Error("Complete every Captain quality rating.");
      const reasons = Array.isArray(body.reasons) ? body.reasons.map(String).filter(Boolean) : [];
      if (reasons.length < 2) throw new Error("Enter at least two recommendation reasons.");
      if (body.applySavedSignature) {
        const credential = await presidentsBadgeRuntime.DB.prepare("SELECT password_hash,password_salt FROM users WHERE id=?").bind(user.id).first<{password_hash:string;password_salt:string}>();
        if (!credential || !(await verifyPassword(String(body.currentPassword ?? ""), credential.password_salt, credential.password_hash))) throw new Error("Current password is incorrect; the saved signature was not applied.");
        const signature = await presidentsBadgeRuntime.DB.prepare("SELECT object_key FROM staff_signature_profiles WHERE user_id=?").bind(user.id).first<{object_key:string}>();
        if (!signature) throw new Error("Upload your own saved signature before applying it.");
        await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_assessments SET signature_object_key=? WHERE application_id=? AND assessor_type='captain'").bind(signature.object_key, applicationId).run();
        await writeAuditEvent({ actor:user, action:"presidents_badge.signature_applied", entityType:"presidents_badge_application", entityId:applicationId, after:{ ownerUserId:user.id } });
      }
      const submitted = now();
      await presidentsBadgeRuntime.DB.prepare(`UPDATE presidents_badge_assessments SET assessor_name=?,ratings_json=?,reasons_json=?,remarks=?,status='submitted',submitted_at=?,updated_at=? WHERE application_id=? AND assessor_type='captain'`).bind(user.name, JSON.stringify(ratings), JSON.stringify(reasons), String(body.remarks ?? ""), submitted, submitted, applicationId).run();
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status='ready',updated_at=? WHERE id=?").bind(submitted, applicationId).run();
      await writeAuditEvent({ actor:user, action:"presidents_badge.captain_assessment_completed", entityType:"presidents_badge_application", entityId:applicationId });
      return json({ok:true});
    }
    if (action === "invite_assessor") {
      const type = String(body.assessorType ?? "");
      if (!["parent", "teacher"].includes(type)) throw new Error("Only parent and teacher invitations are supported.");
      const assessment = await presidentsBadgeRuntime.DB.prepare("SELECT id FROM presidents_badge_assessments WHERE application_id=? AND assessor_type=? AND completion_mode='web'").bind(applicationId, type).first<{ id: number }>();
      if (!assessment) throw new Error("Choose secure web assessment first.");
      const token = randomToken(); const tokenHash = await sha256Bytes(new TextEncoder().encode(token));
      const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_assessment_invitations SET revoked_at=? WHERE assessment_id=? AND revoked_at IS NULL").bind(now(), assessment.id).run();
      await presidentsBadgeRuntime.DB.prepare("INSERT INTO presidents_badge_assessment_invitations(assessment_id,token_hash,expires_at,created_by_user_id,created_at) VALUES(?,?,?,?,?)").bind(assessment.id, tokenHash, expires, user.id, now()).run();
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status='assessments_pending',updated_at=? WHERE id=?").bind(now(),applicationId).run();
      await writeAuditEvent({ actor: user, action: "presidents_badge.assessment_invited", entityType: "presidents_badge_assessment", entityId: assessment.id, after: { type, expires } });
      return json({ ok: true, assessmentUrl: `${new URL(request.url).origin}/presidents-badge-assessment?token=${token}`, expiresAt: expires });
    }
    if (action === "finalise") {
      const bucket = await r2Required();
      const full = await presidentsBadgeRuntime.DB.prepare(`SELECT a.*,m.name,m.rank,m.gender,m.school,m.contact_number candidate_phone,m.email candidate_email,m.nric,m.birth_date,m.passport_photo_object_key,s.company_number,s.official_company_name,s.malaysian_state,s.company_stamp_object_key,u.name captain_name,u.contact_number captain_phone,ao.name awards_officer_name,ao.officer_rank awards_officer_rank,ao.contact_number awards_officer_phone,ao.email awards_officer_email,t.object_key template_key FROM presidents_badge_applications a JOIN members m ON m.id=a.member_id LEFT JOIN presidents_badge_settings s ON s.id=1 LEFT JOIN users u ON u.id=a.captain_user_id LEFT JOIN users ao ON ao.id=a.awards_officer_user_id LEFT JOIN presidents_badge_templates t ON t.id=a.template_id WHERE a.id=?`).bind(applicationId).first<Record<string, string | number | null>>();
      if (!full?.template_key) throw new Error("Upload the exact official template before finalising.");
      const assessmentRows = await presidentsBadgeRuntime.DB.prepare("SELECT assessor_type,completion_mode,status,assessor_name,assessor_relationship,ratings_json,reasons_json,remarks,signature_object_key FROM presidents_badge_assessments WHERE application_id=?").bind(applicationId).all<Record<string,string>>();
      if (assessmentRows.results.filter((row) => row.status === "submitted" || row.status === "paper_selected").length < 3) throw new Error("All three assessments must be completed or selected for paper completion.");
      const eligibility = await calculateEligibility(Number(full.member_id), String(full.exco_meeting_date ?? ""));
      if (!eligibility.eligible) throw new Error("Eligibility validation is incomplete. Resolve every missing requirement before finalising.");
      if (!full.nric || !full.birth_date || !full.passport_photo_object_key) throw new Error("NRIC, birth date and passport photo are required.");
      const templateObject = await bucket.get(String(full.template_key)); if (!templateObject) throw new Error("Official template file is missing from private storage.");
      const splitMalaysianPhone = (raw: string) => {
        let digits = raw.replace(/\D/g, "");
        if (digits.startsWith("60")) digits = `0${digits.slice(2)}`;
        const areaLength = digits.startsWith("01") || digits.startsWith("08") ? 3 : digits.startsWith("0") ? 2 : Math.min(3, digits.length);
        return { area: digits.slice(0, areaLength), number: digits.slice(areaLength) };
      };
      const awardsOfficerPhone = splitMalaysianPhone(String(full.awards_officer_phone ?? ""));
      const candidatePhone = splitMalaysianPhone(String(full.candidate_phone ?? ""));
      const text: OverlayText[] = [
        { ...AWA_SR01_COORDINATES.companyNumber, value: String(full.company_number ?? "") },
        { ...AWA_SR01_COORDINATES.companyName, value: String(full.official_company_name ?? "") },
        { ...AWA_SR01_COORDINATES.state, value: String(full.malaysian_state ?? "") },
        { ...AWA_SR01_COORDINATES.awardsOfficerName, value: String(full.awards_officer_name ?? "") },
        { ...AWA_SR01_COORDINATES.awardsOfficerRank, value: String(full.awards_officer_rank ?? "") },
        { ...AWA_SR01_COORDINATES.awardsOfficerEmail, value: String(full.awards_officer_email ?? "") },
        { ...AWA_SR01_COORDINATES.candidateName, value: String(full.name ?? "") },
        { ...AWA_SR01_COORDINATES.gender, value: String(full.gender ?? "") === "F" ? "F" : "M" },
        { ...AWA_SR01_COORDINATES.rank, value: String(full.rank ?? "") },
        { ...AWA_SR01_COORDINATES.candidateEmail, value: String(full.candidate_email ?? "") },
        { ...AWA_SR01_COORDINATES.captainName, value: String(full.captain_name ?? "") },
      ];
      const pushDigitRun = (x: number, y: number, value: string) => {
        [...value].forEach((digit, index) => text.push({ page: 1, x: x + index * 4.5, y, value: digit, max: 1, size: 8 }));
      };
      pushDigitRun(AWA_SR01_COORDINATES.awardsOfficerPhoneArea.x, AWA_SR01_COORDINATES.awardsOfficerPhoneArea.y, awardsOfficerPhone.area);
      pushDigitRun(AWA_SR01_COORDINATES.awardsOfficerPhoneNumber.x, AWA_SR01_COORDINATES.awardsOfficerPhoneNumber.y, awardsOfficerPhone.number);
      pushDigitRun(AWA_SR01_COORDINATES.candidatePhoneArea.x, AWA_SR01_COORDINATES.candidatePhoneArea.y, candidatePhone.area);
      pushDigitRun(AWA_SR01_COORDINATES.candidatePhoneNumber.x, AWA_SR01_COORDINATES.candidatePhoneNumber.y, candidatePhone.number);
      const nricDigits = String(full.nric ?? "").replace(/\D/g, "");
      if (nricDigits && nricDigits.length !== 12) throw new Error("NRIC must contain exactly 12 digits for the official form.");
      if (nricDigits) text.push(
        { ...AWA_SR01_COORDINATES.nricFirst, value: nricDigits.slice(0, 6) },
        { ...AWA_SR01_COORDINATES.nricMiddle, value: nricDigits.slice(6, 8) },
        { ...AWA_SR01_COORDINATES.nricLast, value: nricDigits.slice(8, 12) },
      );
      // The master form provides three small dd/mm/yy slots rather than one
      // free-form date field. Fill each slot independently so the labels and
      // separators remain untouched.
      const birth = String(full.birth_date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (birth) text.push(
        { ...AWA_SR01_COORDINATES.birthDateDay, value: birth[3] },
        { ...AWA_SR01_COORDINATES.birthDateMonth, value: birth[2] },
        { ...AWA_SR01_COORDINATES.birthDateYear, value: birth[1] },
      );
      const assessmentByType = new Map(assessmentRows.results.map((row) => [row.assessor_type,row]));
      const parent = assessmentByType.get("parent"); const teacher = assessmentByType.get("teacher"); const captain = assessmentByType.get("captain");
      text.push(
        { ...AWA_SR01_COORDINATES.parentCandidateName, value:String(full.name??"") },
        { ...AWA_SR01_COORDINATES.parentName, value:String(parent?.assessor_name??"") },
        { ...AWA_SR01_COORDINATES.parentRelationship, value:String(parent?.assessor_relationship??"") },
        { ...AWA_SR01_COORDINATES.teacherCandidateName, value:String(full.name??"") },
        { ...AWA_SR01_COORDINATES.teacherName, value:String(teacher?.assessor_name??"") },
        { ...AWA_SR01_COORDINATES.captainCandidateName, value:String(full.name??"") },
        { ...AWA_SR01_COORDINATES.captainAssessmentName, value:String(captain?.assessor_name||full.captain_name||"") },
      );
      const attendance = await presidentsBadgeRuntime.DB.prepare(`SELECT substr(s.meeting_date,1,4) year,SUM(CASE WHEN r.status='present' THEN 1 ELSE 0 END) present,SUM(CASE WHEN r.status IN ('present','absent') THEN 1 ELSE 0 END) counted FROM attendance_sessions s JOIN attendance_records r ON r.session_id=s.id AND r.member_id=? WHERE s.meeting_date<=date('now') GROUP BY substr(s.meeting_date,1,4) ORDER BY year DESC LIMIT 5`).bind(full.member_id).all<{year:string;present:number;counted:number}>();
      const attendanceYearX=[267,327,387,447,507];
      const attendancePercentX=[270,330,390,450,513];
      attendance.results.reverse().forEach((row,index)=>{
        text.push({page:1,x:attendanceYearX[index] ?? 507,y:386,value:row.year,max:4,size:6.5});
        const percentage=row.counted?String(Math.round(row.present/row.counted*100)):"0";
        [...percentage].forEach((digit,digitIndex)=>text.push({page:1,x:(attendancePercentX[index] ?? 513)+digitIndex*3.4,y:374,value:digit,max:1,size:6.5}));
      });
      const dateAt = (code:string) => eligibility.awards.find((award)=>award.award_code===code)?.awarded_at?.slice(0,10) ?? "";
      [["three_year_service",336],["christian_education",323],["nco_proficiency",310],["drill",297],["recruitment",284]].forEach(([code,y])=>text.push({page:1,x:252,y:Number(y),value:dateAt(String(code)),max:10,size:7}));
      const camps = await presidentsBadgeRuntime.DB.prepare("SELECT camp_year,camp_level,description FROM member_camp_history WHERE member_id=? ORDER BY camp_year DESC,id DESC LIMIT 9").bind(full.member_id).all<{camp_year:number;camp_level:string;description:string}>();
      camps.results.forEach((camp,index)=>{const y=336-index*12.5;text.push({page:1,x:323,y,value:String(camp.camp_year),max:4,size:7},{page:1,x:363,y,value:camp.camp_level,max:3,size:7},{page:1,x:389,y,value:camp.description,max:46,size:7});});
      const awardMap: Record<string,{x:number;y:number;basic:number;advanced:number;date:number}> = {};
      const addAwards=(names:string[],x:number,startY:number)=>names.forEach((name,index)=>awardMap[name.toLowerCase()]={x,y:startY-index*12.5,basic:x+122,advanced:x+168,date:x+205});
      addAwards(["Arts","Band Proficiency","Communication","Computer Knowledge","Craft","Hobbies","International Relations","Nature Awareness"],42,756);
      addAwards(["Citizenship","Community Service","Environmental Conservation","Fire & Rescue","First Aid","Life Saving","Safety"],297,756);
      addAwards(["Camping","Expedition","Water Adventure"],42,631);
      addAwards(["Athletics","Gymnastics","Martial Arts","Physical Training","Sports","Swimming"],297,631);
      const marks: Array<{page:number;x:number;y:number;checked:boolean;size?:number;kind?:"x"|"underline"}> = [];
      awardMap["crafts"]=awardMap["craft"];
      awardMap["bandsman"]=awardMap["band proficiency"];
      const mappedGroupAwards=eligibility.awards.filter((award)=>/^[A-D]/.test(award.category)&&awardMap[award.award_name.toLowerCase()]);
      const selectedGroupAwards:typeof mappedGroupAwards=[];
      for(const group of ["A","B","C","D"]){const choice=mappedGroupAwards.filter(a=>a.category.startsWith(group)).sort((a,b)=>(a.level==="advanced"?-1:1)-(b.level==="advanced"?-1:1))[0];if(choice&&!selectedGroupAwards.includes(choice))selectedGroupAwards.push(choice);}
      for(const award of mappedGroupAwards.sort((a,b)=>(a.level==="advanced"?-1:1)-(b.level==="advanced"?-1:1))){if(selectedGroupAwards.length>=6)break;if(!selectedGroupAwards.includes(award))selectedGroupAwards.push(award);}
      if(selectedGroupAwards.length<6||new Set(selectedGroupAwards.map(award=>award.category.slice(0,1))).size<4||selectedGroupAwards.filter(award=>award.level==="advanced").length<4)throw new Error("Six official-form Group A–D awards could not be selected. Record at least one mapped award from each group and four Advanced awards.");
      // Tick the six qualifying awards, but print the awarded date for every
      // mapped award on the official form so no recorded award date is lost.
      selectedGroupAwards.forEach((award)=>{const slot=awardMap[award.award_name.toLowerCase()];const advanced=award.level==="advanced";marks.push({page:2,x:slot.x+(advanced?153:116),y:slot.y-5,checked:true,size:advanced?36:20,kind:"underline"});});
      const pushDateParts=(page:number,x:number,y:number,value:string,size:number)=>{
        const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return;
        const unit=size/2;
        text.push(
          {page,x,y,value:match[1],max:4,size},
          {page,x:x+unit*4.3,y,value:"-",max:1,size},
          {page,x:x+unit*5.1,y,value:match[2],max:2,size},
          {page,x:x+unit*7.3,y,value:"-",max:1,size},
          {page,x:x+unit*8.1,y,value:match[3],max:2,size},
        );
      };
      mappedGroupAwards.forEach((award)=>{const slot=awardMap[award.award_name.toLowerCase()];if(slot)pushDateParts(2,slot.date,slot.y,award.awarded_at?.slice(0,10)??"",6.5);});
      const compliance = await presidentsBadgeRuntime.DB.prepare("SELECT brigade_dues_date,ros_return_date,statistics_return_date FROM company_annual_compliance WHERE reporting_year=?").bind(full.application_year).first<{brigade_dues_date:string;ros_return_date:string;statistics_return_date:string}>();
      if(compliance){[[compliance.brigade_dues_date,451],[compliance.ros_return_date,427],[compliance.statistics_return_date,402]].forEach(([value,y])=>{if(value){marks.push({page:2,x:57,y:Number(y)-11,checked:true});pushDateParts(2,295,Number(y),String(value),8);}});}
      const qualityNames=["trustworthiness","respect","responsibility","fairness","caring","good_example","self_discipline","humility","attitude"];
      const overlayAssessment=(assessment:Record<string,string>|undefined,page:number)=>{if(!assessment||assessment.status!=="submitted")return;let ratings:Record<string,number>={};let reasons:string[]=[];try{ratings=JSON.parse(assessment.ratings_json);}catch{}try{reasons=JSON.parse(assessment.reasons_json);}catch{}qualityNames.forEach((quality,index)=>{const value=Number(ratings[quality]);const x=value===5?170:value===3?224:276;marks.push({page,x:x-3,y:486-index*19.5-3,checked:Boolean(value)});});reasons.slice(0,3).forEach((reason,index)=>text.push({page,x:68,y:228-index*50,value:reason,max:100,size:8}));};
      overlayAssessment(parent,3); overlayAssessment(teacher,4); overlayAssessment(captain,5);
      const images: Array<{page:number;x:number;y:number;width:number;height:number;bytes:Uint8Array;mime:"image/png"|"image/jpeg"}> = [];
      const photo = await bucket.get(String(full.passport_photo_object_key));
      if (photo) images.push({ ...AWA_SR01_COORDINATES.passportPhoto, bytes: new Uint8Array(await photo.arrayBuffer()), mime: (photo.httpMetadata?.contentType === "image/png" ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg" });
      if(parent?.signature_object_key){const signature=await bucket.get(parent.signature_object_key);if(signature){const bytes=new Uint8Array(await signature.arrayBuffer());const mime=(signature.httpMetadata?.contentType==="image/png"?"image/png":"image/jpeg") as "image/png"|"image/jpeg";images.push({page:3,x:156,y:57,width:210,height:28,bytes,mime});}}
      if(teacher?.signature_object_key){const signature=await bucket.get(teacher.signature_object_key);if(signature){const bytes=new Uint8Array(await signature.arrayBuffer());const mime=(signature.httpMetadata?.contentType==="image/png"?"image/png":"image/jpeg") as "image/png"|"image/jpeg";images.push({page:4,x:156,y:57,width:105,height:28,bytes,mime});}}
      if(captain?.signature_object_key){const signature=await bucket.get(captain.signature_object_key);if(signature){const bytes=new Uint8Array(await signature.arrayBuffer());const mime=(signature.httpMetadata?.contentType==="image/png"?"image/png":"image/jpeg") as "image/png"|"image/jpeg";images.push({page:2,x:42,y:329,width:190,height:28,bytes,mime},{page:5,x:156,y:57,width:105,height:28,bytes,mime});}}
      if(full.include_company_stamp&&full.company_stamp_object_key){const stamp=await bucket.get(String(full.company_stamp_object_key));if(stamp){const bytes=new Uint8Array(await stamp.arrayBuffer());const mime=(stamp.httpMetadata?.contentType==="image/png"?"image/png":"image/jpeg") as "image/png"|"image/jpeg";images.push({page:2,x:432,y:329,width:90,height:55,bytes,mime},{page:5,x:350,y:50,width:75,height:38,bytes,mime});}}
      const output = await generatePresidentsBadgePdf(new Uint8Array(await templateObject.arrayBuffer()), { text, marks, images });
      const stored = await storePrivateFile(`applications/${applicationId}/versions`, output, "application/pdf");
      const version = await presidentsBadgeRuntime.DB.prepare("SELECT COALESCE(MAX(version_number),0)+1 next FROM presidents_badge_versions WHERE application_id=?").bind(applicationId).first<{ next: number }>();
      const versionNumber = Number(version?.next ?? 1);
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_versions SET superseded_at=? WHERE application_id=? AND superseded_at IS NULL").bind(now(), applicationId).run();
      await presidentsBadgeRuntime.DB.prepare("INSERT INTO presidents_badge_versions(application_id,version_number,object_key,sha256,input_snapshot_json,created_by_user_id,created_at) VALUES(?,?,?,?,?,?,?)").bind(applicationId, versionNumber, stored.key, stored.hash, JSON.stringify({ application: full, eligibility, assessments: assessmentRows.results }), user.id, now()).run();
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status='finalised',finalised_at=?,updated_at=? WHERE id=?").bind(now(), now(), applicationId).run();
      await writeAuditEvent({ actor: user, action: "presidents_badge.pdf_finalised", entityType: "presidents_badge_application", entityId: applicationId, after: { versionNumber, sha256: stored.hash } });
      return json({ ok: true, versionNumber });
    }
    if (action === "reopen") {
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status='preparing',finalised_at=NULL,updated_at=? WHERE id=?").bind(now(), applicationId).run();
      await writeAuditEvent({ actor: user, action: "presidents_badge.application_reopened", entityType: "presidents_badge_application", entityId: applicationId });
      return json({ ok: true });
    }
    if (action === "mark_submitted") {
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status='submitted',submitted_at=?,updated_at=? WHERE id=? AND status='finalised'").bind(now(), now(), applicationId).run();
      const recipients=await activeUserIdsForRoles(["admin","officer"]);await actionItem(`presidents-badge-outcome-${applicationId}`,recipients,"Record President’s Badge outcome","This application was submitted externally and is waiting for a BBM outcome.",applicationId,"normal");
      return json({ ok: true });
    }
    if (action === "record_outcome") {
      if (!hasPresidentPermission(user, "presidents_badge.outcome")) return json({ error: "Outcome permission required" }, { status: 403 });
      const outcome = String(body.outcome ?? ""); const date = String(body.outcomeDate ?? ""); const confirmed = Boolean(body.confirmed);
      if (!["returned", "approved", "rejected"].includes(outcome) || !date) throw new Error("Choose a valid outcome and date.");
      if (outcome === "approved" && (!confirmed || !String(body.reference ?? "").trim())) throw new Error("BBM approval requires explicit confirmation and a supporting reference.");
      await presidentsBadgeRuntime.DB.prepare("INSERT INTO presidents_badge_outcomes(application_id,outcome,outcome_date,reference,confirmed_external_decision,notes,recorded_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(applicationId, outcome, date, String(body.reference ?? ""), confirmed ? 1 : 0, String(body.notes ?? ""), user.id, now()).run();
      await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status=?,closed_at=?,updated_at=? WHERE id=?").bind(outcome, terminal.includes(outcome) ? now() : null, now(), applicationId).run();
      if(terminal.includes(outcome))await resolveAction(`presidents-badge-outcome-${applicationId}`);
      if (outcome === "approved" && confirmed) await presidentsBadgeRuntime.DB.prepare(`INSERT INTO member_awards(member_id,award_code,level,status,awarded_at,updated_at,updated_by) VALUES(?,'presidents_award','basic','awarded',?,?,?) ON CONFLICT(member_id,award_code,level) DO UPDATE SET status='awarded',awarded_at=excluded.awarded_at,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(access.row.member_id, date, now(), user.email).run();
      await writeAuditEvent({ actor: user, action: "presidents_badge.external_outcome_recorded", entityType: "presidents_badge_application", entityId: applicationId, after: { outcome, date, confirmed } });
      return json({ ok: true });
    }
    throw new Error("Unknown President’s Badge action.");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to complete the request" }, { status: 400 });
  }
}
