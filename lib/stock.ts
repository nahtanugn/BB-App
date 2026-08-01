import type { AppUser } from "./auth";

export const STOCK_PERMISSIONS = [
  "stock.view_uniform",
  "stock.manage_uniform",
  "stock.issue_uniform",
  "stock.view_awards",
  "stock.manage_awards",
  "stock.issue_awards",
  "stock.adjust",
  "stock.view_history",
  "stock.export",
  "stock.manage_uniform_requests",
  "stock.stocktake",
] as const;

export type StockPermission = (typeof STOCK_PERMISSIONS)[number];

export const APP_PERMISSIONS = [
  ...STOCK_PERMISSIONS,
  "members.view",
  "members.create",
  "members.edit",
  "members.delete",
  "attendance.view",
  "attendance.manage",
  "awards.view",
  "awards.manage",
  "submissions.view",
  "submissions.review",
  "subscriptions.company.view",
  "subscriptions.company.manage",
  "subscriptions.band.view",
  "subscriptions.band.manage",
  "resources.view_all",
  "resources.manage",
  "announcements.publish",
  "announcements.manage",
  "exports.full",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

type SeedItem = {
  key: string;
  name: string;
  type: "uniform" | "award";
  section: "senior" | "junior" | "shared";
  category: string;
  variant?: string;
  condition?: "current" | "old" | "defective";
  quantity: number;
  notes?: string;
};

const uniformSeeds: SeedItem[] = [
  ...[
    ["S", 0], ["M", 0], ["L", 0], ["XL", 0],
  ].map(([variant, quantity]) => ({ key: `uniform-senior-shirt-${variant}`, name: "Navy Blue Shirt", type: "uniform" as const, section: "senior" as const, category: "Shirt", variant: String(variant), quantity: Number(quantity) })),
  ...[
    ["28", 1], ["30", 3], ["32", 0], ["34", 0], ["36", 0], ["38", 2], ["40", 0], ["42", 0],
  ].map(([variant, quantity]) => ({ key: `uniform-trousers-${variant}`, name: "Navy Blue Trousers", type: "uniform" as const, section: "shared" as const, category: "Trousers", variant: String(variant), quantity: Number(quantity) })),
  ...[
    ["S", 3], ["M", 4], ["L", 3], ["XL", 1],
  ].map(([variant, quantity]) => ({ key: `uniform-company-shirt-${variant}`, name: "Company T-shirt", type: "uniform" as const, section: "shared" as const, category: "Shirt", variant: String(variant), quantity: Number(quantity) })),
  ...[
    ["39", 0], ["40", 0], ["41", 0], ["42", 0], ["43", 0], ["44", 1],
  ].map(([variant, quantity]) => ({ key: `uniform-boots-${variant}`, name: "Marching Boots", type: "uniform" as const, section: "shared" as const, category: "Footwear", variant: String(variant), quantity: Number(quantity) })),
  ...[
    ["56", 0], ["58", 2], ["60", 6],
  ].map(([variant, quantity]) => ({ key: `uniform-cap-${variant}`, name: "Cap (excluding badge)", type: "uniform" as const, section: "shared" as const, category: "Headwear", variant: String(variant), quantity: Number(quantity) })),
  { key: "uniform-glengarry-56", name: "Glengarry", type: "uniform", section: "shared", category: "Headwear", variant: "56", quantity: 0, notes: "Imported from workbook label “Glenggary 56”." },
  ...[
    ["Haversack", 1], ["Haversack Loop", 5], ["Slide", 3], ["Pin", 0],
    ["Leather Belt", 3], ["Belt Buckle", 2], ["Sky Blue Tie", 0], ["Navy Blue Socks", 0],
    ["Senior Cap Badge", 0], ["Senior Right Armlet", 5], ["Senior Left Armlet", 13],
    ["Chevron · Lance Corporal", 6], ["Chevron · Corporal", 2], ["Chevron · Sergeant", 1], ["Chevron · Staff Sergeant", 0],
    ["Red Sash (Sergeant)", 0], ["Blue Sash (Staff Sergeant)", 0],
    ["Armlet · Lance Corporal", 3], ["Armlet · Corporal", 0], ["Armlet · Sergeant", 1], ["Armlet · Staff Sergeant", 0],
    ["White Lanyard", 4], ["Lanyard Whistle", 2],
  ].map(([name, quantity]) => ({ key: `uniform-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "uniform" as const, section: "senior" as const, category: "Accessory", quantity: Number(quantity) })),
  ...[
    ["XS", 0], ["S", 0], ["M", 4], ["L", 1], ["XL", 6], ["XXL", 2],
  ].map(([variant, quantity]) => ({ key: `uniform-junior-shirt-${variant}`, name: "Junior Navy Blue Shirt", type: "uniform" as const, section: "junior" as const, category: "Shirt", variant: String(variant), quantity: Number(quantity) })),
  ...[
    ["White Nylon Belt", 10], ["Junior Cap Badge", 7], ["Junior Right Armlet", 1], ["Junior Left Armlet", 9],
    ["White Nylon Lanyard", 0], ["Blue Nylon Lanyard", 4], ["Red Nylon Lanyard", 0], ["Junior Leader Armlet", 2],
  ].map(([name, quantity]) => ({ key: `uniform-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "uniform" as const, section: "junior" as const, category: "Accessory", quantity: Number(quantity) })),
  { key: "uniform-defective-senior-cap-badge", name: "Senior Cap Badge", type: "uniform", section: "senior", category: "Defective stock", condition: "defective", quantity: 1, notes: "Defective quantity recorded in the source workbook." },
  { key: "uniform-defective-junior-cap-badge", name: "Junior Cap Badge", type: "uniform", section: "junior", category: "Defective stock", condition: "defective", quantity: 1, notes: "Defective quantity recorded in the source workbook." },
  { key: "uniform-defective-cap", name: "Cap", type: "uniform", section: "shared", category: "Defective stock", variant: "Size not stated", condition: "defective", quantity: 3, notes: "The workbook records three defective caps without a size." },
];

const awardSeeds: SeedItem[] = [
  ...[
    ["Scholastics Bronze", 18], ["Scholastics Silver", 2], ["Scholastics Gold", 2],
    ["Junior Service", 11], ["Link Badge", 13],
    ["NCO Proficiency", 0], ["Advanced Patch", 27],
  ].map(([name, quantity]) => ({ key: `award-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "senior" as const, category: "Special Awards", quantity: Number(quantity) })),
  ...[
    ["Three Year Service", 12], ["Long (Five) Year Service", 1],
  ].map(([name, quantity]) => ({ key: `award-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "senior" as const, category: "Service Awards", quantity: Number(quantity) })),
  { key: "award-one-year-service-current", name: "One Year Service · Senior", type: "award", section: "senior", category: "Service Awards", condition: "current", quantity: 5 },
  { key: "award-one-year-service-old", name: "One Year Service · Senior", type: "award", section: "senior", category: "Service Awards", condition: "old", quantity: 3 },
  ...[
    ["Target", 7], ["Christian Education", 13], ["Drill", 3], ["Recruitment", 11],
  ].map(([name, quantity]) => ({ key: `award-compulsory-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "senior" as const, category: "Compulsory", quantity: Number(quantity) })),
  { key: "award-target-old", name: "Target", type: "award", section: "senior", category: "Compulsory", condition: "old", quantity: 3 },
  ...[
    ["Arts", 6], ["Crafts", 18], ["Hobbies", 3], ["Bandsman", 5], ["Buglers", 0], ["Drummers", 0], ["Pipers", 0],
    ["Communication", 6], ["Computer Knowledge", 3], ["Financial Stewardship", 0], ["International Relations", 0], ["Nature Awareness", 28],
  ].map(([name, quantity]) => ({ key: `award-interest-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "senior" as const, category: "A · Interest", quantity: Number(quantity) })),
  ...[
    ["Camping", 17], ["Expedition", 8], ["Water Adventure", 1],
  ].map(([name, quantity]) => ({ key: `award-adventure-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "senior" as const, category: "B · Adventure", quantity: Number(quantity) })),
  ...[
    ["Citizenship", 0], ["First Aid", 18], ["Fire & Rescue", 19], ["Life Saving", 0], ["Safety", 5], ["Social Entrepreneurship", 0], ["Sustainability", 0],
  ].map(([name, quantity]) => ({ key: `award-community-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "senior" as const, category: "C · Community", quantity: Number(quantity) })),
  { key: "award-community-service-current", name: "Community Service", type: "award", section: "senior", category: "C · Community", condition: "current", quantity: 2 },
  { key: "award-community-service-old", name: "Community Service", type: "award", section: "senior", category: "C · Community", condition: "old", quantity: 13 },
  { key: "award-environment-current", name: "Environmental Conservation", type: "award", section: "senior", category: "C · Community", condition: "current", quantity: 8 },
  { key: "award-environment-old", name: "Environmental Conservation", type: "award", section: "senior", category: "C · Community", condition: "old", quantity: 1 },
  ...[
    ["Athletics", 3], ["Gymnastics", 0], ["Physical Training", 8], ["Sports", 0], ["Swimming", 8],
  ].map(([name, quantity]) => ({ key: `award-physical-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "senior" as const, category: "D · Physical", quantity: Number(quantity) })),
  ...[
    ["Recruitment Award", 1], ["One Year Service · Junior", 35], ["White", 3], ["Green", 2], ["Purple", 6], ["Blue", 7], ["Red", 11], ["Silver", 15],
  ].map(([name, quantity]) => ({ key: `award-junior-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: String(name), type: "award" as const, section: "junior" as const, category: "Junior Awards", quantity: Number(quantity) })),
  { key: "award-warrant-officer-collar", name: "Warrant Officer Collar", type: "award", section: "senior", category: "Rank accessory", quantity: 3 },
  { key: "award-target-defective", name: "Target", type: "award", section: "senior", category: "Defective stock", condition: "defective", quantity: 1 },
  { key: "award-first-aid-defective", name: "First Aid", type: "award", section: "senior", category: "Defective stock", condition: "defective", quantity: 1 },
];

const seeds = [...uniformSeeds, ...awardSeeds];
let initialized = false;

export async function ensureStockSchema(db: D1Database) {
  if (initialized) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS custom_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT NOT NULL DEFAULT '#2878d4',
      description TEXT NOT NULL DEFAULT '',
      permissions TEXT NOT NULL DEFAULT '[]',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_custom_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      expires_at TEXT,
      assigned_by INTEGER NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES custom_roles(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      stock_type TEXT NOT NULL,
      section TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      variant TEXT NOT NULL DEFAULT '',
      condition TEXT NOT NULL DEFAULT 'current',
      reorder_level INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity_delta INTEGER NOT NULL,
      member_id INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES stock_items(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS stock_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      actor_user_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS uniform_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      submitted_by_user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      review_notes TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      ready_at TEXT,
      issued_at TEXT,
      issued_by TEXT,
      cancelled_at TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (item_id) REFERENCES stock_items(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS stocktakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'counting',
      scope TEXT NOT NULL DEFAULT 'all',
      started_by INTEGER NOT NULL,
      started_by_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      confirmed_by INTEGER,
      confirmed_by_name TEXT,
      confirmed_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS stocktake_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stocktake_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      expected_quantity INTEGER NOT NULL,
      counted_quantity INTEGER,
      difference_reason TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (stocktake_id) REFERENCES stocktakes(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES stock_items(id),
      UNIQUE(stocktake_id, item_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS stock_transactions_item_idx ON stock_transactions(item_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS user_custom_roles_user_idx ON user_custom_roles(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS uniform_requests_member_idx ON uniform_requests(member_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS uniform_requests_status_idx ON uniform_requests(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS stocktake_lines_stocktake_idx ON stocktake_lines(stocktake_id)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS total FROM stock_items").first<{ total: number }>();
  if (!count?.total) {
    const now = new Date().toISOString();
    for (const seed of seeds) {
      const item = await db.prepare(`INSERT INTO stock_items
        (source_key, name, stock_type, section, category, variant, condition, reorder_level, notes, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?)`)
        .bind(seed.key, seed.name, seed.type, seed.section, seed.category, seed.variant ?? "", seed.condition ?? "current", seed.notes ?? "", now, now)
        .run();
      await db.prepare(`INSERT INTO stock_transactions
        (item_id, transaction_type, quantity_delta, notes, created_by, created_by_name, created_at)
        VALUES (?, 'opening_balance', ?, 'Imported from 11KCHBB Company Stock.xlsx', 0, 'Opening stock import', ?)`)
        .bind(Number(item.meta.last_row_id), seed.quantity, now)
        .run();
    }
  }
  await db.batch([
    db.prepare(`UPDATE stock_items SET category = 'Special Awards'
      WHERE stock_type = 'award' AND section = 'senior'
        AND name IN ('Scholastics Bronze', 'Scholastics Silver', 'Scholastics Gold',
          'Junior Service', 'Link Badge', 'NCO Proficiency', 'Advanced Patch')`),
    db.prepare(`UPDATE stock_items SET category = 'Service Awards'
      WHERE stock_type = 'award' AND section = 'senior'
        AND name IN ('One Year Service · Senior', 'Three Year Service', 'Long (Five) Year Service')`),
    db.prepare(`UPDATE stock_items SET category = 'Junior Awards'
      WHERE stock_type = 'award' AND section = 'junior'`),
    db.prepare(`UPDATE stock_items SET category = 'Shirts'
      WHERE stock_type = 'uniform'
        AND name IN ('Navy Blue Shirt', 'Junior Navy Blue Shirt', 'Company T-shirt')`),
    db.prepare(`UPDATE stock_items SET category = 'Trousers'
      WHERE stock_type = 'uniform' AND name = 'Navy Blue Trousers'`),
    db.prepare(`UPDATE stock_items SET category = 'Footwear'
      WHERE stock_type = 'uniform' AND name IN ('Marching Boots', 'Navy Blue Socks')`),
    db.prepare(`UPDATE stock_items SET category = 'Headwear'
      WHERE stock_type = 'uniform'
        AND name IN ('Cap (excluding badge)', 'Cap', 'Glengarry', 'Senior Cap Badge', 'Junior Cap Badge')`),
    db.prepare(`UPDATE stock_items SET category = 'Belts & Sashes'
      WHERE stock_type = 'uniform'
        AND name IN ('Leather Belt', 'Belt Buckle', 'White Nylon Belt',
          'Red Sash (Sergeant)', 'Blue Sash (Staff Sergeant)')`),
    db.prepare(`UPDATE stock_items SET category = 'Rank Insignia & Armlets'
      WHERE stock_type = 'uniform'
        AND (name LIKE 'Chevron · %' OR name LIKE 'Armlet · %'
          OR name LIKE '% Right Armlet' OR name LIKE '% Left Armlet'
          OR name = 'Junior Leader Armlet')`),
    db.prepare(`UPDATE stock_items SET category = 'Lanyards & Whistles'
      WHERE stock_type = 'uniform'
        AND (name LIKE '%Lanyard%' OR name = 'Lanyard Whistle')`),
    db.prepare(`UPDATE stock_items SET category = 'Accessories'
      WHERE stock_type = 'uniform'
        AND name IN ('Haversack', 'Haversack Loop', 'Slide', 'Pin', 'Sky Blue Tie')`),
  ]);
  initialized = true;
}

export async function getCustomPermissions(db: D1Database, user: AppUser) {
  if (user.role === "viewer") return [];
  const tables = await db.prepare(`SELECT COUNT(*) AS total FROM sqlite_master
    WHERE type = 'table' AND name IN ('custom_roles', 'user_custom_roles')`)
    .first<{ total: number }>();
  if (Number(tables?.total ?? 0) < 2) return [];
  const rows = await db.prepare(`SELECT r.permissions
    FROM user_custom_roles ur
    JOIN custom_roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND (ur.expires_at IS NULL OR ur.expires_at > ?)`)
    .bind(user.id, new Date().toISOString())
    .all<{ permissions: string }>();
  const granted = new Set<string>();
  for (const row of rows.results) {
    try {
      const values = JSON.parse(row.permissions);
      if (Array.isArray(values)) values.forEach((value) => granted.add(String(value)));
    } catch {
      // Ignore malformed legacy role permission data.
    }
  }
  return APP_PERMISSIONS.filter((permission) => granted.has(permission));
}

export async function getStockPermissions(db: D1Database, user: AppUser) {
  if (user.role === "viewer") {
    return [
      "stock.view_uniform",
      "stock.view_awards",
      "stock.view_history",
      "stock.export",
    ];
  }
  if (user.role === "admin" || (user.temporary_access_role === "temporary_admin" && user.access_expires_at && user.access_expires_at > new Date().toISOString())) {
    return [...STOCK_PERMISSIONS];
  }
  const granted = new Set(await getCustomPermissions(db, user));
  return STOCK_PERMISSIONS.filter((permission) => granted.has(permission));
}

export function canViewStockType(permissions: string[], type: string) {
  return permissions.includes(type === "award" ? "stock.view_awards" : "stock.view_uniform");
}
