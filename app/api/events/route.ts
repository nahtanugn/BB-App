import { getCurrentUser, getRuntimeEnv } from "../../../lib/auth";
import { canManageEvents, ensureEventSchema, linkedMember } from "../../../lib/events";
import { createNotifications } from "../../../lib/notifications";

const runtime = getRuntimeEnv();
const sections = ["all", "senior", "junior"];
const audiences = ["section_members", "nco_council"];

function canSeeAudience(user: Awaited<ReturnType<typeof getCurrentUser>>, audience: string) {
  return audience !== "nco_council" || Boolean(user && (canManageEvents(user) || user.role === "viewer" || ["nco", "squad_leader"].includes(user.role)));
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureEventSchema();
    const url = new URL(request.url);
    const calendarEventId = Number(url.searchParams.get("calendar"));
    if (calendarEventId) {
      const event = await runtime.DB.prepare("SELECT id, title, event_date, end_date, location, description, audience FROM company_events WHERE id = ? AND cancelled_at IS NULL").bind(calendarEventId).first<{ id: number; title: string; event_date: string; end_date: string | null; location: string; description: string; audience: string }>();
      if (!event || !canSeeAudience(user, event.audience)) return Response.json({ error: "Event not available" }, { status: 404 });
      const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
      const toUtc = (value: string) => new Date(value).toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
      const start = toUtc(event.event_date);
      const end = event.end_date ? toUtc(event.end_date) : toUtc(new Date(new Date(event.event_date).getTime() + 60 * 60 * 1000).toISOString());
      const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//11KCHBB//Company Events//EN", "BEGIN:VEVENT", `UID:11kchbb-event-${event.id}@11kchbb`, `DTSTAMP:${toUtc(new Date().toISOString())}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escape(event.title)}`, event.location ? `LOCATION:${escape(event.location)}` : "", event.description ? `DESCRIPTION:${escape(event.description)}` : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n") + "\r\n";
      return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="11kchbb-event-${event.id}.ics"`, "Cache-Control": "private, no-store" } });
    }
    const member = await linkedMember(user.email);
    const visibleSections = member ? ["all", member.section] : (canManageEvents(user) || user.role === "viewer" ? sections : ["all"]);
    const placeholders = visibleSections.map(() => "?").join(",");
    const events = await runtime.DB.prepare(`SELECT events.*, recurrence.frequency AS recurrence_frequency, recurrence.interval AS recurrence_interval, recurrence.until_date AS recurrence_until_date, COUNT(rsvps.member_id) AS rsvp_total,
      SUM(CASE WHEN rsvps.status = 'going' THEN 1 ELSE 0 END) AS going_total
      FROM company_events events LEFT JOIN event_rsvps rsvps ON rsvps.event_id = events.id LEFT JOIN event_recurrence recurrence ON recurrence.event_id = events.id
      WHERE events.cancelled_at IS NULL AND events.section IN (${placeholders})
        AND (events.audience != 'nco_council' OR ? = 1)
      GROUP BY events.id ORDER BY events.event_date ASC, events.id ASC`).bind(...visibleSections, canSeeAudience(user, "nco_council") ? 1 : 0).all();
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
      const event = await runtime.DB.prepare("SELECT section, audience FROM company_events WHERE id = ? AND cancelled_at IS NULL").bind(eventId).first<{ section: string; audience: string }>();
      if (!event || !["all", member.section].includes(event.section) || !canSeeAudience(user, event.audience)) return Response.json({ error: "Event not available" }, { status: 404 });
      await runtime.DB.prepare(`INSERT INTO event_rsvps (event_id, member_id, status, note, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id, member_id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`)
        .bind(eventId, member.id, status, String(body.note ?? "").trim().slice(0, 300), now).run();
      return Response.json({ ok: true, message: "Your RSVP has been saved." });
    }
    if (!canManageEvents(user)) return Response.json({ error: "Officer or administrator access required" }, { status: 403 });
    if (action === "create") {
      const title = String(body.title ?? "").trim().slice(0, 120);
      const eventDate = String(body.eventDate ?? "");
      const requestedAudience = String(body.audience ?? "section_members");
      const audience = audiences.includes(requestedAudience) ? requestedAudience : "section_members";
      const section = audience === "nco_council" ? "senior" : String(body.section ?? "all");
      if (!title || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(eventDate) || !sections.includes(section)) return Response.json({ error: "Enter a title, date and valid section" }, { status: 400 });
      let attendanceSessionId: number | null = null;
      if (body.createAttendance !== false) {
        const date = eventDate.slice(0, 10);
        const attendanceSection = section === "all" ? "senior" : section;
        const existing = await runtime.DB.prepare("SELECT id FROM attendance_sessions WHERE meeting_date = ? AND title = ? AND section = ? AND audience = ? LIMIT 1")
          .bind(date, title, attendanceSection, audience).first<{ id: number }>();
        if (existing) attendanceSessionId = existing.id;
        else {
          const session = await runtime.DB.prepare("INSERT INTO attendance_sessions (meeting_date, title, section, audience, created_at) VALUES (?, ?, ?, ?, ?)")
            .bind(date, title, attendanceSection, audience, now).run();
          attendanceSessionId = Number(session.meta.last_row_id);
        }
      }
      const result = await runtime.DB.prepare(`INSERT INTO company_events
        (title, event_date, end_date, location, description, section, audience, attendance_session_id, created_by_user_id, created_by_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(title, eventDate, String(body.endDate ?? "") || null, String(body.location ?? "").trim().slice(0, 160), String(body.description ?? "").trim().slice(0, 2000), section, audience, attendanceSessionId, user.id, user.name, now, now).run();
      const eventId = Number(result.meta.last_row_id);
      const frequency = String(body.recurrenceFrequency ?? "none");
      if (["weekly", "monthly"].includes(frequency)) {
        const interval = Math.min(12, Math.max(1, Number(body.recurrenceInterval) || 1));
        await runtime.DB.prepare("INSERT INTO event_recurrence (event_id, frequency, interval, until_date, created_at) VALUES (?, ?, ?, ?, ?)").bind(eventId, frequency, interval, String(body.recurrenceUntil ?? "") || null, now).run();
      }
      const recipients = await runtime.DB.prepare(`SELECT users.id FROM users JOIN members ON LOWER(members.email) = LOWER(users.email)
        WHERE users.active = 1 AND users.account_status = 'active' AND members.section IN (?, ?)
          AND (? != 'nco_council' OR users.role IN ('nco', 'squad_leader'))`).bind(section === "all" ? "senior" : section, section === "all" ? "junior" : section, audience).all<{ id: number }>();
      await createNotifications({ recipientUserIds: recipients.results.map((row) => row.id), type: "announcement", title: "New company event", body: "A new event has been added to the programme.", targetUrl: "/?open=events", entityKey: `event:${eventId}:created` });
      return Response.json({ ok: true, message: audience === "nco_council" ? "NCO Council meeting created and NCOs notified." : "Event created and attendees notified." });
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
