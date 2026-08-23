import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  rank: text("rank").notNull().default("Private"),
  squad: text("squad").notNull().default("Unassigned"),
  section: text("section").notNull().default("senior"),
  joinedAt: text("joined_at").notNull(),
  serviceYears: integer("service_years").notNull().default(0),
  serviceAwardCount: integer("service_award_count").notNull().default(0),
  bandMember: integer("band_member", { mode: "boolean" }).notNull().default(false),
  school: text("school").notNull().default(""),
  contactNumber: text("contact_number").notNull().default(""),
  emergencyContactNumber: text("emergency_contact_number")
    .notNull()
    .default(""),
  email: text("email").notNull().default(""),
  parentsName: text("parents_name").notNull().default(""),
  gender: text("gender").notNull().default(""),
  ethnicity: text("ethnicity").notNull().default(""),
  acceptedChrist: integer("accepted_christ", { mode: "boolean" }).notNull().default(false),
  baptised: integer("baptised", { mode: "boolean" }).notNull().default(false),
  officerWorkStatus: text("officer_work_status").notNull().default(""),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const companyStatistics = sqliteTable("company_statistics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportingYear: integer("reporting_year").notNull(),
  status: text("status").notNull().default("draft"),
  lockedAt: text("locked_at"),
  lockedByUserId: integer("locked_by_user_id"),
  captainName: text("captain_name").notNull().default(""),
  chaplainName: text("chaplain_name").notNull().default(""),
  submissionDate: text("submission_date").notNull().default(""),
  receivedBy: text("received_by").notNull().default(""),
  dateReceived: text("date_received").notNull().default(""),
  dataEntryName: text("data_entry_name").notNull().default(""),
  remarks: text("remarks").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("company_statistics_year_idx").on(table.reportingYear)]);

export const companyStatisticsInputs = sqliteTable("company_statistics_inputs", {
  statisticsId: integer("statistics_id").primaryKey().references(() => companyStatistics.id, { onDelete: "cascade" }),
  payload: text("payload").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});

export const companyStatisticsMemberStatus = sqliteTable("company_statistics_member_status", {
  statisticsId: integer("statistics_id").notNull().references(() => companyStatistics.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  membershipStatus: text("membership_status").notNull().default("continuing"),
  categoryOverride: text("category_override").notNull().default(""),
  genderOverride: text("gender_override").notNull().default(""),
  ethnicityOverride: text("ethnicity_override").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.statisticsId, table.memberId] })]);

export const companyStatisticsAudit = sqliteTable("company_statistics_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  statisticsId: integer("statistics_id").notNull().references(() => companyStatistics.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actorUserId: integer("actor_user_id").notNull(),
  details: text("details").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const awardDefinitions = sqliteTable("award_definitions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  section: text("section").notNull().default("senior"),
  sortOrder: integer("sort_order").notNull(),
  basicAvailable: integer("basic_available", { mode: "boolean" })
    .notNull()
    .default(true),
  advancedAvailable: integer("advanced_available", { mode: "boolean" })
    .notNull()
    .default(true),
});

export const memberAwards = sqliteTable(
  "member_awards",
  {
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    awardCode: text("award_code")
      .notNull()
      .references(() => awardDefinitions.code, { onDelete: "cascade" }),
    level: text("level").notNull(),
    status: text("status").notNull().default("not_started"),
    awardedAt: text("awarded_at"),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.awardCode, table.level] }),
  ],
);

export const attendanceSessions = sqliteTable("attendance_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingDate: text("meeting_date").notNull(),
  title: text("title").notNull().default("Weekly Parade"),
  section: text("section").notNull().default("senior"),
  createdAt: text("created_at").notNull(),
});

export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    sessionId: integer("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("unmarked"),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.memberId] })],
);

export const memberSubscriptions = sqliteTable(
  "member_subscriptions",
  {
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.year] })],
);

export const bandSubscriptions = sqliteTable(
  "band_subscriptions",
  {
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    status: text("status").notNull().default("unpaid"),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.year] })],
);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("officer"),
  squad: text("squad").notNull().default(""),
  temporaryAccessRole: text("temporary_access_role").notNull().default(""),
  accessExpiresAt: text("access_expires_at"),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  accountStatus: text("account_status").notNull().default("active"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  onboardingCompletedAt: text("onboarding_completed_at"),
  profileConfirmedAt: text("profile_confirmed_at"),
  tourCompletedAt: text("tour_completed_at"),
  privacyNoticeVersion: integer("privacy_notice_version").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const registrationDetails = sqliteTable("registration_details", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  squad: text("squad").notNull(),
  joinedYear: text("joined_year").notNull(),
  school: text("school").notNull(),
  contactNumber: text("contact_number").notNull(),
  emergencyContactNumber: text("emergency_contact_number").notNull(),
  parentsName: text("parents_name").notNull(),
  suggestedMemberId: integer("suggested_member_id"),
  reviewNotes: text("review_notes").notNull().default(""),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const profileCorrectionRequests = sqliteTable("profile_correction_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  proposedValues: text("proposed_values").notNull(),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes").notNull().default(""),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const onboardingAuditLog = sqliteTable("onboarding_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  subjectUserId: integer("subject_user_id"),
  subjectMemberId: integer("subject_member_id"),
  actorUserId: integer("actor_user_id"),
  actorName: text("actor_name").notNull(),
  details: text("details").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  settingKey: text("setting_key").primaryKey(),
  settingValue: text("setting_value").notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: integer("updated_by"),
  updatedAt: text("updated_at").notNull(),
});

export const privacyNoticeVersions = sqliteTable("privacy_notice_versions", {
  version: integer("version").primaryKey(),
  noticeText: text("notice_text").notNull(),
  requireReacknowledgement: integer("require_reacknowledgement", { mode: "boolean" }).notNull().default(false),
  createdBy: integer("created_by"),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const authAttempts = sqliteTable("auth_attempts", {
  identity: text("identity").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: text("window_started_at").notNull(),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipientUserId: integer("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    targetUrl: text("target_url").notNull().default("/"),
    entityKey: text("entity_key").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("notifications_recipient_entity_unique").on(
      table.recipientUserId,
      table.entityKey,
    ),
    index("notifications_user_unread_idx").on(
      table.recipientUserId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("push_subscriptions_user_active_idx").on(table.userId, table.active),
  ],
);

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(true),
  awardUpdates: integer("award_updates", { mode: "boolean" }).notNull().default(true),
  adminTasks: integer("admin_tasks", { mode: "boolean" }).notNull().default(true),
  requestUpdates: integer("request_updates", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const automationRules = sqliteTable("automation_rules", {
  ruleKey: text("rule_key").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  reminderDays: text("reminder_days").notNull().default("[3,7]"),
  recipientRoles: text("recipient_roles").notNull().default("[]"),
  dueMonthDay: text("due_month_day").notNull().default(""),
  updatedBy: integer("updated_by"),
  updatedAt: text("updated_at").notNull(),
});

export const automationActionItems = sqliteTable(
  "automation_action_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dedupeKey: text("dedupe_key").notNull(),
    ruleKey: text("rule_key").notNull(),
    recipientUserId: integer("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    targetUrl: text("target_url").notNull().default("/"),
    priority: text("priority").notNull().default("normal"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull().default("open"),
    dueAt: text("due_at"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    lastSeenRunId: integer("last_seen_run_id"),
    lastNotifiedAt: text("last_notified_at"),
    snoozedUntil: text("snoozed_until"),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    uniqueIndex("automation_action_items_dedupe_unique").on(table.dedupeKey),
    index("automation_action_items_recipient_status_idx").on(
      table.recipientUserId,
      table.status,
      table.dueAt,
    ),
    index("automation_action_items_rule_status_idx").on(
      table.ruleKey,
      table.status,
      table.lastSeenRunId,
    ),
  ],
);

export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runType: text("run_type").notNull(),
    status: text("status").notNull().default("running"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    createdCount: integer("created_count").notNull().default(0),
    resolvedCount: integer("resolved_count").notNull().default(0),
    notificationCount: integer("notification_count").notNull().default(0),
    errorMessage: text("error_message").notNull().default(""),
  },
  (table) => [index("automation_runs_started_idx").on(table.startedAt)],
);

export const automationLocks = sqliteTable("automation_locks", {
  lockKey: text("lock_key").primaryKey(),
  lockedUntil: text("locked_until").notNull(),
  owner: text("owner").notNull(),
});

export const automationSettings = sqliteTable("automation_settings", {
  id: integer("id").primaryKey(),
  dailyTime: text("daily_time").notNull().default("08:00"),
  weeklyTime: text("weekly_time").notNull().default("08:00"),
  updatedBy: integer("updated_by"),
  updatedAt: text("updated_at").notNull(),
});

export const automationScheduleRuns = sqliteTable("automation_schedule_runs", {
  scheduleKey: text("schedule_key").primaryKey(),
  ranAt: text("ran_at").notNull(),
});

export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("General"),
  url: text("url").notNull(),
  accessLevel: text("access_level").notNull().default("member"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

export const awardSubmissions = sqliteTable("award_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id"),
  submittedByUserId: integer("submitted_by_user_id").notNull(),
  submittedByEmail: text("submitted_by_email").notNull(),
  memberName: text("member_name").notNull(),
  awardCode: text("award_code").notNull(),
  awardName: text("award_name").notNull(),
  level: text("level").notNull(),
  evidenceUrl: text("evidence_url").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes").notNull().default(""),
  submittedAt: text("submitted_at").notNull(),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  archivedAt: text("archived_at"),
  archivedBy: text("archived_by"),
});

export const customRoles = sqliteTable("custom_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#2878d4"),
  description: text("description").notNull().default(""),
  permissions: text("permissions").notNull().default("[]"),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userCustomRoles = sqliteTable(
  "user_custom_roles",
  {
    userId: integer("user_id").notNull(),
    roleId: integer("role_id").notNull(),
    expiresAt: text("expires_at"),
    assignedBy: integer("assigned_by").notNull(),
    assignedAt: text("assigned_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const stockItems = sqliteTable("stock_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceKey: text("source_key").notNull().unique(),
  name: text("name").notNull(),
  stockType: text("stock_type").notNull(),
  section: text("section").notNull(),
  category: text("category").notNull().default(""),
  variant: text("variant").notNull().default(""),
  condition: text("condition").notNull().default("current"),
  reorderLevel: integer("reorder_level").notNull().default(0),
  notes: text("notes").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const stockTransactions = sqliteTable("stock_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  transactionType: text("transaction_type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  memberId: integer("member_id"),
  notes: text("notes").notNull().default(""),
  createdBy: integer("created_by").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const stockAuditLog = sqliteTable("stock_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  details: text("details").notNull().default(""),
  actorUserId: integer("actor_user_id").notNull(),
  actorName: text("actor_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const uniformRequests = sqliteTable("uniform_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull(),
  submittedByUserId: integer("submitted_by_user_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes").notNull().default(""),
  submittedAt: text("submitted_at").notNull(),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  readyAt: text("ready_at"),
  issuedAt: text("issued_at"),
  issuedBy: text("issued_by"),
  cancelledAt: text("cancelled_at"),
});

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  priority: text("priority").notNull().default("normal"),
  expiresAt: text("expires_at"),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull(),
  archivedAt: text("archived_at"),
  archivedBy: text("archived_by"),
});

export const announcementReads = sqliteTable(
  "announcement_reads",
  {
    announcementId: integer("announcement_id").notNull(),
    userId: integer("user_id").notNull(),
    readAt: text("read_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.announcementId, table.userId] }),
  ],
);

export const companyEvents = sqliteTable("company_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  eventDate: text("event_date").notNull(),
  endDate: text("end_date"),
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  section: text("section").notNull().default("all"),
  audience: text("audience").notNull().default("section_members"),
  attendanceSessionId: integer("attendance_session_id"),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  cancelledAt: text("cancelled_at"),
});

export const eventRsvps = sqliteTable(
  "event_rsvps",
  {
    eventId: integer("event_id").notNull().references(() => companyEvents.id, { onDelete: "cascade" }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("going"),
    note: text("note").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.memberId] })],
);

export const memberGoals = sqliteTable("member_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("Personal"),
  status: text("status").notNull().default("open"),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});
