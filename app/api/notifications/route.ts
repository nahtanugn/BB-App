import { getCurrentUser } from "../../../lib/auth";
import {
  ensureNotificationSchema,
  vapidPublicKey,
} from "../../../lib/notifications";
import { env } from "cloudflare:workers";

const allowedPreferenceKeys = [
  "pushEnabled",
  "awardUpdates",
  "adminTasks",
  "requestUpdates",
] as const;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureNotificationSchema();
    const notifications = await env.DB.prepare(
      `SELECT id, type, title, body, target_url, read_at, created_at
       FROM notifications WHERE recipient_user_id = ?
       ORDER BY created_at DESC LIMIT 100`,
    )
      .bind(user.id)
      .all();
    const unread = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL",
    )
      .bind(user.id)
      .first<{ total: number }>();
    const preferences = await env.DB.prepare(
      `SELECT push_enabled, award_updates, admin_tasks, request_updates
       FROM notification_preferences WHERE user_id = ?`,
    )
      .bind(user.id)
      .first<{
        push_enabled: number;
        award_updates: number;
        admin_tasks: number;
        request_updates: number;
      }>();
    const subscription = await env.DB.prepare(
      "SELECT endpoint FROM push_subscriptions WHERE user_id = ? AND active = 1 LIMIT 1",
    )
      .bind(user.id)
      .first();
    return Response.json({
      notifications: notifications.results,
      unreadCount: Number(unread?.total ?? 0),
      vapidPublicKey: vapidPublicKey(),
      pushConfigured: Boolean(vapidPublicKey()),
      hasActiveSubscription: Boolean(subscription),
      preferences: {
        pushEnabled: Boolean(preferences?.push_enabled ?? 1),
        awardUpdates: Boolean(preferences?.award_updates ?? 1),
        adminTasks: Boolean(preferences?.admin_tasks ?? 1),
        requestUpdates: Boolean(preferences?.request_updates ?? 1),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load notifications",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureNotificationSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date().toISOString();

    if (action === "mark_read") {
      const id = Number(body.id);
      await env.DB.prepare(
        "UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND recipient_user_id = ?",
      )
        .bind(now, id, user.id)
        .run();
      return Response.json({ ok: true });
    }
    if (action === "mark_all_read") {
      await env.DB.prepare(
        "UPDATE notifications SET read_at = ? WHERE recipient_user_id = ? AND read_at IS NULL",
      )
        .bind(now, user.id)
        .run();
      return Response.json({ ok: true });
    }
    if (action === "subscribe_push") {
      const subscription = body.subscription as
        | {
            endpoint?: unknown;
            keys?: { p256dh?: unknown; auth?: unknown };
          }
        | undefined;
      const endpoint = String(subscription?.endpoint ?? "");
      const p256dh = String(subscription?.keys?.p256dh ?? "");
      const auth = String(subscription?.keys?.auth ?? "");
      if (
        !endpoint.startsWith("https://") ||
        !p256dh ||
        !auth ||
        endpoint.length > 2000
      )
        return Response.json(
          { error: "Invalid push subscription" },
          { status: 400 },
        );
      await env.DB.prepare(
        `INSERT INTO push_subscriptions
         (user_id, endpoint, p256dh, auth, user_agent, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           user_id = excluded.user_id, p256dh = excluded.p256dh,
           auth = excluded.auth, user_agent = excluded.user_agent,
           active = 1, updated_at = excluded.updated_at`,
      )
        .bind(
          user.id,
          endpoint,
          p256dh,
          auth,
          request.headers.get("user-agent")?.slice(0, 500) ?? "",
          now,
          now,
        )
        .run();
      return Response.json({ ok: true });
    }
    if (action === "unsubscribe_push") {
      const endpoint = String(body.endpoint ?? "");
      await env.DB.prepare(
        "UPDATE push_subscriptions SET active = 0, updated_at = ? WHERE endpoint = ? AND user_id = ?",
      )
        .bind(now, endpoint, user.id)
        .run();
      return Response.json({ ok: true });
    }
    if (action === "update_preferences") {
      const values = Object.fromEntries(
        allowedPreferenceKeys.map((key) => [key, body[key] !== false ? 1 : 0]),
      );
      await env.DB.prepare(
        `INSERT INTO notification_preferences
         (user_id, push_enabled, award_updates, admin_tasks, request_updates, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           push_enabled = excluded.push_enabled,
           award_updates = excluded.award_updates,
           admin_tasks = excluded.admin_tasks,
           request_updates = excluded.request_updates,
           updated_at = excluded.updated_at`,
      )
        .bind(
          user.id,
          values.pushEnabled,
          values.awardUpdates,
          values.adminTasks,
          values.requestUpdates,
          now,
        )
        .run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update notifications",
      },
      { status: 500 },
    );
  }
}
