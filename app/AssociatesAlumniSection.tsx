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
  transfer_id?: number | null;
  source_type?: "member" | "officer" | null;
  effective_date?: string | null;
  transfer_reason?: string | null;
};

type TransferSource = { id: number; name: string; email: string; section?: string; squad?: string; rank?: string; officer_rank?: string };
type TransferDraft = { sourceType: "member" | "officer"; sourceId: string; classification: RecordItem["classification"]; workStatus: string; effectiveDate: string; reason: string };

const blank: RecordItem = { id: 0, name: "", classification: "associate_member", gender: "M", work_status: "working", ethnicity: "", religion: "", spiritual_status: "", notes: "", active: 1 };
const labels: Record<RecordItem["classification"], string> = { associate_member: "Associate Member", instructor: "Instructor", helper: "Helper", alumni: "Alumni" };
const ethnicities = ["Malay", "Chinese", "Indian", "Iban", "Bidayuh", "Melanau", "Orang Ulu", "Kadazan-Dusun", "Bajau", "Murut", "Other Bumiputera", "Others"];
const religions = ["Christianity", "Islam", "Buddhism", "Hinduism", "Sikhism", "Taoism / Chinese Traditional Religion", "Traditional / Indigenous Beliefs", "Other", "No religion"];

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function spiritualLabel(value: string) { return value === "accepted_christ" ? "Accepted Christ" : value === "baptised" ? "Baptised" : value === "non_believer" ? "Non-Believer" : "Not recorded (optional)"; }

export default function AssociatesAlumniSection({ role }: { role: string }) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [sources, setSources] = useState<{ members: TransferSource[]; officers: TransferSource[] }>({ members: [], officers: [] });
  const [canTransfer, setCanTransfer] = useState(false);
  const [transfer, setTransfer] = useState<TransferDraft | null>(null);
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
      const result = await response.json() as { records?: RecordItem[]; sources?: { members: TransferSource[]; officers: TransferSource[] }; canTransfer?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load Associate Members and Alumni");
      setRecords(result.records ?? []);
      setSources(result.sources ?? { members: [], officers: [] });
      setCanTransfer(Boolean(result.canTransfer));
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

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!transfer || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/associates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transfer", ...transfer, sourceId: Number(transfer.sourceId) }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to transfer this person");
      setTransfer(null); setNotice(result.message || "Classification transferred."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to transfer this person"); }
    finally { setBusy(false); }
  }

  async function reverseTransfer(record: RecordItem) {
    if (!record.transfer_id || busy) return;
    const reason = window.prompt(`Why are you restoring ${record.name} to the original section?`);
    if (!reason?.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/associates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reverse_transfer", transferId: record.transfer_id, reason }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to restore the original classification");
      setNotice(result.message || "Original classification restored."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to restore the original classification"); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="category-page"><div className="loading-state">Preparing Associate Members and Alumni…</div></main>;
  return <main className="category-page officer-section-page associate-section-page">
    <header className="category-page-header"><div><p className="eyebrow">PEOPLE</p><h1>Associate Members &amp; Alumni</h1><p>Maintain the people classifications required for annual Company Statistics.</p></div><div className="associate-header-actions"><Link className="secondary-button" href="/?open=company-statistics">Open Company Statistics</Link>{canTransfer && <button className="secondary-button" type="button" onClick={() => { setTransfer({ sourceType: "member", sourceId: "", classification: "associate_member", workStatus: "working", effectiveDate: new Date().toISOString().slice(0, 10), reason: "" }); setError(""); }}>Transfer existing person</button>}{!readOnly && <button className="primary-button" type="button" onClick={() => { setEditing({ ...blank }); setError(""); }}>Add person</button>}</div></header>
    <section className="officer-summary" aria-label="Associate Members and Alumni summary"><article><strong>{active.length}</strong><span>Active records</span></article><article><strong>{associateCount}</strong><span>Associates, instructors &amp; helpers</span></article><article><strong>{alumniCount}</strong><span>Alumni</span></article></section>
    <section className="officer-toolbar panel"><label><span>Search people</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, classification or ethnicity" /></label><label className="associate-archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Show archived</label><span>{visible.length} shown</span></section>
    {notice && <p className="form-success" role="status">✓ {notice}</p>}{error && !editing && <p className="form-error" role="alert">{error}</p>}
    <section className="officer-grid">{visible.map((record) => <article className={`officer-card panel ${record.active ? "" : "associate-archived"}`} key={record.id}>
      <div className="officer-card-heading"><span>{initials(record.name)}</span><b className={record.active ? "complete" : "incomplete"}>{record.active ? "Active" : "Archived"}</b></div>
      <div><h2>{record.name}</h2><p>{labels[record.classification]} · {record.work_status === "studying" ? "Studying" : "Working"}</p>{record.source_type && <small>Transferred from {record.source_type === "officer" ? "Officer Section" : "Members Section"}{record.effective_date ? ` on ${record.effective_date}` : ""}</small>}</div>
      <dl><div><dt>Gender</dt><dd>{record.gender === "F" ? "Female" : "Male"}</dd></div><div><dt>Ethnicity</dt><dd>{record.ethnicity}</dd></div><div><dt>Religion</dt><dd>{record.religion || "Not recorded (optional)"}</dd></div><div><dt>Spiritual status</dt><dd>{spiritualLabel(record.spiritual_status)}</dd></div></dl>
      {!readOnly && <div className="associate-card-actions"><button type="button" className="primary-button" onClick={() => { setEditing(record); setError(""); }}>Edit details</button>{canTransfer && record.active && record.transfer_id && <button type="button" className="secondary-button" disabled={busy} onClick={() => void reverseTransfer(record)}>Restore original section</button>}{record.active && !record.transfer_id && <button type="button" className="secondary-button destructive" disabled={busy} onClick={() => void archive(record)}>Archive</button>}</div>}
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
    {transfer && <div className="modal-backdrop" role="presentation" onMouseDown={() => setTransfer(null)}><section className="modal officer-editor" role="dialog" aria-modal="true" aria-labelledby="classification-transfer-title" onMouseDown={(event) => event.stopPropagation()}><header className="modal-heading"><div><p className="eyebrow">CLASSIFICATION TRANSFER</p><h2 id="classification-transfer-title">Move an existing person</h2><small>The original record and history will be preserved and can be restored.</small></div><button type="button" onClick={() => setTransfer(null)} aria-label="Close">×</button></header><form className="officer-editor-form" onSubmit={submitTransfer}><div className="officer-field-grid">
      <label>Current section<select value={transfer.sourceType} onChange={(event) => setTransfer({ ...transfer, sourceType: event.target.value as "member" | "officer", sourceId: "" })}><option value="member">Members Section</option><option value="officer">Officer Section</option></select></label>
      <label>Person<select required value={transfer.sourceId} onChange={(event) => setTransfer({ ...transfer, sourceId: event.target.value })}><option value="">Select a person</option>{sources[transfer.sourceType === "member" ? "members" : "officers"].map((source) => <option value={source.id} key={source.id}>{source.name}{source.rank || source.officer_rank ? ` — ${source.rank || source.officer_rank}` : ""}</option>)}</select></label>
      <label>New classification<select value={transfer.classification} onChange={(event) => setTransfer({ ...transfer, classification: event.target.value as RecordItem["classification"] })}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Working or studying<select value={transfer.workStatus} onChange={(event) => setTransfer({ ...transfer, workStatus: event.target.value })}><option value="working">Working</option><option value="studying">Studying</option></select></label>
      <label>Effective date<input required type="date" value={transfer.effectiveDate} onChange={(event) => setTransfer({ ...transfer, effectiveDate: event.target.value })} /></label>
      <label className="associate-notes-field">Reason (required)<textarea required rows={4} value={transfer.reason} onChange={(event) => setTransfer({ ...transfer, reason: event.target.value })} placeholder="For example: No longer serving as an officer" /></label>
      </div><p className="form-help">Enter a reason before confirming. The person will stop appearing as an active member or officer. Awards, attendance and audit history remain stored. Any linked member login will be disabled.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy || !transfer.sourceId}>{busy ? "Transferring…" : "Confirm transfer"}</button></form></section></div>}
  </main>;
}
