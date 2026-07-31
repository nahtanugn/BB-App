import { env } from "cloudflare:workers";
import {
  buildPushPayload,
  type PushSubscription,
} from "@block65/webcrypto-web-push";

type RuntimeEnv = {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

type NotificationInput = {
  recipientUserIds: number[];
  type: "award" | "admin" | "request" | "announcement" | "system";
  title: string;
  body: string;
  targetUrl?: string;
  entityKey: string;
};

const runtime = env as unknown as RuntimeEnv;
let schemaReady = false;

export async function ensureNotificationSchema() {
  if (schemaReady) return;
  await runtime.DB.batch([
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_url TEXT NOT NULL DEFAULT '/',
      entity_key TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (recipient_user_id, entity_key)
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY,
      push_enabled INTEGER NOT NULL DEFAULT 1,
      award_updates INTEGER NOT NULL DEFAULT 1,
      admin_tasks INTEGER NOT NULL DEFAULT 1,
      request_updates INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(recipient_user_id, read_at, created_at)",
    ),
    runtime.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON push_subscriptions(user_id, active)",
    ),
  ]);
  schemaReady = true;
}

function preferenceColumn(type: NotificationInput["type"]) {
  if (type === "award") return "award_updates";
  if (type === "request") return "request_updates";
  return "admin_tasks";
}

async function sendPush(
  userId: number,
  notification: Omit<NotificationInput, "recipientUserIds">,
) {
  if (!runtime.VAPID_PUBLIC_KEY || !runtime.VAPID_PRIVATE_KEY) return;
  const column = preferenceColumn(notification.type);
  const preference = await runtime.DB.prepare(
    `SELECT push_enabled, ${column} AS category_enabled
     FROM notification_preferences WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ push_enabled: number; category_enabled: number }>();
  if (preference && (!preference.push_enabled || !preference.category_enabled))
    return;
  const subscriptions = await runtime.DB.prepare(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? AND active = 1",
  )
    .bind(userId)
    .all<{ id: number; endpoint: string; p256dh: string; auth: string }>();
  await Promise.all(
    subscriptions.results.map(async (row) => {
      try {
        const subscription: PushSubscription = {
          endpoint: row.endpoint,
          expirationTime: null,
          keys: { p256dh: row.p256dh, auth: row.auth },
        };
        const payload = await buildPushPayload(
          {
            data: JSON.stringify({
              title: notification.title,
              body: notification.body,
              url: notification.targetUrl ?? "/",
              tag: notification.entityKey,
            }),
            options: { ttl: 60 * 60 * 12, urgency: "normal" },
          },
          subscription,
          {
            publicKey: runtime.VAPID_PUBLIC_KEY,
            privateKey: runtime.VAPID_PRIVATE_KEY,
            subject:
              runtime.VAPID_SUBJECT ?? "mailto:11thkuchingbb@gmail.com",
          },
        );
        const response = await fetch(row.endpoint, payload);
        if (response.status === 404 || response.status === 410)
          await runtime.DB.prepare(
            "UPDATE push_subscriptions SET active = 0, updated_at = ? WHERE id = ?",
          )
            .bind(new Date().toISOString(), row.id)
            .run();
      } catch {
        // Push delivery is best-effort. The durable in-app notification remains.
      }
    }),
  );
}

export async function createNotifications(input: NotificationInput) {
  try {
    await ensureNotificationSchema();
    const recipientUserIds = [...new Set(input.recipientUserIds)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    const createdAt = new Date().toISOString();
    for (const recipientUserId of recipientUserIds) {
      const result = await runtime.DB.prepare(
        `INSERT INTO notifications
         (recipient_user_id, type, title, body, target_url, entity_key, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM users
           WHERE id = ? AND active = 1 AND account_status = 'active'
         )
         ON CONFLICT(recipient_user_id, entity_key) DO NOTHING`,
      )
        .bind(
          recipientUserId,
          input.type,
          input.title,
          input.body,
          input.targetUrl ?? "/",
          input.entityKey,
          createdAt,
          recipientUserId,
        )
        .run();
      if (result.meta.changes)
        await sendPush(recipientUserId, {
          type: input.type,
          title: input.title,
          body: input.body,
          targetUrl: input.targetUrl,
          entityKey: input.entityKey,
        });
    }
  } catch {
    // Never fail or duplicate the primary workflow because an alert could not be delivered.
  }
}

export async function activeUserIdsForRoles(roles: string[]) {
  if (!roles.length) return [];
  const placeholders = roles.map(() => "?").join(", ");
  const rows = await runtime.DB.prepare(
    `SELECT id FROM users
     WHERE active = 1 AND account_status = 'active'
       AND role IN (${placeholders})`,
  )
    .bind(...roles)
    .all<{ id: number }>();
  return rows.results.map((row) => row.id);
}

export async function activeUserIdsForRolesOrPermission(
  roles: string[],
  permission: string,
) {
  const placeholders = roles.map(() => "?").join(", ");
  const rows = await runtime.DB.prepare(
    `SELECT DISTINCT users.id FROM users
     LEFT JOIN user_custom_roles ON user_custom_roles.user_id = users.id
       AND (user_custom_roles.expires_at IS NULL OR user_custom_roles.expires_at > ?)
     LEFT JOIN custom_roles ON custom_roles.id = user_custom_roles.role_id
     WHERE users.active = 1 AND users.account_status = 'active'
       AND (
         users.role IN (${placeholders})
         OR custom_roles.permissions LIKE ?
       )`,
  )
    .bind(
      new Date().toISOString(),
      ...roles,
      `%"${permission}"%`,
    )
    .all<{ id: number }>();
  return rows.results.map((row) => row.id);
}

export async function activeUserIdForEmail(email: string) {
  const row = await runtime.DB.prepare(
    `SELECT id FROM users
     WHERE LOWER(email) = LOWER(?) AND active = 1 AND account_status = 'active'
     LIMIT 1`,
  )
    .bind(email)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export function vapidPublicKey() {
  return runtime.VAPID_PUBLIC_KEY ?? "";
}
