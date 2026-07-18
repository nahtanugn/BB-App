"use client";

import { FormEvent, useEffect, useState } from "react";
import AwardTracker from "./AwardTracker";

type User = { id: number; email: string; name: string; role: "admin" | "officer" };
type ManagedUser = User & { active: number; created_at: string };
type AuthState = { user: User | null; setupRequired: boolean; adminEmail?: string };

export default function StandaloneApp() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);

  async function refreshAuth() {
    const response = await fetch("/api/auth", { cache: "no-store" });
    const result = (await response.json()) as AuthState & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to check sign-in");
    setAuth(result);
  }

  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as AuthState & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to check sign-in");
        setAuth(result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to check sign-in"));
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = auth?.setupRequired ? "setup" : "login";
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
        setupToken: form.get("setupToken"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to sign in");
    await refreshAuth();
  }

  async function logout() {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setShowAccount(false);
    setAuth((current) => current ? { ...current, user: null } : current);
  }

  async function loadUsers() {
    const response = await fetch("/api/auth?users=1", { cache: "no-store" });
    const result = (await response.json()) as { users?: ManagedUser[]; error?: string };
    if (response.ok) setUsers(result.users ?? []);
  }

  async function openAccount() {
    setShowAccount(true);
    setError("");
    if (auth?.user?.role === "admin") await loadUsers();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_user", name: form.get("name"), email: form.get("email"), password: form.get("password"), role: form.get("role") }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to create officer");
    event.currentTarget.reset();
    setError("");
    await loadUsers();
  }

  async function setUserActive(user: ManagedUser) {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_user_active", userId: user.id, active: !user.active }),
    });
    await loadUsers();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_password", currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to change password");
    event.currentTarget.reset();
    setError("Password updated successfully.");
  }

  if (!auth) return <main className="loading-state"><div className="brand-mark pulse">A</div><p>{error || "Opening Anchor Awards…"}</p></main>;

  if (!auth.user) return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">A</div><div><strong>Anchor Awards</strong><span>Independent officer portal</span></div></div><p className="eyebrow">{auth.setupRequired ? "FIRST-TIME SETUP" : "OFFICER SIGN IN"}</p><h1>{auth.setupRequired ? "Create your administrator account" : "Welcome back."}</h1><p className="auth-copy">{auth.setupRequired ? "Use the one-time setup code supplied during deployment." : "Sign in to manage members, attendance and Senior Section awards."}</p><form onSubmit={submitAuth}>{auth.setupRequired && <label>Your name<input name="name" required autoComplete="name" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" defaultValue={auth.adminEmail ?? ""} readOnly={auth.setupRequired && Boolean(auth.adminEmail)} /></label><label>Password<input name="password" type="password" minLength={10} required autoComplete={auth.setupRequired ? "new-password" : "current-password"} /></label>{auth.setupRequired && <label>One-time setup code<input name="setupToken" type="password" required autoComplete="off" /></label>}{error && <p className="form-error">{error}</p>}<button className="primary auth-submit" disabled={busy}>{busy ? "Please wait…" : auth.setupRequired ? "Create administrator" : "Sign in"}</button></form><small>Private by default · No ChatGPT account required</small></section></main>;

  return <><AwardTracker user={auth.user} onLogout={logout} onManageAccount={openAccount} />{showAccount && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAccount(false)}><section className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">SIGNED IN</p><h2 id="account-title">{auth.user.name}</h2><small>{auth.user.email} · {auth.user.role}</small></div><button onClick={() => setShowAccount(false)} aria-label="Close">×</button></div><div className="account-content"><section><h3>Change my password</h3><form className="inline-form" onSubmit={changePassword}><label>Current password<input name="currentPassword" type="password" required /></label><label>New password<input name="newPassword" type="password" minLength={10} required /></label><button className="primary" disabled={busy}>Update password</button></form></section>{auth.user.role === "admin" && <section><div className="account-section-heading"><div><h3>Officer accounts</h3><p>Create a separate login for each officer.</p></div></div><div className="user-list">{users.map((user) => <div key={user.id}><span><strong>{user.name}</strong><small>{user.email} · {user.role}</small></span><button disabled={user.id === auth.user?.id} className={user.active ? "danger-link" : "text-button"} onClick={() => setUserActive(user)}>{user.active ? "Disable" : "Enable"}</button></div>)}</div><form className="create-user-form" onSubmit={createUser}><h3>Add an officer</h3><div className="form-row"><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label></div><div className="form-row"><label>Temporary password<input name="password" type="password" minLength={10} required /></label><label>Role<select name="role" defaultValue="officer"><option value="officer">Officer</option><option value="admin">Administrator</option></select></label></div><button className="primary" disabled={busy}>Create account</button></form></section>}{error && <p className="form-error">{error}</p>}</div></section></div>}</>;
}
