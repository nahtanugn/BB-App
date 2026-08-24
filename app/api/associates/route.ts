import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { writeAuditEvent } from "../../../lib/audit";

const allowedRoles = ["admin", "officer", "viewer"];
const editableRoles = ["admin", "officer"];
const classifications = ["associate_member", "instructor", "helper", "alumni"];
const genders = ["M", "F"];
const workStatuses = ["working", "studying"];
const spiritualStatuses = ["", "accepted_christ", "baptised", "non_believer"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return Response.json({ error: "Associate Members and Alumni access required" }, { status: 403 });
  try {
    const records = await env.DB.prepare(`SELECT id, name, classification, gender, work_status,
      ethnicity, religion, spiritual_status, notes, active, created_at, updated_at
      FROM associates_and_alumni ORDER BY active DESC, name COLLATE NOCASE`).all();
    return Response.json({ records: records.results });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Unable to load Associate Members and Alumni" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!editableRoles.includes(user.role)) return Response.json({ error: "Administrator or Officer access required" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  try {
    if (action === "archive") {
      const id = Number(body.id);
      const before = await env.DB.prepare("SELECT * FROM associates_and_alumni WHERE id = ?").bind(id).first();
      if (!before) return Response.json({ error: "Record not found" }, { status: 404 });
      await env.DB.prepare("UPDATE associates_and_alumni SET active = 0, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
      await writeAuditEvent({ actor: user, action: "associate_alumni_archived", entityType: "associate_alumni", entityId: id, before, after: { active: 0 } });
      return Response.json({ ok: true, message: "Record archived." });
    }
    if (!["create", "update"].includes(action)) return Response.json({ error: "Unsupported action" }, { status: 400 });
    const id = Number(body.id || 0);
    const name = String(body.name ?? "").trim().slice(0, 120);
    const classification = String(body.classification ?? "");
    const gender = String(body.gender ?? "M").trim().toUpperCase();
    const workStatus = String(body.workStatus ?? "working").trim();
    const ethnicity = String(body.ethnicity ?? "").trim().slice(0, 60);
    const religion = String(body.religion ?? "").trim().slice(0, 60);
    const spiritualStatus = String(body.spiritualStatus ?? "").trim();
    const notes = String(body.notes ?? "").trim().slice(0, 1000);
    if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
    if (!classifications.includes(classification)) return Response.json({ error: "Select a valid classification" }, { status: 400 });
    if (!genders.includes(gender)) return Response.json({ error: "Select Male or Female" }, { status: 400 });
    if (!workStatuses.includes(workStatus)) return Response.json({ error: "Select Working or Studying" }, { status: 400 });
    if (!ethnicity) return Response.json({ error: "Select an ethnicity" }, { status: 400 });
    if (!spiritualStatuses.includes(spiritualStatus)) return Response.json({ error: "Select a valid spiritual status" }, { status: 400 });
    const now = new Date().toISOString();
    if (action === "create") {
      const result = await env.DB.prepare(`INSERT INTO associates_and_alumni
        (name, classification, gender, work_status, ethnicity, religion, spiritual_status, notes, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .bind(name, classification, gender, workStatus, ethnicity, religion, spiritualStatus, notes, now, now).run();
      const recordId = Number(result.meta.last_row_id);
      await writeAuditEvent({ actor: user, action: "associate_alumni_created", entityType: "associate_alumni", entityId: recordId, after: { name, classification, gender, workStatus, ethnicity, religion, spiritualStatus } });
      return Response.json({ ok: true, message: "Person added successfully." });
    }
    const before = await env.DB.prepare("SELECT * FROM associates_and_alumni WHERE id = ?").bind(id).first();
    if (!before) return Response.json({ error: "Record not found" }, { status: 404 });
    await env.DB.prepare(`UPDATE associates_and_alumni SET name = ?, classification = ?, gender = ?,
      work_status = ?, ethnicity = ?, religion = ?, spiritual_status = ?, notes = ?, active = 1, updated_at = ? WHERE id = ?`)
      .bind(name, classification, gender, workStatus, ethnicity, religion, spiritualStatus, notes, now, id).run();
    await writeAuditEvent({ actor: user, action: "associate_alumni_updated", entityType: "associate_alumni", entityId: id, before, after: { name, classification, gender, workStatus, ethnicity, religion, spiritualStatus } });
    return Response.json({ ok: true, message: "Details updated successfully." });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Unable to save the record" }, { status: 500 });
  }
}
