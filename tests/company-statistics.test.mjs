import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("company statistics has additive annual snapshot tables and member classifications", () => {
  const migration = read("drizzle/0033_company_statistics.sql");
  for (const table of ["company_statistics", "company_statistics_inputs", "company_statistics_member_status", "company_statistics_audit"]) assert.ok(migration.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``));
  for (const column of ["gender", "ethnicity", "accepted_christ", "baptised", "officer_work_status"]) assert.ok(migration.includes(`ADD COLUMN \`${column}\``));
});

test("company statistics route enforces roles, locks final years, and excludes future attendance", () => {
  const route = read("app/api/company-statistics/route.ts");
  assert.match(route, /Only Administrators and Officers may edit annual statistics/);
  assert.match(route, /row\.status === "final"/);
  assert.match(route, /s\.meeting_date <= date\('now'\)/);
  assert.match(route, /action === "reopen"/);
});

test("company statistics is reachable from Manage and the shared shell", () => {
  assert.match(read("app/ManageHub.tsx"), /company-statistics/);
  assert.match(read("app/AppShell.tsx"), /Company Statistics/);
  assert.match(read("app/StandaloneApp.tsx"), /CompanyStatisticsCentre/);
});

test("company statistics explains gender abbreviations and preserves Warrant Officer as one rank", () => {
  const source = read("app/CompanyStatisticsCentre.tsx");
  assert.match(source, /Male \(M\)/);
  assert.match(source, /Female \(F\)/);
  assert.match(source, /Warrant Officer — Working/);
  assert.doesNotMatch(source, /warrantWorkingM.*replace\(/);
});
