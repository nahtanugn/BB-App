"use client";

import { FormEvent, useEffect, useState } from "react";
import AppNavigation from "./AppNavigation";

type ManagementData = {
  requests: Array<Record<string, string | number | null>>;
  corrections: Array<Record<string, string | number | null>>;
  incomplete: Array<Record<string, string | number | null>>;
  audit: Array<Record<string, string | number | null>>;
  privacy: { setting_value: string; version: number };
  permissions: { manageRegistrations: boolean; reviewCorrections: boolean; editPrivacy: boolean; readOnly: boolean };
};

export default function OnboardingCentre({
  currentUser,
  onBack,
  onLogout,
  embedded = false,
}: {
  currentUser: { name: string; role: string };
  onBack?: () => void;
  onLogout?: () => void;
  embedded?: boolean;
}) {
  const [data, setData] = useState<ManagementData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/onboarding?management=1", { cache: "no-store" });
    const result = (await response.json()) as ManagementData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load onboarding work");
    setData(result);
  }
  useEffect(() => {
    fetch("/api/onboarding?management=1", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ManagementData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load onboarding work");
        setData(result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load onboarding work"));
  }, []);

  async function post(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/onboarding", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to complete action");
    }
    await load();
    setNotice(result.message ?? "Action completed.");
    setBusy(false);
  }

  async function registrationDecision(formElement: HTMLFormElement, decision: "approve" | "reject") {
    const form = new FormData(formElement);
    await post({
      action: "review_registration", decision,
      userId: form.get("userId"), memberId: form.get("memberId"),
      section: form.get("section"), squad: form.get("squad"),
      reviewNotes: form.get("reviewNotes"),
    });
  }

  async function correctionDecision(formElement: HTMLFormElement, decision: "approve" | "reject") {
    const form = new FormData(formElement);
    await post({ action: "review_correction", decision, correctionId: form.get("correctionId"), reviewNotes: form.get("reviewNotes") });
  }

  async function updatePrivacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await post({ action: "update_privacy", text: form.get("text"), requireReacknowledgement: form.get("requireReacknowledgement") === "on" });
  }

  const content = (
    <section className={embedded ? "onboarding-management embedded" : "onboarding-management"}>
      {notice && <div className="action-toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss confirmation">×</button></div>}
      <div className="onboarding-management-hero"><div><p className="eyebrow">ONBOARDING OPERATIONS</p><h1>Access & profile review</h1><p>Approve member access, resolve correction requests and monitor incomplete setup.</p></div></div>
      {error && <p className="form-error">{error}</p>}
      {!data ? <p className="empty-inline">Loading onboarding work…</p> : (
        <>
          <div className="admin-summary">
            <article><span>Pending access</span><strong>{data.requests.filter((request) => request.account_status === "pending").length}</strong></article>
            <article><span>Profile corrections</span><strong>{data.corrections.filter((correction) => correction.status === "pending").length}</strong></article>
            <article><span>Incomplete setup</span><strong>{data.incomplete.length}</strong></article>
            <article><span>Privacy version</span><strong>{data.privacy.version}</strong></article>
          </div>

          {data.permissions.manageRegistrations && (
            <section className="onboarding-review-section">
              <div className="request-section-heading"><div><p className="eyebrow">ACCESS REQUESTS</p><h2>Member registrations</h2></div><span>{data.requests.length}</span></div>
              <div className="onboarding-request-list">
                {data.requests.map((request) => (
                  <article key={String(request.user_id)} className={String(request.account_status)}>
                    <header><div><strong>{request.name}</strong><small>{request.email} · {request.section} · {request.squad}</small></div><span>{String(request.account_status)}</span></header>
                    <dl><div><dt>School</dt><dd>{request.school}</dd></div><div><dt>Joined</dt><dd>{request.joined_year}</dd></div><div><dt>Contact</dt><dd>{request.contact_number}</dd></div><div><dt>Emergency</dt><dd>{request.emergency_contact_number}</dd></div><div><dt>Parent / guardian</dt><dd>{request.parents_name}</dd></div></dl>
                    {request.account_status === "pending" && (
                      <form onSubmit={(event) => { event.preventDefault(); void registrationDecision(event.currentTarget, "approve"); }}>
                        <input type="hidden" name="userId" value={String(request.user_id)} />
                        <label>Member profile match<select name="memberId" defaultValue={request.suggested_member_id ? String(request.suggested_member_id) : ""}><option value="">Create a new member profile</option>{request.suggested_member_id && <option value={String(request.suggested_member_id)}>Confirm match: {request.suggested_member_name}</option>}</select></label>
                        <div className="form-row"><label>Final section<select name="section" defaultValue={String(request.section)}><option value="senior">Senior</option><option value="junior">Junior</option></select></label><label>Final squad<select name="squad" defaultValue={String(request.squad)}><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label></div>
                        <label>Review note (optional)<textarea name="reviewNotes" rows={2} /></label>
                        <div className="onboarding-actions"><button className="primary" disabled={busy}>Approve & activate</button><button type="button" className="danger-link" disabled={busy} onClick={(event) => { const form = event.currentTarget.form; if (form) void registrationDecision(form, "reject"); }}>Reject</button></div>
                      </form>
                    )}
                    {request.review_notes && <p className="review-note">Review note: {request.review_notes}</p>}
                  </article>
                ))}
                {!data.requests.length && <p className="empty-inline">No access requests yet.</p>}
              </div>
            </section>
          )}

          <section className="onboarding-review-section">
            <div className="request-section-heading"><div><p className="eyebrow">PROFILE CORRECTIONS</p><h2>Member-proposed changes</h2></div><span>{data.corrections.length}</span></div>
            <div className="onboarding-correction-list">
              {data.corrections.map((correction) => {
                let proposed: Record<string, string> = {};
                try { proposed = JSON.parse(String(correction.proposed_values)); } catch { proposed = {}; }
                return (
                  <article key={String(correction.id)}>
                    <header><div><strong>{correction.member_name}</strong><small>{correction.requester_email} · {correction.squad}</small></div><span>{String(correction.status)}</span></header>
                    <div className="proposed-values">{Object.entries(proposed).filter(([key]) => key !== "email").map(([key, value]) => <div key={key}><small>{key.replaceAll("_", " ")}</small><strong>{value}</strong></div>)}</div>
                    {correction.status === "pending" && data.permissions.reviewCorrections && !data.permissions.readOnly && (
                      <form onSubmit={(event) => { event.preventDefault(); void correctionDecision(event.currentTarget, "approve"); }}>
                        <input type="hidden" name="correctionId" value={String(correction.id)} />
                        <label>Review note (optional)<input name="reviewNotes" /></label>
                        <div className="onboarding-actions"><button className="primary" disabled={busy}>Approve changes</button><button type="button" className="danger-link" disabled={busy} onClick={(event) => { const form = event.currentTarget.form; if (form) void correctionDecision(form, "reject"); }}>Reject</button></div>
                      </form>
                    )}
                    {correction.review_notes && <p className="review-note">Review note: {correction.review_notes}</p>}
                  </article>
                );
              })}
              {!data.corrections.length && <p className="empty-inline">No profile corrections to review.</p>}
            </div>
          </section>

          {data.permissions.editPrivacy && (
            <section className="onboarding-review-section privacy-editor">
              <div><p className="eyebrow">PRIVACY NOTICE</p><h2>Member acknowledgement</h2><p>Editing creates a new version. Existing completed users are only prompted again when you select the checkbox.</p></div>
              <form onSubmit={updatePrivacy}><label>Notice text<textarea name="text" rows={6} minLength={40} required defaultValue={data.privacy.setting_value} /></label><label className="checkbox-row"><input name="requireReacknowledgement" type="checkbox" /> Require every active user to acknowledge this version</label><button className="primary" disabled={busy}>Save new privacy version</button></form>
            </section>
          )}

          {data.incomplete.length > 0 && (
            <section className="onboarding-review-section"><div className="request-section-heading"><div><p className="eyebrow">SETUP HEALTH</p><h2>Incomplete onboarding</h2></div><span>{data.incomplete.length}</span></div><div className="incomplete-list">{data.incomplete.map((user) => <article key={String(user.id)}><strong>{user.name}</strong><small>{user.email} · {String(user.role).replaceAll("_", " ")}{user.must_change_password ? " · password change required" : ""}</small></article>)}</div></section>
          )}

          {data.audit.length > 0 && (
            <section className="onboarding-review-section">
              <div className="request-section-heading"><div><p className="eyebrow">APPROVAL HISTORY</p><h2>Recent onboarding activity</h2></div><span>{data.audit.length}</span></div>
              <div className="onboarding-audit-list">
                {data.audit.map((entry) => (
                  <article key={String(entry.id)}>
                    <div><strong>{String(entry.action).replaceAll("_", " ")}</strong><small>by {entry.actor_name}</small></div>
                    <time dateTime={String(entry.created_at)}>{new Date(String(entry.created_at)).toLocaleString("en-MY")}</time>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );

  if (embedded) return content;
  return <main className="onboarding-centre-shell"><AppNavigation section="Onboarding Centre" userName={currentUser.name} userDescription={`${currentUser.role.replaceAll("_", " ")} access`} onBack={onBack} onLogout={onLogout ?? (() => undefined)} />{content}</main>;
}
