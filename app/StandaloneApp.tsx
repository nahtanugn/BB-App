"use client";

import { FormEvent, useEffect, useState } from "react";
import AwardTracker from "./AwardTracker";
import ResourceLibrary from "./ResourceLibrary";
import SubmissionsPage from "./SubmissionsPage";

type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "officer" | "nco" | "squad_leader" | "member";
  squad: string;
};
type ManagedUser = User & { active: number; created_at: string };
type PendingMember = {
  id: number;
  email: string;
  name: string;
  squad: string;
  section: "senior" | "junior";
  created_at: string;
};
type AuthState = {
  user: User | null;
  setupRequired: boolean;
  adminEmail?: string;
};

export default function StandaloneApp() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissionSection, setSubmissionSection] = useState<
    "senior" | "junior"
  >("senior");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingAccountMember, setPendingAccountMember] =
    useState<PendingMember | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [newUserRole, setNewUserRole] = useState<User["role"]>("officer");

  async function refreshAuth() {
    const response = await fetch("/api/auth", { cache: "no-store" });
    const result = (await response.json()) as AuthState & { error?: string };
    if (!response.ok)
      throw new Error(result.error ?? "Unable to check sign-in");
    setAuth(result);
  }

  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as AuthState & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Unable to check sign-in");
        setAuth(result);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to check sign-in",
        ),
      );
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
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setShowAccount(false);
    setShowResources(false);
    setShowSubmissions(false);
    setAuth((current) => (current ? { ...current, user: null } : current));
  }

  async function loadUsers() {
    const response = await fetch("/api/auth?users=1", { cache: "no-store" });
    const result = (await response.json()) as {
      users?: ManagedUser[];
      pendingMembers?: PendingMember[];
      error?: string;
    };
    if (response.ok) {
      setUsers(result.users ?? []);
      setPendingMembers(result.pendingMembers ?? []);
    }
  }

  async function openAccount() {
    setShowAccount(true);
    setEditingUser(null);
    setPendingAccountMember(null);
    setError("");
    setNotice("");
    if (auth?.user?.role === "admin") await loadUsers();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
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
        memberSection: form.get("memberSection"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok)
      return setError(result.error ?? "Unable to create account");
    event.currentTarget.reset();
    setNewUserRole("officer");
    setPendingAccountMember(null);
    setError("");
    await loadUsers();
    setNotice("Account created successfully.");
  }

  async function setUserActive(user: ManagedUser) {
    setNotice("");
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_user_active",
        userId: user.id,
        active: !user.active,
      }),
    });
    await loadUsers();
    setNotice(`Account ${user.active ? "disabled" : "enabled"} successfully.`);
  }

  async function deleteUser(user: ManagedUser) {
    if (
      !window.confirm(
        `Delete the login account for ${user.name}? Their member profile, attendance, and awards will be preserved.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_user", userId: user.id }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok)
      return setError(result.error ?? "Unable to delete account");
    if (editingUser?.id === user.id) setEditingUser(null);
    await loadUsers();
    setNotice("Account deleted successfully. Member records were preserved.");
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_user",
        userId: editingUser.id,
        name: form.get("name"),
        email: form.get("email"),
        role:
          editingUser.id === auth?.user?.id
            ? editingUser.role
            : form.get("role"),
        squad: form.get("squad"),
        memberSection: form.get("memberSection"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok)
      return setError(result.error ?? "Unable to update account");
    const editedCurrentUser = editingUser.id === auth?.user?.id;
    setEditingUser(null);
    await loadUsers();
    if (editedCurrentUser) await refreshAuth();
    setNotice("Account updated successfully.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_password",
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok)
      return setError(result.error ?? "Unable to change password");
    event.currentTarget.reset();
    setNotice("Password updated successfully.");
  }

  if (!auth)
    return (
      <main className="loading-state">
        <div className="brand-mark pulse">A</div>
        <p>{error || "Opening 11KCHBB App…"}</p>
      </main>
    );

  if (!auth.user)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark">A</div>
            <div>
              <strong>11KCHBB App</strong>
              <span>Company portal</span>
            </div>
          </div>
          <p className="eyebrow">
            {auth.setupRequired ? "FIRST-TIME SETUP" : "ACCOUNT SIGN IN"}
          </p>
          <h1>
            {auth.setupRequired
              ? "Create your administrator account"
              : "Welcome back."}
          </h1>
          <p className="auth-copy">
            {auth.setupRequired
              ? "Use the one-time setup code supplied during deployment."
              : "Sign in to open the areas available to your account."}
          </p>
          <form onSubmit={submitAuth}>
            {auth.setupRequired && (
              <label>
                Your name
                <input name="name" required autoComplete="name" />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={auth.adminEmail ?? ""}
                readOnly={auth.setupRequired && Boolean(auth.adminEmail)}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={10}
                required
                autoComplete={
                  auth.setupRequired ? "new-password" : "current-password"
                }
              />
            </label>
            {auth.setupRequired && (
              <label>
                One-time setup code
                <input
                  name="setupToken"
                  type="password"
                  required
                  autoComplete="off"
                />
              </label>
            )}
            {error && <p className="form-error">{error}</p>}
            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : auth.setupRequired
                  ? "Create administrator"
                  : "Sign in"}
            </button>
          </form>
          <small>Private by default · No ChatGPT account required</small>
        </section>
      </main>
    );

  if (showSubmissions)
    return (
      <SubmissionsPage
        user={auth.user}
        initialSection={submissionSection}
        onLogout={logout}
        onBack={() => setShowSubmissions(false)}
      />
    );

  if (auth.user.role === "member" || showResources)
    return (
      <>
        <ResourceLibrary
          user={auth.user}
          onLogout={logout}
          onOpenSubmissions={
            auth.user.role === "member"
              ? () => setShowSubmissions(true)
              : undefined
          }
          onManageAccount={
            auth.user.role === "member" ? openAccount : undefined
          }
          onBack={
            auth.user.role === "member"
              ? undefined
              : () => setShowResources(false)
          }
        />
        {auth.user.role === "member" && showAccount && (
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={() => setShowAccount(false)}
          >
            <section
              className="modal account-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="member-password-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-heading">
                <div>
                  <p className="eyebrow">MY ACCOUNT</p>
                  <h2 id="member-password-title">Change password</h2>
                  <small>{auth.user.email}</small>
                </div>
                <button
                  onClick={() => setShowAccount(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="account-content">
                <section>
                  <p>
                    Replace the temporary password with a private password of
                    at least 10 characters.
                  </p>
                  <form className="inline-form" onSubmit={changePassword}>
                    <label>
                      Current or temporary password
                      <input
                        name="currentPassword"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </label>
                    <label>
                      New password
                      <input
                        name="newPassword"
                        type="password"
                        minLength={10}
                        required
                        autoComplete="new-password"
                      />
                    </label>
                    <button className="primary" disabled={busy}>
                      {busy ? "Updating…" : "Update password"}
                    </button>
                  </form>
                  {notice && (
                    <p className="form-success account-notice" role="status">
                      {notice}
                    </p>
                  )}
                  {error && <p className="form-error">{error}</p>}
                </section>
              </div>
            </section>
          </div>
        )}
      </>
    );

  return (
    <>
      <AwardTracker
        user={auth.user}
        onLogout={logout}
        onManageAccount={openAccount}
        onOpenResources={() => setShowResources(true)}
        onOpenSubmissions={(section) => {
          setSubmissionSection(section);
          setShowSubmissions(true);
        }}
      />
      {showAccount && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowAccount(false)}
        >
          <section
            className="modal account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">SIGNED IN</p>
                <h2 id="account-title">{auth.user.name}</h2>
                <small>
                  {auth.user.email} · {auth.user.role}
                </small>
              </div>
              <button onClick={() => setShowAccount(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="account-content">
              <section>
                <h3>Change my password</h3>
                <form className="inline-form" onSubmit={changePassword}>
                  <label>
                    Current password
                    <input name="currentPassword" type="password" required />
                  </label>
                  <label>
                    New password
                    <input
                      name="newPassword"
                      type="password"
                      minLength={10}
                      required
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Update password
                  </button>
                </form>
              </section>
              {auth.user.role === "admin" && (
                <section>
                  <div className="account-section-heading">
                    <div>
                      <h3>User accounts</h3>
                      <p>
                        Create accounts or edit existing names, emails and
                        roles.
                      </p>
                    </div>
                  </div>
                  <div className="user-list">
                    {users.map((user) => (
                      <div key={user.id}>
                        <span>
                          <strong>{user.name}</strong>
                          <small>
                            {user.email} · {user.role}
                            {["nco", "squad_leader", "member"].includes(
                              user.role,
                            ) &&
                            user.squad
                              ? ` · ${user.squad}`
                              : ""}
                          </small>
                        </span>
                        <div className="user-actions">
                          <button
                            className="text-button"
                            onClick={() => setEditingUser(user)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={user.id === auth.user?.id}
                            className={
                              user.active ? "danger-link" : "text-button"
                            }
                            onClick={() => setUserActive(user)}
                          >
                            {user.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            disabled={user.id === auth.user?.id || busy}
                            className="danger-link"
                            onClick={() => deleteUser(user)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingMembers.map((member) => (
                      <div key={`pending-member-${member.id}`}>
                        <span>
                          <strong>{member.name}</strong>
                          <small>
                            {member.email} · Member · {member.squad} · Login not
                            created
                          </small>
                        </span>
                        <div className="user-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setPendingAccountMember(member);
                              setNewUserRole("member");
                            }}
                          >
                            Create login
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {editingUser && (
                    <form
                      key={editingUser.id}
                      className="create-user-form edit-user-form"
                      onSubmit={updateUser}
                    >
                      <div className="account-section-heading">
                        <h3>Edit account</h3>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setEditingUser(null)}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="form-row">
                        <label>
                          Name
                          <input
                            name="name"
                            required
                            defaultValue={editingUser.name}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            name="email"
                            type="email"
                            required
                            defaultValue={editingUser.email}
                          />
                        </label>
                      </div>
                      <label>
                        Role
                        <select
                          name="role"
                          value={editingUser.role}
                          onChange={(event) =>
                            setEditingUser({
                              ...editingUser,
                              role: event.target.value as User["role"],
                            })
                          }
                          disabled={editingUser.id === auth.user?.id}
                        >
                          <option value="officer">Officer</option>
                          <option value="nco">
                            NCO · attendance & member details
                          </option>
                          <option value="squad_leader">
                            Squad Leader · full view & NCO controls
                          </option>
                          <option value="member">
                            Member · resources only
                          </option>
                          <option value="admin">Administrator</option>
                        </select>
                      </label>
                      {["nco", "squad_leader", "member"].includes(
                        editingUser.role,
                      ) && (
                        <label>
                          Assigned squad
                          <select
                            name="squad"
                            defaultValue={editingUser.squad || "Alpha"}
                          >
                            <option>Alpha</option>
                            <option>Bravo</option>
                            <option>Charlie</option>
                            <option>Delta</option>
                          </select>
                        </label>
                      )}
                      {editingUser.role === "member" && (
                        <label>
                          Member section
                          <select name="memberSection" defaultValue="senior">
                            <option value="senior">Senior</option>
                            <option value="junior">Junior</option>
                          </select>
                        </label>
                      )}
                      {editingUser.id === auth.user?.id && (
                        <small>
                          Your administrator role cannot be changed while you
                          are signed in.
                        </small>
                      )}
                      <button className="primary" disabled={busy}>
                        {busy ? "Saving…" : "Save changes"}
                      </button>
                    </form>
                  )}
                  <form
                    key={pendingAccountMember?.id ?? "new-account"}
                    className="create-user-form"
                    onSubmit={createUser}
                  >
                    <div className="account-section-heading">
                      <div>
                        <h3>
                          {pendingAccountMember
                            ? `Create login for ${pendingAccountMember.name}`
                            : "Add an account"}
                        </h3>
                        {pendingAccountMember && (
                          <p>
                            Set a temporary password to activate this member’s
                            login.
                          </p>
                        )}
                      </div>
                      {pendingAccountMember && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setPendingAccountMember(null);
                            setNewUserRole("officer");
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <div className="form-row">
                      <label>
                        Name
                        <input
                          name="name"
                          required
                          readOnly={Boolean(pendingAccountMember)}
                          defaultValue={pendingAccountMember?.name ?? ""}
                        />
                      </label>
                      <label>
                        Email
                        <input
                          name="email"
                          type="email"
                          required
                          readOnly={Boolean(pendingAccountMember)}
                          defaultValue={pendingAccountMember?.email ?? ""}
                        />
                      </label>
                    </div>
                    <div className="form-row">
                      <label>
                        Temporary password
                        <input
                          name="password"
                          type="password"
                          minLength={10}
                          required
                        />
                      </label>
                      <label>
                        Role
                        <select
                          name="role"
                          value={newUserRole}
                          disabled={Boolean(pendingAccountMember)}
                          onChange={(event) =>
                            setNewUserRole(event.target.value as User["role"])
                          }
                        >
                          <option value="officer">Officer</option>
                          <option value="nco">
                            NCO · attendance & member details
                          </option>
                          <option value="squad_leader">
                            Squad Leader · full view & NCO controls
                          </option>
                          <option value="member">
                            Member · resources only
                          </option>
                          <option value="admin">Administrator</option>
                        </select>
                        {pendingAccountMember && (
                          <input type="hidden" name="role" value="member" />
                        )}
                      </label>
                    </div>
                    {["nco", "squad_leader", "member"].includes(
                      newUserRole,
                    ) && (
                      <label>
                        Assigned squad
                        <select
                          name="squad"
                          defaultValue={pendingAccountMember?.squad ?? "Alpha"}
                        >
                          <option>Alpha</option>
                          <option>Bravo</option>
                          <option>Charlie</option>
                          <option>Delta</option>
                        </select>
                      </label>
                    )}
                    {newUserRole === "member" && (
                      <label>
                        Member section
                        <select
                          name="memberSection"
                          defaultValue={
                            pendingAccountMember?.section ?? "senior"
                          }
                        >
                          <option value="senior">Senior</option>
                          <option value="junior">Junior</option>
                        </select>
                      </label>
                    )}
                    <button className="primary" disabled={busy}>
                      {busy
                        ? "Creating…"
                        : pendingAccountMember
                          ? "Create member login"
                          : "Create account"}
                    </button>
                  </form>
                </section>
              )}
              {notice && (
                <p className="form-success account-notice" role="status">
                  {notice}
                </p>
              )}
              {error && <p className="form-error">{error}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
