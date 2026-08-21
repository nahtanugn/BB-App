import { env } from "cloudflare:workers";
import { getCurrentUser, hasOperationalAdminAccess } from "../../../lib/auth";
import { linkedMember } from "../../../lib/events";
import { writeAuditEvent } from "../../../lib/audit";

const runtime = env as typeof env & { DB: D1Database };

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureExpansionTables() {
  await runtime.DB.batch([
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_sync_conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
      incoming_status TEXT NOT NULL, existing_status TEXT NOT NULL, incoming_updated_at TEXT NOT NULL,
      existing_updated_at TEXT NOT NULL, submitted_by_user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by_user_id INTEGER, reviewed_at TEXT, created_at TEXT NOT NULL)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS training_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, training_type TEXT NOT NULL,
      title TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL DEFAULT 'completed', notes TEXT NOT NULL DEFAULT '',
      created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS member_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, from_section TEXT, to_section TEXT,
      from_squad TEXT, to_squad TEXT, from_rank TEXT, to_rank TEXT, reason TEXT NOT NULL DEFAULT '',
      changed_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, award_code TEXT NOT NULL, level TEXT NOT NULL,
      certificate_number TEXT NOT NULL UNIQUE, issued_at TEXT NOT NULL, issued_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS equipment_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, item_id INTEGER NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
      issued_at TEXT NOT NULL, returned_at TEXT, issued_by_user_id INTEGER NOT NULL, returned_by_user_id INTEGER, notes TEXT NOT NULL DEFAULT '')`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS message_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL, sender_user_id INTEGER NOT NULL,
      recipient_user_id INTEGER NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS import_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL DEFAULT 'preview', file_name TEXT NOT NULL,
      summary_json TEXT NOT NULL DEFAULT '{}', created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, completed_at TEXT)`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS public_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT, content_type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0, updated_by_user_id INTEGER NOT NULL, updated_at TEXT NOT NULL)`),
  ]);
}

function isStaff(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return hasOperationalAdminAccess(user) || Boolean(user && user.role === "viewer");
}

function isSquadMemberAllowed(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, member: { section: string; squad: string }) {
  if (!["nco", "squad_leader"].includes(user.role)) return true;
  return member.section === user.member_section && member.squad === user.squad;
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureExpansionTables();
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "conflicts";
  if (kind === "conflicts") {
    if (!isStaff(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
    const rows = await runtime.DB.prepare("SELECT * FROM attendance_sync_conflicts WHERE status = 'pending' ORDER BY created_at DESC LIMIT 250").all();
    return Response.json({ conflicts: rows.results });
  }
  const memberId = Number(url.searchParams.get("memberId"));
  if (!memberId) return Response.json({ error: "Select a member" }, { status: 400 });
  const member = await runtime.DB.prepare("SELECT id, section, squad FROM members WHERE id = ?").bind(memberId).first<{ id: number; section: string; squad: string }>();
  if (!member || !isSquadMemberAllowed(user, member)) return Response.json({ error: "Member not available" }, { status: 404 });
  if (kind === "training") {
    const rows = await runtime.DB.prepare("SELECT * FROM training_records WHERE member_id = ? ORDER BY COALESCE(completed_at, created_at) DESC").bind(memberId).all();
    return Response.json({ records: rows.results });
  }
  if (kind === "transfers") {
    const rows = await runtime.DB.prepare("SELECT * FROM member_transfers WHERE member_id = ? ORDER BY created_at DESC").bind(memberId).all();
    return Response.json({ records: rows.results });
  }
  if (kind === "certificates") {
    const rows = await runtime.DB.prepare("SELECT * FROM certificates WHERE member_id = ? ORDER BY issued_at DESC").bind(memberId).all();
    return Response.json({ certificates: rows.results });
  }
  if (kind === "equipment") {
    const rows = await runtime.DB.prepare(`SELECT h.*, i.name AS item_name, i.variant, i.stock_type
      FROM equipment_holdings h LEFT JOIN stock_items i ON i.id = h.item_id WHERE h.member_id = ? ORDER BY h.issued_at DESC`).bind(memberId).all();
    return Response.json({ holdings: rows.results });
  }
  if (kind === "analytics") {
    if (!isStaff(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
    const [attendance, awards, subscriptions, stock] = await Promise.all([
      runtime.DB.prepare(`SELECT s.section, COUNT(*) AS registers,
        SUM(CASE WHEN r.status = 'present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN r.status IN ('absent', 'excused') THEN 1 ELSE 0 END) AS recorded
        FROM attendance_sessions s LEFT JOIN attendance_records r ON r.session_id = s.id
        WHERE s.meeting_date <= date('now') GROUP BY s.section`).all(),
      runtime.DB.prepare("SELECT m.section, ma.status, COUNT(*) AS total FROM member_awards ma JOIN members m ON m.id = ma.member_id GROUP BY m.section, ma.status").all(),
      runtime.DB.prepare("SELECT m.section, ms.paid, COUNT(*) AS total FROM member_subscriptions ms JOIN members m ON m.id = ms.member_id GROUP BY m.section, ms.paid").all(),
      runtime.DB.prepare(`SELECT stock_type, COUNT(*) AS items, SUM(CASE WHEN condition != 'defective' AND quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock FROM (SELECT i.stock_type, i.condition, i.reorder_level, COALESCE(SUM(t.quantity_delta), 0) AS quantity FROM stock_items i LEFT JOIN stock_transactions t ON t.item_id = i.id WHERE i.active = 1 GROUP BY i.id) GROUP BY stock_type`).all(),
    ]);
    return Response.json({ attendance: attendance.results, awards: awards.results, subscriptions: subscriptions.results, stock: stock.results });
  }
  if (kind === "messages") {
    const rows = await runtime.DB.prepare(`SELECT m.*, t.subject FROM messages m JOIN message_threads t ON t.id = m.thread_id
      WHERE m.recipient_user_id = ? OR m.sender_user_id = ? ORDER BY m.created_at DESC LIMIT 200`).bind(user.id, user.id).all();
    return Response.json({ messages: rows.results });
  }
  return Response.json({ error: "Unknown feature collection" }, { status: 400 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureExpansionTables();
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  const now = new Date().toISOString();

  if (action === "create_qr") {
    if (!hasOperationalAdminAccess(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
    const sessionId = Number(body.sessionId);
    const session = await runtime.DB.prepare("SELECT id FROM attendance_sessions WHERE id = ?").bind(sessionId).first();
    if (!sessionId || !session) return Response.json({ error: "Attendance meeting not found" }, { status: 404 });
    const rawToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await runtime.DB.prepare("INSERT INTO attendance_qr_codes (session_id, token_hash, expires_at, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(sessionId, await digest(rawToken), expiresAt, user.id, now).run();
    await writeAuditEvent({ actor: user, action: "attendance_qr_created", entityType: "attendance_session", entityId: sessionId, after: { expiresAt } });
    return Response.json({ ok: true, token: rawToken, expiresAt });
  }

  if (action === "check_in") {
    const token = String(body.token ?? "");
    const member = await linkedMember(user.email);
    if (!token || !member) return Response.json({ error: "Link this account to a member profile first" }, { status: 409 });
    const qr = await runtime.DB.prepare(`SELECT q.session_id, s.section, s.audience FROM attendance_qr_codes q JOIN attendance_sessions s ON s.id = q.session_id WHERE q.token_hash = ? AND q.expires_at > ?`).bind(await digest(token), now).first<{ session_id: number; section: string; audience: string }>();
    if (!qr || !["all", member.section].includes(qr.section) || (qr.audience === "nco_council" && !["nco", "squad_leader", "officer", "admin"].includes(user.role))) return Response.json({ error: "This attendance code is invalid or expired" }, { status: 403 });
    await runtime.DB.prepare(`INSERT INTO attendance_records (session_id, member_id, status, updated_at, updated_by) VALUES (?, ?, 'present', ?, ?)
      ON CONFLICT(session_id, member_id) DO UPDATE SET status = 'present', updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(qr.session_id, member.id, now, user.email).run();
    return Response.json({ ok: true, message: "Attendance checked in successfully." });
  }

  if (action === "sync_attendance") {
    if (!hasOperationalAdminAccess(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
    const changes = Array.isArray(body.changes) ? body.changes as Array<Record<string, unknown>> : [];
    let applied = 0; let conflicts = 0;
    for (const change of changes.slice(0, 500)) {
      const sessionId = Number(change.sessionId); const memberId = Number(change.memberId); const status = String(change.status ?? "unmarked"); const incomingAt = String(change.updatedAt ?? now);
      if (!sessionId || !memberId || !["present", "absent", "excused", "unmarked"].includes(status)) continue;
      const existing = await runtime.DB.prepare("SELECT status, updated_at FROM attendance_records WHERE session_id = ? AND member_id = ?").bind(sessionId, memberId).first<{ status: string; updated_at: string }>();
      if (existing && existing.updated_at > incomingAt) {
        await runtime.DB.prepare(`INSERT INTO attendance_sync_conflicts (session_id, member_id, incoming_status, existing_status, incoming_updated_at, existing_updated_at, submitted_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(sessionId, memberId, status, existing.status, incomingAt, existing.updated_at, user.id, now).run(); conflicts++; continue;
      }
      await runtime.DB.prepare(`INSERT INTO attendance_records (session_id, member_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id, member_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(sessionId, memberId, status, incomingAt, user.email).run(); applied++;
    }
    return Response.json({ ok: true, applied, conflicts, message: conflicts ? "Synced with conflicts requiring review." : "Attendance synced successfully." });
  }

  if (action === "review_conflict") {
    if (!hasOperationalAdminAccess(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
    const conflictId = Number(body.conflictId); const resolution = String(body.resolution ?? "");
    const conflict = await runtime.DB.prepare("SELECT * FROM attendance_sync_conflicts WHERE id = ? AND status = 'pending'").bind(conflictId).first<{ id: number; session_id: number; member_id: number; incoming_status: string; incoming_updated_at: string }>();
    if (!conflict || !["apply", "reject"].includes(resolution)) return Response.json({ error: "Conflict not found" }, { status: 404 });
    if (resolution === "apply") await runtime.DB.prepare(`INSERT INTO attendance_records (session_id, member_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id, member_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(conflict.session_id, conflict.member_id, conflict.incoming_status, conflict.incoming_updated_at, user.email).run();
    await runtime.DB.prepare("UPDATE attendance_sync_conflicts SET status = ?, reviewed_by_user_id = ?, reviewed_at = ? WHERE id = ?").bind(resolution === "apply" ? "applied" : "rejected", user.id, now, conflictId).run();
    return Response.json({ ok: true, message: resolution === "apply" ? "Conflict applied." : "Conflict rejected." });
  }

  if (action === "send_message") {
    if (!user || user.role === "viewer" || user.role === "member") return Response.json({ error: "This account cannot send staff messages" }, { status: 403 });
    const recipientUserId = Number(body.recipientUserId); const message = String(body.message ?? "").trim().slice(0, 4000); const subject = String(body.subject ?? "").trim().slice(0, 160) || "11KCHBB message";
    if (!recipientUserId || !message) return Response.json({ error: "Choose a recipient and enter a message" }, { status: 400 });
    const recipient = await runtime.DB.prepare("SELECT id, role FROM users WHERE id = ? AND active = 1 AND account_status = 'active'").bind(recipientUserId).first<{ id: number; role: string }>();
    if (!recipient || recipient.role === "viewer") return Response.json({ error: "Recipient is not available" }, { status: 404 });
    const thread = await runtime.DB.prepare("INSERT INTO message_threads (subject, created_by_user_id, created_at) VALUES (?, ?, ?)").bind(subject, user.id, now).run();
    await runtime.DB.prepare("INSERT INTO messages (thread_id, sender_user_id, recipient_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(Number(thread.meta.last_row_id), user.id, recipientUserId, message, now).run();
    await writeAuditEvent({ actor: user, action: "message_sent", entityType: "message_thread", entityId: Number(thread.meta.last_row_id) });
    return Response.json({ ok: true, message: "Message sent." });
  }

  if (action === "mark_message_read") {
    const messageId = Number(body.messageId);
    await runtime.DB.prepare("UPDATE messages SET read_at = ? WHERE id = ? AND recipient_user_id = ?").bind(now, messageId, user.id).run();
    return Response.json({ ok: true });
  }

  if (action === "preview_import") {
    if (!hasOperationalAdminAccess(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
    const fileName = String(body.fileName ?? "import.csv").slice(0, 180); const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
    const seenEmails = new Set<string>(); const errors: Array<{ row: number; message: string }> = []; const preview = rows.slice(0, 1000);
    const existing = await runtime.DB.prepare("SELECT lower(email) AS email FROM members WHERE email != ''").all<{ email: string }>();
    const existingEmails = new Set(existing.results.map((row) => row.email));
    preview.forEach((row, index) => { const email = String(row.email ?? "").trim().toLowerCase(); const name = String(row.name ?? "").trim(); if (!name) errors.push({ row: index + 1, message: "Name is required" }); if (email && (seenEmails.has(email) || existingEmails.has(email))) errors.push({ row: index + 1, message: "Duplicate email" }); if (email) seenEmails.add(email); });
    const summary = { rows: preview.length, errors: errors.length, duplicateEmails: errors.filter((error) => error.message === "Duplicate email").length };
    const job = await runtime.DB.prepare("INSERT INTO import_jobs (status, file_name, summary_json, created_by_user_id, created_at) VALUES ('preview', ?, ?, ?, ?)").bind(fileName, JSON.stringify({ ...summary, errors }), user.id, now).run();
    return Response.json({ ok: true, jobId: Number(job.meta.last_row_id), summary, errors });
  }

  if (!["add_training", "add_transfer", "issue_equipment", "return_equipment", "issue_certificate"].includes(action)) return Response.json({ error: "Unknown feature action" }, { status: 400 });
  if (!hasOperationalAdminAccess(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
  const memberId = Number(body.memberId);
  const member = await runtime.DB.prepare("SELECT id, section, squad FROM members WHERE id = ?").bind(memberId).first<{ id: number; section: string; squad: string }>();
  if (!member || !isSquadMemberAllowed(user, member)) return Response.json({ error: "Member not available" }, { status: 404 });
  if (action === "add_training") {
    const title = String(body.title ?? "").trim(); if (!title) return Response.json({ error: "Training title is required" }, { status: 400 });
    await runtime.DB.prepare("INSERT INTO training_records (member_id, training_type, title, completed_at, status, notes, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(memberId, String(body.trainingType ?? "general"), title, String(body.completedAt ?? "") || null, String(body.status ?? "completed"), String(body.notes ?? "").trim(), user.id, now).run();
    return Response.json({ ok: true, message: "Training record saved." });
  }
  if (action === "add_transfer") {
    await runtime.DB.prepare("INSERT INTO member_transfers (member_id, from_section, to_section, from_squad, to_squad, from_rank, to_rank, reason, changed_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(memberId, body.fromSection ?? null, body.toSection ?? null, body.fromSquad ?? null, body.toSquad ?? null, body.fromRank ?? null, body.toRank ?? null, String(body.reason ?? "").trim(), user.id, now).run();
    return Response.json({ ok: true, message: "Transfer history saved." });
  }
  if (action === "issue_certificate") {
    const awardCode = String(body.awardCode ?? "").trim(); const level = String(body.level ?? "").trim();
    const awarded = await runtime.DB.prepare("SELECT status FROM member_awards WHERE member_id = ? AND award_code = ? AND level = ?").bind(memberId, awardCode, level).first<{ status: string }>();
    if (!awarded || !["awarded", "verified"].includes(awarded.status)) return Response.json({ error: "Only verified or awarded records can receive a certificate" }, { status: 409 });
    const certificateNumber = `11KCHBB-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await runtime.DB.prepare("INSERT INTO certificates (member_id, award_code, level, certificate_number, issued_at, issued_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(memberId, awardCode, level, certificateNumber, now, user.id, now).run();
    return Response.json({ ok: true, certificateNumber, message: "Certificate record created." });
  }
  return Response.json({ error: "Equipment workflows remain linked to Stock Centre permissions" }, { status: 400 });
}
