import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Associate Members and Alumni records are additive and auditable", () => {
  const migration = read("drizzle/0037_associates_and_alumni.sql");
  const api = read("app/api/associates/route.ts");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `associates_and_alumni`/);
  for (const field of ["classification", "gender", "work_status", "ethnicity", "religion", "spiritual_status", "active"]) assert.match(migration, new RegExp(field));
  for (const action of ["associate_alumni_created", "associate_alumni_updated", "associate_alumni_archived"]) assert.match(api, new RegExp(action));
  assert.match(api, /editableRoles = \["admin", "officer"\]/);
  assert.doesNotMatch(api, /if \(!religion\)/);
  assert.doesNotMatch(api, /if \(!spiritualStatus\)/);
});

test("Associate Members and Alumni have a dedicated read-only-aware People page", () => {
  const shell = read("app/AppShell.tsx");
  const standalone = read("app/StandaloneApp.tsx");
  const page = read("app/AssociatesAlumniSection.tsx");
  const styles = read("app/globals.css");
  assert.match(shell, /route: "associates"/);
  assert.match(shell, /Associates & Alumni/);
  assert.match(standalone, /<AssociatesAlumniSection role=\{currentUser\.role\}/);
  for (const classification of ["Associate Member", "Instructor", "Helper", "Alumni"]) assert.match(page, new RegExp(classification));
  assert.match(page, /role === "viewer"/);
  assert.match(page, /Religion \(optional\)/);
  assert.match(page, /Spiritual status \(optional\)/);
  assert.match(page, /Reason \(required\)/);
  assert.doesNotMatch(page, /disabled=\{busy \|\| !transfer\.sourceId \|\| !transfer\.reason\.trim\(\)\}/);
  assert.match(styles, /\.primary-button/);
  assert.match(styles, /\.secondary-button/);
  assert.match(styles, /@media \(max-width: 1120px\)[\s\S]*\.associate-section-page \.category-page-header/);
});

test("Company Statistics shows read-only totals linked to active directory records", () => {
  const api = read("app/api/company-statistics/route.ts");
  const page = read("app/CompanyStatisticsCentre.tsx");
  assert.match(api, /FROM associates_and_alumni WHERE active = 1/);
  assert.match(api, /person\.classification === "alumni"/);
  assert.match(api, /otherCounts/);
  assert.match(page, /open=associates/);
  assert.match(page, /stats-linked-row/);
  assert.match(page, /linked total/);
  assert.doesNotMatch(page, /Annual adjustment/);
  assert.doesNotMatch(page, /stats-number/);
});
