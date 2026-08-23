import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("member profiles collect and display ethnicity", () => {
  const tracker = read("app/AwardTracker.tsx");
  const route = read("app/api/tracker/route.ts");
  assert.match(tracker, /Ethnicity \(race\)/);
  assert.match(tracker, /standardEthnicities/);
  assert.match(tracker, /<select\s+name="ethnicity"/);
  for (const ethnicity of ["Chinese", "Malay", "Iban", "Bidayuh", "Melanau", "Indian", "Orang Ulu", "Others"]) assert.match(tracker, new RegExp(ethnicity));
  assert.match(route, /\["Ethnicity", ethnicity\]/);
  assert.match(route, /parents_name, ethnicity, religion, is_demo/);
});

test("member profiles collect and display religion separately", () => {
  const tracker = read("app/AwardTracker.tsx");
  const route = read("app/api/tracker/route.ts");
  const migration = read("drizzle/0034_member_religion.sql");
  assert.match(tracker, /standardReligions/);
  assert.match(tracker, /<select\s+name="religion"/);
  for (const religion of ["Christianity", "Islam", "Buddhism", "Hinduism", "Sikhism", "No religion"]) assert.match(tracker, new RegExp(religion));
  assert.match(route, /\["Religion", religion\]/);
  assert.match(route, /ethnicity, religion, is_demo/);
  assert.match(migration, /ADD COLUMN `religion` text NOT NULL DEFAULT ''/);
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

test("shared form controls use an explicit consistent size in Safari and mobile", () => {
  const css = read("app/globals.css");
  assert.match(css, /Final shared form-control sizing/);
  assert.match(css, /height: 48px !important/);
  assert.match(css, /height: 52px !important/);
  assert.match(css, /\.school-dropdown-trigger/);
});
