import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { writeAuditEvent } from "../../../lib/audit";

type Db = { id: number; reporting_year: number; status: string; locked_at: string | null; locked_by_user_id: number | null; captain_name: string; chaplain_name: string; submission_date: string; received_by: string; date_received: string; data_entry_name: string; remarks: string; notes: string; created_at: string; updated_at: string };
type Member = { id: number; name: string; rank: string; section: string; gender: string; ethnicity: string; accepted_christ: number; baptised: number };
type Status = { member_id: number; membership_status: string; category_override: string; gender_override: string; ethnicity_override: string };

const staff = (role: string) => ["admin", "officer", "viewer"].includes(role);
const editable = (role: string) => ["admin", "officer"].includes(role);
const yearOf = (value: string | null) => Number(value || new Date().getFullYear());
const emptyPayload = () => ({
  reEnrolled: {}, recruits: {}, primer: {}, associateMembers: {}, alumni: {}, officers: {}, ethnicity: {}, spirituality: {}, categoryMapping: {}, notes: "",
});

function category(member: Member, override: string) {
  if (override) return override;
  if (member.section === "junior") return member.rank.toLowerCase() === "pre-junior" ? "Pre-Junior" : "Junior";
  return "Senior";
}
function countMap(rows: Member[], statuses: Map<number, Status>, statusName: string) {
  const result: Record<string, { M: number; F: number; unknown: number }> = {};
  for (const member of rows) {
    const status = statuses.get(member.id);
    if ((status?.membership_status || "continuing") !== statusName) continue;
    const key = category(member, status?.category_override || "");
    const gender = String(status?.gender_override || member.gender || "").toUpperCase();
    result[key] ??= { M: 0, F: 0, unknown: 0 };
    if (gender === "M" || gender === "MALE") result[key].M += 1;
    else if (gender === "F" || gender === "FEMALE") result[key].F += 1;
    else result[key].unknown += 1;
  }
  return result;
}

async function getData(year: number) {
  const record = await env.DB.prepare("SELECT * FROM company_statistics WHERE reporting_year = ? LIMIT 1").bind(year).first<Db>();
  const members = (await env.DB.prepare("SELECT id,name,rank,section,COALESCE(gender,'') gender,COALESCE(ethnicity,'') ethnicity,COALESCE(accepted_christ,0) accepted_christ,COALESCE(baptised,0) baptised FROM members WHERE is_demo = 0 ORDER BY name").all<Member>()).results;
  const statuses = new Map<number, Status>();
  if (record) for (const row of (await env.DB.prepare("SELECT member_id,membership_status,category_override,gender_override,ethnicity_override FROM company_statistics_member_status WHERE statistics_id = ?").bind(record.id).all<Status>()).results) statuses.set(row.member_id, row);
  let inputs = emptyPayload();
  if (record) {
    const input = await env.DB.prepare("SELECT payload FROM company_statistics_inputs WHERE statistics_id = ?").bind(record.id).first<{ payload: string }>();
    if (input?.payload) { try { inputs = { ...inputs, ...JSON.parse(input.payload) }; } catch { /* keep defaults */ } }
  }
  const counts = {
    continuing: countMap(members, statuses, "continuing"),
    reEnrolled: countMap(members, statuses, "re_enrolled"),
    recruits: countMap(members, statuses, "recruit"),
  };
  const ethnicity: Record<string, number> = {};
  let acceptedChrist = 0; let baptised = 0;
  for (const member of members) {
    const status = statuses.get(member.id); const key = status?.ethnicity_override || member.ethnicity || "Unclassified";
    ethnicity[key] = (ethnicity[key] || 0) + 1;
    acceptedChrist += Number(member.accepted_christ) ? 1 : 0; baptised += Number(member.baptised) ? 1 : 0;
  }
  const attendance = await env.DB.prepare(`SELECT COUNT(*) AS sessions, SUM(CASE WHEN ar.status IN ('present','absent','excused') THEN 1 ELSE 0 END) AS marked
    FROM attendance_sessions s LEFT JOIN attendance_records ar ON ar.session_id = s.id
    WHERE substr(s.meeting_date,1,4) = ? AND s.meeting_date <= date('now')`).bind(String(year)).first<{ sessions: number; marked: number }>();
  const calculated = { memberCount: members.length, counts, ethnicity, spirituality: { acceptedChrist, baptised }, attendance: { sessions: Number(attendance?.sessions || 0), marked: Number(attendance?.marked || 0) }, missingClassification: members.filter((member) => !member.gender || !member.ethnicity).map((member) => ({ id: member.id, name: member.name })), members };
  const reviewed = inputs.classificationComplete === true;
  const validation = { missingClassification: calculated.missingClassification.length, warnings: calculated.missingClassification.length && !reviewed ? ["Some members need gender and ethnicity classification before finalisation."] : [], canFinalize: calculated.missingClassification.length === 0 || reviewed };
  return { year, record, inputs, calculated, validation, memberStatus: [...statuses.values()] };
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!staff(user.role)) return Response.json({ error: "Statistics access required" }, { status: 403 });
  try { return Response.json(await getData(yearOf(new URL(request.url).searchParams.get("year")))); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load company statistics" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request); if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!staff(user.role)) return Response.json({ error: "Statistics access required" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>; const year = yearOf(String(body.year ?? "")); const action = String(body.action ?? ""); const now = new Date().toISOString();
  try {
    let row = await env.DB.prepare("SELECT * FROM company_statistics WHERE reporting_year = ? LIMIT 1").bind(year).first<Db>();
    if (action === "export") { if (row) await env.DB.prepare("INSERT INTO company_statistics_audit (statistics_id,action,actor_user_id,details,created_at) VALUES (?,?,?,?,?)").bind(row.id, "export", user.id, JSON.stringify({ format: body.format || "print" }), now).run(); return Response.json({ ok: true }); }
    if (!editable(user.role)) return Response.json({ error: "Only Administrators and Officers may edit annual statistics" }, { status: 403 });
    if (action === "reopen") { if (user.role !== "admin") return Response.json({ error: "Administrator access required to reopen a year" }, { status: 403 }); if (!row) return Response.json({ error: "Year not found" }, { status: 404 }); await env.DB.prepare("UPDATE company_statistics SET status='draft',locked_at=NULL,locked_by_user_id=NULL,updated_at=? WHERE id=?").bind(now,row.id).run(); await writeAuditEvent({ actor: user, action: "reopen", entityType: "company_statistics", entityId: row.id }); return Response.json({ ok: true, ...(await getData(year)) }); }
    if (!row) { await env.DB.prepare("INSERT INTO company_statistics (reporting_year,status,created_at,updated_at) VALUES (?, 'draft', ?, ?)").bind(year, now, now).run(); row = await env.DB.prepare("SELECT * FROM company_statistics WHERE reporting_year = ? LIMIT 1").bind(year).first<Db>(); }
    if (!row) throw new Error("Unable to create statistics year");
    if (row.status === "final" && action !== "reopen") return Response.json({ error: "This year is finalised and locked" }, { status: 409 });
    const inputs = (body.inputs && typeof body.inputs === "object") ? body.inputs : emptyPayload(); const fields = body.fields && typeof body.fields === "object" ? body.fields as Record<string, unknown> : {};
    await env.DB.prepare("INSERT INTO company_statistics_inputs (statistics_id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(statistics_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(row.id, JSON.stringify(inputs), now).run();
    await env.DB.prepare("UPDATE company_statistics SET captain_name=?,chaplain_name=?,submission_date=?,received_by=?,date_received=?,data_entry_name=?,remarks=?,notes=?,updated_at=? WHERE id=?").bind(String(fields.captainName ?? row.captain_name),String(fields.chaplainName ?? row.chaplain_name),String(fields.submissionDate ?? row.submission_date),String(fields.receivedBy ?? row.received_by),String(fields.dateReceived ?? row.date_received),String(fields.dataEntryName ?? row.data_entry_name),String(fields.remarks ?? row.remarks),String(fields.notes ?? row.notes),now,row.id).run();
    if (Array.isArray(body.memberStatus)) for (const item of body.memberStatus as Array<Record<string, unknown>>) { const memberId = Number(item.memberId); if (!memberId) continue; await env.DB.prepare("INSERT INTO company_statistics_member_status (statistics_id,member_id,membership_status,category_override,gender_override,ethnicity_override,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(statistics_id,member_id) DO UPDATE SET membership_status=excluded.membership_status,category_override=excluded.category_override,gender_override=excluded.gender_override,ethnicity_override=excluded.ethnicity_override,updated_at=excluded.updated_at").bind(row.id,memberId,String(item.membershipStatus||"continuing"),String(item.categoryOverride||""),String(item.genderOverride||""),String(item.ethnicityOverride||""),now).run(); }
    if (action === "finalize") { const preview = await getData(year); if (!preview.validation.canFinalize) return Response.json({ error: "Resolve missing classifications before finalising", validation: preview.validation }, { status: 400 }); await env.DB.prepare("UPDATE company_statistics SET status='final',locked_at=?,locked_by_user_id=?,updated_at=? WHERE id=?").bind(now,user.id,now,row.id).run(); }
    await env.DB.prepare("INSERT INTO company_statistics_audit (statistics_id,action,actor_user_id,details,created_at) VALUES (?,?,?,?,?)").bind(row.id,action || "save_draft",user.id,JSON.stringify({ fields, inputs }),now).run();
    await writeAuditEvent({ actor: user, action: action || "save_draft", entityType: "company_statistics", entityId: row.id, after: { year, status: action === "finalize" ? "final" : "draft" } });
    return Response.json({ ok: true, ...(await getData(year)) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to save company statistics" }, { status: 500 }); }
}
