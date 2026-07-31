"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import CustomRoleManager from "./CustomRoleManager";
import AppNavigation from "./AppNavigation";
import OnboardingCentre from "./OnboardingCentre";

type Role = "admin" | "officer" | "nco" | "squad_leader" | "viewer" | "member";
type ManagedUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  squad: string;
  temporary_access_role: string;
  access_expires_at: string | null;
  active: number;
  created_at: string;
  member_section?: "senior" | "junior" | null;
};
type PendingMember = {
  id: number;
  email: string;
  name: string;
  squad: string;
  section: "senior" | "junior";
  created_at: string;
};

export default function AdminCentre({
  currentUser,
  onBack,
  onLogout,
}: {
  currentUser: { id: number; name: string; email: string; role: Role };
  onBack: () => void;
  onLogout: () => void;
}) {
  const readOnly = currentUser.role === "viewer";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resettingUser, setResettingUser] = useState<ManagedUser | null>(null);
  const [pendingAccountMember, setPendingAccountMember] = useState<PendingMember | null>(null);
  const [newRole, setNewRole] = useState<Role>("officer");
  const [newTemporaryAccess, setNewTemporaryAccess] = useState("");
  const [tab, setTab] = useState<"accounts" | "access" | "onboarding">("accounts");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/auth?users=1", { cache: "no-store" });
    const result = (await response.json()) as {
      users?: ManagedUser[];
      pendingMembers?: PendingMember[];
      error?: string;
    };
    if (!response.ok) throw new Error(result.error ?? "Unable to load accounts");
    setUsers(result.users ?? []);
    setPendingMembers(result.pendingMembers ?? []);
  }
  useEffect(() => {
    fetch("/api/auth?users=1", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          users?: ManagedUser[];
          pendingMembers?: PendingMember[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Unable to load accounts");
        setUsers(result.users ?? []);
        setPendingMembers(result.pendingMembers ?? []);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load accounts"));
  }, []);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => !term || `${user.name} ${user.email} ${user.role} ${user.squad}`.toLowerCase().includes(term));
  }, [query, users]);
  const counts = useMemo(() => ({
    active: users.filter((user) => user.active).length,
    disabled: users.filter((user) => !user.active).length,
    members: users.filter((user) => user.role === "member").length,
    staff: users.filter((user) => user.role !== "member").length,
  }), [users]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_user",
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
        squad: form.get("squad"),
        temporaryAccessRole: form.get("temporaryAccessRole"),
        accessExpiresOn: form.get("accessExpiresOn"),
        memberSection: form.get("memberSection"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to create account");
    }
    formElement.reset();
    setNewRole("officer"); setNewTemporaryAccess(""); setPendingAccountMember(null);
    await load();
    setNotice("Account created successfully.");
    setBusy(false);
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_user",
        userId: editingUser.id,
        name: form.get("name"),
        email: form.get("email"),
        role: editingUser.id === currentUser.id ? editingUser.role : form.get("role"),
        squad: form.get("squad"),
        temporaryAccessRole: editingUser.id === currentUser.id ? editingUser.temporary_access_role : form.get("temporaryAccessRole"),
        accessExpiresOn: form.get("accessExpiresOn"),
        memberSection: form.get("memberSection"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to update account");
    }
    setEditingUser(null);
    await load();
    setNotice("Account details and role updated.");
    setBusy(false);
  }

  async function setUserActive(user: ManagedUser) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_user_active", userId: user.id, active: !user.active }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to update account");
    }
    await load();
    setNotice(`Account ${user.active ? "disabled" : "enabled"} successfully.`);
    setBusy(false);
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resettingUser) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset_password",
        userId: resettingUser.id,
        temporaryPassword: form.get("temporaryPassword"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to reset password");
    }
    setResettingUser(null);
    setNotice(
      `${resettingUser.name}'s password was reset. Their existing sessions were signed out.`,
    );
    setBusy(false);
  }

  async function deleteUser(user: ManagedUser) {
    if (!window.confirm(`Delete the login account for ${user.name}? Their member profile, attendance and awards will remain.`)) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_user", userId: user.id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to delete account");
    }
    if (editingUser?.id === user.id) setEditingUser(null);
    await load();
    setNotice("Login account deleted. Member records were preserved.");
    setBusy(false);
  }

  return (
    <main className="admin-centre-shell">
      {notice && <div className="action-toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss confirmation">×</button></div>}
      <AppNavigation
        section="Admin Centre"
        userName={currentUser.name}
        userDescription={readOnly ? "Viewer · read only" : "Administrator"}
        onBack={onBack}
        onLogout={onLogout}
      />
      <section className="admin-centre-page">
        <div className="admin-centre-hero">
          <div><p className="eyebrow">ADMINISTRATION</p><h1>Roles & accounts</h1><p>{readOnly ? "View membership logins, access levels and custom operational roles." : "Manage membership logins, access levels and custom operational roles in one place."}</p></div>
          <label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts" /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="admin-summary">
          <article><span>Active accounts</span><strong>{counts.active}</strong></article>
          <article><span>Disabled</span><strong>{counts.disabled}</strong></article>
          <article><span>Member logins</span><strong>{counts.members}</strong></article>
          <article><span>Staff accounts</span><strong>{counts.staff}</strong></article>
        </div>
        <div className="admin-tabs" role="tablist">
          <button className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}>Membership accounts</button>
          <button className={tab === "access" ? "active" : ""} onClick={() => setTab("access")}>Custom access roles</button>
          <button className={tab === "onboarding" ? "active" : ""} onClick={() => setTab("onboarding")}>Onboarding</button>
        </div>

        {tab === "accounts" ? (
          <div className="admin-account-layout">
            <section className="admin-account-list-panel">
              <div className="request-section-heading"><div><p className="eyebrow">ACCOUNTS</p><h2>Existing users</h2></div><span>{visibleUsers.length}</span></div>
              <div className="admin-account-list">
                {visibleUsers.map((user) => (
                  <article className={!user.active ? "disabled" : ""} key={user.id}>
                    <div className="admin-user-avatar">{user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
                    <div><strong>{user.name}</strong><small>{user.email}</small><span>{user.role.replaceAll("_", " ")}{user.squad ? ` · ${user.squad}` : ""}{!user.active ? " · Disabled" : ""}</span></div>
                    {!readOnly && <div className="admin-account-actions">
                      <button className="text-button" onClick={() => { setResettingUser(null); setEditingUser(user); }}>Edit</button>
                      <button
                        className="text-button"
                        disabled={busy || user.id === currentUser.id}
                        onClick={() => {
                          setEditingUser(null);
                          setResettingUser(user);
                          setError("");
                          setNotice("");
                        }}
                      >
                        Reset password
                      </button>
                      <button disabled={busy || user.id === currentUser.id} className={user.active ? "danger-link" : "text-button"} onClick={() => setUserActive(user)}>{user.active ? "Disable" : "Enable"}</button>
                      <button disabled={busy || user.id === currentUser.id} className="danger-link" onClick={() => deleteUser(user)}>Delete</button>
                    </div>}
                  </article>
                ))}
              </div>
              {pendingMembers.length > 0 && (
                <div className="pending-login-panel">
                  <h3>Members without login accounts</h3>
                  {pendingMembers.map((member) => <article key={member.id}><div><strong>{member.name}</strong><small>{member.email} · {member.section} · {member.squad}</small></div>{!readOnly && <button className="text-button" onClick={() => { setResettingUser(null); setEditingUser(null); setPendingAccountMember(member); setNewRole("member"); setNewTemporaryAccess(""); }}>Create login</button>}</article>)}
                </div>
              )}
            </section>
            <section className="admin-account-editor">
              {readOnly ? (
                <div className="read-only-panel"><p className="eyebrow">READ ONLY</p><h2>Account details are protected</h2><p>Viewer accounts can inspect every account but cannot create, edit, disable, or delete accounts.</p></div>
              ) : resettingUser ? (
                <form key={`reset-${resettingUser.id}`} onSubmit={resetPassword}>
                  <div className="account-section-heading">
                    <div>
                      <p className="eyebrow">PASSWORD RESET</p>
                      <h2>{resettingUser.name}</h2>
                    </div>
                    <button type="button" className="text-button" onClick={() => setResettingUser(null)}>Cancel</button>
                  </div>
                  <p className="account-editor-note">
                    Set a temporary password for this account. The user will be
                    signed out on every device and can replace it after logging
                    in again.
                  </p>
                  <label>
                    New temporary password
                    <input
                      name="temporaryPassword"
                      type="password"
                      minLength={10}
                      required
                      autoComplete="new-password"
                    />
                    <small>At least 10 characters.</small>
                  </label>
                  <button className="primary" disabled={busy}>
                    {busy ? "Resetting…" : "Reset password"}
                  </button>
                </form>
              ) : editingUser ? (
                <form key={editingUser.id} onSubmit={updateUser}>
                  <div className="account-section-heading"><div><p className="eyebrow">EDIT ACCOUNT</p><h2>{editingUser.name}</h2></div><button type="button" className="text-button" onClick={() => setEditingUser(null)}>Cancel</button></div>
                  <label>Name<input name="name" required defaultValue={editingUser.name} /></label>
                  <label>Email<input name="email" type="email" required defaultValue={editingUser.email} /></label>
                  <label>Normal role<select name="role" value={editingUser.role} disabled={editingUser.id === currentUser.id} onChange={(event) => setEditingUser({ ...editingUser, role: event.target.value as Role })}><option value="admin">Administrator</option><option value="officer">Officer</option><option value="nco">NCO</option><option value="squad_leader">Squad Leader</option><option value="viewer">Viewer · full read-only access</option><option value="member">Member</option></select></label>
                  {["nco", "squad_leader", "member"].includes(editingUser.role) && <label>Assigned squad<select name="squad" defaultValue={editingUser.squad || "Alpha"}><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label>}
                  {editingUser.role === "member" && <label>Member section<select name="memberSection" defaultValue={editingUser.member_section ?? "senior"}><option value="senior">Senior</option><option value="junior">Junior</option></select></label>}
                  <label>Temporary access<select name="temporaryAccessRole" value={editingUser.temporary_access_role} disabled={editingUser.id === currentUser.id} onChange={(event) => setEditingUser({ ...editingUser, temporary_access_role: event.target.value, access_expires_at: event.target.value ? editingUser.access_expires_at : null })}><option value="">None</option><option value="temporary_admin">Temporary Admin</option></select></label>
                  {editingUser.temporary_access_role === "temporary_admin" && <label>Access expires on<input name="accessExpiresOn" type="date" required defaultValue={editingUser.access_expires_at?.slice(0, 10) ?? ""} /><small>Access ends at midnight Malaysia time.</small></label>}
                  <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save account changes"}</button>
                </form>
              ) : (
                <form key={pendingAccountMember?.id ?? "new-admin-account"} onSubmit={createUser}>
                  <div className="account-section-heading"><div><p className="eyebrow">NEW LOGIN</p><h2>{pendingAccountMember ? `Create login for ${pendingAccountMember.name}` : "Add an account"}</h2></div>{pendingAccountMember && <button type="button" className="text-button" onClick={() => { setPendingAccountMember(null); setNewRole("officer"); }}>Cancel</button>}</div>
                  <label>Name<input name="name" required readOnly={Boolean(pendingAccountMember)} defaultValue={pendingAccountMember?.name ?? ""} /></label>
                  <label>Email<input name="email" type="email" required readOnly={Boolean(pendingAccountMember)} defaultValue={pendingAccountMember?.email ?? ""} /></label>
                  <label>Temporary password<input name="password" type="password" minLength={10} required /><small>At least 10 characters. The user can change it after signing in.</small></label>
                  <label>Normal role<select name="role" value={newRole} disabled={Boolean(pendingAccountMember)} onChange={(event) => setNewRole(event.target.value as Role)}><option value="admin">Administrator</option><option value="officer">Officer</option><option value="nco">NCO</option><option value="squad_leader">Squad Leader</option><option value="viewer">Viewer · full read-only access</option><option value="member">Member</option></select>{pendingAccountMember && <input type="hidden" name="role" value="member" />}</label>
                  {["nco", "squad_leader", "member"].includes(newRole) && <label>Assigned squad<select name="squad" defaultValue={pendingAccountMember?.squad ?? "Alpha"}><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label>}
                  {newRole === "member" && <label>Member section<select name="memberSection" defaultValue={pendingAccountMember?.section ?? "senior"}><option value="senior">Senior</option><option value="junior">Junior</option></select></label>}
                  <label>Temporary access<select name="temporaryAccessRole" value={newTemporaryAccess} onChange={(event) => setNewTemporaryAccess(event.target.value)}><option value="">None</option><option value="temporary_admin">Temporary Admin</option></select></label>
                  {newTemporaryAccess === "temporary_admin" && <label>Access expires on<input name="accessExpiresOn" type="date" required /></label>}
                  <button className="primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
                </form>
              )}
            </section>
          </div>
        ) : tab === "access" ? (
          <section className="admin-custom-access">
            <CustomRoleManager users={users} readOnly={readOnly} />
          </section>
        ) : (
          <OnboardingCentre currentUser={currentUser} embedded />
        )}
      </section>
    </main>
  );
}
