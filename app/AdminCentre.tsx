"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import CustomRoleManager from "./CustomRoleManager";
import OnboardingCentre from "./OnboardingCentre";
import AuditHistory from "./AuditHistory";
import BrandingSettings from "./BrandingSettings";

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
type JuniorRankReview = { id: number; name: string; rank: string; squad: string; joined_at: string; email: string };
type AdminTab = "accounts" | "access" | "onboarding" | "audit" | "schools" | "branding" | "junior-ranks";

export default function AdminCentre({
  currentUser,
}: {
  currentUser: { id: number; name: string; email: string; role: Role };
  onBack: () => void;
  onLogout: () => void;
}) {
  const readOnly = currentUser.role !== "admin";
  const canReviewJuniorRanks = ["admin", "officer"].includes(currentUser.role);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resettingUser, setResettingUser] = useState<ManagedUser | null>(null);
  const [pendingAccountMember, setPendingAccountMember] = useState<PendingMember | null>(null);
  const [newRole, setNewRole] = useState<Role>("officer");
  const [newTemporaryAccess, setNewTemporaryAccess] = useState("");
  const [tab, setTab] = useState<AdminTab>(currentUser.role === "officer" ? "junior-ranks" : "accounts");
  const [schools, setSchools] = useState<Array<{ id: number; name: string }>>([]);
  const [newSchool, setNewSchool] = useState("");
  const [juniorRankReviews, setJuniorRankReviews] = useState<JuniorRankReview[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [squadFilter, setSquadFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [response, rankResponse, schoolResponse] = await Promise.all([
      currentUser.role === "officer" ? Promise.resolve(null) : fetch("/api/auth?users=1", { cache: "no-store" }),
      canReviewJuniorRanks ? fetch("/api/tracker?juniorRankReview=1", { cache: "no-store" }) : Promise.resolve(null),
      currentUser.role === "admin" ? fetch("/api/schools", { cache: "no-store" }) : Promise.resolve(null),
    ]);
    if (response) {
      const result = (await response.json()) as {
        users?: ManagedUser[];
        pendingMembers?: PendingMember[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Unable to load accounts");
      setUsers(result.users ?? []);
      setPendingMembers(result.pendingMembers ?? []);
    }
    if (rankResponse) {
      const rankResult = (await rankResponse.json()) as { members?: JuniorRankReview[]; error?: string };
      if (!rankResponse.ok) throw new Error(rankResult.error ?? "Unable to load Junior rank review");
      setJuniorRankReviews(rankResult.members ?? []);
    }
    if (schoolResponse) { const result = await schoolResponse.json() as { schools?: Array<{ id: number; name: string }> }; if (schoolResponse.ok) setSchools(result.schools ?? []); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load accounts"));
    }, 0);
    return () => window.clearTimeout(timer);
    // load is intentionally initial-only; role does not change while this centre is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.active) return false;
      if (statusFilter === "disabled" && user.active) return false;
      if (sectionFilter !== "all" && user.member_section !== sectionFilter) return false;
      if (squadFilter !== "all" && user.squad !== squadFilter) return false;
      return !term || `${user.name} ${user.email} ${user.role} ${user.squad}`.toLowerCase().includes(term);
    });
  }, [query, roleFilter, sectionFilter, squadFilter, statusFilter, users]);
  const duplicateEmailCount = useMemo(() => {
    const countsByEmail = new Map<string, number>();
    users.forEach((user) => countsByEmail.set(user.email.trim().toLowerCase(), (countsByEmail.get(user.email.trim().toLowerCase()) ?? 0) + 1));
    return [...countsByEmail.values()].filter((count) => count > 1).length;
  }, [users]);
  const counts = useMemo(() => ({
    active: users.filter((user) => user.active).length,
    disabled: users.filter((user) => !user.active).length,
    members: users.filter((user) => user.role === "member").length,
    staff: users.filter((user) => user.role !== "member").length,
  }), [users]);
  const adminTabOptions: Array<{ value: AdminTab; label: string }> = [
    ...(currentUser.role === "admin" ? [
      { value: "accounts" as const, label: "Membership accounts" },
      { value: "access" as const, label: "Custom access roles" },
      { value: "onboarding" as const, label: "Onboarding" },
      { value: "schools" as const, label: "School directory" },
      { value: "branding" as const, label: "App branding" },
      { value: "audit" as const, label: "Audit history" },
    ] : []),
    ...(canReviewJuniorRanks ? [{ value: "junior-ranks" as const, label: `Junior rank review${juniorRankReviews.length ? ` (${juniorRankReviews.length})` : ""}` }] : []),
  ];

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

  async function reviewJuniorRank(member: JuniorRankReview, rank: string) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/tracker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review_junior_rank", memberId: member.id, rank }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) { setBusy(false); return setError(result.error ?? "Unable to update Junior rank"); }
    await load(); setNotice(`${member.name}'s Junior rank was updated.`); setBusy(false);
  }

  async function addSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/schools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: newSchool }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error ?? "Unable to add school"); setBusy(false); return; }
    setNewSchool(""); await load(); setNotice("School added successfully."); setBusy(false);
  }

  async function archiveSchool(id: number) {
    if (!window.confirm("Archive this school from future member forms? Existing records remain unchanged.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/schools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive", id }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to archive school");
      await load();
      setNotice(result.message ?? "School archived.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to archive school");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-centre-shell">
      {notice && <div className="action-toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss confirmation">×</button></div>}
      <section className="admin-centre-page">
        <div className="admin-centre-hero">
          <div><p className="eyebrow">ADMINISTRATION</p><h1>Accounts and roles</h1><p>{readOnly ? "View member logins, access levels and custom roles." : "Manage member logins, access levels and custom roles in one place."}</p></div>
          <label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts" /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        {currentUser.role === "admin" && <div className="admin-summary">
          <article><span>Active accounts</span><strong>{counts.active}</strong></article>
          <article><span>Disabled</span><strong>{counts.disabled}</strong></article>
          <article><span>Member logins</span><strong>{counts.members}</strong></article>
          <article><span>Staff accounts</span><strong>{counts.staff}</strong></article>
        </div>}
        {currentUser.role === "admin" && <section className="admin-data-quality panel" aria-label="Account data quality">
          <div><p className="eyebrow">DATA QUALITY</p><h2>Needs attention</h2><p>Resolve these account-linking issues before they become workflow problems.</p></div>
          <div className="admin-quality-items"><span><strong>{pendingMembers.length}</strong> members without a login</span><span><strong>{duplicateEmailCount}</strong> duplicate email groups</span><span><strong>{users.filter((user) => user.role === "member" && !user.member_section).length}</strong> unlinked sections</span></div>
        </section>}
        <div className="admin-tabs" role="tablist" aria-label="Administration sections">
          {adminTabOptions.map((option) => <button type="button" role="tab" aria-selected={tab === option.value} className={tab === option.value ? "active" : ""} onClick={() => setTab(option.value)} key={option.value}>{option.label}</button>)}
        </div>
        <label className="admin-mobile-tabs">
          <span>Administration section</span>
          <select value={tab} onChange={(event) => setTab(event.target.value as AdminTab)}>
            {adminTabOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>

        {tab === "branding" ? <BrandingSettings /> : tab === "audit" ? <AuditHistory /> : tab === "schools" ? <section className="panel school-directory"><div className="panel-heading"><div><p className="eyebrow">DATA QUALITY</p><h2>School directory</h2><p>Approved names appear as suggestions in member forms. Existing free-text values are preserved.</p></div><span>{schools.length}</span></div><form onSubmit={addSchool} className="inline-form"><input value={newSchool} onChange={(event) => setNewSchool(event.target.value)} placeholder="e.g. School name" required /><button className="primary" disabled={busy}>{busy ? "Adding…" : "Add school"}</button></form><div className="school-list">{schools.map((school) => <article key={school.id}><strong>{school.name}</strong><button className="danger-link" disabled={busy} onClick={() => void archiveSchool(school.id)}>Archive</button></article>)}</div></section> : tab === "junior-ranks" ? (
          <section className="junior-rank-review panel"><div className="panel-heading"><div><p className="eyebrow">MANUAL REVIEW</p><h2>Junior members needing a rank</h2><p>These members remain unchanged until you choose their correct Junior rank.</p></div><span>{juniorRankReviews.length}</span></div>{juniorRankReviews.map((member) => <article key={member.id}><div><strong>{member.name}</strong><small>{member.squad} · joined {member.joined_at} · {member.email}</small></div><select defaultValue="Pre-Junior" aria-label={`Choose rank for ${member.name}`}><option>Pre-Junior</option><option>Junior</option><option>Assistant Leading Boy</option><option>Leading Boy</option><option>Chief Leading Boy</option></select><button className="primary" disabled={busy} onClick={(event) => reviewJuniorRank(member, (event.currentTarget.previousElementSibling as HTMLSelectElement).value)}>Save rank</button></article>)}{!juniorRankReviews.length && <div className="operations-empty"><span>✓</span><h2>All Junior ranks are reviewed</h2><p>No Junior member remains recorded as Private.</p></div>}</section>
        ) : tab === "accounts" ? (
          <div className="admin-account-layout">
            <section className="admin-account-list-panel">
              <div className="admin-filter-bar" aria-label="Filter accounts">
                <label>Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option><option value="admin">Administrator</option><option value="officer">Officer</option><option value="nco">NCO</option><option value="squad_leader">Squad Leader</option><option value="viewer">Viewer</option><option value="member">Member</option></select></label>
                <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active only</option><option value="all">All statuses</option><option value="disabled">Disabled only</option></select></label>
                <label>Section<select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}><option value="all">All sections</option><option value="senior">Senior</option><option value="junior">Junior</option></select></label>
                <label>Squad<select value={squadFilter} onChange={(event) => setSquadFilter(event.target.value)}><option value="all">All squads</option><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label>
              </div>
              <div className="request-section-heading"><div><p className="eyebrow">ACCOUNTS</p><h2>Existing users</h2><p>{statusFilter === "active" ? "Active accounts" : "All account records"} · use filters to find a person quickly.</p></div><span>{visibleUsers.length}</span></div>
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
                <form className="account-create-form" key={pendingAccountMember?.id ?? "new-admin-account"} onSubmit={createUser}>
                  <div className="account-section-heading"><div><p className="eyebrow">NEW LOGIN</p><h2>{pendingAccountMember ? `Create login for ${pendingAccountMember.name}` : "Add an account"}</h2></div>{pendingAccountMember && <button type="button" className="text-button" onClick={() => { setPendingAccountMember(null); setNewRole("officer"); }}>Cancel</button>}</div>
                  <p className="account-editor-note">Create a secure login, choose the person’s normal app role, then add temporary access only when it is needed.</p>
                  <div className="account-form-group">
                    <p>Login details</p>
                    <div className="account-field-grid">
                      <label>Name<input name="name" required readOnly={Boolean(pendingAccountMember)} defaultValue={pendingAccountMember?.name ?? ""} placeholder="Full name" /></label>
                      <label>Email<input name="email" type="email" required readOnly={Boolean(pendingAccountMember)} defaultValue={pendingAccountMember?.email ?? ""} placeholder="name@example.com" /></label>
                    </div>
                    <label>Temporary password<input name="password" type="password" minLength={10} required autoComplete="new-password" placeholder="At least 10 characters" /><small>The person will be asked to change this after their first sign-in.</small></label>
                  </div>
                  <div className="account-form-group">
                    <p>Access</p>
                    <div className="account-field-grid">
                      <label>Normal role<select name="role" value={newRole} disabled={Boolean(pendingAccountMember)} onChange={(event) => setNewRole(event.target.value as Role)}><option value="admin">Administrator</option><option value="officer">Officer</option><option value="nco">NCO</option><option value="squad_leader">Squad Leader</option><option value="viewer">Viewer · full read-only access</option><option value="member">Member</option></select>{pendingAccountMember && <input type="hidden" name="role" value="member" />}</label>
                      <label>Temporary access<select name="temporaryAccessRole" value={newTemporaryAccess} onChange={(event) => setNewTemporaryAccess(event.target.value)}><option value="">None</option><option value="temporary_admin">Temporary Admin</option></select><small>Optional extra access; the normal role stays unchanged.</small></label>
                    </div>
                    {["nco", "squad_leader", "member"].includes(newRole) && <label>Assigned squad<select name="squad" defaultValue={pendingAccountMember?.squad ?? "Alpha"}><option>Alpha</option><option>Bravo</option><option>Charlie</option><option>Delta</option></select></label>}
                    {newRole === "member" && <label>Member section<select name="memberSection" defaultValue={pendingAccountMember?.section ?? "senior"}><option value="senior">Senior</option><option value="junior">Junior</option></select></label>}
                    {newTemporaryAccess === "temporary_admin" && <label>Access expires on<input name="accessExpiresOn" type="date" required /></label>}
                  </div>
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
