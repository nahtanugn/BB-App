"use client";

import { FormEvent, useEffect, useState } from "react";

type Assessment = { candidateName: string; assessorType: string; expiresAt: string; completed: boolean };
const qualities = ["trustworthiness", "respect", "responsibility", "fairness", "caring", "good_example", "self_discipline", "humility", "attitude"];
const reasons = ["Shows consistent character", "Serves others willingly", "Demonstrates leadership", "Is dependable", "Is ready for the President’s Badge"];

export default function PresidentsBadgeAssessmentPage() {
  const [token] = useState(() => typeof window === "undefined" ? "" : new URL(window.location.href).searchParams.get("token") ?? ""); const [data, setData] = useState<Assessment | null>(null); const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer=window.setTimeout(()=>{fetch(`/api/presidents-badge/assessment?token=${encodeURIComponent(token)}`, { cache: "no-store" }).then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.error); setData(body); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to open assessment"));},0);return()=>window.clearTimeout(timer);
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    form.set("token", token);
    const res = await fetch("/api/presidents-badge/assessment", { method: "POST", body: form });
    const body = await res.json(); setBusy(false); if (!res.ok) return setError(body.error ?? "Unable to submit assessment"); setDone(true);
  }
  if (error && !data) return <main className="public-assessment"><section className="assessment-card"><p className="eyebrow">PRIVATE ASSESSMENT</p><h1>Link unavailable</h1><p className="error-banner">{error}</p></section></main>;
  if (!data) return <main className="public-assessment"><section className="assessment-card"><p>Opening secure assessment…</p></section></main>;
  if (done || data.completed) return <main className="public-assessment"><section className="assessment-card"><p className="eyebrow">PRESIDENT’S BADGE</p><h1>Assessment received</h1><p>Thank you. This one-time link can no longer be used.</p></section></main>;
  return <main className="public-assessment"><form className="assessment-card" onSubmit={submit}>
    <p className="eyebrow">{data.assessorType.toUpperCase()} ASSESSMENT</p><h1>{data.candidateName}</h1><p>Only the candidate’s name and this assessment are shown. The link expires {new Date(data.expiresAt).toLocaleString()}.</p>
    <label>Assessor name<input name="assessorName" required maxLength={40} /></label><label>Relationship / role<input name="relationship" maxLength={30} /></label>
    <fieldset><legend>Quality ratings</legend>{qualities.map((quality) => <label key={quality}>{quality.replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase())}<select name={quality} required defaultValue=""><option value="" disabled>Choose rating</option><option value="5">Excellent</option><option value="3">Good</option><option value="1">Average</option></select></label>)}</fieldset>
    <fieldset><legend>Recommendation reasons — choose at least two</legend>{reasons.map((reason) => <label className="check-row" key={reason}><input type="checkbox" name="reasons" value={reason} />{reason}</label>)}</fieldset>
    <label>Remarks<textarea name="remarks" maxLength={240} rows={5} /></label><label>Signature image — optional<input type="file" name="signature" accept="image/png,image/jpeg" /></label><p>Submitting is your electronic confirmation. If no signature image is supplied, the official signature line remains blank for signing on paper.</p>{error && <p className="error-banner">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Submitting…" : "Submit assessment"}</button>
  </form></main>;
}
