"use client";

import { FormEvent, useEffect, useState } from "react";

type UserOption = { id: number; name: string; email: string };
type Role = { id: number; name: string; color: string; description: string; permissions: string };
type Assignment = { user_id: number; role_id: number; expires_at: string | null; user_name: string; email: string; role_name: string; color: string };

const permissionOptions = [
  ["stock.view_uniform", "View uniform stock"],
  ["stock.manage_uniform", "Receive & return uniforms"],
  ["stock.issue_uniform", "Issue uniforms"],
  ["stock.view_awards", "View award stock"],
  ["stock.manage_awards", "Receive & return awards"],
  ["stock.issue_awards", "Issue awards"],
  ["stock.adjust", "Adjust stock & add catalogue items"],
  ["stock.view_history", "View transaction history"],
  ["stock.export", "Export stock data"],
  ["stock.manage_uniform_requests", "Review and issue uniform requests"],
] as const;

export default function CustomRoleManager({
  users,
  readOnly = false,
}: {
  users: UserOption[];
  readOnly?: boolean;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/stock", { cache: "no-store" });
    const result = (await response.json()) as { roles?: Role[]; assignments?: Assignment[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load custom roles");
    setRoles(result.roles ?? []);
    setAssignments(result.assignments ?? []);
  }
  useEffect(() => {
    fetch("/api/stock", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { roles?: Role[]; assignments?: Assignment[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load custom roles");
        setRoles(result.roles ?? []);
        setAssignments(result.assignments ?? []);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load custom roles"));
  }, []);

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: editing ? "update_role" : "create_role",
      roleId: editing?.id,
      name: form.get("name"), color: form.get("color"), description: form.get("description"),
      permissions: form.getAll("permissions"),
    }) });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to save role");
    event.currentTarget.reset(); setEditing(null); await load();
    setNotice(editing ? "Custom role updated." : "Custom role created.");
  }
  async function assignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "assign_role", userId: form.get("userId"), roleId: form.get("roleId"), expiresOn: form.get("expiresOn"),
    }) });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to assign role");
    event.currentTarget.reset(); await load(); setNotice("Custom role assigned.");
  }
  async function removeAssignment(assignment: Assignment) {
    await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove_role", userId: assignment.user_id, roleId: assignment.role_id }) });
    await load(); setNotice("Custom role removed from account.");
  }
  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete the custom role “${role.name}”? All assignments to it will also be removed.`)) return;
    await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_role", roleId: role.id }) });
    if (editing?.id === role.id) setEditing(null);
    await load(); setNotice("Custom role deleted.");
  }

  const editingPermissions = (() => {
    try { return editing ? JSON.parse(editing.permissions) as string[] : []; } catch { return []; }
  })();
  return (
    <section className="custom-role-manager">
      <div className="account-section-heading"><div><h3>Custom access roles</h3><p>Create Discord-style additional roles, then assign any number of them to an account. These roles control the Stock Centre without changing the person’s normal app role.</p></div></div>
      {notice && <p className="form-success">{notice}</p>}{error && <p className="form-error">{error}</p>}
      <div className="custom-role-layout">
        <div>
          <h4>Roles</h4>
          <div className="role-list">
            {roles.map((role) => (
              <article key={role.id}>
                <span className="role-color" style={{ backgroundColor: role.color }} />
                <div><strong>{role.name}</strong><small>{role.description || "No description"}</small></div>
                {!readOnly && <button className="text-button" onClick={() => setEditing(role)}>Edit</button>}
                {!readOnly && <button className="danger-link" onClick={() => deleteRole(role)}>Delete</button>}
              </article>
            ))}
            {!roles.length && <p className="empty-inline">No custom roles yet.</p>}
          </div>
          {!readOnly && <form key={editing?.id ?? "new-role"} className="role-form" onSubmit={saveRole}>
            <h4>{editing ? `Edit ${editing.name}` : "Create a role"}</h4>
            <div className="form-row"><label>Role name<input name="name" required defaultValue={editing?.name ?? ""} placeholder="e.g. Quartermaster" /></label><label>Colour<input name="color" type="color" defaultValue={editing?.color ?? "#2878d4"} /></label></div>
            <label>Description<input name="description" defaultValue={editing?.description ?? ""} placeholder="What this role is responsible for" /></label>
            <fieldset className="permission-grid"><legend>Permissions</legend>{permissionOptions.map(([value, label]) => <label key={`${editing?.id ?? "new"}-${value}`}><input type="checkbox" name="permissions" value={value} defaultChecked={editingPermissions.includes(value)} /><span>{label}</span></label>)}</fieldset>
            <div className="role-form-actions">{editing && <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>}<button className="primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save role" : "Create role"}</button></div>
          </form>}
        </div>
        <div>
          <h4>Assignments</h4>
          <div className="assignment-list">
            {assignments.map((assignment) => <article key={`${assignment.user_id}-${assignment.role_id}`}><span className="role-color" style={{ backgroundColor: assignment.color }} /><div><strong>{assignment.user_name}</strong><small>{assignment.role_name}{assignment.expires_at ? ` · until ${new Date(assignment.expires_at).toLocaleDateString("en-MY")}` : " · no expiry"}</small></div>{!readOnly && <button className="danger-link" onClick={() => removeAssignment(assignment)}>Remove</button>}</article>)}
            {!assignments.length && <p className="empty-inline">No custom role assignments yet.</p>}
          </div>
          {!readOnly && <form className="role-form" onSubmit={assignRole}>
            <h4>Assign a role</h4>
            <label>Account<select name="userId" required defaultValue=""><option value="" disabled>Select an account</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name} · {user.email}</option>)}</select></label>
            <label>Custom role<select name="roleId" required defaultValue=""><option value="" disabled>Select a role</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
            <label>Expires on (optional)<input name="expiresOn" type="date" /><small>Leave blank for ongoing access.</small></label>
            <button className="primary" disabled={busy || !roles.length}>{busy ? "Assigning…" : "Assign role"}</button>
          </form>}
        </div>
      </div>
    </section>
  );
}
