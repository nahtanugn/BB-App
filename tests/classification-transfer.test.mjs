import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("drizzle/0038_classification_transfers.sql", "utf8");
const api = readFileSync("app/api/associates/route.ts", "utf8");
const page = readFileSync("app/AssociatesAlumniSection.tsx", "utf8");
const statistics = readFileSync("app/api/company-statistics/route.ts", "utf8");

test("classification transfers preserve source records and are reversible", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `classification_transfers`/);
  assert.match(migration, /WHERE `reversed_at` IS NULL/);
  assert.doesNotMatch(api, /DELETE FROM members/);
  assert.match(api, /UPDATE members SET section = 'associate'/);
  assert.match(api, /UPDATE members SET section = \?, rank = \?, squad = \?/);
  assert.match(api, /classification_transfer_reversed/);
});

test("only administrators can transfer and linked logins are disabled safely", () => {
  assert.match(api, /user\.role !== "admin"/);
  assert.match(api, /You cannot transfer your own signed-in Administrator account/);
  assert.match(api, /UPDATE users SET active = 0, account_status = 'disabled'/);
  assert.match(api, /DELETE FROM sessions WHERE user_id = \?/);
});

test("active statistics and directories exclude transferred members", () => {
  assert.match(statistics, /section IN \('senior', 'junior'\)/);
  assert.match(page, /Transfer existing person/);
  assert.match(page, /Restore original section/);
  assert.match(page, /Existing history was preserved|history will be preserved/);
});
