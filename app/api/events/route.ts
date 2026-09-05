import { getCurrentUser, getRuntimeEnv } from "../../../lib/auth";
import { canManageEvents, ensureEventSchema, linkedMember } from "../../../lib/events";
import { createNotifications } from "../../../lib/notifications";
import { getBranding } from "../../../lib/branding";

const runtime = getRuntimeEnv();
const sections = ["all", "senior", "junior"];
const audiences = ["section_members", "nco_council", "selected_members"];

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
      const event = await runtime.DB.prepare("SELECT id, title, event_date, end_date, location, description, audience, section, selected_member_ids FROM company_events WHERE id = ? AND cancelled_at IS NULL").bind(calendarEventId).first<{ id: number; title: string; event_date: string; end_date: string | null; location: string; description: string; audience: string; section: string; selected_member_ids: string }>();
      if (!event || !canSeeAudience(user, event.audience)) return Response.json({ error: "Event not available" }, { status: 404 });
      const calendarMember = await linkedMember(user.email);
      if (!canManageEvents(user) && user.role !== "viewer" && (!calendarMember || !["all", calendarMember.section].includes(event.section) || (event.audience === "selected_members" && !JSON.parse(event.selected_member_ids).includes(calendarMember.id)))) return Response.json({ error: "Event not available" }, { status: 404 });
      const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
      const toUtc = (value: string) => new Date(value).toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
      const start = toUtc(event.event_date);
      const end = event.end_date ? toUtc(event.end_date) : toUtc(new Date(new Date(event.event_date).getTime() + 60 * 60 * 1000).toISOString());
      const branding = await getBranding();
      const calendarSlug = branding.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bb-company-app";
      const body = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${escape(branding.appName)}//Company Events//EN`, "BEGIN:VEVENT", `UID:${calendarSlug}-event-${event.id}@company-app`, `DTSTAMP:${toUtc(new Date().toISOString())}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escape(event.title)}`, event.location ? `LOCATION:${escape(event.location)}` : "", event.description ? `DESCRIPTION:${escape(event.description)}` : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n") + "\r\n";
      return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${calendarSlug}-event-${event.id}.ics"`, "Cache-Control": "private, no-store" } });
    }
    const member = await linkedMember(user.email);
    const visibleSections = canManageEvents(user) ? sections : member ? ["all", member.section] : (canManageEvents(user) || user.role === "viewer" ? sections : ["all"]);
    const placeholders = visibleSections.map(() => "?").join(",");
    const events = await runtime.DB.prepare(`SELECT events.*, recurrence.frequency AS recurrence_frequency, recurrence.interval AS recurrence_interval, recurrence.until_date AS recurrence_until_date, COUNT(rsvps.member_id) AS rsvp_total,
      SUM(CASE WHEN rsvps.status = 'going' THEN 1 ELSE 0 END) AS going_total
      FROM company_events events LEFT JOIN event_rsvps rsvps ON rsvps.event_id = events.id LEFT JOIN event_recurrence recurrence ON recurrence.event_id = events.id
      WHERE events.cancelled_at IS NULL AND events.section IN (${placeholders})
        AND (events.audience != 'nco_council' OR ? = 1)
      AND (events.audience != 'selected_members' OR ? = 1 OR EXISTS (SELECT 1 FROM json_each(events.selected_member_ids) WHERE value = ?))
      GROUP BY events.id ORDER BY events.event_date ASC, events.id ASC`).bind(...visibleSections, canSeeAudience(user, "nco_council") ? 1 : 0, canManageEvents(user) || user.role === "viewer" ? 1 : 0, member?.id ?? -1).all();
    const rsvps = member ? await runtime.DB.prepare("SELECT event_id, status, note FROM event_rsvps WHERE member_id = ?")
      .bind(member.id).all() : { results: [] };
    const members = canManageEvents(user) ? await runtime.DB.prepare("SELECT id,name,section FROM members WHERE section IN ('senior','junior') ORDER BY section,name").all() : {results: []};
    return Response.json({ members: members.results, events: events.results, rsvps: rsvps.results, member, canManage: canManageEvents(user), readOnly: user.role === "viewer" });
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
      const event = await runtime.DB.prepare("SELECT section, audience, selected_member_ids FROM company_events WHERE id = ? AND cancelled_at IS NULL").bind(eventId).first<{ section: string; audience: string; selected_member_ids: string }>();
      if (!event || !["all", member.section].includes(event.section) || (event.audience === "selected_members" && !JSON.parse(event.selected_member_ids).includes(member.id)) || !canSeeAudience(user, event.audience)) return Response.json({ error: "Event not available" }, { status: 404 });
      await runtime.DB.prepare(`INSERT INTO event_rsvps (event_id, member_id, status, note, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id, member_id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`)
        .bind(eventId, member.id, status, String(body.note ?? "").trim().slice(0, 300), now).run();
      return Response.json({ ok: true, message: "Your RSVP has been saved." });
    }
    if (!canManageEvents(user)) return Response.json({ error: "Officer or administrator access required" }, { status: 403 });
    let selectedIds: number[] = [];
    if (["create", "update"].includes(action) && body.audience === "selected_members") {
      selectedIds = [...new Set((Array.isArray(body.memberIds) ? body.memberIds : []).map(Number))];
      const valid = await runtime.DB.prepare("SELECT id FROM members WHERE section IN ('senior','junior')").all<{id:number}>();
      if (!selectedIds.length || selectedIds.some(id => !valid.results.some(m => m.id === id))) return Response.json({error:"Choose at least one valid member."},{status:400});
    }
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
        const attendanceSection = section;
        const existing = await runtime.DB.prepare("SELECT id FROM attendance_sessions WHERE meeting_date = ? AND title = ? AND section = ? AND audience = ? LIMIT 1")
          .bind(date, title, attendanceSection, audience).first<{ id: number }>();
        if (existing && audience !== "selected_members") attendanceSessionId = existing.id;
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
      await runtime.DB.prepare("UPDATE company_events SET selected_member_ids=? WHERE id=?").bind(JSON.stringify(selectedIds),eventId).run();
      if (attendanceSessionId) await runtime.DB.prepare("UPDATE attendance_sessions SET selected_member_ids=? WHERE id=?").bind(JSON.stringify(selectedIds),attendanceSessionId).run();
      const frequency = String(body.recurrenceFrequency ?? "none");
      if (["weekly", "monthly"].includes(frequency)) {
        const interval = Math.min(12, Math.max(1, Number(body.recurrenceInterval) || 1));
        await runtime.DB.prepare("INSERT INTO event_recurrence (event_id, frequency, interval, until_date, created_at) VALUES (?, ?, ?, ?, ?)").bind(eventId, frequency, interval, String(body.recurrenceUntil ?? "") || null, now).run();
      }
      const recipients = await runtime.DB.prepare(`SELECT users.id FROM users JOIN members ON LOWER(members.email) = LOWER(users.email)
        WHERE users.active = 1 AND users.account_status = 'active' AND members.section IN (?, ?)
          AND (? != 'nco_council' OR users.role IN ('nco', 'squad_leader')) AND (? != 'selected_members' OR members.id IN (SELECT value FROM json_each(?)))`).bind(section === "all" ? "senior" : section, section === "all" ? "junior" : section, audience, audience, JSON.stringify(selectedIds)).all<{ id: number }>();
      await createNotifications({ recipientUserIds: recipients.results.map((row) => row.id), type: "announcement", title: "New company event", body: "A new event has been added to the programme.", targetUrl: "/?open=events", entityKey: `event:${eventId}:created` });
      return Response.json({ ok: true, message: audience === "nco_council" ? "NCO Council meeting created and NCOs notified." : "Event created and attendees notified." });
    }
    if (action === "update") {
      const eventId = Number(body.eventId);
      const existing = await runtime.DB.prepare("SELECT attendance_session_id FROM company_events WHERE id = ? AND cancelled_at IS NULL").bind(eventId).first<{ attendance_session_id: number | null }>();
      if (!existing) return Response.json({ error: "Event not found" }, { status: 404 });
      const audience = String(body.audience ?? "section_members");
      const section = audience === "nco_council" ? "senior" : String(body.section ?? "all");
      if (!audiences.includes(audience) || !sections.includes(section)) return Response.json({error:"Choose valid attendees."},{status:400});
      const title = String(body.title ?? "").trim();
      const date = String(body.eventDate ?? "");
      const end = String(body.endDate ?? "");
      if (!title || title.length > 120 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || (end && (!Number.isFinite(Date.parse(end)) || end < date))) return Response.json({ error: "Enter a valid title and date; the end must follow the start." }, { status: 400 });
      const statements = [runtime.DB.prepare("UPDATE company_events SET section=?,audience=?,selected_member_ids=? WHERE id=?").bind(section,audience,JSON.stringify(selectedIds),eventId),runtime.DB.prepare("UPDATE company_events SET title=?,event_date=?,end_date=?,location=?,description=?,updated_at=? WHERE id=? AND cancelled_at IS NULL").bind(title,date,end || null,String(body.location ?? "").trim().slice(0,160),String(body.description ?? "").trim().slice(0,2000),now,eventId)];
      if (existing.attendance_session_id) {
        const shared = await runtime.DB.prepare("SELECT id FROM company_events WHERE attendance_session_id=? AND id!=? AND cancelled_at IS NULL LIMIT 1").bind(existing.attendance_session_id,eventId).first();
        if (shared) return Response.json({ error: "This attendance register is shared with another event. Edit the register separately before changing this event." }, { status: 409 });
        statements.push(runtime.DB.prepare("UPDATE attendance_sessions SET title=?,meeting_date=?,section=?,audience=?,selected_member_ids=? WHERE id=?").bind(title,date.slice(0,10),section,audience,JSON.stringify(selectedIds),existing.attendance_session_id));
      }
      await runtime.DB.batch(statements);
      return Response.json({ ok: true, message: "Event updated. Linked attendance records have been kept." });
    }
    if (action === "cancel" || action === "delete") {
      const eventId = Number(body.eventId);
      if (!eventId) return Response.json({ error: "Invalid event" }, { status: 400 });
      await runtime.DB.prepare("UPDATE company_events SET cancelled_at = ?, updated_at = ? WHERE id = ? AND cancelled_at IS NULL").bind(now, now, eventId).run();
      return Response.json({ ok: true, message: "Event deleted from the programme. Existing attendance records have been kept." });
    }
    return Response.json({ error: "Unknown event action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update events" }, { status: 500 });
  }
}
