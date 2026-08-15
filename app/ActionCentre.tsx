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
type TrackerSummary = {
  mode: "company" | "personal";
  memberCount?: number;
  meetingsThisYear?: number;
  completedRegisters?: number;
  pendingSubmissions?: number;
  attendancePercent?: number;
  awardsEarned?: number;
  upcomingEvents?: number;
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
  userRole,
  readOnly,
  onOpen,
  onCountChange,
  announcementSummary,
  onAnnouncements,
}: {
  userName: string;
  userRole: string;
  readOnly: boolean;
  onOpen: (targetUrl: string) => void;
  onCountChange?: (count: number) => void;
  announcementSummary?: { unreadCount: number; latest: { title: string; body: string; priority: string } | null };
  onAnnouncements?: () => void;
}) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
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

  const loadSummary = useCallback(async () => {
    const summaryResponse = await fetch("/api/tracker?summary=1", { cache: "no-store" });
    if (summaryResponse.ok) {
      const summaryResult = await summaryResponse.json() as { summary?: TrackerSummary };
      setSummary(summaryResult.summary ?? null);
    }
  }, []);

  useEffect(() => {
    const refresh = () => load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load action items"));
    const timer = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 3000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [load]);

  useEffect(() => {
    const refresh = () => loadSummary().catch(() => undefined);
    const timer = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [loadSummary]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.rule_key))], [items]);
  const visible = filter === "all" ? items.filter((item) => item.priority === "urgent").slice(0, 3) : items.filter((item) => item.rule_key === filter);
  const snapshot = summary?.mode === "personal" ? [
    { label: "Attendance", value: `${summary.attendancePercent ?? 0}%`, note: "completed meetings" },
    { label: "Awards", value: summary.awardsEarned ?? 0, note: "earned" },
    { label: "Coming up", value: summary.upcomingEvents ?? 0, note: "events" },
  ] : [
    { label: "Members", value: summary?.memberCount ?? "—", note: "Senior and Junior" },
    { label: "Attendance", value: `${summary?.completedRegisters ?? 0}/${summary?.meetingsThisYear ?? 0}`, note: "registers complete" },
    { label: "Award reviews", value: summary?.pendingSubmissions ?? 0, note: "awaiting review" },
  ];
  const quickActions = ["member", "nco", "squad_leader"].includes(userRole) ? [
    { label: "View my progress", target: "/?open=awards" },
    { label: "View programme", target: "/?open=events" },
    { label: "Make a request", target: "/?open=manage" },
  ] : [
    { label: "Find a member", target: "/?open=members" },
    { label: "Take attendance", target: "/?open=attendance" },
    { label: "Manage requests", target: "/?open=manage" },
  ];

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
      <header className="action-centre-hero simplified-home-hero">
        <div><p className="eyebrow">HOME</p><h1>Shalom, {userName.split(" ")[0]}.</h1><p>Your priorities, progress and common tools are gathered in one place.</p></div>
        <div className="action-total"><strong>{items.length}</strong><span>Open task{items.length === 1 ? "" : "s"}</span></div>
      </header>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
      <section className="home-snapshot" aria-label={summary?.mode === "personal" ? "My snapshot" : "Company snapshot"}>{snapshot.map((item) => <article className="panel" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</section>
      <section className="home-quick-actions panel"><div><p className="eyebrow">QUICK ACTIONS</p><h2>What would you like to do?</h2></div><div>{quickActions.map((action) => <button type="button" onClick={() => onOpen(action.target)} key={action.target}>{action.label}<span>›</span></button>)}</div></section>
      {announcementSummary?.latest && <button type="button" className={`home-announcement panel ${announcementSummary.latest.priority}`} onClick={onAnnouncements}><span>◉</span><div><strong>{announcementSummary.latest.title}</strong><small>{announcementSummary.latest.body}</small></div>{announcementSummary.unreadCount > 0 && <b>{announcementSummary.unreadCount} new</b>}</button>}
      <div className="home-section-heading"><div><p className="eyebrow">ACTION CENTRE</p><h2>{filter === "all" ? "Urgent work" : ruleLabels[filter] ?? filter.replaceAll("_", " ")}</h2></div>{filter !== "all" && <button type="button" onClick={() => setFilter("all")}>Back to urgent</button>}</div>
      <section className="action-summary-grid" aria-label="Task category summaries">
        {categories.map((category) => {
          const total = items.filter((item) => item.rule_key === category).length;
          return <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category)}>
            <span>{ruleLabels[category] ?? category.replaceAll("_", " ")}</span><strong>{total}</strong><small>{total === 1 ? "task" : "tasks"}</small>
          </button>;
        })}
      </section>
      <section className="action-list simplified-action-list" aria-live="polite">
        {visible.map((item) => (
          <ActionCard key={item.id} item={item} busy={busy} readOnly={readOnly} onOpen={onOpen} onUpdate={update} />
        ))}
        {!visible.length && <div className="action-empty"><span>✓</span><h2>{filter === "all" ? "No urgent tasks" : "You’re all caught up"}</h2><p>{filter === "all" ? "Choose a category above to review normal work." : "No open work matches this view."}</p></div>}
      </section>
    </main>
  );
}

function ActionCard({ item, busy, readOnly, onOpen, onUpdate }: { item: ActionItem; busy: number | null; readOnly: boolean; onOpen: (targetUrl: string) => void; onUpdate: (action: "dismiss_item" | "snooze_item", itemId: number) => Promise<void> }) {
  return (
          <article className={item.priority}>
            <div className="action-priority" aria-hidden="true" />
            <div>
              <p>{ruleLabels[item.rule_key] ?? item.rule_key.replaceAll("_", " ")}</p>
              <h2>{item.title}</h2>
              <span>{item.description}</span>
              <small>Open since {new Date(item.first_seen_at).toLocaleDateString("en-MY")}{item.due_at ? ` · Due ${new Date(item.due_at).toLocaleDateString("en-MY")}` : ""}</small>
            </div>
            <div className="action-item-buttons">
              <button className="primary" onClick={() => onOpen(item.target_url)}>Open</button>
              {!readOnly && <button disabled={busy === item.id} onClick={() => onUpdate("snooze_item", item.id)}>Tomorrow</button>}
              {!readOnly && <button disabled={busy === item.id} onClick={() => onUpdate("dismiss_item", item.id)}>Dismiss</button>}
            </div>
          </article>
  );
}
