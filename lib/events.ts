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
      section TEXT NOT NULL DEFAULT 'all', attendance_session_id INTEGER,
      created_by_user_id INTEGER NOT NULL, created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, cancelled_at TEXT
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
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_company_events_section_date ON company_events(section, event_date)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_member_goals_member_status ON member_goals(member_id, status)"),
  ]);
}

export async function linkedMember(email: string) {
  return runtime.DB.prepare(`SELECT id, name, section, squad, school, contact_number,
    emergency_contact_number, parents_name FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1`)
    .bind(email).first<{
      id: number; name: string; section: string; squad: string; school: string;
      contact_number: string; emergency_contact_number: string; parents_name: string;
    }>();
}
