"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ActionItem = {
  id: number;
  rule_key: string;
  title: string;
  description: string;
  target_url: string;
  priority: string;
  due_at: string | null;
  first_seen_at: string;
};

const ruleLabels: Record<string, string> = {
  award_reviews: "Awards",
  access_reviews: "Access",
  incomplete_onboarding: "Onboarding",
  uniform_requests: "Uniforms",
  attendance_unmarked: "Attendance",
  event_reminders: "Events",
  low_stock: "Stock",
  access_expiry: "Access expiry",
  data_quality: "Data quality",
  company_subscription: "Subscriptions",
  band_subscription: "Band",
};

export default function ActionCentre({
  userName,
  readOnly,
  onOpen,
  onCountChange,
}: {
  userName: string;
  readOnly: boolean;
  onOpen: (targetUrl: string) => void;
  onCountChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/automation", { cache: "no-store" });
    const result = (await response.json()) as { items?: ActionItem[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load action items");
    setItems(result.items ?? []);
    onCountChange?.(result.items?.length ?? 0);
  }, [onCountChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load action items")), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.rule_key))], [items]);
  const visible = filter === "all" ? items : items.filter((item) => item.rule_key === filter);

  async function update(action: "dismiss_item" | "snooze_item", itemId: number) {
    setBusy(itemId); setError(""); setNotice("");
    const response = await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, itemId, days: 1 }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setBusy(null);
    if (!response.ok) return setError(result.error ?? "Unable to update task");
    setNotice(result.message ?? "Task updated.");
    await load();
  }

  return (
    <main className="action-centre-page">
      <header className="action-centre-hero">
        <div><p className="eyebrow">PERSONAL ACTION CENTRE</p><h1>Shalom, {userName.split(" ")[0]}.</h1><p>Your live priorities are gathered here automatically. Official decisions always remain with an authorised person.</p></div>
        <div className="action-total"><strong>{items.length}</strong><span>Open task{items.length === 1 ? "" : "s"}</span></div>
      </header>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="action-filter" role="tablist" aria-label="Action categories">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <span>{items.length}</span></button>
        {categories.map((category) => (
          <button className={filter === category ? "active" : ""} onClick={() => setFilter(category)} key={category}>
            {ruleLabels[category] ?? category.replaceAll("_", " ")}
            <span>{items.filter((item) => item.rule_key === category).length}</span>
          </button>
        ))}
      </div>
      <section className="action-list" aria-live="polite">
        {visible.map((item) => (
          <article className={item.priority} key={item.id}>
            <div className="action-priority" aria-hidden="true" />
            <div>
              <p>{ruleLabels[item.rule_key] ?? item.rule_key.replaceAll("_", " ")}</p>
              <h2>{item.title}</h2>
              <span>{item.description}</span>
              <small>Open since {new Date(item.first_seen_at).toLocaleDateString("en-MY")}{item.due_at ? ` · Due ${new Date(item.due_at).toLocaleDateString("en-MY")}` : ""}</small>
            </div>
            <div className="action-item-buttons">
              <button className="primary" onClick={() => onOpen(item.target_url)}>Open</button>
              {!readOnly && <button disabled={busy === item.id} onClick={() => update("snooze_item", item.id)}>Tomorrow</button>}
              {!readOnly && <button disabled={busy === item.id} onClick={() => update("dismiss_item", item.id)}>Dismiss</button>}
            </div>
          </article>
        ))}
        {!visible.length && <div className="action-empty"><span>✓</span><h2>You’re all caught up</h2><p>No open work matches this view.</p></div>}
      </section>
    </main>
  );
}
