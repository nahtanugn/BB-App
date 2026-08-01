"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WorkItem = {
  id: number;
  rule_key: string;
  title: string;
  description: string;
  target_url: string;
  priority: "urgent" | "important" | "normal";
  due_at: string | null;
};

const labels: Record<string, string> = {
  award_reviews: "Award reviews",
  access_reviews: "Access requests",
  incomplete_onboarding: "Onboarding",
  uniform_requests: "Uniform requests",
  attendance_unmarked: "Attendance",
  event_reminders: "Events",
  low_stock: "Stock",
  access_expiry: "Access expiry",
  data_quality: "Data quality",
  company_subscription: "Subscriptions",
  band_subscription: "Band subscriptions",
};

export default function OperationsHome({ onOpen }: { onOpen: (targetUrl: string) => void }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/automation", { cache: "no-store" });
    const result = (await response.json()) as { items?: WorkItem[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load operational work");
    setItems(result.items ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load operational work"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const urgent = items.filter((item) => item.priority === "urgent");
  const groups = useMemo(() => [...new Map(items.map((item) => [item.rule_key, 0])).keys()].map((key) => ({
    key,
    total: items.filter((item) => item.rule_key === key).length,
  })), [items]);
  const reviewItems = [...urgent, ...items.filter((item) => item.priority !== "urgent")].slice(0, 8);

  return (
    <main className="operations-page">
      <header className="operations-hero">
        <div><p className="eyebrow">OPERATIONS HOME</p><h1>Work needing review</h1><p>One queue for the decisions you are authorised to make. Nothing is approved automatically.</p></div>
        <div className="operations-total"><strong>{items.length}</strong><span>open items</span></div>
      </header>
      {error && <p className="form-error">{error}</p>}
      <section className="operations-summary" aria-label="Operational summary">
        <article><span>Urgent</span><strong>{urgent.length}</strong><small>review first</small></article>
        {groups.slice(0, 3).map((group) => <article key={group.key}><span>{labels[group.key] ?? group.key.replaceAll("_", " ")}</span><strong>{group.total}</strong><small>open</small></article>)}
      </section>
      <section className="operations-queue panel" aria-live="polite">
        <div className="panel-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h2>{urgent.length ? "Urgent items first" : "Your next reviews"}</h2></div><span>Open each item to review it fully.</span></div>
        {reviewItems.map((item) => <article className={item.priority} key={item.id}>
          <span aria-hidden="true" />
          <div><p>{labels[item.rule_key] ?? item.rule_key.replaceAll("_", " ")}</p><h3>{item.title}</h3><small>{item.description}</small></div>
          <button className="primary" onClick={() => onOpen(item.target_url)}>Review</button>
        </article>)}
        {!reviewItems.length && <div className="operations-empty"><span>✓</span><h2>Nothing needs review</h2><p>New authorised work will appear here when it needs your attention.</p></div>}
      </section>
    </main>
  );
}
