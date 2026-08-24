"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RecordItem = {
  id: number;
  name: string;
  classification: "associate_member" | "instructor" | "helper" | "alumni";
  gender: string;
  work_status: string;
  ethnicity: string;
  religion: string;
  spiritual_status: string;
  notes: string;
  active: number;
};

const blank: RecordItem = { id: 0, name: "", classification: "associate_member", gender: "M", work_status: "working", ethnicity: "", religion: "", spiritual_status: "", notes: "", active: 1 };
const labels: Record<RecordItem["classification"], string> = { associate_member: "Associate Member", instructor: "Instructor", helper: "Helper", alumni: "Alumni" };
const ethnicities = ["Malay", "Chinese", "Indian", "Iban", "Bidayuh", "Melanau", "Orang Ulu", "Kadazan-Dusun", "Bajau", "Murut", "Other Bumiputera", "Others"];
const religions = ["Christianity", "Islam", "Buddhism", "Hinduism", "Sikhism", "Taoism / Chinese Traditional Religion", "Traditional / Indigenous Beliefs", "Other", "No religion"];

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function spiritualLabel(value: string) { return value === "accepted_christ" ? "Accepted Christ" : value === "baptised" ? "Baptised" : value === "non_believer" ? "Non-Believer" : "Not recorded (optional)"; }

export default function AssociatesAlumniSection({ role }: { role: string }) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const readOnly = role === "viewer";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/associates", { cache: "no-store" });
      const result = await response.json() as { records?: RecordItem[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load Associate Members and Alumni");
      setRecords(result.records ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Associate Members and Alumni"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((record) => (showArchived || record.active) && (!term || `${record.name} ${labels[record.classification]} ${record.ethnicity}`.toLowerCase().includes(term)));
  }, [query, records, showArchived]);
  const active = records.filter((record) => record.active);
  const associateCount = active.filter((record) => record.classification !== "alumni").length;
  const alumniCount = active.filter((record) => record.classification === "alumni").length;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing || busy) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/associates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: editing.id ? "update" : "create", id: editing.id, name: form.get("name"), classification: form.get("classification"), gender: form.get("gender"), workStatus: form.get("workStatus"), ethnicity: form.get("ethnicity"), religion: form.get("religion"), spiritualStatus: form.get("spiritualStatus"), notes: form.get("notes") }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save details");
      setEditing(null); setNotice(result.message || "Details saved."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save details"); }
    finally { setBusy(false); }
  }

  async function archive(record: RecordItem) {
    if (busy || !window.confirm(`Archive ${record.name}? Historical audit records will be retained.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/associates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive", id: record.id }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to archive record");
      setNotice(result.message || "Record archived."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to archive record"); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="category-page"><div className="loading-state">Preparing Associate Members and Alumni…</div></main>;
  return <main className="category-page officer-section-page associate-section-page">
    <header className="category-page-header"><div><p className="eyebrow">PEOPLE</p><h1>Associate Members &amp; Alumni</h1><p>Maintain the people classifications required for annual Company Statistics.</p></div><div className="associate-header-actions"><Link className="secondary-button" href="/?open=company-statistics">Open Company Statistics</Link>{!readOnly && <button className="primary-button" type="button" onClick={() => { setEditing({ ...blank }); setError(""); }}>Add person</button>}</div></header>
    <section className="officer-summary" aria-label="Associate Members and Alumni summary"><article><strong>{active.length}</strong><span>Active records</span></article><article><strong>{associateCount}</strong><span>Associates, instructors &amp; helpers</span></article><article><strong>{alumniCount}</strong><span>Alumni</span></article></section>
    <section className="officer-toolbar panel"><label><span>Search people</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, classification or ethnicity" /></label><label className="associate-archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label><span>{visible.length} shown</span></section>
    {notice && <p className="form-success" role="status">✓ {notice}</p>}{error && !editing && <p className="form-error" role="alert">{error}</p>}
    <section className="officer-grid">{visible.map((record) => <article className={`officer-card panel ${record.active ? "" : "associate-archived"}`} key={record.id}>
      <div className="officer-card-heading"><span>{initials(record.name)}</span><b className={record.active ? "complete" : "incomplete"}>{record.active ? "Active" : "Archived"}</b></div>
      <div><h2>{record.name}</h2><p>{labels[record.classification]} · {record.work_status === "studying" ? "Studying" : "Working"}</p></div>
      <dl><div><dt>Gender</dt><dd>{record.gender === "F" ? "Female" : "Male"}</dd></div><div><dt>Ethnicity</dt><dd>{record.ethnicity}</dd></div><div><dt>Religion</dt><dd>{record.religion || "Not recorded (optional)"}</dd></div><div><dt>Spiritual status</dt><dd>{spiritualLabel(record.spiritual_status)}</dd></div></dl>
      {!readOnly && <div className="associate-card-actions"><button type="button" className="primary-button" onClick={() => { setEditing(record); setError(""); }}>Edit details</button>{record.active && <button type="button" className="secondary-button destructive" disabled={busy} onClick={() => void archive(record)}>Archive</button>}</div>}
    </article>)}{!visible.length && <div className="empty-state panel"><h2>No records found</h2><p>Add an Associate Member, Instructor, Helper, or Alumni record.</p></div>}</section>
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><section className="modal officer-editor" role="dialog" aria-modal="true" aria-labelledby="associate-editor-title" onMouseDown={(event) => event.stopPropagation()}><header className="modal-heading"><div><p className="eyebrow">ASSOCIATE MEMBERS &amp; ALUMNI</p><h2 id="associate-editor-title">{editing.id ? editing.name : "Add a person"}</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button></header><form className="officer-editor-form" onSubmit={save}><div className="officer-field-grid">
      <label>Full name<input name="name" required defaultValue={editing.name} /></label>
      <label>Classification<select name="classification" required defaultValue={editing.classification}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Gender<select name="gender" required defaultValue={editing.gender || "M"}><option value="M">Male (M)</option><option value="F">Female (F)</option></select></label>
      <label>Working or studying<select name="workStatus" required defaultValue={editing.work_status || "working"}><option value="working">Working</option><option value="studying">Studying</option></select></label>
      <label>Ethnicity (race)<select name="ethnicity" required defaultValue={editing.ethnicity}><option value="">Select ethnicity</option>{editing.ethnicity && !ethnicities.includes(editing.ethnicity) && <option>{editing.ethnicity}</option>}{ethnicities.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Religion (optional)<select name="religion" defaultValue={editing.religion}><option value="">Not recorded</option>{editing.religion && !religions.includes(editing.religion) && <option>{editing.religion}</option>}{religions.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Spiritual status (optional)<select name="spiritualStatus" defaultValue={editing.spiritual_status}><option value="">Not recorded</option><option value="accepted_christ">Accepted Christ</option><option value="baptised">Baptised</option><option value="non_believer">Non-Believer</option></select></label>
      <label className="associate-notes-field">Notes (optional)<textarea name="notes" rows={4} defaultValue={editing.notes} /></label>
      </div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving…" : editing.id ? "Save details" : "Add person"}</button></form></section></div>}
  </main>;
}
