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
