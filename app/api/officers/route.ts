import { writeAuditEvent } from "../../../lib/audit";
import { ensureAuthSchema, getCurrentUser, getRuntimeEnv } from "../../../lib/auth";

const runtime = getRuntimeEnv();
const officerRanks = ["Staff Sergeant", "Warrant Officer", "Lieutenant", "Captain", "Honorary Captain", "Chaplain"];
const genders = ["M", "F"];
const spiritualStatuses = ["", "accepted_christ", "baptised", "non_believer"];
const workStatuses = ["working", "studying"];

async function ensureContactNumber() {
  try { await runtime.DB.prepare("ALTER TABLE users ADD COLUMN contact_number TEXT NOT NULL DEFAULT ''").run(); } catch { /* migration already applied */ }
}

export async function GET(request: Request) {
  try {
    await ensureAuthSchema();
    await ensureContactNumber();
    const user = await getCurrentUser(request);
    if (!user || !["admin", "officer", "viewer"].includes(user.role))
      return Response.json({ error: "Officer Section access required" }, { status: 403 });

    const officers = await runtime.DB.prepare(
      `SELECT id, name, email, role, active,
        COALESCE(officer_rank, '') AS officer_rank,
        COALESCE(gender, '') AS gender,
        COALESCE(ethnicity, '') AS ethnicity,
        COALESCE(religion, '') AS religion,
        COALESCE(spiritual_status, '') AS spiritual_status,
        COALESCE(officer_work_status, '') AS officer_work_status
        ,COALESCE(contact_number, '') AS contact_number
      FROM users
      WHERE active = 1 AND role IN ('admin', 'officer')
      ORDER BY name COLLATE NOCASE`,
    ).all();

    return Response.json({ officers: officers.results, readOnly: user.role === "viewer" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load Officer Section" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureAuthSchema();
    await ensureContactNumber();
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (!["admin", "officer"].includes(user.role))
      return Response.json({ error: "Administrator or Officer access required" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    if (body.action !== "update_officer")
      return Response.json({ error: "Unsupported Officer Section action" }, { status: 400 });

    const officerId = Number(body.officerId);
    const officerRank = String(body.officerRank ?? "").trim();
    const gender = String(body.gender ?? "").trim().toUpperCase();
    const ethnicity = String(body.ethnicity ?? "").trim().slice(0, 60);
    const religion = String(body.religion ?? "").trim().slice(0, 60);
    const spiritualStatus = String(body.spiritualStatus ?? "").trim();
    const officerWorkStatus = String(body.officerWorkStatus ?? "").trim();
    const contactNumber = String(body.contactNumber ?? "").trim().slice(0, 30);

    if (!officerId) return Response.json({ error: "Select an officer" }, { status: 400 });
    if (!officerRanks.includes(officerRank))
      return Response.json({ error: "Select a valid Officer Section rank" }, { status: 400 });
    if (!genders.includes(gender))
      return Response.json({ error: "Select Male or Female" }, { status: 400 });
    if (!ethnicity) return Response.json({ error: "Select the officer's ethnicity" }, { status: 400 });
    if (!spiritualStatuses.includes(spiritualStatus))
      return Response.json({ error: "Select a valid spiritual status" }, { status: 400 });
    if (!workStatuses.includes(officerWorkStatus))
      return Response.json({ error: "Select Working or Studying" }, { status: 400 });

    const before = await runtime.DB.prepare(
      `SELECT id, name, email, role, active, officer_rank, gender, ethnicity, religion,
        spiritual_status, officer_work_status
      FROM users WHERE id = ? AND active = 1 AND role IN ('admin', 'officer')`,
    ).bind(officerId).first<Record<string, unknown>>();
    if (!before) return Response.json({ error: "Officer account not found" }, { status: 404 });

    await runtime.DB.prepare(
      `UPDATE users SET officer_rank = ?, gender = ?, ethnicity = ?, religion = ?,
        spiritual_status = ?, officer_work_status = ?, contact_number = ?
      WHERE id = ? AND active = 1 AND role IN ('admin', 'officer')`,
    ).bind(officerRank, gender, ethnicity, religion, spiritualStatus, officerWorkStatus, contactNumber, officerId).run();

    const after = { officerRank, gender, ethnicity, religion, spiritualStatus, officerWorkStatus, contactNumber };
    await writeAuditEvent({ actor: user, action: "officer_profile_updated", entityType: "officer_profile", entityId: officerId, before, after });
    return Response.json({ ok: true, message: "Officer details updated and linked to Company Statistics." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update officer details" }, { status: 500 });
  }
}
