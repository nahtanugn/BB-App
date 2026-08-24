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
  assert.match(route, /COUNT\(DISTINCT s\.id\) AS sessions/);
  assert.match(route, /substr\(joined_at,1,4\) joined_year/);
  assert.doesNotMatch(route, /section,joined_year,/);
  assert.match(route, /Associate Member and Alumni totals are temporarily unavailable/);
});

test("company statistics loading failures resolve to a retryable error state", () => {
  const source = read("app/CompanyStatisticsCentre.tsx");
  assert.match(source, /setLoading\(false\)/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /Statistics could not be loaded/);
  assert.match(source, />Try again</);
});

test("company statistics separates the working screen into clear report stages", () => {
  const source = read("app/CompanyStatisticsCentre.tsx");
  const styles = read("app/globals.css");
  for (const section of ["official-report", "data-review", "sign-off"]) {
    assert.match(source, new RegExp(`id=\"${section}\"`));
    assert.match(source, new RegExp(`href=\"#${section}\"`));
  }
  assert.match(styles, /\.stats-work-nav/);
  assert.match(styles, /\.stats-page-section-heading/);
  assert.match(styles, /@media \(max-width: 720px\)[^{]*\{[^}]*\.company-statistics-page/s);
});

test("company statistics exports a dedicated official report with a useful filename", () => {
  const source = read("app/CompanyStatisticsCentre.tsx");
  const pdf = read("app/lib/company-statistics-pdf.ts");
  assert.match(source, /const title = `Company Statistics \$\{year\}`/);
  assert.match(source, /popup\.document\.title = title/);
  assert.match(source, /link\.download = `Company Statistics \$\{year\}\.pdf`/);
  assert.match(source, /generateCompanyStatisticsPdf/);
  assert.match(pdf, /document\.addPage\(\[841\.89, 595\.28\]\)/);
  assert.match(pdf, /ASSOCIATE MEMBERS AND ALUMNI/);
  assert.match(pdf, /FOR OFFICER USE ONLY/);
  assert.match(source, /Associate Members and Alumni/);
  assert.match(source, /For Officer Use Only/);
  assert.doesNotMatch(source, /cloneNode\(true\)/);
});

test("company statistics is reachable from Manage and the shared shell", () => {
  assert.match(read("app/ManageHub.tsx"), /company-statistics/);
  assert.match(read("app/AppShell.tsx"), /Company Statistics/);
  assert.match(read("app/StandaloneApp.tsx"), /CompanyStatisticsCentre/);
});

test("company statistics uses the complete official officer-rank list", () => {
  const source = read("app/CompanyStatisticsCentre.tsx");
  assert.match(source, /Male \(M\)/);
  assert.match(source, /Female \(F\)/);
  for (const rank of ["Staff Sergeant", "Warrant Officer", "Lieutenant", "Captain", "Honorary Captain", "Chaplain"]) assert.match(source, new RegExp(rank));
  assert.doesNotMatch(source, /M means Male and F means Female/);
  assert.match(source, /\(A\) Members re-enrolled/);
  assert.match(source, /\(B\) Recruits/);
  assert.match(source, /Sub Total \(A\+B\)/);
  assert.match(source, /Warrant Officers/);
  assert.match(source, /TOTAL MEMBERSHIP as at/);
  assert.match(source, /Associate Members (?:&amp;|and) Alumni/);
});

test("company statistics links fixed Malaysian classifications to member and officer profiles", () => {
  const source = read("app/CompanyStatisticsCentre.tsx");
  const route = read("app/api/company-statistics/route.ts");
  for (const classification of ["Accepted Christ", "Baptised", "Non-Believer"]) assert.match(source, new RegExp(classification));
  for (const ethnicity of ["Chinese", "Indian", "Bumi", "Others"]) assert.match(source, new RegExp(ethnicity));
  assert.match(source, /Members Section/);
  assert.match(source, /Officers Section/);
  assert.match(route, /function ethnicityGroup/);
  assert.match(route, /officer_rank/);
  assert.doesNotMatch(source, /New ethnicity category/);
  assert.doesNotMatch(source, /Add ethnicity/);
});

test("religion and spiritual status remain optional classifications", () => {
  const route = read("app/api/company-statistics/route.ts");
  const tracker = read("app/AwardTracker.tsx");
  assert.doesNotMatch(route, /!member\.spiritual_status/);
  assert.doesNotMatch(route, /!officer\.spiritual_status/);
  assert.match(tracker, /Religion \(optional\)/);
  assert.match(tracker, /Spiritual status \(optional\)/);
});

test("officer demographic profiles are additive and available in account management", () => {
  const migration = read("drizzle/0035_demographic_profiles.sql");
  const admin = read("app/AdminCentre.tsx");
  for (const column of ["officer_rank", "gender", "ethnicity", "religion", "spiritual_status", "officer_work_status"]) assert.ok(migration.includes(`ADD COLUMN \`${column}\``));
  assert.match(admin, /Officer Section details/);
  for (const rank of ["Staff Sergeant", "Warrant Officer", "Lieutenant", "Captain", "Honorary Captain", "Chaplain"]) assert.match(admin, new RegExp(rank));
});
