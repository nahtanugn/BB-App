import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  rank: text("rank").notNull().default("Private"),
  squad: text("squad").notNull().default("Unassigned"),
  joinedAt: text("joined_at").notNull(),
  serviceYears: integer("service_years").notNull().default(0),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const awardDefinitions = sqliteTable("award_definitions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sortOrder: integer("sort_order").notNull(),
  basicAvailable: integer("basic_available", { mode: "boolean" }).notNull().default(true),
  advancedAvailable: integer("advanced_available", { mode: "boolean" }).notNull().default(true),
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
  (table) => [primaryKey({ columns: [table.memberId, table.awardCode, table.level] })],
);

export const attendanceSessions = sqliteTable("attendance_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingDate: text("meeting_date").notNull(),
  title: text("title").notNull().default("Weekly Parade"),
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

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("officer"),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});
