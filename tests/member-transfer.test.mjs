import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("member profiles collect and display ethnicity", () => {
  const tracker = read("app/AwardTracker.tsx");
  const route = read("app/api/tracker/route.ts");
  assert.match(tracker, /Ethnicity \(race\)/);
  assert.match(tracker, /name="ethnicity"/);
  assert.match(route, /\["Ethnicity", ethnicity\]/);
  assert.match(route, /parents_name, ethnicity, is_demo/);
});

test("Junior to Senior transfer retains the member and resets rank safely", () => {
  const route = read("app/api/tracker/route.ts");
  assert.match(route, /action === "transfer_member_to_senior"/);
  assert.match(route, /hasOperationalAdminAccess\(user\)/);
  assert.match(route, /UPDATE members SET section = 'senior', rank = 'Private'/);
  assert.match(route, /INSERT INTO member_transfers/);
  assert.match(route, /UPDATE registration_details SET section = 'senior'/);
  assert.match(route, /action: "member_transferred"/);
  assert.doesNotMatch(route, /transfer_member_to_senior[\s\S]{0,2500}DELETE FROM members/);
});
