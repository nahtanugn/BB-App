"use client";

import { FormEvent, useEffect, useState } from "react";

type Announcement = {
  id: number;
  title: string;
  body: string;
  priority: "normal" | "important" | "urgent";
  expires_at: string | null;
  created_by_name: string;
  created_at: string;
  is_read: number;
};
type AnnouncementData = {
  announcements: Announcement[];
  unreadCount: number;
  canAnnounce: boolean;
  canArchive: boolean;
};

export default function Announcements({
  userName,
  onBack,
  onLogout,
  onRead,
}: {
  userName: string;
  onBack: () => void;
  onLogout: () => void;
  onRead: () => void;
}) {
  const [data, setData] = useState<AnnouncementData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(markRead = false) {
    const response = await fetch("/api/announcements/", { cache: "no-store" });
    const result = (await response.json()) as AnnouncementData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load announcements");
    setData(result);
    if (markRead && result.unreadCount > 0) {
      await fetch("/api/announcements/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setData((current) => current ? { ...current, unreadCount: 0, announcements: current.announcements.map((announcement) => ({ ...announcement, is_read: 1 })) } : current);
      onRead();
    }
  }
  useEffect(() => {
    fetch("/api/announcements/", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as AnnouncementData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load announcements");
        setData(result);
        if (result.unreadCount > 0) {
          await fetch("/api/announcements/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "mark_all_read" }),
          });
          setData((current) => current ? { ...current, unreadCount: 0, announcements: current.announcements.map((announcement) => ({ ...announcement, is_read: 1 })) } : current);
          onRead();
        }
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load announcements"));
  }, []);

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/announcements/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_announcement",
        title: form.get("title"),
        body: form.get("body"),
        priority: form.get("priority"),
        expiresOn: form.get("expiresOn"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to publish announcement");
    event.currentTarget.reset();
    await load(false);
    setNotice("Announcement published to everyone.");
  }

  async function archiveAnnouncement(announcement: Announcement) {
    if (!window.confirm(`Archive “${announcement.title}”?`)) return;
    const response = await fetch("/api/announcements/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive_announcement", announcementId: announcement.id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setError(result.error ?? "Unable to archive announcement");
    await load(false);
    setNotice("Announcement archived.");
  }

  return (
    <main className="announcement-shell">
      <header className="stock-topbar">
        <div className="resource-brand">
          <div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" />
          <div><strong>11KCHBB App</strong><span>Announcements</span></div>
        </div>
        <div className="stock-user">
          <span><strong>{userName}</strong><small>Company announcement channel</small></span>
          <button onClick={onBack}>Back to app</button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <section className="announcement-page">
        <div className="announcement-hero">
          <p className="eyebrow">COMPANY CHANNEL</p>
          <h1>Announcements</h1>
          <p>Official notices shared with every signed-in member, NCO and officer.</p>
        </div>
        {notice && <p className="form-success" role="status">{notice}</p>}
        {error && <p className="form-error">{error}</p>}
        {data?.canAnnounce && (
          <section className="announcement-composer">
            <div><p className="eyebrow">NEW ANNOUNCEMENT</p><h2>Notify everyone</h2><p>Everyone will see an unread notification the next time they use the app.</p></div>
            <form onSubmit={createAnnouncement}>
              <label>Title<input name="title" required maxLength={120} placeholder="e.g. Parade time changed" /></label>
              <label>Message<textarea name="body" required maxLength={4000} rows={5} placeholder="Write the full announcement here" /></label>
              <div className="form-row">
                <label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
                <label>Expires on (optional)<input name="expiresOn" type="date" /></label>
              </div>
              <button className="primary" disabled={busy}>{busy ? "Publishing…" : "Publish announcement"}</button>
            </form>
          </section>
        )}
        <section className="announcement-feed">
          <div className="request-section-heading"><div><p className="eyebrow">LATEST</p><h2>Company notices</h2></div><span>{data?.announcements.length ?? 0}</span></div>
          <div className="announcement-list">
            {data?.announcements.map((announcement) => (
              <article className={`announcement-card ${announcement.priority}`} key={announcement.id}>
                <div className="announcement-meta">
                  <span className={`announcement-priority ${announcement.priority}`}>{announcement.priority}</span>
                  <time>{new Date(announcement.created_at).toLocaleString("en-MY")}</time>
                </div>
                <h3>{announcement.title}</h3>
                <p>{announcement.body}</p>
                <footer><span>Posted by {announcement.created_by_name}</span>{announcement.expires_at && <span>Available until {new Date(announcement.expires_at).toLocaleDateString("en-MY")}</span>}{data.canArchive && <button className="danger-link" onClick={() => archiveAnnouncement(announcement)}>Archive</button>}</footer>
              </article>
            ))}
            {data && !data.announcements.length && <p className="empty-inline">No announcements have been published yet.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
