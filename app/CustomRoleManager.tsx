"use client";

import { FormEvent, useEffect, useState } from "react";

type UserOption = { id: number; name: string; email: string };
type Role = { id: number; name: string; color: string; description: string; permissions: string };
type Assignment = { user_id: number; role_id: number; expires_at: string | null; user_name: string; email: string; role_name: string; color: string };

const permissionGroups = [
  {
    title: "Members",
    description: "Member directory and profile records",
    options: [
      ["members.view", "View all member details"],
      ["members.create", "Add members"],
      ["members.edit", "Edit member details"],
      ["members.delete", "Delete members"],
    ],
  },
  {
    title: "Attendance",
    description: "Meeting dates and parade registers",
    options: [
      ["attendance.view", "View attendance"],
      ["attendance.manage", "Create meetings and update attendance"],
    ],
  },
  {
    title: "Awards & submissions",
    description: "Award records and member applications",
    options: [
      ["awards.view", "View award matrix"],
      ["awards.manage", "Update member awards"],
      ["submissions.view", "View award submissions"],
      ["submissions.review", "Approve or reject submissions"],
    ],
  },
  {
    title: "Subscriptions",
    description: "Company and band payment registers",
    options: [
      ["subscriptions.company.view", "View company subscriptions"],
      ["subscriptions.company.manage", "Update company subscriptions"],
      ["subscriptions.band.view", "View band subscriptions"],
      ["subscriptions.band.manage", "Update band subscriptions"],
    ],
  },
  {
    title: "Resources & announcements",
    description: "Shared information for the company",
    options: [
      ["resources.view_all", "View all resource levels"],
      ["resources.manage", "Add and delete resources"],
      ["announcements.publish", "Publish announcements"],
      ["announcements.manage", "Manage announcements"],
      ["exports.full", "Export all company data"],
    ],
  },
  {
    title: "Uniform store",
    description: "Uniform stock and member requests",
    options: [
      ["stock.view_uniform", "View uniform stock"],
      ["stock.manage_uniform", "Receive and return uniforms"],
      ["stock.issue_uniform", "Issue uniforms"],
      ["stock.manage_uniform_requests", "Review and issue uniform requests"],
    ],
  },
  {
    title: "Award store",
    description: "Award stock and distribution",
    options: [
      ["stock.view_awards", "View award stock"],
      ["stock.manage_awards", "Receive and return awards"],
      ["stock.issue_awards", "Issue awards"],
    ],
  },
  {
    title: "Stock administration",
    description: "Catalogue, records and exports",
    options: [
      ["stock.adjust", "Adjust stock and add catalogue items"],
      ["stock.view_history", "View transaction history"],
      ["stock.export", "Export stock data"],
    ],
  },
  {
    title: "Programme operations",
    description: "Parade plans, duty rosters and event committees",
    options: [
      ["programme.plans.manage", "Manage parade plans and templates"],
      ["programme.rosters.manage", "Manage duty rosters"],
      ["programme.committees.manage", "Manage event committees and tasks"],
    ],
  },
  {
    title: "Leave, promotion & service",
    description: "Progress reviews with separate squad and final authority",
    options: [
      ["leave.review_squad", "Confirm squad leave requests"],
      ["leave.approve", "Give final leave decisions"],
      ["promotion.rules.manage", "Configure promotion requirements"],
      ["promotion.review", "Review readiness and record promotion decisions"],
      ["service.verify_squad", "Confirm squad service hours"],
      ["service.approve", "Give final service-hour approval"],
    ],
  },
  {
    title: "Band Centre",
    description: "Band members, instruments and programme",
    options: [
      ["band.view", "View Band Centre"],
      ["band.manage_profiles", "Manage band profiles"],
      ["band.manage_instruments", "Issue, return and maintain instruments"],
      ["band.manage_programme", "Manage rehearsals, performances and assessments"],
    ],
  },
  {
    title: "President’s Badge",
    description: "Sensitive application preparation, endorsement and external outcomes",
    options: [
      ["presidents_badge.manage", "Prepare applications"],
      ["presidents_badge.endorse", "Complete Captain endorsement"],
      ["presidents_badge.outcome", "Record BBM outcomes"],
      ["presidents_badge.view_sensitive", "View another member’s sensitive application files"],
    ],
  },
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const wasEditing = Boolean(editing);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: editing ? "update_role" : "create_role",
      roleId: editing?.id,
      name: form.get("name"), color: form.get("color"), description: form.get("description"),
      permissions: form.getAll("permissions"),
    }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to save role");
    }
    formElement.reset(); setEditing(null); await load();
    setNotice(wasEditing ? "Custom role updated." : "Custom role created.");
    setBusy(false);
  }
  async function assignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "assign_role", userId: form.get("userId"), roleId: form.get("roleId"), expiresOn: form.get("expiresOn"),
    }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to assign role");
    }
    formElement.reset(); await load(); setNotice("Custom role assigned.");
    setBusy(false);
  }
  async function removeAssignment(assignment: Assignment) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove_role", userId: assignment.user_id, roleId: assignment.role_id }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to remove custom role");
    }
    await load(); setNotice("Custom role removed from account."); setBusy(false);
  }
  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete the custom role “${role.name}”? All assignments to it will also be removed.`)) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_role", roleId: role.id }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to delete custom role");
    }
    if (editing?.id === role.id) setEditing(null);
    await load(); setNotice("Custom role deleted."); setBusy(false);
  }

  const editingPermissions = (() => {
    try { return editing ? JSON.parse(editing.permissions) as string[] : []; } catch { return []; }
  })();
  return (
    <section className="custom-role-manager">
      <div className="custom-role-intro">
        <div>
          <p className="eyebrow">ADDITIONAL ACCESS</p>
          <h2>Custom access roles</h2>
          <p>Create a role with only the permissions it needs, then assign it to one or more accounts. A person’s normal app role will not change.</p>
        </div>
        <div className="custom-role-summary" aria-label="Custom role summary">
          <article><strong>{roles.length}</strong><span>Roles</span></article>
          <article><strong>{assignments.length}</strong><span>Assignments</span></article>
        </div>
      </div>
      {notice && <p className="form-success">{notice}</p>}{error && <p className="form-error">{error}</p>}
      <div className="custom-role-layout">
        <section className="custom-role-column">
          <div className="custom-role-section-heading">
            <span className="custom-role-step">1</span>
            <div><h3>Create access roles</h3><p>Choose what each operational role is allowed to do.</p></div>
          </div>
          <div className="role-list">
            {roles.map((role) => (
              <article key={role.id}>
                <span className="role-color" style={{ backgroundColor: role.color }} />
                <div className="role-list-copy">
                  <strong>{role.name}</strong>
                  <small className="helper-text">{role.description || "No description provided"}</small>
                  <span>{(() => { try { return `${(JSON.parse(role.permissions) as string[]).length} permissions`; } catch { return "0 permissions"; } })()}</span>
                </div>
                {!readOnly && <div className="role-card-actions"><button className="text-button" disabled={busy} onClick={() => setEditing(role)}>Edit</button><button className="danger-link" disabled={busy} onClick={() => deleteRole(role)}>Delete</button></div>}
              </article>
            ))}
            {!roles.length && <div className="custom-role-empty"><span>+</span><strong>No custom roles yet</strong><p>Create your first role below.</p></div>}
          </div>
          {!readOnly && <form key={editing?.id ?? "new-role"} className="role-form" onSubmit={saveRole}>
            <div className="role-form-heading"><div><p className="eyebrow">{editing ? "EDIT ROLE" : "NEW ROLE"}</p><h3>{editing ? editing.name : "Role details"}</h3></div>{editing && <button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button>}</div>
            <div className="role-form-fields">
              <label>Role name<input name="name" required defaultValue={editing?.name ?? ""} placeholder="e.g. Quartermaster" /></label>
              <label className="role-colour-field">Role colour<span><input name="color" type="color" defaultValue={editing?.color ?? "#2878d4"} /><small className="helper-text">Used to identify this role</small></span></label>
            </div>
            <label>Description<input name="description" defaultValue={editing?.description ?? ""} placeholder="What this role is responsible for" /></label>
            <fieldset className="permission-grid">
              <legend>Choose permissions</legend>
              {permissionGroups.map((group) => (
                <section className="permission-group" key={group.title}>
                  <div><strong>{group.title}</strong><small className="helper-text">{group.description}</small></div>
                  <div>{group.options.map(([value, label]) => <label key={`${editing?.id ?? "new"}-${value}`}><input type="checkbox" name="permissions" value={value} defaultChecked={editingPermissions.includes(value)} /><span>{label}</span></label>)}</div>
                </section>
              ))}
            </fieldset>
            <div className="role-form-actions">{editing && <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>}<button className="primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save role" : "Create role"}</button></div>
          </form>}
        </section>
        <section className="custom-role-column">
          <div className="custom-role-section-heading">
            <span className="custom-role-step">2</span>
            <div><h3>Assign roles</h3><p>Give an account additional access, with an optional expiry date.</p></div>
          </div>
          <div className="assignment-list">
            {assignments.map((assignment) => <article key={`${assignment.user_id}-${assignment.role_id}`}><span className="role-color" style={{ backgroundColor: assignment.color }} /><div className="role-list-copy"><strong>{assignment.user_name}</strong><small>{assignment.email}</small><span>{assignment.role_name} · {assignment.expires_at ? `expires ${new Date(assignment.expires_at).toLocaleDateString("en-MY")}` : "ongoing access"}</span></div>{!readOnly && <button className="danger-link" disabled={busy} onClick={() => removeAssignment(assignment)}>Remove</button>}</article>)}
            {!assignments.length && <div className="custom-role-empty"><span>↗</span><strong>No assignments yet</strong><p>Assign a role after creating one.</p></div>}
          </div>
          {!readOnly && <form className="role-form assignment-form" onSubmit={assignRole}>
            <div className="role-form-heading"><div><p className="eyebrow">NEW ASSIGNMENT</p><h3>Grant additional access</h3></div></div>
            <label>Account<select name="userId" required defaultValue=""><option value="" disabled>Select an account</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name} · {user.email}</option>)}</select></label>
            <label>Custom role<select name="roleId" required defaultValue=""><option value="" disabled>Select a role</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
            <label>Expiry date <span className="optional-label">Optional</span><input name="expiresOn" type="date" /><small className="helper-text">Leave blank to keep this access active until it is removed.</small></label>
            <button className="primary" disabled={busy || !roles.length}>{busy ? "Assigning…" : "Assign role"}</button>
          </form>}
        </section>
      </div>
    </section>
  );
}
