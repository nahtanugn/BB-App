import { getCurrentUser } from "../../../../lib/auth";
import { ensurePresidentsBadgeSchema, hasPresidentPermission, memberIdForUser, presidentsBadgeRuntime } from "../../../../lib/presidents-badge";
import { writeAuditEvent } from "../../../../lib/audit";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensurePresidentsBadgeSchema();
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const url = new URL(request.url); const applicationId = Number(url.searchParams.get("applicationId")); const versionId = Number(url.searchParams.get("versionId")); const outcomeId=Number(url.searchParams.get("outcomeId"));
  if(outcomeId){
    const outcome=await presidentsBadgeRuntime.DB.prepare(`SELECT o.id,o.returned_document_object_key,a.member_id,m.name FROM presidents_badge_outcomes o JOIN presidents_badge_applications a ON a.id=o.application_id JOIN members m ON m.id=a.member_id WHERE o.id=? AND o.application_id=?`).bind(outcomeId,applicationId).first<{id:number;returned_document_object_key:string;member_id:number;name:string}>();
    if(!outcome?.returned_document_object_key)return Response.json({error:"Supporting document not found"},{status:404});
    const ownMemberId=await memberIdForUser(user);if(ownMemberId!==outcome.member_id&&!hasPresidentPermission(user,"presidents_badge.manage")&&!hasPresidentPermission(user,"presidents_badge.view_sensitive"))return Response.json({error:"Permission denied"},{status:403});
    const object=await presidentsBadgeRuntime.DOCUMENTS?.get(outcome.returned_document_object_key);if(!object)return Response.json({error:"Private supporting document is unavailable"},{status:404});
    await writeAuditEvent({actor:user,action:"presidents_badge.outcome_document_downloaded",entityType:"presidents_badge_outcome",entityId:outcome.id});
    const contentType=object.httpMetadata?.contentType??"application/octet-stream";
    const extension=contentType==="application/pdf"?"pdf":contentType==="image/png"?"png":contentType==="image/jpeg"?"jpg":"bin";
    return new Response(object.body,{headers:{"Content-Type":contentType,"Content-Disposition":`attachment; filename="President's Badge - ${outcome.name.replace(/[^A-Za-z0-9 .'-]/g,"")} - BBM document.${extension}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  const row = await presidentsBadgeRuntime.DB.prepare(`SELECT v.id,v.object_key,v.sha256,a.member_id,a.application_year,m.name,m.email FROM presidents_badge_versions v JOIN presidents_badge_applications a ON a.id=v.application_id JOIN members m ON m.id=a.member_id WHERE v.application_id=? AND (?=0 OR v.id=?) ORDER BY v.version_number DESC LIMIT 1`).bind(applicationId, versionId, versionId).first<{ id:number;object_key:string;sha256:string;member_id:number;application_year:number;name:string;email:string }>();
  if (!row) return Response.json({ error: "Completed PDF not found" }, { status: 404 });
  const ownMemberId = await memberIdForUser(user);
  if (ownMemberId !== row.member_id && !hasPresidentPermission(user, "presidents_badge.manage") && !hasPresidentPermission(user, "presidents_badge.view_sensitive")) return Response.json({ error: "Permission denied" }, { status: 403 });
  const object = await presidentsBadgeRuntime.DOCUMENTS?.get(row.object_key);
  if (!object) return Response.json({ error: "Private PDF file is unavailable" }, { status: 404 });
  await writeAuditEvent({ actor: user, action: "presidents_badge.pdf_downloaded", entityType: "presidents_badge_version", entityId: row.id, after: { sha256: row.sha256 } });
  const safeName = row.name.replace(/[^A-Za-z0-9 .'-]/g, "").trim() || "Member";
  return new Response(object.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="President's Badge - ${safeName} - ${row.application_year}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
