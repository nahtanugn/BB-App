import {
  integer,
  primaryKey,
  sqliteTable,
  text,
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
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
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
