"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { brandingLogoStyle, useBranding } from "./BrandingContext";

type User = {
  name: string;
  email: string;
  role:
    | "admin"
    | "officer"
    | "nco"
    | "squad_leader"
    | "viewer"
    | "member";
  temporary_access_role: string;
  access_expires_at: string | null;
  member_section?: string;
  custom_permissions?: string[];
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
}: {
  user: User;
}) {
  const branding = useBranding();
  const [resources, setResources] = useState<Resource[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<"category" | "recent">("category");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const hasTemporaryAdminAccess = Boolean(
    user.role !== "viewer" &&
      user.temporary_access_role === "temporary_admin" &&
      user.access_expires_at &&
      user.access_expires_at > new Date().toISOString(),
  );
  const canManageResources =
    ["admin", "officer"].includes(user.role) ||
    hasTemporaryAdminAccess ||
    Boolean(user.custom_permissions?.includes("resources.manage"));

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

  const categories = useMemo(() => [...new Set(resources.map((resource) => resource.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [resources]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return resources.filter((resource) => {
        if (categoryFilter !== "all" && resource.category !== categoryFilter) return false;
        return !term || `${resource.title} ${resource.description} ${resource.category}`
          .toLowerCase()
          .includes(term);
    });
  }, [categoryFilter, query, resources]);

  const grouped = useMemo(() => {
    if (sortMode === "recent") return [["Most recent", [...visible].sort((a, b) => b.created_at.localeCompare(a.created_at))] as [string, Resource[]]];
    const groups = new Map<string, Resource[]>();
    visible.forEach((resource) =>
      groups.set(resource.category, [
        ...(groups.get(resource.category) ?? []),
        resource,
      ]),
    );
    return [...groups.entries()];
  }, [sortMode, visible]);

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to add resource");
    }
    formElement.reset();
    await loadResources();
    setNotice("Resource created successfully.");
    setBusy(false);
  }

  async function deleteResource(resource: Resource) {
    if (!window.confirm(`Remove “${resource.title}” from the library?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_resource",
        resourceId: resource.id,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      return setError(result.error ?? "Unable to remove resource");
    }
    await loadResources();
    setNotice(`“${resource.title}” was removed from the library.`);
    setBusy(false);
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
      <section className="resources-hero">
        <div>
          <p className="eyebrow">{branding.companyName.toUpperCase()}</p>
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
        <div className="resource-toolbar" aria-label="Resource filters">
          <label>Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
          <label>Sort<select value={sortMode} onChange={(event) => setSortMode(event.target.value as "category" | "recent")}><option value="category">By category</option><option value="recent">Most recent</option></select></label>
        </div>
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
                        disabled={busy}
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
              aria-label={branding.companyName}
              style={brandingLogoStyle(branding)}
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
