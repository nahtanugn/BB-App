"use client";

import { useCallback, useEffect, useState } from "react";

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  target_url: string;
  read_at: string | null;
  created_at: string;
};

type Preferences = {
  pushEnabled: boolean;
  awardUpdates: boolean;
  adminTasks: boolean;
  requestUpdates: boolean;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
  vapidPublicKey: string;
  pushConfigured: boolean;
  hasActiveSubscription: boolean;
  preferences: Preferences;
};

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export default function NotificationCentre() {
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (response.status === 401) return setData(null);
    const result = (await response.json()) as NotificationResponse & {
      error?: string;
    };
    if (!response.ok)
      throw new Error(result.error ?? "Unable to load notifications");
    setData(result);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(
      () => refresh().catch(() => undefined),
      0,
    );
    const timer = window.setInterval(() => refresh().catch(() => undefined), 60_000);
    const onFocus = () => refresh().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok)
      throw new Error(result.error ?? "Unable to update notifications");
  }

  async function openItem(item: NotificationItem) {
    if (!item.read_at) {
      await post({ action: "mark_read", id: item.id }).catch(() => undefined);
    }
    window.location.assign(item.target_url || "/");
  }

  async function markAllRead() {
    setBusy(true);
    setError("");
    try {
      await post({ action: "mark_all_read" });
      await refresh();
      setNotice("All notifications marked as read.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update notifications");
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!data?.vapidPublicKey)
        throw new Error("Device alerts are not configured on this deployment yet.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error("This browser does not support device alerts. On iPhone, add the app to your Home Screen first.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error("Notifications were not allowed. You can change this in your device settings.");
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      const subscription =
        current ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(data.vapidPublicKey),
        }));
      await post({
        action: "subscribe_push",
        subscription: subscription.toJSON(),
      });
      await refresh();
      setNotice("Device alerts are now on for this device.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to enable device alerts");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await post({ action: "unsubscribe_push", endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      await refresh();
      setNotice("Device alerts are off on this device.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to disable device alerts");
    } finally {
      setBusy(false);
    }
  }

  async function changePreference(key: keyof Preferences, checked: boolean) {
    if (!data) return;
    const next = { ...data.preferences, [key]: checked };
    setData({ ...data, preferences: next });
    try {
      await post({ action: "update_preferences", ...next });
      setNotice("Notification preferences saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save preferences");
      await refresh().catch(() => undefined);
    }
  }

  if (!data) return null;

  return (
    <>
      <button
        className="notification-bell"
        type="button"
        onClick={() => {
          setOpen(true);
          setNotice("");
          setError("");
        }}
        aria-label={`Notifications${data.unreadCount ? `, ${data.unreadCount} unread` : ""}`}
      >
        <span aria-hidden="true">♢</span>
        {data.unreadCount > 0 && (
          <strong>{data.unreadCount > 99 ? "99+" : data.unreadCount}</strong>
        )}
      </button>
      {open && (
        <div
          className="notification-backdrop"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <aside
            className="notification-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">UPDATES</p>
                <h2 id="notification-title">Notifications</h2>
                <span>{data.unreadCount} unread</span>
              </div>
              <button
                type="button"
                className="notification-close"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                ×
              </button>
            </header>
            <div className="notification-actions">
              <button type="button" onClick={markAllRead} disabled={busy || !data.unreadCount}>
                Mark all read
              </button>
              <button type="button" onClick={() => setSettingsOpen((value) => !value)}>
                {settingsOpen ? "Hide settings" : "Alert settings"}
              </button>
            </div>
            {settingsOpen && (
              <section className="notification-settings">
                <div>
                  <strong>Outside-app alerts</strong>
                  <p>Receive safe summaries on this phone or computer.</p>
                </div>
                {data.hasActiveSubscription ? (
                  <button type="button" onClick={disablePush} disabled={busy}>
                    Turn off on this device
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={enablePush}
                    disabled={busy || !data.pushConfigured}
                  >
                    {busy ? "Please wait…" : "Enable on this device"}
                  </button>
                )}
                {!data.pushConfigured && (
                  <p className="notification-hint">
                    Device alerts will become available after the secure server key is configured. In-app notifications are already active.
                  </p>
                )}
                <fieldset>
                  <legend>What should notify me?</legend>
                  {[
                    ["awardUpdates", "Award submissions and decisions"],
                    ["adminTasks", "Account and profile tasks"],
                    ["requestUpdates", "Uniform and other requests"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={data.preferences[key as keyof Preferences]}
                        onChange={(event) =>
                          changePreference(
                            key as keyof Preferences,
                            event.target.checked,
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </section>
            )}
            {notice && <p className="form-success notification-message" role="status">{notice}</p>}
            {error && <p className="form-error notification-message">{error}</p>}
            <div className="notification-list">
              {data.notifications.length ? (
                data.notifications.map((item) => (
                  <button
                    type="button"
                    className={item.read_at ? "" : "unread"}
                    key={item.id}
                    onClick={() => openItem(item)}
                  >
                    <span className={`notification-type ${item.type}`} aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                      <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
                    </span>
                  </button>
                ))
              ) : (
                <div className="notification-empty">
                  <strong>You’re all caught up</strong>
                  <p>New award, account, and request updates will appear here.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
