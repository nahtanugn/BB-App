"use client";

import { useEffect, useState } from "react";
import { brandingLogoStyle, useBranding } from "./BrandingContext";

type PublicItem = { id: number; title: string; body: string; content_type: string; updated_at: string };

export default function PublicInformation({ onBack }: { onBack?: () => void }) {
  const branding = useBranding();
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/public-content", { cache: "no-store" }).then(async (response) => { const result = await response.json() as { content?: PublicItem[] }; if (response.ok) setItems(result.content ?? []); }).finally(() => setLoading(false)); }, []);
  return <main className="auth-screen public-information"><section className="auth-card"><div className="auth-brand"><div className="brand-mark app-photo" style={brandingLogoStyle(branding)} /><div><strong>{branding.appName}</strong><span>Public information</span></div></div><p className="eyebrow">{branding.companyName.toUpperCase()}</p><h1>Information for our community</h1><p className="auth-copy">Approved notices and resources from {branding.companyName}.</p>{onBack && <button type="button" className="text-button" onClick={onBack}>Back to sign in</button>}<div className="public-content-list">{loading && <p className="empty-state">Loading information…</p>}{!loading && !items.length && <p className="empty-state">No public information has been published.</p>}{items.map((item) => <article className="panel" key={item.id}><p className="eyebrow">{item.content_type.replaceAll("_", " ")}</p><h2>{item.title}</h2><p>{item.body}</p><small>Updated {new Date(item.updated_at).toLocaleDateString("en-MY")}</small></article>)}</div></section></main>;
}
