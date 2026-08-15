"use client";
import { useEffect, useState } from "react";
type Event = { id: number; actor_email: string; actor_role: string; action: string; entity_type: string; entity_id: string; before_json: string | null; after_json: string | null; created_at: string };
export default function AuditHistory() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/audit", { cache: "no-store" }).then(async (r) => { const result = await r.json() as { events?: Event[]; error?: string }; if (!r.ok) throw new Error(result.error); setEvents(result.events ?? []); }).catch((e) => setError(e instanceof Error ? e.message : "Unable to load audit history")); }, []);
  return <section className="panel audit-history"><div className="panel-heading"><div><p className="eyebrow">ACCOUNTABILITY</p><h2>Audit history</h2><p>Recent profile, award, attendance and export changes.</p></div><span>{events.length}</span></div>{error && <p className="form-error">{error}</p>}<div className="audit-list">{events.map((event) => <article key={event.id}><div><strong>{event.action.replaceAll("_", " ")}</strong><small>{event.entity_type} {event.entity_id ? `· ${event.entity_id}` : ""}</small></div><div><span>{event.actor_email} · {event.actor_role}</span><time>{new Date(event.created_at).toLocaleString("en-MY")}</time></div></article>)}{!events.length && !error && <p className="empty-state">No audit entries yet.</p>}</div></section>;
}
