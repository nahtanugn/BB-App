import { type AppUser, getRuntimeEnv, hasOperationalAdminAccess } from "./auth";

const runtime = getRuntimeEnv();

export function canManageEvents(user: AppUser) {
  return hasOperationalAdminAccess(user);
}

export async function ensureEventSchema() {
  await runtime.DB.batch([
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS company_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, event_date TEXT NOT NULL,
      end_date TEXT, location TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL DEFAULT 'all', audience TEXT NOT NULL DEFAULT 'section_members', attendance_session_id INTEGER,
      created_by_user_id INTEGER NOT NULL, created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, cancelled_at TEXT
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, meeting_date TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Weekly Parade', section TEXT NOT NULL DEFAULT 'senior',
      audience TEXT NOT NULL DEFAULT 'section_members', created_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS event_rsvps (
      event_id INTEGER NOT NULL, member_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'going',
      note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
      PRIMARY KEY(event_id, member_id),
      FOREIGN KEY(event_id) REFERENCES company_events(id) ON DELETE CASCADE,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS member_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Personal', status TEXT NOT NULL DEFAULT 'open',
      created_by_user_id INTEGER NOT NULL, created_at TEXT NOT NULL, completed_at TEXT,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS event_recurrence (
      event_id INTEGER PRIMARY KEY, frequency TEXT NOT NULL, interval INTEGER NOT NULL DEFAULT 1,
      until_date TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY(event_id) REFERENCES company_events(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_company_events_section_date ON company_events(section, event_date)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_member_goals_member_status ON member_goals(member_id, status)"),
  ]);
  const eventColumns = await runtime.DB.prepare("PRAGMA table_info(company_events)").all<{ name: string }>();
  if (!eventColumns.results.some((column) => column.name === "audience"))
    await runtime.DB.prepare("ALTER TABLE company_events ADD COLUMN audience TEXT NOT NULL DEFAULT 'section_members'").run();
  const sessionColumns = await runtime.DB.prepare("PRAGMA table_info(attendance_sessions)").all<{ name: string }>();
  for (const [table, columns] of [["company_events", eventColumns], ["attendance_sessions", sessionColumns]] as const) {
    if (!columns.results.some((column) => column.name === "selected_member_ids"))
      await runtime.DB.prepare(`ALTER TABLE ${table} ADD COLUMN selected_member_ids TEXT NOT NULL DEFAULT '[]'`).run();
  }
  if (!sessionColumns.results.some((column) => column.name === "audience"))
    await runtime.DB.prepare("ALTER TABLE attendance_sessions ADD COLUMN audience TEXT NOT NULL DEFAULT 'section_members'").run();
}

export async function linkedMember(email: string) {
  return runtime.DB.prepare(`SELECT id, name, section, squad, school, contact_number,
    emergency_contact_number, parents_name FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1`)
    .bind(email).first<{
      id: number; name: string; section: string; squad: string; school: string;
      contact_number: string; emergency_contact_number: string; parents_name: string;
    }>();
}
