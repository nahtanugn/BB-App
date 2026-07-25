import {
  getCurrentUser,
  getRuntimeEnv,
  hasTemporaryAdminAccess,
} from "../../../lib/auth";

const runtime = getRuntimeEnv();
let initialized = false;

async function ensureAnnouncementSchema() {
  if (initialized) return;
  await runtime.DB.batch([
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      expires_at TEXT,
      created_by_user_id INTEGER NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT,
      archived_by TEXT
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS announcement_reads (
      announcement_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (announcement_id, user_id),
      FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements(created_at)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS announcement_reads_user_idx ON announcement_reads(user_id)"),
  ]);
  initialized = true;
}

function canAnnounce(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return (
    ["admin", "officer", "nco", "squad_leader"].includes(user.role) ||
    hasTemporaryAdminAccess(user)
  );
}

function canArchive(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return (
    ["admin", "officer"].includes(user.role) ||
    hasTemporaryAdminAccess(user)
  );
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureAnnouncementSchema();
    const now = new Date().toISOString();
    const rows = await runtime.DB.prepare(`SELECT a.*,
      CASE WHEN r.user_id IS NULL THEN 0 ELSE 1 END AS is_read
      FROM announcements a
      LEFT JOIN announcement_reads r
        ON r.announcement_id = a.id AND r.user_id = ?
      WHERE a.archived_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > ?)
      ORDER BY CASE a.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        a.created_at DESC`)
      .bind(user.id, now)
      .all();
    const announcements = rows.results;
    const unread = announcements.filter((row) => !Number((row as { is_read?: number }).is_read));
    const url = new URL(request.url);
    if (url.searchParams.get("summary") === "1") {
      return Response.json({
        unreadCount: unread.length,
        latest: unread[0] ?? null,
        canAnnounce: canAnnounce(user),
      });
    }
    return Response.json({
      announcements,
      unreadCount: unread.length,
      canAnnounce: canAnnounce(user),
      canArchive: canArchive(user),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load announcements" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    await ensureAnnouncementSchema();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "create_announcement") {
      if (!canAnnounce(user)) return Response.json({ error: "Only officers and NCOs can publish announcements" }, { status: 403 });
      const title = String(body.title ?? "").trim();
      const message = String(body.body ?? "").trim();
      const priority = ["normal", "important", "urgent"].includes(String(body.priority)) ? String(body.priority) : "normal";
      const expiresOn = String(body.expiresOn ?? "");
      const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresOn) ? `${expiresOn}T15:59:59.999Z` : null;
      if (!title || !message) return Response.json({ error: "Enter a title and announcement message" }, { status: 400 });
      if (title.length > 120 || message.length > 4000) return Response.json({ error: "The announcement is too long" }, { status: 400 });
      await runtime.DB.prepare(`INSERT INTO announcements
        (title, body, priority, expires_at, created_by_user_id, created_by_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(title, message, priority, expiresAt, user.id, user.name, new Date().toISOString()).run();
      return Response.json({ ok: true });
    }

    if (action === "mark_all_read") {
      const now = new Date().toISOString();
      const active = await runtime.DB.prepare(`SELECT id FROM announcements
        WHERE archived_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`).bind(now).all<{ id: number }>();
      if (active.results.length) {
        await runtime.DB.batch(active.results.map((announcement) =>
          runtime.DB.prepare(`INSERT INTO announcement_reads (announcement_id, user_id, read_at)
            VALUES (?, ?, ?) ON CONFLICT(announcement_id, user_id) DO UPDATE SET read_at = excluded.read_at`)
            .bind(announcement.id, user.id, now),
        ));
      }
      return Response.json({ ok: true });
    }

    if (action === "archive_announcement") {
      if (!canArchive(user)) return Response.json({ error: "Officer access required" }, { status: 403 });
      const announcementId = Number(body.announcementId);
      await runtime.DB.prepare("UPDATE announcements SET archived_at = ?, archived_by = ? WHERE id = ?")
        .bind(new Date().toISOString(), user.name, announcementId).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown announcement action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update announcements" }, { status: 500 });
  }
}
