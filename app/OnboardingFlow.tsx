"use client";

import { FormEvent, useEffect, useState } from "react";
import ManagedSchoolSelect from "./ManagedSchoolSelect";

type Member = {
  id: number;
  name: string;
  rank: string;
  squad: string;
  section: string;
  joined_at: string;
  school: string;
  contact_number: string;
  emergency_contact_number: string;
  email: string;
  parents_name: string;
};
type Data = {
  member: Member | null;
  profileComplete: boolean;
  correction: { status: string; review_notes: string } | null;
  privacy: { setting_value: string; version: number };
  checklist: string[];
  steps: { password: boolean; profile: boolean; privacy: boolean; tour: boolean };
};

export default function OnboardingFlow({
  user,
  onComplete,
  onLogout,
}: {
  user: { name: string; email: string; role: string };
  onComplete: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");

  async function load() {
    const response = await fetch("/api/onboarding", { cache: "no-store" });
    const result = (await response.json()) as Data & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load onboarding");
    setData(result);
    if (Object.values(result.steps).every(Boolean)) await onComplete();
  }

  useEffect(() => {
    fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as Data & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load onboarding");
        setData(result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load onboarding"));
  }, []);

  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to save onboarding");
    }
    setNotice(result.message ?? success);
    await load();
    setBusy(false);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("newPasswordConfirm") ?? "");
    if (confirmation && newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_password",
        currentPassword: form.get("currentPassword"),
        newPassword,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to change password");
    }
    formElement.reset();
    setNewPasswordValue("");
    setNotice("Your private password is now active.");
    await load();
    setBusy(false);
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action({
      action: "submit_correction",
      name: form.get("name"),
      section: form.get("section"),
      squad: form.get("squad"),
      joinedYear: form.get("joinedYear"),
      school: form.get("school"),
      contactNumber: form.get("contactNumber"),
      emergencyContactNumber: form.get("emergencyContactNumber"),
      parentsName: form.get("parentsName"),
    }, "Correction request submitted.");
    setShowCorrection(false);
  }

  if (!data)
    return <main className="loading-state"><div className="brand-mark pulse">A</div><p>{error || "Preparing your account…"}</p></main>;

  const activeStep = !data.steps.password ? 1 : !data.steps.profile ? 2 : !data.steps.privacy ? 3 : 4;
  const member = data.member;
  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <header className="onboarding-header">
          <div className="auth-brand"><div className="brand-mark app-photo" /><div><strong>11KCHBB App</strong><span>Account onboarding</span></div></div>
          <button className="text-button" onClick={onLogout}>Sign out</button>
        </header>
        <div className="onboarding-intro">
          <p className="eyebrow">WELCOME, {user.name.toUpperCase()}</p>
          <h1>Let’s prepare your account</h1>
          <p>Complete these four steps once. Your progress is saved automatically.</p>
        </div>
        <ol className="onboarding-progress" aria-label="Onboarding progress">
          {["Secure account", "Verify profile", "Privacy", "App guide"].map((label, index) => (
            <li className={data.steps[["password", "profile", "privacy", "tour"][index] as keyof Data["steps"]] ? "done" : activeStep === index + 1 ? "active" : ""} key={label}>
              <span>{data.steps[["password", "profile", "privacy", "tour"][index] as keyof Data["steps"]] ? "✓" : index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
        {notice && <p className="form-success" role="status">{notice}</p>}
        {error && <p className="form-error">{error}</p>}

        {!data.steps.password && (
          <section className="onboarding-step">
            <p className="eyebrow">STEP 1</p><h2>Choose your private password</h2>
            <p>Replace the password used for your access request. Use at least 10 characters.</p>
            <form onSubmit={changePassword}>
              <label>Current password<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
              <label>New private password<input name="newPassword" type="password" minLength={10} required autoComplete="new-password" value={newPasswordValue} onChange={(event) => setNewPasswordValue(event.target.value)} /></label>
              <label>Confirm new password<input name="newPasswordConfirm" type="password" minLength={10} required autoComplete="new-password" /></label>
              <ul className="password-checklist" aria-label="Password requirements"><li className={newPasswordValue.length >= 10 ? "valid" : ""}>{newPasswordValue.length >= 10 ? "✓" : "○"} At least 10 characters</li><li className={/[A-Z]/.test(newPasswordValue) ? "valid" : ""}>{/[A-Z]/.test(newPasswordValue) ? "✓" : "○"} One uppercase letter</li><li className={/[0-9]/.test(newPasswordValue) ? "valid" : ""}>{/[0-9]/.test(newPasswordValue) ? "✓" : "○"} One number</li></ul>
              <button className="primary" disabled={busy}>{busy ? "Updating…" : "Secure my account"}</button>
            </form>
          </section>
        )}

        {data.steps.password && !data.steps.profile && (
          <section className="onboarding-step">
            <p className="eyebrow">STEP 2</p><h2>Verify your member profile</h2>
            {!member ? <p className="form-error">Your account is not linked to a member profile. Ask an administrator to review the approval.</p> : (
              <>
                <dl className="onboarding-profile">
                  <div><dt>Full name</dt><dd>{member.name}</dd></div>
                  <div><dt>Section & squad</dt><dd>{member.section} · {member.squad}</dd></div>
                  <div><dt>Joined year</dt><dd>{member.joined_at}</dd></div>
                  <div><dt>School</dt><dd>{member.school || "Missing"}</dd></div>
                  <div><dt>Contact</dt><dd>{member.contact_number || "Missing"}</dd></div>
                  <div><dt>Emergency contact</dt><dd>{member.emergency_contact_number || "Missing"}</dd></div>
                  <div><dt>Parent / guardian</dt><dd>{member.parents_name || "Missing"}</dd></div>
                  <div><dt>Email</dt><dd>{member.email}</dd></div>
                </dl>
                {data.correction?.status === "pending" ? (
                  <div className="onboarding-waiting"><strong>Correction awaiting review</strong><p>A staff member must review your proposed details before you can confirm this profile.</p><button className="secondary" disabled={busy} onClick={() => void load()}>Refresh review status</button></div>
                ) : (
                  <div className="onboarding-actions">
                    <button className="primary" disabled={busy || !data.profileComplete} onClick={() => action({ action: "confirm_profile" }, "Profile confirmed.")}>These details are correct</button>
                    <button className="secondary" onClick={() => setShowCorrection((value) => !value)}>Request a correction</button>
                  </div>
                )}
                {data.correction?.status === "rejected" && <p className="form-error">Previous correction declined{data.correction.review_notes ? `: ${data.correction.review_notes}` : "."}</p>}
                {showCorrection && (
                  <form className="onboarding-correction" onSubmit={submitCorrection}>
                    <label>Full name<input name="name" required defaultValue={member.name} /></label>
                    <div className="form-row"><label>Section<select name="section" defaultValue={member.section}><option value="senior">Senior</option><option value="junior">Junior</option></select></label><label>Squad<select name="squad" defaultValue={member.squad}><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label></div>
                    <label>Joined year<input name="joinedYear" type="number" min="1950" max={new Date().getFullYear()} required defaultValue={member.joined_at} /></label>
                    <ManagedSchoolSelect defaultValue={member.school} />
                    <label>Contact number<input name="contactNumber" required defaultValue={member.contact_number} /></label>
                    <label>Emergency contact number<input name="emergencyContactNumber" required defaultValue={member.emergency_contact_number} /></label>
                    <label>Parent / guardian name<input name="parentsName" required defaultValue={member.parents_name} /></label>
                    <button className="primary" disabled={busy}>{busy ? "Submitting…" : "Submit correction request"}</button>
                  </form>
                )}
              </>
            )}
          </section>
        )}

        {data.steps.profile && !data.steps.privacy && (
          <section className="onboarding-step">
            <p className="eyebrow">STEP 3</p><h2>How your information is used</h2>
            <div className="privacy-notice"><p>{data.privacy.setting_value}</p><small>Privacy notice version {data.privacy.version}</small></div>
            <button className="primary" disabled={busy} onClick={() => action({ action: "accept_privacy" }, "Privacy notice acknowledged.")}>{busy ? "Saving…" : "I understand and agree"}</button>
          </section>
        )}

        {data.steps.privacy && !data.steps.tour && (
          <section className="onboarding-step">
            <p className="eyebrow">STEP 4</p><h2>Your {user.role.replaceAll("_", " ")} guide</h2>
            <p>Tick each item after reading it. These are the areas most useful to your account.</p>
            <div className="onboarding-checklist">
              {data.checklist.map((item, index) => (
                <label key={item}><input type="checkbox" checked={checked.includes(index)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, index] : current.filter((value) => value !== index))} /><span><strong>{item}</strong><small>You can find this from the app navigation menu.</small></span></label>
              ))}
            </div>
            <button className="primary" disabled={busy || checked.length !== data.checklist.length} onClick={() => action({ action: "complete_tour" }, "Onboarding complete.")}>{busy ? "Finishing…" : "Finish onboarding"}</button>
          </section>
        )}
      </section>
    </main>
  );
}
