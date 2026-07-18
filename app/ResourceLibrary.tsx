"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { name: string; email: string; role: "admin" | "officer" | "member" };
type Resource = { id: number; title: string; description: string; category: string; url: string; created_at: string; created_by: string };

export default function ResourceLibrary({ user, onBack, onLogout }: { user: User; onBack?: () => void; onLogout: () => void }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadResources() {
    const response = await fetch("/api/resources", { cache: "no-store" });
    const result = (await response.json()) as { resources?: Resource[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load resources");
    setResources(result.resources ?? []);
  }

  useEffect(() => {
    fetch("/api/resources", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { resources?: Resource[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load resources");
        setResources(result.resources ?? []);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load resources"));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return resources.filter((resource) => !term || `${resource.title} ${resource.description} ${resource.category}`.toLowerCase().includes(term));
  }, [query, resources]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Resource[]>();
    visible.forEach((resource) => groups.set(resource.category, [...(groups.get(resource.category) ?? []), resource]));
    return [...groups.entries()];
  }, [visible]);

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_resource", title: form.get("title"), description: form.get("description"), category: form.get("category"), url: form.get("url") }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to add resource");
    event.currentTarget.reset();
    await loadResources();
  }

  async function deleteResource(resource: Resource) {
    if (!window.confirm(`Remove “${resource.title}” from the library?`)) return;
    await fetch("/api/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_resource", resourceId: resource.id }) });
    await loadResources();
  }

  return <main className="resources-shell"><header className="resources-topbar"><div className="resource-brand"><div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" /><div><strong>11KCHBB App</strong><span>{user.role === "member" ? "Member resources" : "Resource management"}</span></div></div><div className="resource-user"><span><strong>{user.name}</strong><small>{user.role}</small></span>{onBack && <button onClick={onBack}>Back to tracker</button>}<button onClick={onLogout}>Sign out</button></div></header><section className="resources-hero"><div><p className="eyebrow">11TH KUCHING COMPANY</p><h1>Resources</h1><p>Company materials, training guides and useful links in one shared place.</p></div><label className="resource-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources" aria-label="Search resources" /></label></section>{user.role !== "member" && <section className="resource-editor panel"><div><p className="eyebrow">ADD TO LIBRARY</p><h2>Share a resource</h2><p>Paste a link to a document, video, website or shared file.</p></div><form onSubmit={createResource}><div className="form-row"><label>Title<input name="title" required placeholder="e.g. Drill handbook" /></label><label>Category<input name="category" required defaultValue="General" /></label></div><label>Resource link<input name="url" type="url" required placeholder="https://…" /></label><label>Description<input name="description" placeholder="Short note about this resource" /></label>{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Adding…" : "Add resource"}</button></form></section>}{error && user.role === "member" && <p className="form-error resource-error">{error}</p>}<section className="resource-groups">{grouped.length ? grouped.map(([category, items]) => <div key={category} className="resource-group"><div className="resource-category"><p className="eyebrow">CATEGORY</p><h2>{category}</h2><span>{items.length} {items.length === 1 ? "resource" : "resources"}</span></div><div className="resource-grid">{items.map((resource) => <article className="resource-card" key={resource.id}><div className="resource-card-icon">↗</div><div><h3>{resource.title}</h3><p>{resource.description || "Shared company resource"}</p><a href={resource.url} target="_blank" rel="noreferrer">Open resource →</a></div>{user.role !== "member" && <button className="resource-delete" onClick={() => deleteResource(resource)} aria-label={`Remove ${resource.title}`}>×</button>}</article>)}</div></div>) : <div className="resource-empty"><div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" /><h2>No resources yet</h2><p>{user.role === "member" ? "An officer will add materials here soon." : "Add the first link to start the shared library."}</p></div>}</section></main>;
}
