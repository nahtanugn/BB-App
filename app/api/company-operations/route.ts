import { env } from "cloudflare:workers";
import { getCurrentUser, hasOperationalAdminAccess } from "../../../lib/auth";
import { canManageScopedPermission, canManageSquadRecord, canViewMemberScope, hasPermission, isSquadOperationsUser, linkedMember } from "../../../lib/company-operations";
import { writeAuditEvent } from "../../../lib/audit";
import { activeUserIdForEmail, activeUserIdsForRolesOrPermission, createNotifications } from "../../../lib/notifications";

type RuntimeEnv = { DB: D1Database };
const runtime = env as unknown as RuntimeEnv;
const allowedModules = new Set(["parades", "duties", "committees", "leave", "promotion", "service", "band", "emergency"]);

function jsonList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(Boolean);
}
function storedJsonList(value: unknown) {
  try { return jsonList(JSON.parse(String(value || "[]"))); }
  catch { return []; }
}
function text(value: unknown, max = 5000) { return String(value ?? "").trim().slice(0, max); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function isFinalStaff(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) { return hasOperationalAdminAccess(user); }
async function memberById(id: number) {
  return runtime.DB.prepare("SELECT id, name, rank, section, squad, email, emergency_contact_number, parents_name, band_member FROM members WHERE id = ?")
    .bind(id).first<{ id: number; name: string; rank: string; section: string; squad: string; email: string; emergency_contact_number: string; parents_name: string; band_member: number }>();
}
function scoped<T extends { section: string; squad: string }>(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, rows: T[]) {
  if (hasOperationalAdminAccess(user) || user.role === "viewer") return rows;
  return rows.filter((row) => row.section === user.member_section && row.squad === user.squad);
}
async function notifyMember(memberId: number, title: string, body: string, targetUrl: string, entityKey: string) {
  const member = await memberById(memberId); if (!member?.email) return;
  const recipient = await activeUserIdForEmail(member.email); if (!recipient) return;
  await createNotifications({ recipientUserIds: [recipient], type: "request", title, body, targetUrl, entityKey });
}
async function actionItem(input: { key: string; rule: string; recipients: number[]; title: string; description: string; url: string; sourceType: string; sourceId: string; priority?: string }) {
  const now = new Date().toISOString();
  for (const recipient of [...new Set(input.recipients)]) await runtime.DB.prepare(`INSERT INTO automation_action_items
    (dedupe_key, rule_key, recipient_user_id, title, description, target_url, priority, source_type, source_id, status, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title, description=excluded.description, target_url=excluded.target_url, status='open', last_seen_at=excluded.last_seen_at, resolved_at=NULL`)
    .bind(`${input.key}:${recipient}`, input.rule, recipient, input.title, input.description, input.url, input.priority ?? "normal", input.sourceType, input.sourceId, now, now).run();
}
async function resolveActions(prefix: string) {
  await runtime.DB.prepare("UPDATE automation_action_items SET status='resolved', resolved_at=? WHERE dedupe_key LIKE ? AND status='open'")
    .bind(new Date().toISOString(), `${prefix}%`).run();
}
async function audit(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, action: string, entityType: string, entityId: string | number, before?: unknown, after?: unknown) {
  await writeAuditEvent({ actor: user, action, entityType, entityId, before, after });
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const url = new URL(request.url); const workspace = url.searchParams.get("module") ?? "parades";
  if (!allowedModules.has(workspace)) return Response.json({ error: "Unknown operations module" }, { status: 400 });
  const own = await linkedMember(runtime.DB, user);
  const allMembers = await runtime.DB.prepare("SELECT id, name, rank, section, squad, email, band_member FROM members ORDER BY name").all<{ id: number; name: string; rank: string; section: string; squad: string; email: string; band_member: number }>();
  const members = allMembers.results.filter((member) => canViewMemberScope(user, member));
  const events = await runtime.DB.prepare("SELECT id, title, event_date, section, audience, attendance_session_id FROM company_events WHERE cancelled_at IS NULL ORDER BY event_date DESC LIMIT 100").all();
  const visibleEvents = (events.results as Array<{ section: string; audience: string }>).filter((event) => {
    if (hasOperationalAdminAccess(user) || user.role === "viewer") return true;
    if (!['all', user.member_section].includes(event.section)) return false;
    return event.audience !== "nco_only" || ["nco", "squad_leader"].includes(user.role);
  });
  const permissions = {
    readOnly: user.role === "viewer",
    finalAuthority: isFinalStaff(user),
    squadManager: isSquadOperationsUser(user),
    canReviewLeaveSquad: isSquadOperationsUser(user) || hasPermission(user, "leave.review_squad"),
    canApproveLeave: isFinalStaff(user) || hasPermission(user, "leave.approve"),
    canVerifyServiceSquad: isSquadOperationsUser(user) || hasPermission(user, "service.verify_squad"),
    canApproveService: isFinalStaff(user) || hasPermission(user, "service.approve"),
    canManagePlans: hasPermission(user, "programme.plans.manage") || isSquadOperationsUser(user),
    canManageDuties: hasPermission(user, "programme.rosters.manage") || isSquadOperationsUser(user),
    canManageCommittees: hasPermission(user, "programme.committees.manage") || isSquadOperationsUser(user),
    canReviewLeave: isFinalStaff(user) || isSquadOperationsUser(user) || hasPermission(user, "leave.review_squad") || hasPermission(user, "leave.approve"),
    canManagePromotion: hasPermission(user, "promotion.rules.manage") || hasPermission(user, "promotion.review"),
    canReviewService: isFinalStaff(user) || isSquadOperationsUser(user) || hasPermission(user, "service.verify_squad") || hasPermission(user, "service.approve"),
    canViewBand: hasOperationalAdminAccess(user) || user.role === "viewer" || user.custom_permissions.some((p) => p.startsWith("band.")) || Boolean(own?.id && allMembers.results.find((m) => m.id === own.id)?.band_member),
    canManageBand: hasPermission(user, "band.manage_profiles") || hasPermission(user, "band.manage_instruments") || hasPermission(user, "band.manage_programme"),
    canManageEmergency: hasPermission(user, "emergency.manage") || isSquadOperationsUser(user),
    canViewEmergencyContacts: isFinalStaff(user) || isSquadOperationsUser(user) || hasPermission(user, "emergency.view_contacts"),
  };
  if (workspace === "parades") {
    const templates = await runtime.DB.prepare("SELECT * FROM parade_templates ORDER BY updated_at DESC").all<{ section: string; squad: string }>();
    const plans = await runtime.DB.prepare("SELECT p.*, e.title AS event_title FROM parade_plans p LEFT JOIN company_events e ON e.id=p.event_id ORDER BY plan_date DESC").all<{ section: string; squad: string }>();
    return Response.json({ module: workspace, permissions, members, events: visibleEvents, templates: scoped(user, templates.results), plans: scoped(user, plans.results) });
  }
  if (workspace === "duties") {
    const dutyTypes = await runtime.DB.prepare("SELECT * FROM duty_types WHERE active=1 ORDER BY name").all();
    const assignments = await runtime.DB.prepare(`SELECT d.*, dt.name AS duty_name, m.name AS member_name, e.title AS event_title
      FROM duty_assignments d JOIN duty_types dt ON dt.id=d.duty_type_id LEFT JOIN members m ON m.id=d.member_id LEFT JOIN company_events e ON e.id=d.event_id ORDER BY d.starts_at DESC`).all<{ section: string; squad: string }>();
    return Response.json({ module: workspace, permissions, members, events: visibleEvents, dutyTypes: dutyTypes.results, assignments: scoped(user, assignments.results) });
  }
  if (workspace === "committees") {
    const committees = await runtime.DB.prepare(`SELECT c.*, e.title AS event_title, COUNT(DISTINCT cm.member_id) AS member_count, SUM(CASE WHEN ct.status!='completed' THEN 1 ELSE 0 END) AS open_tasks
      FROM event_committees c LEFT JOIN company_events e ON e.id=c.event_id LEFT JOIN committee_members cm ON cm.committee_id=c.id LEFT JOIN committee_tasks ct ON ct.committee_id=c.id GROUP BY c.id ORDER BY c.updated_at DESC`).all<{ section: string; squad: string }>();
    const visibleCommittees = scoped(user, committees.results);
    const visibleCommitteeIds = new Set(visibleCommittees.map((item) => Number((item as { id: number }).id)));
    const tasks = await runtime.DB.prepare("SELECT t.*, m.name AS assigned_member_name FROM committee_tasks t LEFT JOIN members m ON m.id=t.assigned_member_id ORDER BY COALESCE(t.deadline,'9999-12-31'), t.id DESC").all<{ committee_id: number }>();
    return Response.json({ module: workspace, permissions, members, events: visibleEvents, committees: visibleCommittees, tasks: tasks.results.filter((task) => visibleCommitteeIds.has(task.committee_id)) });
  }
  if (workspace === "leave") {
    const rows = await runtime.DB.prepare(`SELECT l.*, m.name AS member_name, m.section, m.squad, e.title AS event_title, e.event_date
      FROM leave_requests l JOIN members m ON m.id=l.member_id JOIN company_events e ON e.id=l.event_id WHERE l.withdrawn_at IS NULL ORDER BY l.created_at DESC`).all<{ member_id: number; section: string; squad: string }>();
    const requests = rows.results.filter((row) => canViewMemberScope(user, { ...row, email: allMembers.results.find((m) => m.id === row.member_id)?.email }));
    return Response.json({ module: workspace, permissions, members, events: visibleEvents, requests });
  }
  if (workspace === "service") {
    const rows = await runtime.DB.prepare(`SELECT s.*, m.name AS member_name, m.section, m.squad FROM service_hour_submissions s JOIN members m ON m.id=s.member_id ORDER BY s.service_date DESC, s.id DESC`).all<{ member_id: number; section: string; squad: string }>();
    return Response.json({ module: workspace, permissions, members, submissions: rows.results.filter((row) => canViewMemberScope(user, { ...row, email: allMembers.results.find((m) => m.id === row.member_id)?.email })) });
  }
  if (workspace === "promotion") {
    const rules = await runtime.DB.prepare("SELECT * FROM promotion_rules WHERE active=1 ORDER BY section,target_rank").all();
    const readiness = [] as Array<Record<string, unknown>>;
    for (const member of members) {
      const memberRules = rules.results.filter((rule) => (rule as { section: string }).section === member.section);
      const attendance = await runtime.DB.prepare(`SELECT COUNT(CASE WHEN ar.status IN ('present','absent','excused') THEN 1 END) AS marked, COUNT(CASE WHEN ar.status='present' THEN 1 END) AS present FROM attendance_sessions s LEFT JOIN attendance_records ar ON ar.session_id=s.id AND ar.member_id=? WHERE s.section=? AND s.meeting_date<=date('now')`).bind(member.id, member.section).first<{ marked: number; present: number }>();
      const awards = await runtime.DB.prepare("SELECT award_code, level, status FROM member_awards WHERE member_id=? AND status IN ('verified','awarded')").bind(member.id).all<{ award_code: string; level: string; status: string }>();
      const training = await runtime.DB.prepare("SELECT training_type,title FROM training_records WHERE member_id=? AND status='completed'").bind(member.id).all<{ training_type: string; title: string }>();
      const service = await runtime.DB.prepare("SELECT COALESCE(SUM(duration_minutes),0) AS minutes FROM service_hour_submissions WHERE member_id=? AND status='approved'").bind(member.id).first<{ minutes: number }>();
      for (const raw of memberRules) {
        const rule = raw as { id: number; target_rank: string; minimum_attendance_percent: number; required_awards_json: string; required_training_json: string; minimum_service_hours: number; officer_assessment_required: number };
        const waivers = await runtime.DB.prepare("SELECT requirement_key FROM promotion_waivers WHERE member_id=? AND promotion_rule_id=?").bind(member.id, rule.id).all<{ requirement_key: string }>();
        const waived = new Set(waivers.results.map((item) => item.requirement_key));
        const attendancePercent = attendance?.marked ? Math.round((Number(attendance.present) / Number(attendance.marked)) * 100) : 0;
        const requiredAwards = storedJsonList(rule.required_awards_json); const requiredTraining = storedJsonList(rule.required_training_json);
        const earned = new Set(awards.results.flatMap((item) => [item.award_code, item.level, `${item.award_code}:${item.level}`]));
        const completedTraining = new Set(training.results.flatMap((item) => [item.training_type, item.title]));
        const checks = [
          { key: "attendance", label: `Attendance ${rule.minimum_attendance_percent}%`, met: attendancePercent >= rule.minimum_attendance_percent, value: `${attendancePercent}%` },
          ...requiredAwards.map((value) => ({ key: `award:${value}`, label: `Award: ${value}`, met: earned.has(value), value: earned.has(value) ? "Earned" : "Missing" })),
          ...requiredTraining.map((value) => ({ key: `training:${value}`, label: `Training: ${value}`, met: completedTraining.has(value), value: completedTraining.has(value) ? "Completed" : "Missing" })),
          { key: "service", label: `${rule.minimum_service_hours} verified service hours`, met: Number(service?.minutes ?? 0) >= rule.minimum_service_hours * 60, value: `${(Number(service?.minutes ?? 0) / 60).toFixed(1)} hours` },
        ].map((check) => ({ ...check, waived: waived.has(check.key) }));
        readiness.push({ memberId: member.id, memberName: member.name, section: member.section, squad: member.squad, ruleId: rule.id, targetRank: rule.target_rank, checks, ready: checks.every((check) => check.met || check.waived), officerAssessmentRequired: Boolean(rule.officer_assessment_required) });
      }
    }
    return Response.json({ module: workspace, permissions, members, rules: rules.results, readiness });
  }
  if (workspace === "band") {
    if (!permissions.canViewBand) return Response.json({ error: "Band access required" }, { status: 403 });
    const [profiles, instruments, history, rehearsals, performances, assessments] = await Promise.all([
      runtime.DB.prepare("SELECT bp.*,m.name,m.rank,m.section,m.squad FROM band_profiles bp JOIN members m ON m.id=bp.member_id ORDER BY m.name").all(),
      runtime.DB.prepare("SELECT i.*,m.name AS holder_name FROM band_instruments i LEFT JOIN members m ON m.id=i.current_holder_member_id WHERE i.active=1 ORDER BY i.instrument_section,i.name").all(),
      runtime.DB.prepare("SELECT h.*,i.name AS instrument_name,m.name AS member_name FROM band_instrument_history h JOIN band_instruments i ON i.id=h.instrument_id LEFT JOIN members m ON m.id=h.member_id ORDER BY h.created_at DESC LIMIT 100").all(),
      runtime.DB.prepare("SELECT * FROM band_rehearsals ORDER BY rehearsal_date DESC").all(), runtime.DB.prepare("SELECT * FROM band_performances ORDER BY performance_date DESC").all(),
      runtime.DB.prepare("SELECT a.*,m.name AS member_name FROM band_proficiency_assessments a JOIN members m ON m.id=a.member_id ORDER BY assessed_at DESC").all(),
    ]);
    const visibleBandMemberIds = new Set(members.filter((member) => member.band_member).map((member) => member.id));
    const hasCompanyBandAccess = hasOperationalAdminAccess(user) || user.role === "viewer" || (!isSquadOperationsUser(user) && user.custom_permissions.some((permission) => permission.startsWith("band.")));
    const scopedProfiles = hasCompanyBandAccess ? profiles.results : (profiles.results as Array<{ member_id: number }>).filter((profile) => visibleBandMemberIds.has(profile.member_id));
    const scopedAssessments = hasCompanyBandAccess ? assessments.results : (assessments.results as Array<{ member_id: number }>).filter((assessment) => visibleBandMemberIds.has(assessment.member_id));
    const scopedHistory = hasCompanyBandAccess ? history.results : (history.results as Array<{ member_id: number | null }>).filter((entry) => entry.member_id == null || visibleBandMemberIds.has(entry.member_id));
    const scopedInstruments = hasCompanyBandAccess ? instruments.results : (instruments.results as Array<{ current_holder_member_id: number | null; holder_name?: string }>).map((instrument) => instrument.current_holder_member_id == null || visibleBandMemberIds.has(instrument.current_holder_member_id) ? instrument : { ...instrument, holder_name: undefined });
    return Response.json({ module: workspace, permissions, members: members.filter((m) => m.band_member), profiles: scopedProfiles, instruments: scopedInstruments, history: scopedHistory, rehearsals: rehearsals.results, performances: performances.results, assessments: scopedAssessments });
  }
  const sessions = await runtime.DB.prepare("SELECT * FROM emergency_sessions ORDER BY started_at DESC LIMIT 30").all();
  const responses = await runtime.DB.prepare(`SELECT r.*,m.name,m.rank,m.section,m.squad FROM emergency_responses r JOIN members m ON m.id=r.member_id ORDER BY r.updated_at DESC`).all<{ section: string; squad: string }>();
  const visibleResponses = scoped(user, responses.results);
  const visibleSessionIds = new Set(visibleResponses.map((row) => Number((row as { session_id: number }).session_id)));
  const visibleSessions = hasOperationalAdminAccess(user) || user.role === "viewer" ? sessions.results : (sessions.results as Array<{ id: number }>).filter((session) => visibleSessionIds.has(session.id));
  return Response.json({ module: workspace, permissions, members, events: visibleEvents, sessions: visibleSessions, responses: visibleResponses.map((row) => ({ ...row, emergency_contact_number: undefined, parents_name: undefined })) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (user.role === "viewer") return Response.json({ error: "Viewer access is read-only" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>; const action = text(body.action, 80); const now = new Date().toISOString();
  const requestKey = text(request.headers.get("Idempotency-Key"), 120);
  if (requestKey) {
    try { await runtime.DB.prepare("INSERT INTO operations_idempotency_keys (request_key,user_id,action,created_at) VALUES (?,?,?,?)").bind(requestKey,user.id,action,now).run(); }
    catch { return Response.json({ error: "This action was already submitted. Refresh to see the latest result." }, { status: 409 }); }
  }
  const own = await linkedMember(runtime.DB, user);
  const requireMember = async () => { const member = await memberById(number(body.memberId)); return member && canViewMemberScope(user, member) ? member : null; };

  if (action === "create_parade_template") {
    if (!(hasPermission(user,"programme.plans.manage") || isSquadOperationsUser(user))) return Response.json({ error:"Parade planning permission required"},{status:403});
    const section = text(body.section,20); const squad = isSquadOperationsUser(user) ? user.squad : text(body.squad,40);
    if (isSquadOperationsUser(user) && section !== user.member_section) return Response.json({error:"You can manage only your assigned squad"},{status:403});
    const result = await runtime.DB.prepare("INSERT INTO parade_templates (name,section,squad,notes,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(text(body.name,160),section,squad,text(body.notes),user.id,now,now).run();
    const id=Number(result.meta.last_row_id); await audit(user,"parade_template_created","parade_template",id,undefined,body); return Response.json({ok:true,id,message:"Parade template created."});
  }
  if (action === "create_parade_plan") {
    if (!(hasPermission(user,"programme.plans.manage") || isSquadOperationsUser(user))) return Response.json({error:"Parade planning permission required"},{status:403});
    const section=text(body.section,20); const squad=isSquadOperationsUser(user)?user.squad:text(body.squad,40); if(!hasPermission(user,"programme.plans.manage")&&!canManageSquadRecord(user,section,squad)) return Response.json({error:"You can manage only your assigned squad"},{status:403});
    const result=await runtime.DB.prepare("INSERT INTO parade_plans (event_id,template_id,title,plan_date,section,squad,status,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',?,?,?)").bind(number(body.eventId)||null,number(body.templateId)||null,text(body.title,160),text(body.planDate,10),section,squad,user.id,now,now).run();
    const id=Number(result.meta.last_row_id); const items=Array.isArray(body.items)?body.items as Array<Record<string,unknown>>:[]; for(let i=0;i<items.length;i++) await runtime.DB.prepare("INSERT INTO parade_plan_items (plan_id,position,activity,starts_at,ends_at,location,person_in_charge,notes) VALUES (?,?,?,?,?,?,?,?)").bind(id,i,text(items[i].activity,200),text(items[i].startsAt,8),text(items[i].endsAt,8),text(items[i].location,160),text(items[i].personInCharge,160),text(items[i].notes)).run();
    await audit(user,"parade_plan_created","parade_plan",id,undefined,body); return Response.json({ok:true,id,message:"Parade plan saved as a draft."});
  }
  if (action === "publish_parade_plan") {
    if (!isFinalStaff(user)) return Response.json({error:"Officer or administrator approval required"},{status:403}); const id=number(body.planId);
    await runtime.DB.prepare("UPDATE parade_plans SET status='published',published_at=?,locked_at=?,updated_at=? WHERE id=? AND status='draft'").bind(now,body.lock?now:null,now,id).run(); await audit(user,"parade_plan_published","parade_plan",id,undefined,{locked:Boolean(body.lock)}); return Response.json({ok:true,message:"Parade plan published."});
  }
  if (action === "create_duty_type") {
    if (!hasPermission(user,"programme.rosters.manage")) return Response.json({error:"Duty roster permission required"},{status:403}); const result=await runtime.DB.prepare("INSERT INTO duty_types (name,description,created_by_user_id,created_at) VALUES (?,?,?,?)").bind(text(body.name,120),text(body.description),user.id,now).run(); return Response.json({ok:true,id:Number(result.meta.last_row_id),message:"Duty type created."});
  }
  if (action === "assign_duty") {
    if (!(hasPermission(user,"programme.rosters.manage")||isSquadOperationsUser(user))) return Response.json({error:"Duty roster permission required"},{status:403});
    const memberId=number(body.memberId); const member=memberId?await memberById(memberId):null; const section=member?.section??text(body.section,20); const squad=member?.squad??(isSquadOperationsUser(user)?user.squad:text(body.squad,40));
    if(member&&!canViewMemberScope(user,member)&&!hasPermission(user,"programme.rosters.manage"))return Response.json({error:"Member not available"},{status:404});
    const result=await runtime.DB.prepare("INSERT INTO duty_assignments (event_id,duty_type_id,member_id,section,squad,starts_at,ends_at,status,notes,assigned_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'assigned',?,?,?,?)").bind(number(body.eventId)||null,number(body.dutyTypeId),member?.id??null,section,squad,text(body.startsAt,30),text(body.endsAt,30)||null,text(body.notes),user.id,now,now).run(); const id=Number(result.meta.last_row_id);
    if(member){ await notifyMember(member.id,"Duty assigned",`You have been assigned ${text(body.dutyName,120)||"a company duty"}.`,"/?open=duties",`duty:${id}`); const recipient=member.email?await activeUserIdForEmail(member.email):null; if(recipient)await actionItem({key:`duty:${id}`,rule:"duty_rosters",recipients:[recipient],title:"Duty assigned",description:`${text(body.dutyName,120)||"Company duty"} · ${text(body.startsAt,30)}`,url:"/?open=duties",sourceType:"duty_assignment",sourceId:String(id)}); } else {const recipients=await activeUserIdsForRolesOrPermission(["admin","officer"],"programme.rosters.manage");await actionItem({key:`duty-unfilled:${id}`,rule:"duty_rosters",recipients,title:"Duty remains unfilled",description:`${text(body.dutyName,120)||"A duty"} needs a member assignment.`,url:"/?open=duties",sourceType:"duty_assignment",sourceId:String(id),priority:"important"});}
    await audit(user,"duty_assigned","duty_assignment",id,undefined,body); return Response.json({ok:true,id,message:member?"Duty assigned and the member was notified.":"Unfilled duty created and staff were alerted."});
  }
  if (action === "substitute_duty") {
    if (!(hasPermission(user,"programme.rosters.manage")||isSquadOperationsUser(user))) return Response.json({error:"Duty roster permission required"},{status:403}); const id=number(body.assignmentId); const member=await requireMember(); if(!member)return Response.json({error:"Member not available"},{status:404}); const before=await runtime.DB.prepare("SELECT * FROM duty_assignments WHERE id=?").bind(id).first<{member_id:number}>();
    await runtime.DB.prepare("UPDATE duty_assignments SET substituted_from_member_id=member_id,member_id=?,section=?,squad=?,status='substituted',updated_at=? WHERE id=?").bind(member.id,member.section,member.squad,now,id).run(); await audit(user,"duty_substituted","duty_assignment",id,before,{memberId:member.id}); return Response.json({ok:true,message:"Duty substitution saved."});
  }
  if (action === "create_committee") {
    if (!(hasPermission(user,"programme.committees.manage")||isSquadOperationsUser(user))) return Response.json({error:"Committee permission required"},{status:403}); const section=isSquadOperationsUser(user)?user.member_section:text(body.section,20); const squad=isSquadOperationsUser(user)?user.squad:text(body.squad,40); const result=await runtime.DB.prepare("INSERT INTO event_committees (event_id,name,section,squad,status,notes,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,'active',?,?,?,?)").bind(number(body.eventId)||null,text(body.name,160),section,squad,text(body.notes),user.id,now,now).run(); const id=Number(result.meta.last_row_id); await audit(user,"committee_created","event_committee",id,undefined,body); return Response.json({ok:true,id,message:"Committee created."});
  }
  if (action === "add_committee_task") {
    if (!(hasPermission(user,"programme.committees.manage")||isSquadOperationsUser(user))) return Response.json({error:"Committee permission required"},{status:403});
    const committeeId=number(body.committeeId); const committee=await runtime.DB.prepare("SELECT section,squad FROM event_committees WHERE id=?").bind(committeeId).first<{section:string;squad:string}>();
    if(!committee||(!hasPermission(user,"programme.committees.manage")&&!canManageSquadRecord(user,committee.section,committee.squad)))return Response.json({error:"Committee not available"},{status:404});
    const memberId=number(body.memberId)||null; const member=memberId?await memberById(memberId):null; if(member&&!canViewMemberScope(user,member)&&!hasPermission(user,"programme.committees.manage"))return Response.json({error:"Member not available"},{status:404});
    const result=await runtime.DB.prepare("INSERT INTO committee_tasks (committee_id,title,assigned_member_id,deadline,status,notes,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,'open',?,?,?,?)").bind(committeeId,text(body.title,200),memberId,text(body.deadline,10)||null,text(body.notes),user.id,now,now).run(); const id=Number(result.meta.last_row_id);
    if(memberId){ await notifyMember(memberId,"Committee task assigned",text(body.title,200),"/?open=committees",`committee-task:${id}`); const recipient=member?.email?await activeUserIdForEmail(member.email):null; if(recipient)await actionItem({key:`committee:${id}`,rule:"committee_tasks",recipients:[recipient],title:"Committee task assigned",description:text(body.title,200),url:"/?open=committees",sourceType:"committee_task",sourceId:String(id)}); } return Response.json({ok:true,id,message:"Committee task added."});
  }
  if (action === "add_committee_member") {
    if (!(hasPermission(user,"programme.committees.manage")||isSquadOperationsUser(user))) return Response.json({error:"Committee permission required"},{status:403}); const member=await requireMember(); if(!member)return Response.json({error:"Member not available"},{status:404});
    await runtime.DB.prepare("INSERT INTO committee_members (committee_id,member_id,role,created_at) VALUES (?,?,?,?) ON CONFLICT(committee_id,member_id) DO UPDATE SET role=excluded.role").bind(number(body.committeeId),member.id,text(body.role,80)||"Member",now).run(); await notifyMember(member.id,"Added to event committee",`Your committee role is ${text(body.role,80)||"Member"}.`,"/?open=committees",`committee-member:${body.committeeId}:${member.id}`); return Response.json({ok:true,message:"Committee member added and notified."});
  }
  if (action === "update_committee_task") {
    const id=number(body.taskId); const task=await runtime.DB.prepare("SELECT t.assigned_member_id,c.section,c.squad FROM committee_tasks t JOIN event_committees c ON c.id=t.committee_id WHERE t.id=?").bind(id).first<{assigned_member_id:number|null;section:string;squad:string}>();
    const assignedToUser=Boolean(task?.assigned_member_id&&own?.id===task.assigned_member_id); if(!task||(!assignedToUser&&!canManageScopedPermission(user,"programme.committees.manage",task.section,task.squad)))return Response.json({error:"Committee task not available"},{status:404});
    const status=text(body.status,30); if(!["open","in_progress","completed","blocked"].includes(status))return Response.json({error:"Invalid task status"},{status:400}); await runtime.DB.prepare("UPDATE committee_tasks SET status=?,notes=?,updated_at=? WHERE id=?").bind(status,text(body.notes),now,id).run(); if(status==="completed")await resolveActions(`committee:${id}`); return Response.json({ok:true,message:"Committee task updated."});
  }
  if (action === "submit_leave") {
    const memberId=number(body.memberId)||own?.id||0; const member=await memberById(memberId); if(!member||(!canViewMemberScope(user,member)&&member.email.toLowerCase()!==user.email.toLowerCase()))return Response.json({error:"Member not available"},{status:404});
    try { const result=await runtime.DB.prepare("INSERT INTO leave_requests (event_id,member_id,reason,attachment_document_id,status,submitted_by_user_id,created_at,updated_at) VALUES (?,?,?,?,'pending_squad',?,?,?)").bind(number(body.eventId),member.id,text(body.reason),number(body.attachmentDocumentId)||null,user.id,now,now).run(); const id=Number(result.meta.last_row_id); const reviewers=await runtime.DB.prepare("SELECT id FROM users WHERE active=1 AND account_status='active' AND role IN ('nco','squad_leader') AND squad=?").bind(member.squad).all<{id:number}>(); await actionItem({key:`leave:${id}`,rule:"leave_requests",recipients:reviewers.results.map(r=>r.id),title:"Leave request needs squad review",description:`${member.name} submitted an event leave request.`,url:"/?open=leave",sourceType:"leave_request",sourceId:String(id)}); return Response.json({ok:true,id,message:"Leave request submitted."}); } catch { return Response.json({error:"A leave request for this event already exists"},{status:409}); }
  }
  if (action === "review_leave_squad") {
    if (!(isSquadOperationsUser(user)||hasPermission(user,"leave.review_squad")))return Response.json({error:"Squad review permission required"},{status:403}); const id=number(body.requestId); const row=await runtime.DB.prepare("SELECT l.*,m.section,m.squad FROM leave_requests l JOIN members m ON m.id=l.member_id WHERE l.id=?").bind(id).first<{section:string;squad:string}>(); if(!row||!canManageScopedPermission(user,"leave.review_squad",row.section,row.squad))return Response.json({error:"Request not available"},{status:404}); const decision=text(body.decision,20); if(!["confirmed","rejected"].includes(decision))return Response.json({error:"Invalid decision"},{status:400}); await runtime.DB.prepare("UPDATE leave_requests SET squad_review_status=?,status=?,squad_reviewer_user_id=?,squad_reviewed_at=?,reviewer_notes=?,updated_at=? WHERE id=?").bind(decision,decision==="confirmed"?"pending_final":"rejected",user.id,now,text(body.notes),now,id).run(); await resolveActions(`leave:${id}`); if(decision==="confirmed"){const recipients=await activeUserIdsForRolesOrPermission(["admin","officer"],"leave.approve");await actionItem({key:`leave-final:${id}`,rule:"leave_requests",recipients,title:"Leave request needs final approval",description:"A squad-reviewed leave request needs an Officer decision.",url:"/?open=leave",sourceType:"leave_request",sourceId:String(id),priority:"important"});} return Response.json({ok:true,message:`Leave request ${decision}.`});
  }
  if (action === "review_leave_final") {
    if (!(isFinalStaff(user)||hasPermission(user,"leave.approve")))return Response.json({error:"Final leave approval permission required"},{status:403}); const id=number(body.requestId); const decision=text(body.decision,20); if(!["approved","rejected"].includes(decision))return Response.json({error:"Invalid decision"},{status:400}); const row=await runtime.DB.prepare(`SELECT l.*,e.attendance_session_id,m.name FROM leave_requests l JOIN company_events e ON e.id=l.event_id JOIN members m ON m.id=l.member_id WHERE l.id=?`).bind(id).first<{member_id:number;attendance_session_id:number|null;name:string}>(); if(!row)return Response.json({error:"Request not found"},{status:404}); let conflict=0; if(decision==="approved"&&row.attendance_session_id){const attendance=await runtime.DB.prepare("SELECT status FROM attendance_records WHERE session_id=? AND member_id=?").bind(row.attendance_session_id,row.member_id).first<{status:string}>(); if(!attendance||attendance.status==="unmarked")await runtime.DB.prepare("INSERT INTO attendance_records (session_id,member_id,status,updated_at,updated_by) VALUES (?,?,'excused',?,?) ON CONFLICT(session_id,member_id) DO UPDATE SET status='excused',updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE attendance_records.status='unmarked'").bind(row.attendance_session_id,row.member_id,now,user.email).run(); else {conflict=1;const recipients=await activeUserIdsForRolesOrPermission(["admin","officer"],"attendance.manage");await actionItem({key:`leave-attendance:${id}`,rule:"leave_requests",recipients,title:"Approved leave conflicts with attendance",description:`${row.name} already has ${attendance.status} recorded. Review it without automatic overwrite.`,url:"/?open=attendance",sourceType:"leave_request",sourceId:String(id),priority:"important"});}}
    await runtime.DB.prepare("UPDATE leave_requests SET status=?,final_reviewer_user_id=?,final_reviewed_at=?,reviewer_notes=?,attendance_conflict=?,updated_at=? WHERE id=?").bind(decision,user.id,now,text(body.notes),conflict,now,id).run(); await resolveActions(`leave-final:${id}`); await notifyMember(row.member_id,`Leave request ${decision}`,text(body.notes)||`Your leave request was ${decision}.`,"/?open=leave",`leave-decision:${id}:${decision}`); await audit(user,"leave_request_decided","leave_request",id,undefined,{decision,conflict}); return Response.json({ok:true,message:conflict?"Leave approved. Existing attendance was preserved and a review task was created.":`Leave request ${decision}.`});
  }
  if (action === "withdraw_leave") { const id=number(body.requestId); await runtime.DB.prepare("UPDATE leave_requests SET status='withdrawn',withdrawn_at=?,updated_at=? WHERE id=? AND submitted_by_user_id=? AND status LIKE 'pending%'").bind(now,now,id,user.id).run(); await resolveActions(`leave:${id}`); return Response.json({ok:true,message:"Leave request withdrawn."}); }
  if (action === "save_promotion_rule") {
    if (!hasPermission(user,"promotion.rules.manage"))return Response.json({error:"Promotion rule permission required"},{status:403}); await runtime.DB.prepare(`INSERT INTO promotion_rules (section,target_rank,minimum_attendance_percent,required_awards_json,required_training_json,minimum_service_hours,officer_assessment_required,active,updated_by_user_id,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?) ON CONFLICT(section,target_rank) DO UPDATE SET minimum_attendance_percent=excluded.minimum_attendance_percent,required_awards_json=excluded.required_awards_json,required_training_json=excluded.required_training_json,minimum_service_hours=excluded.minimum_service_hours,officer_assessment_required=excluded.officer_assessment_required,active=1,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at`).bind(text(body.section,20),text(body.targetRank,80),Math.max(0,Math.min(100,number(body.minimumAttendancePercent))),JSON.stringify(jsonList(body.requiredAwards)),JSON.stringify(jsonList(body.requiredTraining)),Math.max(0,number(body.minimumServiceHours)),body.officerAssessmentRequired?1:0,user.id,now).run(); return Response.json({ok:true,message:"Promotion requirements saved."});
  }
  if (action === "waive_promotion_requirement") { if (!hasPermission(user,"promotion.review"))return Response.json({error:"Promotion review permission required"},{status:403}); await runtime.DB.prepare("INSERT INTO promotion_waivers (member_id,promotion_rule_id,requirement_key,reason,waived_by_user_id,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(member_id,promotion_rule_id,requirement_key) DO UPDATE SET reason=excluded.reason,waived_by_user_id=excluded.waived_by_user_id,created_at=excluded.created_at").bind(number(body.memberId),number(body.ruleId),text(body.requirementKey,160),text(body.reason),user.id,now).run(); return Response.json({ok:true,message:"Requirement waiver recorded."}); }
  if (action === "record_promotion_decision") { if (!hasPermission(user,"promotion.review"))return Response.json({error:"Promotion review permission required"},{status:403}); const result=await runtime.DB.prepare("INSERT INTO promotion_decisions (member_id,promotion_rule_id,decision,assessment_notes,decided_by_user_id,decided_at) VALUES (?,?,?,?,?,?)").bind(number(body.memberId),number(body.ruleId),text(body.decision,30),text(body.notes),user.id,now).run(); await audit(user,"promotion_decision_recorded","promotion_decision",Number(result.meta.last_row_id),undefined,body); return Response.json({ok:true,message:"Promotion decision recorded. The member rank was not changed automatically."}); }
  if (action === "submit_service_hours") { const memberId=number(body.memberId)||own?.id||0; const member=await memberById(memberId); if(!member||!canViewMemberScope(user,member))return Response.json({error:"Member not available"},{status:404}); const minutes=Math.round(number(body.hours)*60+number(body.minutes)); if(minutes<=0||minutes>24*60)return Response.json({error:"Enter a valid service duration"},{status:400}); const result=await runtime.DB.prepare("INSERT INTO service_hour_submissions (member_id,activity,service_date,duration_minutes,category,description,evidence_document_id,status,submitted_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending_squad',?,?,?)").bind(member.id,text(body.activity,200),text(body.serviceDate,10),minutes,text(body.category,80),text(body.description),number(body.evidenceDocumentId)||null,user.id,now,now).run(); const id=Number(result.meta.last_row_id); const reviewers=await runtime.DB.prepare("SELECT id FROM users WHERE active=1 AND role IN ('nco','squad_leader') AND squad=?").bind(member.squad).all<{id:number}>(); await actionItem({key:`service:${id}`,rule:"service_verification",recipients:reviewers.results.map(r=>r.id),title:"Service hours need squad confirmation",description:`${member.name} submitted ${Math.round(minutes/6)/10} service hours.`,url:"/?open=service",sourceType:"service_hours",sourceId:String(id)}); return Response.json({ok:true,id,message:"Service hours submitted for squad confirmation."}); }
  if (action === "review_service_squad") { if(!(isSquadOperationsUser(user)||hasPermission(user,"service.verify_squad")))return Response.json({error:"Squad verification permission required"},{status:403}); const id=number(body.submissionId); const row=await runtime.DB.prepare("SELECT s.*,m.section,m.squad FROM service_hour_submissions s JOIN members m ON m.id=s.member_id WHERE s.id=?").bind(id).first<{section:string;squad:string}>(); if(!row||!canManageScopedPermission(user,"service.verify_squad",row.section,row.squad))return Response.json({error:"Submission not available"},{status:404}); const decision=text(body.decision,20); await runtime.DB.prepare("UPDATE service_hour_submissions SET status=?,squad_reviewer_user_id=?,squad_reviewed_at=?,squad_review_notes=?,updated_at=? WHERE id=?").bind(decision==="confirmed"?"pending_final":"rejected",user.id,now,text(body.notes),now,id).run(); await resolveActions(`service:${id}`); if(decision==="confirmed"){const recipients=await activeUserIdsForRolesOrPermission(["admin","officer"],"service.approve");await actionItem({key:`service-final:${id}`,rule:"service_verification",recipients,title:"Service hours need final approval",description:"Squad-confirmed service hours need an Officer decision.",url:"/?open=service",sourceType:"service_hours",sourceId:String(id)});} return Response.json({ok:true,message:`Service submission ${decision}.`}); }
  if (action === "review_service_final") { if(!(isFinalStaff(user)||hasPermission(user,"service.approve")))return Response.json({error:"Final service approval permission required"},{status:403}); const id=number(body.submissionId); const decision=text(body.decision,20); const row=await runtime.DB.prepare("SELECT member_id FROM service_hour_submissions WHERE id=?").bind(id).first<{member_id:number}>(); await runtime.DB.prepare("UPDATE service_hour_submissions SET status=?,final_reviewer_user_id=?,final_reviewed_at=?,final_review_notes=?,updated_at=? WHERE id=?").bind(decision,user.id,now,text(body.notes),now,id).run(); await resolveActions(`service-final:${id}`); if(row)await notifyMember(row.member_id,`Service hours ${decision}`,text(body.notes)||`Your service hours were ${decision}.`,"/?open=service",`service-decision:${id}:${decision}`); return Response.json({ok:true,message:`Service hours ${decision}.`}); }
  if (action === "save_band_profile") { if(!hasPermission(user,"band.manage_profiles"))return Response.json({error:"Band profile permission required"},{status:403}); await runtime.DB.prepare("INSERT INTO band_profiles (member_id,instrument_section,proficiency,position,active,notes,updated_by_user_id,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET instrument_section=excluded.instrument_section,proficiency=excluded.proficiency,position=excluded.position,active=excluded.active,notes=excluded.notes,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at").bind(number(body.memberId),text(body.instrumentSection,80),text(body.proficiency,80),text(body.position,80),body.active===false?0:1,text(body.notes),user.id,now).run(); return Response.json({ok:true,message:"Band profile saved."}); }
  if (action === "add_band_instrument") { if(!hasPermission(user,"band.manage_instruments"))return Response.json({error:"Instrument permission required"},{status:403}); try{const result=await runtime.DB.prepare("INSERT INTO band_instruments (name,instrument_section,serial_number,condition,maintenance_due_at,notes,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(text(body.name,160),text(body.instrumentSection,80),text(body.serialNumber,120),text(body.condition,30)||"serviceable",text(body.maintenanceDueAt,10)||null,text(body.notes),user.id,now,now).run(); return Response.json({ok:true,id:Number(result.meta.last_row_id),message:"Instrument added."});}catch{return Response.json({error:"That serial number is already in use"},{status:409});} }
  if (action === "band_instrument_action") { if(!hasPermission(user,"band.manage_instruments"))return Response.json({error:"Instrument permission required"},{status:403}); const id=number(body.instrumentId); const instrument=await runtime.DB.prepare("SELECT condition,current_holder_member_id,issued_at,due_at FROM band_instruments WHERE id=?").bind(id).first<{condition:string;current_holder_member_id:number|null;issued_at:string|null;due_at:string|null}>(); if(!instrument)return Response.json({error:"Instrument not found"},{status:404}); const operation=text(body.operation,30); const memberId=number(body.memberId)||null; if(operation==="issue"&&(instrument.condition==="defective"||instrument.current_holder_member_id))return Response.json({error:instrument.condition==="defective"?"Defective instruments cannot be issued":"Instrument is already issued"},{status:409}); if(operation==="issue"&&!memberId)return Response.json({error:"Select a member"},{status:400}); let holder=instrument.current_holder_member_id; let condition=instrument.condition; if(operation==="issue")holder=memberId; else if(operation==="return")holder=null; else if(operation==="condition")condition=text(body.condition,30); else return Response.json({error:"Invalid instrument action"},{status:400}); const issuedAt=operation==="issue"?now:operation==="return"?null:instrument.issued_at; const dueAt=operation==="issue"?text(body.dueAt,10)||null:operation==="return"?null:instrument.due_at; await runtime.DB.prepare("UPDATE band_instruments SET current_holder_member_id=?,issued_at=?,due_at=?,condition=?,maintenance_due_at=COALESCE(?,maintenance_due_at),updated_at=? WHERE id=?").bind(holder,issuedAt,dueAt,condition,text(body.maintenanceDueAt,10)||null,now,id).run(); await runtime.DB.prepare("INSERT INTO band_instrument_history (instrument_id,member_id,action,condition_before,condition_after,notes,performed_by_user_id,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,memberId||instrument.current_holder_member_id,operation,instrument.condition,condition,text(body.notes),user.id,now).run(); await audit(user,`band_instrument_${operation}`,"band_instrument",id,instrument,{holder,condition}); return Response.json({ok:true,message:`Instrument ${operation} recorded.`}); }
  if (action === "add_band_rehearsal" || action === "add_band_performance") { if(!hasPermission(user,"band.manage_programme"))return Response.json({error:"Band programme permission required"},{status:403}); const rehearsal=action.endsWith("rehearsal"); const table=rehearsal?"band_rehearsals":"band_performances"; const dateColumn=rehearsal?"rehearsal_date":"performance_date"; const result=await runtime.DB.prepare(`INSERT INTO ${table} (title,${dateColumn},location,notes,created_by_user_id,created_at) VALUES (?,?,?,?,?,?)`).bind(text(body.title,160),text(body.date,10),text(body.location,160),text(body.notes),user.id,now).run(); return Response.json({ok:true,id:Number(result.meta.last_row_id),message:`Band ${rehearsal?"rehearsal":"performance"} added.`}); }
  if (action === "add_band_assessment") { if(!hasPermission(user,"band.manage_programme"))return Response.json({error:"Band assessment permission required"},{status:403}); const result=await runtime.DB.prepare("INSERT INTO band_proficiency_assessments (member_id,proficiency,result,assessed_at,notes,assessed_by_user_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(number(body.memberId),text(body.proficiency,80),text(body.result,80),text(body.assessedAt,10),text(body.notes),user.id,now).run(); return Response.json({ok:true,id:Number(result.meta.last_row_id),message:"Proficiency assessment recorded."}); }
  if (action === "mark_band_rehearsal") { if(!hasPermission(user,"band.manage_programme"))return Response.json({error:"Band programme permission required"},{status:403}); const status=text(body.status,20); if(!["present","absent","excused","unmarked"].includes(status))return Response.json({error:"Invalid rehearsal attendance"},{status:400}); await runtime.DB.prepare("INSERT INTO band_rehearsal_attendance (rehearsal_id,member_id,status,updated_by_user_id,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(rehearsal_id,member_id) DO UPDATE SET status=excluded.status,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at").bind(number(body.rehearsalId),number(body.memberId),status,user.id,now).run(); return Response.json({ok:true,message:"Rehearsal attendance updated."}); }
  if (action === "start_emergency") { if(!(hasPermission(user,"emergency.manage")||isSquadOperationsUser(user)))return Response.json({error:"Emergency roll-call permission required"},{status:403}); const section=isSquadOperationsUser(user)?user.member_section:text(body.section,20)||"all"; const result=await runtime.DB.prepare("INSERT INTO emergency_sessions (title,event_id,section,status,started_by_user_id,started_at) VALUES (?,?,?,'active',?,?)").bind(text(body.title,160),number(body.eventId)||null,section,user.id,now).run(); const id=Number(result.meta.last_row_id); const expected=allScopeQuery(section,isSquadOperationsUser(user)?user.squad:""); const members=await runtime.DB.prepare(expected.sql).bind(...expected.bindings).all<{id:number}>(); for(const member of members.results)await runtime.DB.prepare("INSERT INTO emergency_responses (session_id,member_id,status,notes,updated_by_user_id,updated_at) VALUES (?,?,'unknown','',?,?)").bind(id,member.id,user.id,now).run(); await audit(user,"emergency_roll_call_started","emergency_session",id,undefined,{section,count:members.results.length}); return Response.json({ok:true,id,message:"Emergency roll call started."}); }
  if (action === "update_emergency_response") { if(!(hasPermission(user,"emergency.manage")||isSquadOperationsUser(user)))return Response.json({error:"Emergency roll-call permission required"},{status:403}); const member=await requireMember(); if(!member)return Response.json({error:"Member not available"},{status:404}); const status=text(body.status,20); if(!["safe","missing","departed","unknown"].includes(status))return Response.json({error:"Invalid response status"},{status:400}); const sessionId=number(body.sessionId); const before=await runtime.DB.prepare("SELECT status,notes FROM emergency_responses WHERE session_id=? AND member_id=?").bind(sessionId,member.id).first(); await runtime.DB.prepare("UPDATE emergency_responses SET status=?,notes=?,updated_by_user_id=?,updated_at=? WHERE session_id=? AND member_id=?").bind(status,text(body.notes),user.id,now,sessionId,member.id).run(); await audit(user,"emergency_response_updated","emergency_response",`${sessionId}:${member.id}`,before,{status}); return Response.json({ok:true,message:"Roll-call status updated."}); }
  if (action === "close_emergency") { if(!hasPermission(user,"emergency.manage"))return Response.json({error:"Emergency roll-call permission required"},{status:403}); const id=number(body.sessionId); await runtime.DB.prepare("UPDATE emergency_sessions SET status='closed',closed_by_user_id=?,closed_at=? WHERE id=? AND status='active'").bind(user.id,now,id).run(); await audit(user,"emergency_roll_call_closed","emergency_session",id,undefined,{closedAt:now}); return Response.json({ok:true,message:"Emergency roll call closed."}); }
  if (action === "view_emergency_contact") { if(!(isFinalStaff(user)||isSquadOperationsUser(user)||hasPermission(user,"emergency.view_contacts")))return Response.json({error:"Emergency contact permission required"},{status:403}); const member=await requireMember(); if(!member)return Response.json({error:"Member not available"},{status:404}); await audit(user,"emergency_contact_viewed","member",member.id,undefined,{reason:text(body.reason,200)}); return Response.json({ok:true,contact:{memberName:member.name,emergencyContactNumber:member.emergency_contact_number,parentsName:member.parents_name}}); }
  return Response.json({error:"Unknown operations action"},{status:400});
}

function allScopeQuery(section:string,squad:string){const clauses=["1=1"];const bindings:Array<string>=[];if(section&&section!=="all"){clauses.push("section=?");bindings.push(section);}if(squad){clauses.push("squad=?");bindings.push(squad);}return{sql:`SELECT id FROM members WHERE ${clauses.join(" AND ")} ORDER BY name`,bindings};}
