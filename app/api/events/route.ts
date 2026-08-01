import { getCurrentUser, getRuntimeEnv } from "../../../lib/auth";
import { canManageEvents, ensureEventSchema, linkedMember } from "../../../lib/events";
import { createNotifications } from "../../../lib/notifications";

const runtime = getRuntimeEnv();
const sections = ["all", "senior", "junior"];

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureEventSchema();
    const member = await linkedMember(user.email);
    const visibleSections = member ? ["all", member.section] : (canManageEvents(user) || user.role === "viewer" ? sections : ["all"]);
    const placeholders = visibleSections.map(() => "?").join(",");
    const events = await runtime.DB.prepare(`SELECT events.*, COUNT(rsvps.member_id) AS rsvp_total,
      SUM(CASE WHEN rsvps.status = 'going' THEN 1 ELSE 0 END) AS going_total
      FROM company_events events LEFT JOIN event_rsvps rsvps ON rsvps.event_id = events.id
      WHERE events.cancelled_at IS NULL AND events.section IN (${placeholders})
      GROUP BY events.id ORDER BY events.event_date ASC, events.id ASC`).bind(...visibleSections).all();
    const rsvps = member ? await runtime.DB.prepare("SELECT event_id, status, note FROM event_rsvps WHERE member_id = ?")
      .bind(member.id).all() : { results: [] };
    return Response.json({ events: events.results, rsvps: rsvps.results, member, canManage: canManageEvents(user), readOnly: user.role === "viewer" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureEventSchema();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date().toISOString();
    if (action === "rsvp") {
      if (user.role === "viewer") return Response.json({ error: "Viewer accounts are read-only" }, { status: 403 });
      const member = await linkedMember(user.email);
      const eventId = Number(body.eventId);
      const status = String(body.status ?? "");
      if (!member || !eventId || !["going", "maybe", "not_going"].includes(status)) return Response.json({ error: "Choose a valid RSVP response" }, { status: 400 });
      const event = await runtime.DB.prepare("SELECT section FROM company_events WHERE id = ? AND cancelled_at IS NULL").bind(eventId).first<{ section: string }>();
      if (!event || !["all", member.section].includes(event.section)) return Response.json({ error: "Event not available" }, { status: 404 });
      await runtime.DB.prepare(`INSERT INTO event_rsvps (event_id, member_id, status, note, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id, member_id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`)
        .bind(eventId, member.id, status, String(body.note ?? "").trim().slice(0, 300), now).run();
      return Response.json({ ok: true, message: "Your RSVP has been saved." });
    }
    if (!canManageEvents(user)) return Response.json({ error: "Officer or administrator access required" }, { status: 403 });
    if (action === "create") {
      const title = String(body.title ?? "").trim().slice(0, 120);
      const eventDate = String(body.eventDate ?? "");
      const section = String(body.section ?? "all");
      if (!title || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(eventDate) || !sections.includes(section)) return Response.json({ error: "Enter a title, date and valid section" }, { status: 400 });
      let attendanceSessionId: number | null = null;
      if (body.createAttendance !== false) {
        const date = eventDate.slice(0, 10);
        const attendanceSection = section === "all" ? "senior" : section;
        const existing = await runtime.DB.prepare("SELECT id FROM attendance_sessions WHERE meeting_date = ? AND title = ? AND section = ? LIMIT 1")
          .bind(date, title, attendanceSection).first<{ id: number }>();
        if (existing) attendanceSessionId = existing.id;
        else {
          const session = await runtime.DB.prepare("INSERT INTO attendance_sessions (meeting_date, title, section, created_at) VALUES (?, ?, ?, ?)")
            .bind(date, title, attendanceSection, now).run();
          attendanceSessionId = Number(session.meta.last_row_id);
        }
      }
      const result = await runtime.DB.prepare(`INSERT INTO company_events
        (title, event_date, end_date, location, description, section, attendance_session_id, created_by_user_id, created_by_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(title, eventDate, String(body.endDate ?? "") || null, String(body.location ?? "").trim().slice(0, 160), String(body.description ?? "").trim().slice(0, 2000), section, attendanceSessionId, user.id, user.name, now, now).run();
      const eventId = Number(result.meta.last_row_id);
      const recipients = await runtime.DB.prepare(`SELECT users.id FROM users JOIN members ON LOWER(members.email) = LOWER(users.email)
        WHERE users.active = 1 AND users.account_status = 'active' AND members.section IN (?, ?)`).bind(section === "all" ? "senior" : section, section === "all" ? "junior" : section).all<{ id: number }>();
      await createNotifications({ recipientUserIds: recipients.results.map((row) => row.id), type: "announcement", title: "New company event", body: "A new event has been added to the programme.", targetUrl: "/?open=events", entityKey: `event:${eventId}:created` });
      return Response.json({ ok: true, message: "Event created and attendees notified." });
    }
    if (action === "cancel") {
      const eventId = Number(body.eventId);
      if (!eventId) return Response.json({ error: "Invalid event" }, { status: 400 });
      await runtime.DB.prepare("UPDATE company_events SET cancelled_at = ?, updated_at = ? WHERE id = ? AND cancelled_at IS NULL").bind(now, now, eventId).run();
      return Response.json({ ok: true, message: "Event archived." });
    }
    return Response.json({ error: "Unknown event action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update events" }, { status: 500 });
  }
}
