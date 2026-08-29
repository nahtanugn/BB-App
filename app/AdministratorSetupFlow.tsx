"use client";

import { FormEvent, useEffect, useState } from "react";
import { brandingLogoStyle, type Branding, useBranding } from "./BrandingContext";

type SetupData = {
  eligible: boolean;
  status: { privacy: boolean; branding: boolean; tour: boolean };
  requiredComplete: boolean;
  privacy: { text: string; version: number };
  branding: Branding;
  optional: { schoolCount: number; officerCount: number };
  companyAddress: string;
};

export default function AdministratorSetupFlow({
  userName,
  onComplete,
  onLogout,
}: {
  userName: string;
  onComplete: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const currentBranding = useBranding();
  const [data, setData] = useState<SetupData | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/company-setup", { cache: "no-store" });
    const result = await response.json() as SetupData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load company setup");
    setData(result);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load company setup"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function onboardingAction(action: "accept_privacy" | "complete_tour") {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to save setup progress");
  }

  async function acceptPrivacy() {
    setBusy(true); setError("");
    try { await onboardingAction("accept_privacy"); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save privacy acknowledgement"); }
    finally { setBusy(false); }
  }

  function chooseLogo(file?: File) {
    setError("");
    if (!file) return setLogoDataUrl(null);
    if (file.size > 750_000) return setError("Choose a logo smaller than 750 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function saveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    const companyName = String(form.get("companyName") ?? "").trim();
    if (!companyName || companyName === "Your BB Company") return setError("Enter your company’s official name.");
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data.branding, companyName, logoDataUrl }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save company identity");
      window.dispatchEvent(new Event("app-branding-updated"));
      setLogoDataUrl(null);
      setNotice("Company identity saved.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save company identity"); }
    finally { setBusy(false); }
  }

  async function finish(target?: "schools" | "accounts") {
    setBusy(true); setError("");
    try {
      await onboardingAction("complete_tour");
      if (target) window.history.replaceState({}, "", `/?open=admin&setup=${target}`);
      else window.history.replaceState({}, "", "/?section=senior");
      await onComplete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to finish setup"); setBusy(false); }
  }

  async function copyAddress() {
    if (!data) return;
    try { await navigator.clipboard.writeText(data.companyAddress); setNotice("Company address copied."); }
    catch { setError("Copy the company address from your browser address bar."); }
  }

  if (!data) return <main className="loading-state"><div className="brand-mark app-photo pulse" style={brandingLogoStyle(currentBranding)} /><p>{error || "Preparing administrator setup…"}</p></main>;
  const active = !data.status.privacy ? 1 : !data.status.branding ? 2 : 3;

  return <main className="administrator-setup-shell">
    <section className="administrator-setup-card">
      <header className="administrator-setup-header">
        <div className="auth-brand"><div className="brand-mark app-photo" style={brandingLogoStyle(currentBranding)} /><div><strong>{currentBranding.appName}</strong><span>Administrator setup</span></div></div>
        <button type="button" className="text-button" onClick={onLogout}>Sign out</button>
      </header>
      <div className="administrator-setup-intro"><p className="eyebrow">WELCOME, {userName.toUpperCase()}</p><h1>Finish your company setup</h1><p>Three short steps, then BB App is ready to use.</p></div>
      <ol className="administrator-setup-progress" aria-label="Administrator setup progress">
        {["Privacy", "Company identity", "Quick start"].map((label, index) => { const done = [data.status.privacy, data.status.branding, data.status.tour][index]; return <li className={done ? "done" : active === index + 1 ? "active" : ""} key={label}><span>{done ? "✓" : index + 1}</span><small>{label}</small></li>; })}
      </ol>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!data.status.privacy && <section className="administrator-setup-step"><p className="eyebrow">STEP 1</p><h2>Confirm privacy</h2><div className="privacy-notice"><p>{data.privacy.text}</p><small>Privacy notice version {data.privacy.version}</small></div><button className="primary" disabled={busy} onClick={() => void acceptPrivacy()}>{busy ? "Saving…" : "I understand and agree"}</button></section>}

      {data.status.privacy && !data.status.branding && <section className="administrator-setup-step"><p className="eyebrow">STEP 2</p><h2>Name your company app</h2><p>The standard BB logo remains in use unless you upload a company logo.</p><form onSubmit={saveBranding}><label>Company name<input name="companyName" required maxLength={100} placeholder="e.g. 1st Example Company" autoFocus /></label><label>Company logo <small>Optional square PNG, JPEG or WebP; maximum 750 KB.</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseLogo(event.target.files?.[0])} /></label><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save company identity"}</button></form></section>}

      {data.status.privacy && data.status.branding && <section className="administrator-setup-step"><p className="eyebrow">STEP 3</p><h2>Your app is ready</h2><p>Review these recommended next steps. They can be completed now or later from the Action Centre.</p><div className="administrator-setup-options">
        <article className={data.optional.schoolCount ? "done" : ""}><span>{data.optional.schoolCount ? "✓" : "1"}</span><div><strong>School directory</strong><small>{data.optional.schoolCount ? `${data.optional.schoolCount} school${data.optional.schoolCount === 1 ? "" : "s"} added` : "Add schools before registering members."}</small></div><button type="button" className="secondary" disabled={busy} onClick={() => void finish("schools")}>{data.optional.schoolCount ? "Review" : "Add schools"}</button></article>
        <article className={data.optional.officerCount ? "done" : ""}><span>{data.optional.officerCount ? "✓" : "2"}</span><div><strong>First Officer</strong><small>{data.optional.officerCount ? `${data.optional.officerCount} Officer account${data.optional.officerCount === 1 ? "" : "s"} created` : "Add a second person who can help operate the app."}</small></div><button type="button" className="secondary" disabled={busy} onClick={() => void finish("accounts")}>{data.optional.officerCount ? "Review" : "Create Officer"}</button></article>
        <article><span>3</span><div><strong>Share the company address</strong><small>{data.companyAddress}</small></div><button type="button" className="secondary" onClick={() => void copyAddress()}>Copy address</button></article>
      </div><button className="primary administrator-setup-finish" disabled={busy} onClick={() => void finish()}>{busy ? "Finishing…" : "Finish and open BB App"}</button></section>}
    </section>
  </main>;
}
