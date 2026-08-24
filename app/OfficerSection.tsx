"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Officer = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "officer";
  officer_rank: string;
  gender: string;
  ethnicity: string;
  religion: string;
  spiritual_status: string;
  officer_work_status: string;
};

const officerRanks = ["Staff Sergeant", "Warrant Officer", "Lieutenant", "Captain", "Honorary Captain", "Chaplain"];
const malaysiaEthnicities = ["Malay", "Chinese", "Indian", "Iban", "Bidayuh", "Melanau", "Orang Ulu", "Kadazan-Dusun", "Bajau", "Murut", "Other Bumiputera", "Others"];
const religions = ["Christianity", "Islam", "Buddhism", "Hinduism", "Sikhism", "Taoism / Chinese Traditional Religion", "Traditional / Indigenous Beliefs", "Other", "No religion"];

function profileStatus(officer: Officer) {
  const fields = [officer.officer_rank, officer.gender, officer.ethnicity, officer.religion, officer.officer_work_status];
  const complete = fields.filter(Boolean).length;
  return { complete: complete === fields.length, percent: Math.round((complete / fields.length) * 100) };
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function OfficerSection({ role }: { role: string }) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [editing, setEditing] = useState<Officer | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const readOnly = role === "viewer";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/officers", { cache: "no-store" });
      const result = await response.json() as { officers?: Officer[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load Officer Section");
      setOfficers(result.officers ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Officer Section");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return officers.filter((officer) => !term || `${officer.name} ${officer.email} ${officer.officer_rank}`.toLowerCase().includes(term));
  }, [officers, query]);
  const completeCount = officers.filter((officer) => profileStatus(officer).complete).length;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/officers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_officer",
          officerId: editing.id,
          officerRank: form.get("officerRank"),
          gender: form.get("gender"),
          ethnicity: form.get("ethnicity"),
          religion: form.get("religion"),
          spiritualStatus: form.get("spiritualStatus"),
          officerWorkStatus: form.get("officerWorkStatus"),
        }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update officer details");
      setEditing(null);
      setNotice(result.message || "Officer details updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update officer details");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="category-page"><div className="loading-state">Preparing Officer Section…</div></main>;

  return <main className="category-page officer-section-page">
    <header className="category-page-header">
      <div><p className="eyebrow">PEOPLE</p><h1>Officer Section</h1><p>Officer records used by the annual Company Statistics report.</p></div>
      <Link className="secondary-button" href="/?open=company-statistics">Open Company Statistics</Link>
    </header>
    <section className="officer-summary" aria-label="Officer Section summary">
      <article><strong>{officers.length}</strong><span>Active officers</span></article>
      <article><strong>{completeCount}</strong><span>Complete profiles</span></article>
      <article><strong>{officers.length - completeCount}</strong><span>Need details</span></article>
    </section>
    <section className="officer-toolbar panel">
      <label><span>Search officers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email or rank" /></label>
      <span>{visible.length} shown</span>
    </section>
    {notice && <p className="form-success" role="status">✓ {notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="officer-grid">
      {visible.map((officer) => {
        const status = profileStatus(officer);
        return <article className="officer-card panel" key={officer.id}>
          <div className="officer-card-heading"><span>{initials(officer.name)}</span><b className={status.complete ? "complete" : "incomplete"}>{status.percent}% complete</b></div>
          <div><h2>{officer.name}</h2><p>{officer.officer_rank || "Officer rank not set"} · {officer.officer_work_status ? officer.officer_work_status[0].toUpperCase() + officer.officer_work_status.slice(1) : "Work/study status not set"}</p></div>
          <dl><div><dt>Gender</dt><dd>{officer.gender === "M" ? "Male" : officer.gender === "F" ? "Female" : "Not recorded"}</dd></div><div><dt>Ethnicity</dt><dd>{officer.ethnicity || "Not recorded"}</dd></div><div><dt>Religion</dt><dd>{officer.religion || "Not recorded"}</dd></div><div><dt>Spiritual status</dt><dd>{officer.spiritual_status === "accepted_christ" ? "Accepted Christ" : officer.spiritual_status === "baptised" ? "Baptised" : officer.spiritual_status === "non_believer" ? "Non-Believer" : "Not recorded (optional)"}</dd></div></dl>
          {!readOnly && <button type="button" className="primary-button" onClick={() => { setEditing(officer); setError(""); }}>Edit officer details</button>}
        </article>;
      })}
      {!visible.length && <div className="empty-state panel"><h2>No officers found</h2><p>Try another search term.</p></div>}
    </section>
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}>
      <section className="modal officer-editor" role="dialog" aria-modal="true" aria-labelledby="officer-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-heading"><div><p className="eyebrow">OFFICER SECTION</p><h2 id="officer-editor-title">{editing.name}</h2><small>{editing.email}</small></div><button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button></header>
        <form className="officer-editor-form" onSubmit={save}>
          <div className="officer-field-grid">
            <label>Officer rank<select name="officerRank" required defaultValue={editing.officer_rank}><option value="">Select rank</option>{officerRanks.map((rank) => <option key={rank}>{rank}</option>)}</select></label>
            <label>Gender<select name="gender" required defaultValue={editing.gender}><option value="">Select gender</option><option value="M">Male (M)</option><option value="F">Female (F)</option></select></label>
            <label>Ethnicity (race)<select name="ethnicity" required defaultValue={editing.ethnicity}><option value="">Select ethnicity</option>{editing.ethnicity && !malaysiaEthnicities.includes(editing.ethnicity) && <option>{editing.ethnicity}</option>}{malaysiaEthnicities.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Religion<select name="religion" required defaultValue={editing.religion}><option value="">Select religion</option>{editing.religion && !religions.includes(editing.religion) && <option>{editing.religion}</option>}{religions.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Working or studying<select name="officerWorkStatus" required defaultValue={editing.officer_work_status}><option value="">Select status</option><option value="working">Working</option><option value="studying">Studying</option></select></label>
            <label>Spiritual status (optional)<select name="spiritualStatus" defaultValue={editing.spiritual_status}><option value="">Not recorded</option><option value="accepted_christ">Accepted Christ</option><option value="baptised">Baptised</option><option value="non_believer">Non-Believer</option></select></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save officer details"}</button>
        </form>
      </section>
    </div>}
  </main>;
}
