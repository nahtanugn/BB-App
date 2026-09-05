import { ensurePresidentsBadgeSchema, presidentsBadgeRuntime, reservePrivateDocument, releasePrivateDocument, sha256Bytes, validateOverlayText } from "../../../../lib/presidents-badge";
import { writeAuditEvent } from "../../../../lib/audit";
import { createNotifications } from "../../../../lib/notifications";

export const runtime = "edge";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const response = (body: unknown, status = 200) => Response.json(body, { status, headers });
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

function signatureMime(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return "";
}

async function invitation(token: string) {
  if (token.length < 32) return null;
  const hash = await sha256Bytes(new TextEncoder().encode(token));
  return presidentsBadgeRuntime.DB.prepare(`SELECT i.id invitation_id,i.assessment_id,i.expires_at,a.assessor_type,a.status,p.id application_id,m.name candidate_name FROM presidents_badge_assessment_invitations i JOIN presidents_badge_assessments a ON a.id=i.assessment_id JOIN presidents_badge_applications p ON p.id=a.application_id JOIN members m ON m.id=p.member_id WHERE i.token_hash=? AND i.revoked_at IS NULL AND i.expires_at>?`).bind(hash, new Date().toISOString()).first<{ invitation_id:number;assessment_id:number;expires_at:string;assessor_type:string;status:string;application_id:number;candidate_name:string }>();
}

export async function GET(request: Request) {
  await ensurePresidentsBadgeSchema();
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const row = await invitation(token);
  if (!row) return response({ error: "This private assessment link is invalid, expired or revoked." }, 410);
  await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_assessment_invitations SET last_accessed_at=? WHERE id=?").bind(new Date().toISOString(), row.invitation_id).run();
  await writeAuditEvent({ actor: { id: 0, email: "secure-assessor", role: row.assessor_type }, action: "presidents_badge.assessment_accessed", entityType: "presidents_badge_assessment", entityId: row.assessment_id, after: { assessorType: row.assessor_type } });
  return response({ candidateName: row.candidate_name, assessorType: row.assessor_type, expiresAt: row.expires_at, completed: row.status === "submitted" });
}

export async function POST(request: Request) {
  await ensurePresidentsBadgeSchema();
  const form = await request.formData();
  const row = await invitation(String(form.get("token") ?? ""));
  if (!row) return response({ error: "This private assessment link is invalid, expired or revoked." }, 410);
  if (row.status === "submitted") return response({ error: "This assessment has already been submitted." }, 409);
  const required = ["trustworthiness", "respect", "responsibility", "fairness", "caring", "good_example", "self_discipline", "humility", "attitude"];
  const ratings = Object.fromEntries(required.map((key) => [key, Number(form.get(key))]));
  if (required.some((key) => ![1,2,3,4,5].includes(Number(ratings[key])))) return response({ error: "Complete every quality rating." }, 400);
  const reasons = form.getAll("reasons").map(String).filter(Boolean);
  if (reasons.length < 2) return response({ error: "Choose at least two recommendation reasons." }, 400);
  const name = validateOverlayText(String(form.get("assessorName") ?? ""), "Assessor name", 40);
  if (!name) return response({ error: "Assessor name is required." }, 400);
  const relationship = validateOverlayText(String(form.get("relationship") ?? ""), "Relationship", 30);
  const remarks = validateOverlayText(String(form.get("remarks") ?? ""), "Remarks", 240);
  let signatureObjectKey = "";
  const signature = form.get("signature");
  if (signature instanceof File && signature.size) {
    if (signature.size > MAX_SIGNATURE_BYTES) return response({ error: "Signature image must be 2 MB or smaller." }, 400);
    const bytes = new Uint8Array(await signature.arrayBuffer());
    const mime = signatureMime(bytes);
    if (!mime) return response({ error: "Signature must be a PNG or JPEG image." }, 400);
    const bucket = presidentsBadgeRuntime.DOCUMENTS;
    if (!bucket) return response({ error: "Private document storage is unavailable." }, 503);
    const hash = await sha256Bytes(bytes);
    signatureObjectKey = `presidents-badge/assessments/${row.assessment_id}/signature-${crypto.randomUUID()}.${mime === "image/png" ? "png" : "jpg"}`;
    await reservePrivateDocument(bytes.byteLength);
    try { await bucket.put(signatureObjectKey, bytes, { httpMetadata: { contentType: mime }, customMetadata: { sha256: hash, assessmentId: String(row.assessment_id) } }); } catch (error) { await releasePrivateDocument(bytes.byteLength); throw error; }
  }
  const submitted = new Date().toISOString();
  await presidentsBadgeRuntime.DB.prepare(`UPDATE presidents_badge_assessments SET assessor_name=?,assessor_relationship=?,ratings_json=?,reasons_json=?,remarks=?,signature_object_key=?,status='submitted',submitted_at=?,updated_at=? WHERE id=?`).bind(name, relationship, JSON.stringify(ratings), JSON.stringify(reasons), remarks, signatureObjectKey, submitted, submitted, row.assessment_id).run();
  await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_assessment_invitations SET revoked_at=? WHERE assessment_id=?").bind(submitted, row.assessment_id).run();
  const pending = await presidentsBadgeRuntime.DB.prepare("SELECT COUNT(*) total FROM presidents_badge_assessments WHERE application_id=? AND assessor_type IN ('parent','teacher') AND status NOT IN ('submitted','paper_selected')").bind(row.application_id).first<{total:number}>();
  if(!Number(pending?.total??0)){
    await presidentsBadgeRuntime.DB.prepare("UPDATE presidents_badge_applications SET status='captain_review',updated_at=? WHERE id=?").bind(submitted,row.application_id).run();
    const captain=await presidentsBadgeRuntime.DB.prepare("SELECT captain_user_id FROM presidents_badge_applications WHERE id=?").bind(row.application_id).first<{captain_user_id:number|null}>();
    if(captain?.captain_user_id)await createNotifications({recipientUserIds:[captain.captain_user_id],type:"award",title:"President’s Badge Captain review",body:`${row.candidate_name}'s parent and teacher assessments are ready for Captain review.`,targetUrl:`/?open=presidents-badge&application=${row.application_id}`,entityKey:`presidents-badge-captain-${row.application_id}`});
  }
  await writeAuditEvent({ actor: { id: 0, email: "secure-assessor", role: row.assessor_type }, action: "presidents_badge.assessment_submitted", entityType: "presidents_badge_assessment", entityId: row.assessment_id, after: { assessorType: row.assessor_type, signatureProvided: Boolean(signatureObjectKey) } });
  return response({ ok: true });
}
