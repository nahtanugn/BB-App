import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../lib/auth";
import { writeAuditEvent } from "../../../lib/audit";

const allowedRoles = ["admin", "officer", "viewer"];
const editableRoles = ["admin", "officer"];
const classifications = ["associate_member", "instructor", "helper", "alumni"];
const genders = ["M", "F"];
const workStatuses = ["working", "studying"];
const spiritualStatuses = ["", "accepted_christ", "baptised", "non_believer"];

function dateOnly(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return Response.json({ error: "Associate Members and Alumni access required" }, { status: 403 });
  try {
    const [records, members, officers] = await Promise.all([
      env.DB.prepare(`SELECT a.id, a.name, a.classification, a.gender, a.work_status,
        a.ethnicity, a.religion, a.spiritual_status, a.notes, a.active, a.created_at, a.updated_at,
        t.id AS transfer_id, t.source_type, t.source_id, t.effective_date, t.reason AS transfer_reason
        FROM associates_and_alumni a
        LEFT JOIN classification_transfers t ON t.associate_id = a.id AND t.reversed_at IS NULL
        ORDER BY a.active DESC, a.name COLLATE NOCASE`).all(),
      user.role === "admin"
        ? env.DB.prepare(`SELECT id, name, email, section, squad, rank, gender, ethnicity, religion, spiritual_status
            FROM members WHERE section IN ('senior', 'junior') AND is_demo = 0 ORDER BY name COLLATE NOCASE`).all()
        : Promise.resolve({ results: [] }),
      user.role === "admin"
        ? env.DB.prepare(`SELECT id, name, email, role, officer_rank, gender, ethnicity, religion,
            spiritual_status, officer_work_status FROM users
            WHERE active = 1 AND role IN ('admin', 'officer') AND id != ? ORDER BY name COLLATE NOCASE`).bind(user.id).all()
        : Promise.resolve({ results: [] }),
    ]);
    return Response.json({ records: records.results, sources: { members: members.results, officers: officers.results }, canTransfer: user.role === "admin" });
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
    if (["transfer", "reverse_transfer"].includes(action) && user.role !== "admin")
      return Response.json({ error: "Only an Administrator can change a person's classification" }, { status: 403 });
    if (action === "transfer") {
      const sourceType = String(body.sourceType ?? "");
      const sourceId = Number(body.sourceId);
      const classification = String(body.classification ?? "");
      const workStatus = String(body.workStatus ?? "working");
      const effectiveDate = dateOnly(body.effectiveDate);
      const reason = String(body.reason ?? "").trim().slice(0, 500);
      if (!['member', 'officer'].includes(sourceType) || !sourceId)
        return Response.json({ error: "Select a member or officer" }, { status: 400 });
      if (!classifications.includes(classification))
        return Response.json({ error: "Select a valid new classification" }, { status: 400 });
      if (!workStatuses.includes(workStatus))
        return Response.json({ error: "Select Working or Studying" }, { status: 400 });
      if (!effectiveDate) return Response.json({ error: "Select a valid effective date" }, { status: 400 });
      if (!reason) return Response.json({ error: "Give a reason for this transfer" }, { status: 400 });
      const existing = await env.DB.prepare("SELECT id FROM classification_transfers WHERE source_type = ? AND source_id = ? AND reversed_at IS NULL")
        .bind(sourceType, sourceId).first();
      if (existing) return Response.json({ error: "This person already has an active classification transfer" }, { status: 409 });

      const source = sourceType === "member"
        ? await env.DB.prepare(`SELECT id, name, email, section, squad, rank, gender, ethnicity, religion, spiritual_status
            FROM members WHERE id = ? AND section IN ('senior', 'junior') AND is_demo = 0`).bind(sourceId).first<Record<string, unknown>>()
        : await env.DB.prepare(`SELECT id, name, email, role, active, account_status, officer_rank, gender, ethnicity,
            religion, spiritual_status, officer_work_status FROM users
            WHERE id = ? AND active = 1 AND role IN ('admin', 'officer')`).bind(sourceId).first<Record<string, unknown>>();
      if (!source) return Response.json({ error: "The selected active person was not found" }, { status: 404 });
      if (sourceType === "officer" && sourceId === user.id)
        return Response.json({ error: "You cannot transfer your own signed-in Administrator account" }, { status: 409 });

      let linkedUser: Record<string, unknown> | null = null;
      if (sourceType === "member" && source.email) {
        linkedUser = await env.DB.prepare(`SELECT id, role, active, account_status FROM users
          WHERE LOWER(email) = LOWER(?) AND role NOT IN ('admin', 'officer') LIMIT 1`).bind(source.email).first<Record<string, unknown>>() ?? null;
      }
      const now = new Date().toISOString();
      const insert = await env.DB.prepare(`INSERT INTO associates_and_alumni
        (name, classification, gender, work_status, ethnicity, religion, spiritual_status, notes, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .bind(source.name, classification, source.gender || "M", workStatus, source.ethnicity || "Others",
          source.religion || "", source.spiritual_status || "", `Transferred from ${sourceType === "member" ? "Members" : "Officer"} Section. ${reason}`, now, now).run();
      const associateId = Number(insert.meta.last_row_id);
      try {
        const statements = [];
        if (sourceType === "member") {
          statements.push(env.DB.prepare("UPDATE members SET section = 'associate' WHERE id = ? AND section IN ('senior', 'junior')").bind(sourceId));
          if (linkedUser) {
            statements.push(env.DB.prepare("UPDATE users SET active = 0, account_status = 'disabled' WHERE id = ?").bind(linkedUser.id));
            statements.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(linkedUser.id));
          }
        } else {
          statements.push(env.DB.prepare("UPDATE users SET active = 0, account_status = 'disabled' WHERE id = ?").bind(sourceId));
          statements.push(env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(sourceId));
        }
        statements.push(env.DB.prepare(`INSERT INTO classification_transfers
          (source_type, source_id, associate_id, linked_user_id, previous_section, previous_rank, previous_squad,
           previous_user_role, previous_user_active, previous_account_status, target_classification,
           effective_date, reason, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(sourceType, sourceId, associateId, sourceType === "member" ? linkedUser?.id ?? null : sourceId,
            source.section ?? null, source.rank ?? source.officer_rank ?? null, source.squad ?? null,
            sourceType === "member" ? linkedUser?.role ?? null : source.role ?? null,
            sourceType === "member" ? linkedUser?.active ?? null : source.active ?? null,
            sourceType === "member" ? linkedUser?.account_status ?? null : source.account_status ?? null,
            classification, effectiveDate, reason, user.id, now));
        await env.DB.batch(statements);
      } catch (cause) {
        await env.DB.prepare("DELETE FROM associates_and_alumni WHERE id = ?").bind(associateId).run();
        throw cause;
      }
      await writeAuditEvent({ actor: user, action: "classification_transferred", entityType: sourceType, entityId: sourceId,
        before: source, after: { classification, associateId, effectiveDate, reason } });
      return Response.json({ ok: true, message: `${String(source.name)} moved to ${classification.replaceAll("_", " ")}. Existing history was preserved.` });
    }
    if (action === "reverse_transfer") {
      const transferId = Number(body.transferId);
      const reversalReason = String(body.reason ?? "").trim().slice(0, 500);
      if (!transferId || !reversalReason) return Response.json({ error: "Give a reason for restoring this person" }, { status: 400 });
      const transfer = await env.DB.prepare("SELECT * FROM classification_transfers WHERE id = ? AND reversed_at IS NULL").bind(transferId).first<Record<string, unknown>>();
      if (!transfer) return Response.json({ error: "Active transfer not found" }, { status: 404 });
      const now = new Date().toISOString();
      const statements = [
        env.DB.prepare("UPDATE associates_and_alumni SET active = 0, updated_at = ? WHERE id = ?").bind(now, transfer.associate_id),
        env.DB.prepare("UPDATE classification_transfers SET reversed_at = ?, reversed_by = ?, reversal_reason = ? WHERE id = ? AND reversed_at IS NULL").bind(now, user.id, reversalReason, transferId),
      ];
      if (transfer.source_type === "member") {
        statements.push(env.DB.prepare("UPDATE members SET section = ?, rank = ?, squad = ? WHERE id = ? AND section = 'associate'")
          .bind(transfer.previous_section, transfer.previous_rank, transfer.previous_squad, transfer.source_id));
      }
      if (transfer.linked_user_id) {
        statements.push(env.DB.prepare("UPDATE users SET role = COALESCE(?, role), active = COALESCE(?, active), account_status = COALESCE(?, account_status) WHERE id = ?")
          .bind(transfer.previous_user_role, transfer.previous_user_active, transfer.previous_account_status, transfer.linked_user_id));
      }
      await env.DB.batch(statements);
      await writeAuditEvent({ actor: user, action: "classification_transfer_reversed", entityType: String(transfer.source_type), entityId: Number(transfer.source_id),
        before: transfer, after: { restored: true, reversalReason } });
      return Response.json({ ok: true, message: "Original classification restored. The associate record was archived for audit history." });
    }
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
