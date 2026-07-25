"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import MemberProgress from "./MemberProgress";

type User = {
  name: string;
  email: string;
  role:
    | "admin"
    | "officer"
    | "nco"
    | "squad_leader"
    | "member";
  temporary_access_role: string;
  access_expires_at: string | null;
  member_section?: string;
};
type Resource = {
  id: number;
  title: string;
  description: string;
  category: string;
  url: string;
  access_level: "member" | "nco" | "officer";
  created_at: string;
  created_by?: string;
};

const accessLabels = {
  member: "Members",
  nco: "NCOs & officers",
  officer: "Officers only",
} as const;

export default function ResourceLibrary({
  user,
  onBack,
  onOpenSubmissions,
  onManageAccount,
  onOpenStock,
  onOpenUniformRequests,
  onOpenAnnouncements,
  announcementSummary,
  onLogout,
}: {
  user: User;
  onBack?: () => void;
  onOpenSubmissions?: () => void;
  onManageAccount?: () => void;
  onOpenStock?: () => void;
  onOpenUniformRequests?: () => void;
  onOpenAnnouncements?: () => void;
  announcementSummary?: {
    unreadCount: number;
    latest: { title: string; body: string; priority: string } | null;
  };
  onLogout: () => void;
}) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const hasTemporaryAdminAccess = Boolean(
    user.temporary_access_role === "temporary_admin" &&
      user.access_expires_at &&
      user.access_expires_at > new Date().toISOString(),
  );
  const canManageResources =
    ["admin", "officer"].includes(user.role) || hasTemporaryAdminAccess;

  async function loadResources() {
    const response = await fetch("/api/resources", { cache: "no-store" });
    const result = (await response.json()) as {
      resources?: Resource[];
      error?: string;
    };
    if (!response.ok)
      throw new Error(result.error ?? "Unable to load resources");
    setResources(result.resources ?? []);
  }

  useEffect(() => {
    fetch("/api/resources", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          resources?: Resource[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load resources");
        setResources(result.resources ?? []);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to load resources",
        ),
      );
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return resources.filter(
      (resource) =>
        !term ||
        `${resource.title} ${resource.description} ${resource.category}`
          .toLowerCase()
          .includes(term),
    );
  }, [query, resources]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Resource[]>();
    visible.forEach((resource) =>
      groups.set(resource.category, [
        ...(groups.get(resource.category) ?? []),
        resource,
      ]),
    );
    return [...groups.entries()];
  }, [visible]);

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_resource",
        title: form.get("title"),
        description: form.get("description"),
        category: form.get("category"),
        accessLevel: form.get("accessLevel"),
        url: form.get("url"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to add resource");
    event.currentTarget.reset();
    await loadResources();
    setNotice("Resource created successfully.");
  }

  async function deleteResource(resource: Resource) {
    if (!window.confirm(`Remove “${resource.title}” from the library?`)) return;
    await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_resource",
        resourceId: resource.id,
      }),
    });
    await loadResources();
  }

  async function updateResourceAccess(
    resource: Resource,
    accessLevel: Resource["access_level"],
  ) {
    setError("");
    setNotice("");
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_access",
        resourceId: resource.id,
        accessLevel,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Unable to update resource access");
      return;
    }
    await loadResources();
    setNotice(`Access updated for “${resource.title}”.`);
  }

  return (
    <main className="resources-shell">
      <header className="resources-topbar">
        <div className="resource-brand">
          <div
            className="brand-mark app-photo"
            role="img"
            aria-label="11th Kuching Company"
          />
          <div>
            <strong>11KCHBB App</strong>
            <span>
              {canManageResources
                ? "Resource management"
                : "Resource library"}
            </span>
          </div>
        </div>
        <div className="resource-user">
          <span>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </span>
          {["member", "nco", "squad_leader"].includes(user.role) &&
            onOpenSubmissions && (
            <button onClick={onOpenSubmissions}>Award submissions</button>
          )}
          {user.role === "member" && onManageAccount && (
            <button onClick={onManageAccount}>Change password</button>
          )}
          {onOpenStock && <button onClick={onOpenStock}>Stock Centre</button>}
          {onOpenUniformRequests && (
            <button onClick={onOpenUniformRequests}>Uniform requests</button>
          )}
          {onOpenAnnouncements && (
            <button onClick={onOpenAnnouncements}>
              Announcements
              {announcementSummary && announcementSummary.unreadCount > 0
                ? ` (${announcementSummary.unreadCount})`
                : ""}
            </button>
          )}
          {onBack && <button onClick={onBack}>Back to tracker</button>}
          <button onClick={onLogout}>Sign out</button>
        </div>
      </header>
      {announcementSummary && announcementSummary.unreadCount > 0 && announcementSummary.latest && (
        <button className={`announcement-alert resource-announcement-alert ${announcementSummary.latest.priority}`} onClick={onOpenAnnouncements}>
          <span>!</span>
          <div><strong>{announcementSummary.latest.title}</strong><small>{announcementSummary.latest.body}</small></div>
          <b>{announcementSummary.unreadCount} new</b>
        </button>
      )}
      <section className="resources-hero">
        <div>
          <p className="eyebrow">11TH KUCHING COMPANY</p>
          <h1>Resources</h1>
          <p>
            Company materials, training guides and useful links in one shared
            place.
          </p>
        </div>
        <label className="resource-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources"
            aria-label="Search resources"
          />
        </label>
      </section>
      {canManageResources && (
        <section className="resource-editor panel">
          <div>
            <p className="eyebrow">ADD TO LIBRARY</p>
            <h2>Share a resource</h2>
            <p>Paste a link to a document, video, website or shared file.</p>
          </div>
          <form onSubmit={createResource}>
            <div className="form-row">
              <label>
                Title
                <input
                  name="title"
                  required
                  placeholder="e.g. Drill handbook"
                />
              </label>
              <label>
                Category
                <input name="category" required defaultValue="General" />
              </label>
            </div>
            <label>
              Who can access this resource?
              <select name="accessLevel" defaultValue="member">
                <option value="member">Members, NCOs and officers</option>
                <option value="nco">NCOs and officers only</option>
                <option value="officer">Officers only</option>
              </select>
            </label>
            <label>
              Resource link
              <input name="url" type="url" required placeholder="https://…" />
            </label>
            <label>
              Description
              <input
                name="description"
                placeholder="Short note about this resource"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary" disabled={busy}>
              {busy ? "Adding…" : "Add resource"}
            </button>
          </form>
        </section>
      )}
      {notice && (
        <p className="form-success resource-success" role="status">
          {notice}
        </p>
      )}
      {error && !canManageResources && (
        <p className="form-error resource-error">{error}</p>
      )}
      <MemberProgress user={user} />
      <section className="resource-groups">
        {grouped.length ? (
          grouped.map(([category, items]) => (
            <div key={category} className="resource-group">
              <div className="resource-category">
                <p className="eyebrow">CATEGORY</p>
                <h2>{category}</h2>
                <span>
                  {items.length} {items.length === 1 ? "resource" : "resources"}
                </span>
              </div>
              <div className="resource-grid">
                {items.map((resource) => (
                  <article className="resource-card" key={resource.id}>
                    <div className="resource-card-icon">↗</div>
                    <div>
                      <h3>{resource.title}</h3>
                      <span className={`resource-access resource-access-${resource.access_level}`}>
                        {accessLabels[resource.access_level] ?? "Members"}
                      </span>
                      <p>{resource.description || "Shared company resource"}</p>
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        Open resource →
                      </a>
                      {canManageResources && (
                        <label className="resource-access-editor">
                          Access
                          <select
                            value={resource.access_level}
                            onChange={(event) =>
                              updateResourceAccess(
                                resource,
                                event.target.value as Resource["access_level"],
                              )
                            }
                          >
                            <option value="member">Members and above</option>
                            <option value="nco">NCOs and officers</option>
                            <option value="officer">Officers only</option>
                          </select>
                        </label>
                      )}
                    </div>
                    {canManageResources && (
                      <button
                        className="resource-delete"
                        onClick={() => deleteResource(resource)}
                        aria-label={`Remove ${resource.title}`}
                      >
                        ×
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="resource-empty">
            <div
              className="brand-mark app-photo"
              role="img"
              aria-label="11th Kuching Company"
            />
            <h2>No resources yet</h2>
            <p>
              {!canManageResources
                ? "An officer will add materials here soon."
                : "Add the first link to start the shared library."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
