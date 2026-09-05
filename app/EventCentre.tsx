"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type EventItem = { id: number; title: string; event_date: string; end_date: string | null; location: string; description: string; section: string; audience: string; attendance_session_id: number | null; selected_member_ids: string; rsvp_total: number; going_total: number };
type Rsvp = { event_id: number; status: string; note: string };

export default function EventCentre() {
  const [members,setMembers] = useState<{id:number;name:string;section:string}[]>([]);
  const [mode,setMode] = useState("senior");
  const [selected,setSelected] = useState<number[]>([]);
  const [search,setSearch] = useState("");
  const attendees = () => ({section: mode === "senior" || mode === "junior" ? mode : mode === "nco_council" ? "senior" : "all", audience: mode === "selected_members" || mode === "nco_council" ? mode : "section_members", memberIds:selected});
  const [editing, setEditing] = useState<EventItem | null>(null);
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy("edit");
    try { await post({ action: "update", eventId: editing?.id, ...Object.fromEntries(data), ...attendees() }); setEditing(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update event"); }
    finally { setBusy(null); }
  }
  async function deleteEvent(item: EventItem) {
    if (!window.confirm(`Delete “${item.title}” from the programme? Existing attendance records will be kept.`)) return;
    setBusy(item.id);
    try { await post({ action: "delete", eventId: item.id }); if (editing?.id === item.id) setEditing(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete event"); }
    finally { setBusy(null); }
  }
  const [events, setEvents] = useState<EventItem[]>([]); const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [canManage, setCanManage] = useState(false); const [readOnly, setReadOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false); const [busy, setBusy] = useState<number | string | null>(null); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/events", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Unable to load events"); setEvents(result.events ?? []); setMembers(result.members ?? []); setRsvps(result.rsvps ?? []); setCanManage(Boolean(result.canManage)); setReadOnly(Boolean(result.readOnly)); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load events")); }, 0); return () => window.clearTimeout(timer); }, [load]);
  async function post(body: Record<string, unknown>) { setError(""); const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Unable to update events"); setNotice(result.message ?? "Saved."); await load(); }
  async function rsvp(eventId: number, status: string) { setBusy(eventId); try { await post({ action: "rsvp", eventId, status }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save RSVP"); } finally { setBusy(null); } }
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy("create"); try { await post({ action: "create", ...attendees(), title: data.get("title"), eventDate: data.get("eventDate"), endDate: data.get("endDate"), recurrenceFrequency: data.get("recurrenceFrequency"), recurrenceInterval: data.get("recurrenceInterval"), recurrenceUntil: data.get("recurrenceUntil"), location: data.get("location"), description: data.get("description"), createAttendance: data.get("attendance") === "on" }); setFormOpen(false); form.reset(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create event"); } finally { setBusy(null); } }
  const attendeePicker = <div className="event-wide event-attendee-picker"><fieldset><legend>Who should attend?</legend><div className="event-audience-options">{[["senior","Senior Section"],["junior","Junior Section"],["all","Both sections"],["selected_members","Choose specific members"],["nco_council","NCO Council"]].map(([value,label]) => <button key={value} type="button" className={mode === value ? "active" : ""} onClick={() => { setMode(value); if (value !== "selected_members") setSelected([]); }}>{label}</button>)}</div></fieldset>{mode === "selected_members" && <><label>Search members<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or section" /></label><div className="event-attendee-summary"><strong>{selected.length} member{selected.length === 1 ? "" : "s"} selected</strong>{selected.length > 0 && <button type="button" className="text-button" onClick={() => setSelected([])}>Clear selection</button>}</div><div className="event-member-options">{members.filter(m => (m.name+" "+m.section).toLowerCase().includes(search.toLowerCase())).map(m => <label key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={e => setSelected(ids => e.target.checked ? (ids.includes(m.id) ? ids : [...ids,m.id]) : ids.filter(id => id !== m.id))} /><span>{m.name}<small>{m.section === "senior" ? "Senior" : "Junior"} Section</small></span></label>)}{members.length === 0 && <p>No members are available to choose.</p>}</div></>}</div>;
  return <main className="event-centre-page">
    <header className="category-page-header"><div><p className="eyebrow">PROGRAMME</p><h1>Meetings and events</h1><p>Keep the company programme, RSVPs and attendance follow-up in one place.</p></div>{canManage && <button className="primary" onClick={() => setFormOpen((value) => { setEditing(null); setMode("senior"); setSelected([]); return !value; })}>{formOpen ? "Close form" : "Add event"}</button>}</header>
    {canManage && editing && <form className="event-form panel" key={editing.id} onSubmit={saveEdit}>
      <div className="panel-heading"><div><p className="eyebrow">EDIT PROGRAMME ITEM</p><h2>Edit meeting or event</h2></div></div>
      <div className="event-form-grid">
        {attendeePicker}
        <label>Title<input name="title" required maxLength={120} defaultValue={editing.title} /></label>
        <label>Date and time<input name="eventDate" type="datetime-local" required defaultValue={editing.event_date.slice(0,16)} /></label>
        <label>End date and time<input name="endDate" type="datetime-local" defaultValue={editing.end_date?.slice(0,16) ?? ""} /></label>
        <label>Location<input name="location" maxLength={160} defaultValue={editing.location} /></label>
        <label className="event-wide">Details<textarea name="description" rows={3} maxLength={2000} defaultValue={editing.description} /></label>
      </div>
      <div className="event-editor-actions"><button className="primary" disabled={busy !== null}>Save changes</button>
      <button type="button" disabled={busy !== null} onClick={() => setEditing(null)}>Cancel</button></div>
    </form>}
    {notice && <p className="form-success" role="status">{notice}</p>}{error && <p className="form-error">{error}</p>}
    {formOpen && <form className="event-form panel" onSubmit={create}><div className="panel-heading"><div><p className="eyebrow">NEW PROGRAMME ITEM</p><h2>Plan an event</h2></div><span>Only the selected attendees will be notified.</span><button className="event-form-close" type="button" onClick={() => setFormOpen(false)} aria-label="Close event planner">×</button></div><div className="event-form-grid"><label>Title<input name="title" required maxLength={120} placeholder="e.g. NCO Council Meeting" /></label><label>Date and time<input name="eventDate" type="datetime-local" required /></label>{attendeePicker}<label>Repeat<select name="recurrenceFrequency" defaultValue="none"><option value="none">Does not repeat</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Repeat interval<input name="recurrenceInterval" type="number" min="1" max="12" defaultValue="1" /></label><label>Repeat until<input name="recurrenceUntil" type="date" /></label><label className="event-wide">Location<input name="location" maxLength={160} placeholder="Optional location" /></label><label className="event-wide">Details<textarea name="description" rows={3} maxLength={2000} placeholder="What the selected attendees need to know" /></label><label className="event-register-toggle"><input name="attendance" type="checkbox" defaultChecked /><span><strong>Create an attendance register</strong><small>Only required attendees will appear in the register.</small></span></label></div><button className="primary" disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create event"}</button></form>}
    <section className="event-timeline" aria-live="polite">{events.map((event) => { const response = rsvps.find((item) => item.event_id === event.id)?.status ?? ""; const date = new Date(event.event_date); const audienceLabel = event.audience === "selected_members" ? "SELECTED MEMBERS" : event.audience === "nco_council" ? "NCO COUNCIL" : event.section === "all" ? "COMPANY EVENT" : `${event.section.toUpperCase()} SECTION`; return <article className="event-card panel" key={event.id}><time dateTime={event.event_date}><strong>{date.toLocaleDateString("en-MY", { day: "2-digit" })}</strong><span>{date.toLocaleDateString("en-MY", { month: "short" })}</span></time><div className="event-body"><p className="eyebrow">{audienceLabel}</p><h2>{event.title}</h2><p>{date.toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}{event.location ? ` · ${event.location}` : ""}</p>{event.description && <small>{event.description}</small>}<span className="event-attendance">{event.attendance_session_id ? "Attendance register ready" : "No attendance register"}{canManage ? ` · ${event.going_total ?? 0} going` : ""}</span><a className="text-button" href={`/api/events?calendar=${event.id}`}>Add to calendar</a>{canManage && <div className="event-management-actions"><button type="button" disabled={busy !== null} onClick={() => { setEditing(event); setMode(event.audience === "section_members" ? event.section : event.audience); setSelected(JSON.parse(event.selected_member_ids || "[]")); setFormOpen(false); setError(""); window.scrollTo({top:0,behavior:"smooth"}); }}>Edit event</button><button type="button" className="event-delete-button" disabled={busy !== null} onClick={() => void deleteEvent(event)}>Delete</button></div>}</div>{!readOnly && <div className="rsvp-actions"><small>Your RSVP</small>{[["going", "Going"], ["maybe", "Maybe"], ["not_going", "Can’t go"]].map(([status, label]) => <button key={status} disabled={busy === event.id} className={response === status ? "active" : ""} onClick={() => rsvp(event.id, status)}>{label}</button>)}</div>}</article>; })}{!events.length && <div className="event-empty panel"><span>◫</span><h2>No upcoming events</h2><p>New meetings and company events will appear here.</p></div>}</section>
  </main>;
}
