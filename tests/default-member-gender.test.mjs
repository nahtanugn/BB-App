import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Senior and Junior members default to Male throughout creation workflows", () => {
  const tracker = read("app/api/tracker/route.ts");
  const onboarding = read("app/api/onboarding/route.ts");
  const auth = read("app/api/auth/route.ts");
  const imports = read("app/api/feature-expansion/route.ts");
  const form = read("app/AwardTracker.tsx");

  assert.match(tracker, /toUpperCase\(\) \|\| "M"/);
  assert.match(onboarding, /parents_name, gender,[\s\S]*'M'/);
  assert.match(auth, /parents_name, gender, is_demo[\s\S]*'M'/);
  assert.match(imports, /band_member, gender, created_at[\s\S]*"M"/);
  assert.match(form, /defaultValue=\{editingMember\?\.gender \|\| "M"\}/);
});

test("gender backfill changes only blank Senior and Junior values", () => {
  const migration = read("drizzle/0036_default_member_gender.sql");
  assert.match(migration, /SET `gender` = 'M'/);
  assert.match(migration, /IN \('senior', 'junior'\)/);
  assert.match(migration, /TRIM\(COALESCE\(`gender`, ''\)\) = ''/);
});
