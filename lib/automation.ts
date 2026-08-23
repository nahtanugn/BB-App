import {
  activeUserIdForEmail,
  activeUserIdsForRoles,
  activeUserIdsForRolesOrPermission,
  createNotifications,
} from "./notifications";

export const AUTOMATION_RULES = [
  ["award_reviews", "Award reviews", ["admin", "officer"]],
  ["access_reviews", "Registrations and corrections", ["admin", "officer"]],
  ["incomplete_onboarding", "Incomplete onboarding", ["admin"]],
  ["uniform_requests", "Uniform requests", ["admin", "officer"]],
  ["attendance_unmarked", "Unmarked attendance", ["admin", "officer"]],
  ["event_reminders", "Upcoming meetings and events", ["member", "nco", "squad_leader"]],
  ["low_stock", "Low stock", ["admin", "officer"]],
  ["access_expiry", "Expiring temporary access", ["admin"]],
  ["data_quality", "Member data quality", ["admin", "officer"]],
  ["company_subscription", "Company subscriptions", ["admin", "officer"]],
  ["band_subscription", "Band subscriptions", ["admin", "officer"]],
  ["company_statistics", "Annual company statistics", ["admin", "officer"]],
  ["duty_rosters", "Duty rosters", ["admin", "officer"]],
  ["committee_tasks", "Committee tasks", ["admin", "officer"]],
  ["leave_requests", "Leave requests", ["admin", "officer"]],
  ["service_verification", "Service verification", ["admin", "officer"]],
  ["band_maintenance", "Band instrument maintenance", ["admin", "officer"]],
] as const;

type RuleKey = (typeof AUTOMATION_RULES)[number][0];
type Candidate = {
  ruleKey: RuleKey;
  sourceType: string;
  sourceId: string;
  recipientUserIds: number[];
  title: string;
  description: string;
  targetUrl: string;
  priority?: "normal" | "important" | "urgent";
  dueAt?: string | null;
  reminderDays?: number[];
};

export async function ensureAutomationSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS automation_rules (
      rule_key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      reminder_days TEXT NOT NULL DEFAULT '[3,7]',
      recipient_roles TEXT NOT NULL DEFAULT '[]',
      due_month_day TEXT NOT NULL DEFAULT '',
      updated_by INTEGER,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS automation_action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key TEXT NOT NULL UNIQUE,
      rule_key TEXT NOT NULL,
      recipient_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      target_url TEXT NOT NULL DEFAULT '/',
      priority TEXT NOT NULL DEFAULT 'normal',
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      due_at TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_seen_run_id INTEGER,
      last_notified_at TEXT,
      snoozed_until TEXT,
      resolved_at TEXT,
      FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_count INTEGER NOT NULL DEFAULT 0,
      resolved_count INTEGER NOT NULL DEFAULT 0,
      notification_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT NOT NULL DEFAULT ''
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS automation_locks (
      lock_key TEXT PRIMARY KEY,
      locked_until TEXT NOT NULL,
      owner TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS automation_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      daily_time TEXT NOT NULL DEFAULT '08:00',
      weekly_time TEXT NOT NULL DEFAULT '08:00',
      updated_by INTEGER,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS automation_schedule_runs (
      schedule_key TEXT PRIMARY KEY,
      ran_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automation_items_recipient_status ON automation_action_items(recipient_user_id, status, due_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automation_items_rule_status ON automation_action_items(rule_key, status, last_seen_run_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON automation_runs(started_at)"),
  ]);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO automation_settings (id, daily_time, weekly_time, updated_at)
    VALUES (1, '08:00', '08:00', ?) ON CONFLICT(id) DO NOTHING`).bind(now).run();
  for (const [ruleKey, , roles] of AUTOMATION_RULES)
    await db.prepare(`INSERT INTO automation_rules
      (rule_key, enabled, reminder_days, recipient_roles, due_month_day, updated_at)
      VALUES (?, 1, '[3,7]', ?, '', ?)
      ON CONFLICT(rule_key) DO NOTHING`)
      .bind(ruleKey, JSON.stringify(roles), now)
      .run();
  await db.batch([
    db.prepare("UPDATE automation_rules SET enabled = 0, updated_at = ? WHERE rule_key = 'emergency_roll_call'").bind(now),
    db.prepare("UPDATE automation_action_items SET status = 'resolved', resolved_at = ? WHERE rule_key = 'emergency_roll_call' AND status IN ('open','snoozed')").bind(now),
  ]);
}

function kuchingParts(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuching",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    date: `${values.year}-${values.month}-${values.day}`,
    monthDay: `${values.month}-${values.day}`,
    weekday: values.weekday,
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuching",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date),
  };
}

async function roleIds(_db: D1Database, roles: string[]) {
  return activeUserIdsForRoles(roles);
}

async function enabledRules(db: D1Database) {
  const rows = await db.prepare("SELECT rule_key, enabled, reminder_days, recipient_roles, due_month_day FROM automation_rules").all<{
    rule_key: RuleKey;
    enabled: number;
    reminder_days: string;
    recipient_roles: string;
    due_month_day: string;
  }>();
  return new Map(rows.results.map((row) => [row.rule_key, row]));
}

function parseList(value: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

function configuredRoles(
  rules: Awaited<ReturnType<typeof enabledRules>>,
  key: RuleKey,
  fallback: string[],
) {
  return parseList(rules.get(key)?.recipient_roles ?? "[]", fallback)
    .filter((role) => ["admin", "officer", "nco", "squad_leader", "member"].includes(role));
}

function configuredReminderDays(
  rules: Awaited<ReturnType<typeof enabledRules>>,
  key: RuleKey,
) {
  return parseList(rules.get(key)?.reminder_days ?? "[3,7]", ["3", "7"])
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 30);
}

async function collectCandidates(db: D1Database, now: Date) {
  const candidates: Candidate[] = [];
  const rules = await enabledRules(db);
  const enabled = (key: RuleKey) => Boolean(rules.get(key)?.enabled);

  if (enabled("award_reviews")) {
    const recipients = await activeUserIdsForRolesOrPermission(
      configuredRoles(rules, "award_reviews", ["admin", "officer"]),
      "submissions.review",
    );
    const rows = await db.prepare("SELECT id FROM award_submissions WHERE status = 'pending' AND archived_at IS NULL").all<{ id: number }>();
    for (const row of rows.results)
      candidates.push({
        ruleKey: "award_reviews", sourceType: "award_submission", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Award submission awaiting review",
        description: "A Senior Section award application needs a decision.",
        targetUrl: "/?open=submissions", priority: "important",
      });
  }

  if (enabled("access_reviews")) {
    const configured = configuredRoles(rules, "access_reviews", ["admin", "officer"]);
    const admins = await roleIds(db, configured.filter((role) => role === "admin"));
    const officers = await roleIds(db, configured.filter((role) => ["admin", "officer"].includes(role)));
    const registrations = await db.prepare("SELECT id FROM users WHERE account_status = 'pending'").all<{ id: number }>();
    for (const row of registrations.results)
      candidates.push({
        ruleKey: "access_reviews", sourceType: "registration", sourceId: String(row.id),
        recipientUserIds: admins, title: "Member registration awaiting review",
        description: "A member access request needs administrator review.",
        targetUrl: "/?open=onboarding", priority: "important",
      });
    const corrections = await db.prepare(`SELECT requests.id, members.squad
      FROM profile_correction_requests requests JOIN members ON members.id = requests.member_id
      WHERE requests.status = 'pending'`).all<{ id: number; squad: string }>();
    for (const row of corrections.results) {
      const squad = await db.prepare(`SELECT id FROM users WHERE active = 1 AND account_status = 'active'
        AND role IN ('nco','squad_leader') AND squad = ?`).bind(row.squad).all<{ id: number }>();
      candidates.push({
        ruleKey: "access_reviews", sourceType: "profile_correction", sourceId: String(row.id),
        recipientUserIds: [...officers, ...squad.results.map((item) => item.id)],
        title: "Profile correction awaiting review",
        description: "A member’s proposed details need review.",
        targetUrl: "/?open=onboarding",
      });
    }
  }

  if (enabled("incomplete_onboarding")) {
    const recipients = await roleIds(db, configuredRoles(rules, "incomplete_onboarding", ["admin"]));
    const rows = await db.prepare(`SELECT id FROM users WHERE active = 1 AND account_status = 'active'
      AND (must_change_password = 1 OR onboarding_completed_at IS NULL)`).all<{ id: number }>();
    for (const row of rows.results)
      candidates.push({
        ruleKey: "incomplete_onboarding", sourceType: "user", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Onboarding is incomplete",
        description: "An active account still has required setup steps.",
        targetUrl: "/?open=onboarding",
      });
  }

  if (enabled("uniform_requests")) {
    const recipients = await activeUserIdsForRolesOrPermission(
      configuredRoles(rules, "uniform_requests", ["admin", "officer"]),
      "stock.manage_uniform_requests",
    );
    const rows = await db.prepare("SELECT id FROM uniform_requests WHERE status IN ('pending','approved','ready')").all<{ id: number }>();
    for (const row of rows.results)
      candidates.push({
        ruleKey: "uniform_requests", sourceType: "uniform_request", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Uniform request needs action",
        description: "A member uniform request is still open.",
        targetUrl: "/?open=uniform-requests",
      });
  }

  if (enabled("attendance_unmarked")) {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = await db.prepare(`SELECT sessions.id, sessions.section, members.squad, COUNT(*) AS missing
      FROM attendance_sessions sessions
      JOIN members ON members.section = sessions.section
      LEFT JOIN users ON LOWER(users.email) = LOWER(members.email)
      LEFT JOIN attendance_records records ON records.session_id = sessions.id AND records.member_id = members.id
      WHERE sessions.meeting_date <= ? AND (records.status IS NULL OR records.status = 'unmarked')
        AND (sessions.audience != 'nco_council' OR users.role IN ('nco', 'squad_leader'))
      GROUP BY sessions.id, sessions.section, members.squad`).bind(cutoff).all<{
        id: number; section: string; squad: string; missing: number;
      }>();
    const company = await roleIds(
      db,
      configuredRoles(rules, "attendance_unmarked", ["admin", "officer"])
        .filter((role) => ["admin", "officer"].includes(role)),
    );
    for (const row of rows.results) {
      const squad = await db.prepare(`SELECT id FROM users WHERE active = 1 AND account_status = 'active'
        AND role IN ('nco','squad_leader') AND squad = ?`).bind(row.squad).all<{ id: number }>();
      candidates.push({
        ruleKey: "attendance_unmarked", sourceType: "attendance_session", sourceId: `${row.id}:${row.squad}`,
        recipientUserIds: [...company, ...squad.results.map((item) => item.id)],
        title: "Attendance is incomplete",
        description: `${row.missing} attendance record${row.missing === 1 ? "" : "s"} remain unmarked for ${row.squad} Squad.`,
        targetUrl: "/?open=attendance", priority: "important",
      });
    }
  }

  if (enabled("event_reminders")) {
    const from = now.toISOString().slice(0, 10);
    const until = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    const rows = await db.prepare(`SELECT id, title, event_date, section, audience FROM company_events
      WHERE cancelled_at IS NULL AND event_date >= ? AND event_date <= ?`).bind(from, until).all<{
        id: number; title: string; event_date: string; section: string; audience: string;
      }>();
    for (const row of rows.results) {
      const recipients = await db.prepare(`SELECT users.id FROM users JOIN members
        ON LOWER(members.email) = LOWER(users.email)
        WHERE users.active = 1 AND users.account_status = 'active' AND members.section IN (?, ?)
          AND (? != 'nco_council' OR users.role IN ('nco', 'squad_leader'))`)
        .bind(row.section === "all" ? "senior" : row.section, row.section === "all" ? "junior" : row.section, row.audience ?? "section_members")
        .all<{ id: number }>();
      candidates.push({
        ruleKey: "event_reminders", sourceType: "company_event", sourceId: String(row.id),
        recipientUserIds: recipients.results.map((recipient) => recipient.id),
        title: "Upcoming company event", description: `${row.title} is coming up soon.`,
        targetUrl: "/?open=events", priority: "normal",
      });
    }
  }

  if (enabled("low_stock")) {
    const recipients = await activeUserIdsForRolesOrPermission(
      configuredRoles(rules, "low_stock", ["admin", "officer"]),
      "stock.adjust",
    );
    const rows = await db.prepare(`SELECT items.id, items.name,
      COALESCE(SUM(transactions.quantity_delta), 0) AS quantity, items.reorder_level
      FROM stock_items items LEFT JOIN stock_transactions transactions ON transactions.item_id = items.id
      WHERE items.active = 1 AND items.condition != 'defective'
      GROUP BY items.id HAVING quantity <= items.reorder_level`).all<{
        id: number; name: string; quantity: number; reorder_level: number;
      }>();
    for (const row of rows.results)
      candidates.push({
        ruleKey: "low_stock", sourceType: "stock_item", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Stock at reorder level",
        description: `${row.name} has ${row.quantity} remaining.`,
        targetUrl: "/?open=stock", priority: "important",
      });
  }

  if (enabled("access_expiry")) {
    const recipients = await roleIds(db, configuredRoles(rules, "access_expiry", ["admin"]));
    const inSevenDays = new Date(now.getTime() + 7 * 86400000).toISOString();
    const temporary = await db.prepare(`SELECT id, access_expires_at FROM users
      WHERE access_expires_at > ? AND access_expires_at <= ? AND temporary_access_role != ''`)
      .bind(now.toISOString(), inSevenDays).all<{ id: number; access_expires_at: string }>();
    for (const row of temporary.results)
      candidates.push({
        ruleKey: "access_expiry", sourceType: "temporary_access", sourceId: String(row.id),
        recipientUserIds: [...recipients, row.id], title: "Temporary access is expiring",
        description: "Temporary operational access will end soon.",
        targetUrl: "/?open=admin", dueAt: row.access_expires_at, priority: "important",
      });
    const custom = await db.prepare(`SELECT user_id, role_id, expires_at FROM user_custom_roles
      WHERE expires_at > ? AND expires_at <= ?`).bind(now.toISOString(), inSevenDays)
      .all<{ user_id: number; role_id: number; expires_at: string }>();
    for (const row of custom.results)
      candidates.push({
        ruleKey: "access_expiry", sourceType: "custom_access", sourceId: `${row.user_id}:${row.role_id}`,
        recipientUserIds: [...recipients, row.user_id], title: "Custom access is expiring",
        description: "An additional access role will end soon.",
        targetUrl: "/?open=admin", dueAt: row.expires_at, priority: "important",
      });
  }

  if (enabled("data_quality")) {
    const recipients = await roleIds(db, configuredRoles(rules, "data_quality", ["admin", "officer"]));
    const localYear = kuchingParts(now).year;
    const incomplete = await db.prepare(`SELECT id FROM members WHERE TRIM(name) = '' OR TRIM(joined_at) = ''
      OR TRIM(school) = '' OR TRIM(contact_number) = '' OR TRIM(emergency_contact_number) = ''
      OR TRIM(email) = '' OR TRIM(parents_name) = ''`).all<{ id: number }>();
    for (const row of incomplete.results)
      candidates.push({
        ruleKey: "data_quality", sourceType: "member", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Member profile is incomplete",
        description: "Required member information needs attention.",
        targetUrl: "/?open=members",
      });
    const duplicates = await db.prepare(`SELECT LOWER(email) AS email FROM members WHERE TRIM(email) != ''
      GROUP BY LOWER(email) HAVING COUNT(*) > 1`).all<{ email: string }>();
    for (const row of duplicates.results)
      candidates.push({
        ruleKey: "data_quality", sourceType: "duplicate_email", sourceId: row.email,
        recipientUserIds: recipients, title: "Possible duplicate member email",
        description: "Two or more member profiles share an email address.",
        targetUrl: "/?open=members", priority: "important",
      });
    const unlinked = await db.prepare(`SELECT users.id FROM users
      LEFT JOIN members ON LOWER(members.email) = LOWER(users.email)
      WHERE users.active = 1 AND users.account_status = 'active'
        AND users.role IN ('member','nco','squad_leader') AND members.id IS NULL`)
      .all<{ id: number }>();
    for (const row of unlinked.results)
      candidates.push({
        ruleKey: "data_quality", sourceType: "unlinked_account", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Account is not linked to a member",
        description: "An operational or member account has no matching member profile.",
        targetUrl: "/?open=admin", priority: "important",
      });
    const invalidYears = await db.prepare(`SELECT id FROM members
      WHERE LENGTH(TRIM(joined_at)) != 4 OR CAST(joined_at AS INTEGER) < 1950
        OR CAST(joined_at AS INTEGER) > ?`).bind(localYear).all<{ id: number }>();
    for (const row of invalidYears.results)
      candidates.push({
        ruleKey: "data_quality", sourceType: "invalid_joining_year", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Joining year needs correction",
        description: "A member profile contains an invalid joining year.",
        targetUrl: "/?open=members",
      });
    const noAttendance = await db.prepare(`SELECT members.id FROM members
      WHERE NOT EXISTS (
        SELECT 1 FROM attendance_records WHERE attendance_records.member_id = members.id
      )`).all<{ id: number }>();
    for (const row of noAttendance.results)
      candidates.push({
        ruleKey: "data_quality", sourceType: "missing_attendance", sourceId: String(row.id),
        recipientUserIds: recipients, title: "Member has no attendance record",
        description: "A member profile has not yet been linked to any attendance record.",
        targetUrl: "/?open=attendance",
      });
    const noSubscription = await db.prepare(`SELECT members.id FROM members
      WHERE NOT EXISTS (
        SELECT 1 FROM member_subscriptions
        WHERE member_subscriptions.member_id = members.id AND member_subscriptions.year = ?
      )`).bind(localYear).all<{ id: number }>();
    for (const row of noSubscription.results)
      candidates.push({
        ruleKey: "data_quality", sourceType: "missing_subscription", sourceId: `${row.id}:${localYear}`,
        recipientUserIds: recipients, title: "Member has no yearly subscription record",
        description: `The ${localYear} company subscription record is missing.`,
        targetUrl: "/?open=subscriptions",
      });
  }

  const local = kuchingParts(now);
  for (const [key, title, bandOnly] of [
    ["company_subscription", "Company subscription is unpaid", false],
    ["band_subscription", "Band subscription is unpaid", true],
  ] as const) {
    const rule = rules.get(key);
    if (!rule?.enabled || !rule.due_month_day || local.monthDay < rule.due_month_day) continue;
    const rows = bandOnly
      ? await db.prepare(`SELECT members.id, members.email FROM members
          LEFT JOIN band_subscriptions subscriptions ON subscriptions.member_id = members.id AND subscriptions.year = ?
          WHERE members.band_member = 1 AND COALESCE(subscriptions.status, 'unpaid') = 'unpaid'`)
          .bind(local.year).all<{ id: number; email: string }>()
      : await db.prepare(`SELECT members.id, members.email FROM members
          LEFT JOIN member_subscriptions subscriptions ON subscriptions.member_id = members.id AND subscriptions.year = ?
          WHERE COALESCE(subscriptions.paid, 0) = 0`)
          .bind(local.year).all<{ id: number; email: string }>();
    const staffRecipients = await roleIds(db, configuredRoles(rules, key, ["admin", "officer"]));
    for (const row of rows.results) {
      const memberUserId = await activeUserIdForEmail(row.email);
      candidates.push({
        ruleKey: key, sourceType: bandOnly ? "band_subscription" : "company_subscription",
        sourceId: `${row.id}:${local.year}`,
        recipientUserIds: memberUserId ? [memberUserId, ...staffRecipients] : staffRecipients,
        title, description: `The ${local.year} record remains unpaid.`,
        targetUrl: "/?open=subscriptions",
      });
    }
  }

  const statisticsRule = rules.get("company_statistics");
  if (statisticsRule?.enabled && statisticsRule.due_month_day && local.monthDay >= statisticsRule.due_month_day) {
    const snapshot = await db.prepare("SELECT id FROM company_statistics WHERE reporting_year = ? AND status = 'final' LIMIT 1").bind(local.year).first<{ id: number }>();
    if (!snapshot) {
      const recipients = await roleIds(db, configuredRoles(rules, "company_statistics", ["admin", "officer"]));
      candidates.push({ ruleKey: "company_statistics", sourceType: "company_statistics", sourceId: String(local.year), recipientUserIds: recipients, title: "Annual company statistics need finalisation", description: `The ${local.year} company statistics snapshot is not finalised.`, targetUrl: "/?open=company-statistics", priority: "important" });
    }
  }

  if (enabled("duty_rosters")) {
    const recipients = await activeUserIdsForRolesOrPermission(configuredRoles(rules, "duty_rosters", ["admin", "officer"]), "programme.rosters.manage");
    const rows = await db.prepare("SELECT id, starts_at FROM duty_assignments WHERE member_id IS NULL AND status NOT IN ('completed','cancelled')").all<{ id: number; starts_at: string }>();
    for (const row of rows.results) candidates.push({ ruleKey: "duty_rosters", sourceType: "duty_assignment", sourceId: String(row.id), recipientUserIds: recipients, title: "Duty remains unfilled", description: "Assign a member before the duty begins.", targetUrl: "/?open=duties", priority: "important", dueAt: row.starts_at });
  }
  if (enabled("committee_tasks")) {
    const staff = await activeUserIdsForRolesOrPermission(configuredRoles(rules, "committee_tasks", ["admin", "officer"]), "programme.committees.manage");
    const rows = await db.prepare("SELECT id,title,deadline FROM committee_tasks WHERE status NOT IN ('completed','cancelled')").all<{ id: number; title: string; deadline: string | null }>();
    for (const row of rows.results) candidates.push({ ruleKey: "committee_tasks", sourceType: "committee_task", sourceId: String(row.id), recipientUserIds: staff, title: "Committee task outstanding", description: row.title, targetUrl: "/?open=committees", dueAt: row.deadline });
  }
  if (enabled("leave_requests")) {
    const recipients = await activeUserIdsForRolesOrPermission(configuredRoles(rules, "leave_requests", ["admin", "officer"]), "leave.approve");
    const rows = await db.prepare("SELECT id FROM leave_requests WHERE status='pending_final' AND withdrawn_at IS NULL").all<{ id: number }>();
    for (const row of rows.results) candidates.push({ ruleKey: "leave_requests", sourceType: "leave_request", sourceId: String(row.id), recipientUserIds: recipients, title: "Leave request needs final approval", description: "A squad-confirmed request needs an authorised decision.", targetUrl: "/?open=leave", priority: "important" });
  }
  if (enabled("service_verification")) {
    const recipients = await activeUserIdsForRolesOrPermission(configuredRoles(rules, "service_verification", ["admin", "officer"]), "service.approve");
    const rows = await db.prepare("SELECT id FROM service_hour_submissions WHERE status='pending_final'").all<{ id: number }>();
    for (const row of rows.results) candidates.push({ ruleKey: "service_verification", sourceType: "service_hours", sourceId: String(row.id), recipientUserIds: recipients, title: "Service hours need final approval", description: "Only fully verified hours count toward progress.", targetUrl: "/?open=service" });
  }
  if (enabled("band_maintenance")) {
    const recipients = await activeUserIdsForRolesOrPermission(configuredRoles(rules, "band_maintenance", ["admin", "officer"]), "band.manage_instruments");
    const rows = await db.prepare("SELECT id,name,maintenance_due_at,due_at FROM band_instruments WHERE active=1 AND (condition IN ('maintenance','defective') OR maintenance_due_at<=date('now') OR (current_holder_member_id IS NOT NULL AND due_at<date('now')))").all<{ id: number; name: string; maintenance_due_at: string | null; due_at: string | null }>();
    for (const row of rows.results) candidates.push({ ruleKey: "band_maintenance", sourceType: "band_instrument", sourceId: String(row.id), recipientUserIds: recipients, title: "Band instrument needs attention", description: `${row.name} needs maintenance or return follow-up.`, targetUrl: "/?open=band", priority: "important", dueAt: row.maintenance_due_at ?? row.due_at });
  }

  for (const candidate of candidates)
    candidate.reminderDays = configuredReminderDays(rules, candidate.ruleKey);
  return candidates;
}

async function yearlyUpkeep(db: D1Database, now: Date) {
  const local = kuchingParts(now);
  if (local.monthDay !== "01-01") return;
  const timestamp = now.toISOString();
  await db.batch([
    db.prepare(`INSERT INTO member_subscriptions (member_id, year, paid, updated_at, updated_by)
      SELECT id, ?, 0, ?, 'automation' FROM members WHERE 1 = 1
      ON CONFLICT(member_id, year) DO NOTHING`).bind(local.year, timestamp),
    db.prepare(`INSERT INTO band_subscriptions (member_id, year, status, updated_at, updated_by)
      SELECT id, ?, 'unpaid', ?, 'automation' FROM members WHERE band_member = 1
      ON CONFLICT(member_id, year) DO NOTHING`).bind(local.year, timestamp),
  ]);
}

async function expireAccess(db: D1Database, now: Date) {
  const timestamp = now.toISOString();
  const expiredTemporary = await db.prepare(`SELECT id FROM users WHERE temporary_access_role != ''
    AND access_expires_at IS NOT NULL AND access_expires_at <= ?`).bind(timestamp).all<{ id: number }>();
  if (expiredTemporary.results.length)
    await db.prepare(`UPDATE users SET temporary_access_role = '', access_expires_at = NULL
      WHERE temporary_access_role != '' AND access_expires_at IS NOT NULL AND access_expires_at <= ?`)
      .bind(timestamp).run();
  const expiredCustom = await db.prepare("SELECT user_id, role_id FROM user_custom_roles WHERE expires_at IS NOT NULL AND expires_at <= ?")
    .bind(timestamp).all<{ user_id: number; role_id: number }>();
  if (expiredCustom.results.length)
    await db.prepare("DELETE FROM user_custom_roles WHERE expires_at IS NOT NULL AND expires_at <= ?").bind(timestamp).run();
  for (const row of expiredTemporary.results)
    await db.prepare(`INSERT INTO onboarding_audit_log
      (action, subject_user_id, actor_name, details, created_at)
      VALUES ('temporary_access_expired', ?, 'Automation', ?, ?)`)
      .bind(row.id, JSON.stringify({ source: "scheduled_upkeep" }), timestamp).run();
  for (const row of expiredCustom.results)
    await db.prepare(`INSERT INTO onboarding_audit_log
      (action, subject_user_id, actor_name, details, created_at)
      VALUES ('custom_access_expired', ?, 'Automation', ?, ?)`)
      .bind(row.user_id, JSON.stringify({ roleId: row.role_id, source: "scheduled_upkeep" }), timestamp).run();
  for (const row of [...expiredTemporary.results.map((item) => ({ user_id: item.id, role_id: 0 })), ...expiredCustom.results])
    await createNotifications({
      recipientUserIds: [row.user_id],
      type: "admin",
      title: "Additional access ended",
      body: "Your time-limited additional access has expired.",
      targetUrl: "/",
      entityKey: `access-expired:${row.user_id}:${row.role_id}:${timestamp.slice(0, 10)}`,
    });
}

export async function runAutomation(
  db: D1Database,
  runType: "scheduled" | "weekly" | "manual" | "health" = "scheduled",
  at = new Date(),
) {
  await ensureAutomationSchema(db);
  const owner = crypto.randomUUID();
  const now = at.toISOString();
  const lockedUntil = new Date(at.getTime() + 15 * 60 * 1000).toISOString();
  const lock = await db.prepare(`INSERT INTO automation_locks (lock_key, locked_until, owner)
    VALUES ('daily', ?, ?) ON CONFLICT(lock_key) DO UPDATE SET
      locked_until = excluded.locked_until, owner = excluded.owner
    WHERE automation_locks.locked_until <= ?`).bind(lockedUntil, owner, now).run();
  if (!lock.meta.changes) return { skipped: true, reason: "Another automation run is active." };
  const run = await db.prepare(`INSERT INTO automation_runs (run_type, status, started_at)
    VALUES (?, 'running', ?)`).bind(runType, now).run();
  const runId = Number(run.meta.last_row_id);
  let created = 0;
  let notified = 0;
  try {
    await yearlyUpkeep(db, at);
    await expireAccess(db, at);
    const candidates = await collectCandidates(db, at);
    for (const candidate of candidates) {
      for (const recipientUserId of [...new Set(candidate.recipientUserIds)]) {
        const dedupeKey = `${candidate.ruleKey}:${candidate.sourceType}:${candidate.sourceId}:user:${recipientUserId}`;
        const existed = await db.prepare("SELECT id FROM automation_action_items WHERE dedupe_key = ?")
          .bind(dedupeKey).first<{ id: number }>();
        const result = await db.prepare(`INSERT INTO automation_action_items
          (dedupe_key, rule_key, recipient_user_id, title, description, target_url, priority,
           source_type, source_id, status, due_at, first_seen_at, last_seen_at, last_seen_run_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
          ON CONFLICT(dedupe_key) DO UPDATE SET
            title = excluded.title, description = excluded.description,
            target_url = excluded.target_url, priority = excluded.priority,
            due_at = excluded.due_at, last_seen_at = excluded.last_seen_at,
            last_seen_run_id = excluded.last_seen_run_id,
            status = CASE WHEN automation_action_items.status = 'resolved' THEN 'open' ELSE automation_action_items.status END,
            resolved_at = NULL`)
          .bind(
            dedupeKey, candidate.ruleKey, recipientUserId, candidate.title,
            candidate.description, candidate.targetUrl, candidate.priority ?? "normal",
            candidate.sourceType, candidate.sourceId, candidate.dueAt ?? null,
            now, now, runId,
          ).run();
        if (!existed && result.meta.changes) created += 1;
        const item = await db.prepare("SELECT id, first_seen_at, last_notified_at FROM automation_action_items WHERE dedupe_key = ?")
          .bind(dedupeKey).first<{ id: number; first_seen_at: string; last_notified_at: string | null }>();
        const ageDays = Math.floor((at.getTime() - new Date(item?.first_seen_at ?? now).getTime()) / 86400000);
        const remainingDays = candidate.dueAt
          ? Math.ceil((new Date(candidate.dueAt).getTime() - at.getTime()) / 86400000)
          : null;
        const expiryReminder =
          candidate.ruleKey === "access_expiry" &&
          remainingDays !== null &&
          [7, 1].includes(remainingDays);
        const notifyNow =
          !item?.last_notified_at ||
          (candidate.reminderDays ?? [3, 7]).includes(ageDays) ||
          expiryReminder;
        // Attendance follow-up remains in the Action Centre, but it is deliberately
        // not sent to the Notification Centre or as a device alert. A single meeting
        // can create several squad follow-ups, which makes the notification feed noisy.
        if (notifyNow && item && candidate.ruleKey !== "attendance_unmarked") {
          await createNotifications({
            recipientUserIds: [recipientUserId],
            type: candidate.ruleKey.includes("subscription") || candidate.ruleKey === "uniform_requests" ? "request" : candidate.ruleKey === "award_reviews" ? "award" : "admin",
            title: candidate.title,
            body: candidate.description,
            targetUrl: candidate.targetUrl,
            entityKey: `automation:${item.id}:day:${ageDays}`,
          });
          await db.prepare("UPDATE automation_action_items SET last_notified_at = ? WHERE id = ?").bind(now, item.id).run();
          notified += 1;
        }
      }
    }
    const resolved = await db.prepare(`UPDATE automation_action_items SET status = 'resolved', resolved_at = ?
      WHERE status IN ('open','snoozed') AND COALESCE(last_seen_run_id, 0) != ?`).bind(now, runId).run();
    const local = kuchingParts(at);
    if (runType === "weekly" && local.weekday === "Mon") {
      const staff = await roleIds(db, ["admin", "officer"]);
      for (const userId of staff) {
        const total = await db.prepare("SELECT COUNT(*) AS total FROM automation_action_items WHERE recipient_user_id = ? AND status = 'open'")
          .bind(userId).first<{ total: number }>();
        if (Number(total?.total ?? 0) > 0)
          await createNotifications({
            recipientUserIds: [userId],
            type: "admin",
            title: "Weekly company action summary",
            body: `${total?.total ?? 0} item${Number(total?.total ?? 0) === 1 ? "" : "s"} need your attention.`,
            targetUrl: "/?open=home",
            entityKey: `weekly-summary:${at.toISOString().slice(0, 10)}:${userId}`,
          });
      }
    }
    await db.prepare(`UPDATE automation_runs SET status = 'completed', completed_at = ?,
      created_count = ?, resolved_count = ?, notification_count = ? WHERE id = ?`)
      .bind(now, created, Number(resolved.meta.changes ?? 0), notified, runId).run();
    return { ok: true, runId, created, resolved: Number(resolved.meta.changes ?? 0), notified };
  } catch (error) {
    await db.prepare(`UPDATE automation_runs SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?`)
      .bind(now, error instanceof Error ? error.message.slice(0, 1000) : "Automation failed", runId).run();
    await createNotifications({
      recipientUserIds: await activeUserIdsForRoles(["admin"]),
      type: "system",
      title: "Automation check failed",
      body: "A scheduled operations check could not finish. Review Automation Centre.",
      targetUrl: "/?open=automation",
      entityKey: `automation-run-failed:${runId}`,
    });
    throw error;
  } finally {
    await db.prepare("DELETE FROM automation_locks WHERE lock_key = 'daily' AND owner = ?").bind(owner).run();
  }
}

export async function runScheduledAutomationTick(db: D1Database, at = new Date()) {
  await ensureAutomationSchema(db);
  const local = kuchingParts(at);
  const settings = await db.prepare("SELECT daily_time, weekly_time FROM automation_settings WHERE id = 1")
    .first<{ daily_time: string; weekly_time: string }>();
  const schedules = [
    {
      due: local.time >= (settings?.daily_time ?? "08:00"),
      key: `daily:${local.date}`,
      runType: "scheduled" as const,
    },
    {
      due: local.weekday === "Mon" && local.time >= (settings?.weekly_time ?? "08:00"),
      key: `weekly:${local.date}`,
      runType: "weekly" as const,
    },
  ];
  const results: unknown[] = [];
  for (const schedule of schedules) {
    if (!schedule.due) continue;
    const claim = await db.prepare(`INSERT INTO automation_schedule_runs (schedule_key, ran_at)
      VALUES (?, ?) ON CONFLICT(schedule_key) DO NOTHING`).bind(schedule.key, at.toISOString()).run();
    if (!claim.meta.changes) continue;
    try {
      results.push(await runAutomation(db, schedule.runType, at));
    } catch (error) {
      await db.prepare("DELETE FROM automation_schedule_runs WHERE schedule_key = ?").bind(schedule.key).run();
      throw error;
    }
  }
  return { ok: true, results };
}
