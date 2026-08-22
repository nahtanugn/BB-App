import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("company operations migration remains additive and preserves historical roll-call data", async () => {
  const migration = await source("../drizzle/0031_company_operations.sql");
  for (const table of [
    "parade_plans", "duty_assignments", "leave_requests", "promotion_rules",
    "service_hour_submissions", "band_instruments", "emergency_sessions", "event_committees",
  ]) assert.match(migration, new RegExp("CREATE TABLE IF NOT EXISTS `" + table + "`"));
  assert.match(migration, /operations_idempotency_keys/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM members|ALTER TABLE members/);
});

test("operations API enforces squad scope, final authority, and decision safety", async () => {
  const [api, permissions] = await Promise.all([
    source("../app/api/company-operations/route.ts"),
    source("../lib/company-operations.ts"),
  ]);
  assert.match(permissions, /canManageScopedPermission/);
  assert.match(permissions, /user\.member_section === section && user\.squad === squad/);
  assert.match(api, /canManageScopedPermission\(user,"leave\.review_squad"/);
  assert.match(api, /canManageScopedPermission\(user,"service\.verify_squad"/);
  assert.match(api, /attendance_records\.status='unmarked'/);
  assert.match(api, /Existing attendance was preserved/);
  assert.match(api, /Defective instruments cannot be issued/);
  assert.match(api, /The member rank was not changed automatically/);
  assert.match(api, /operations_idempotency_keys/);
  assert.match(api, /const allowedSquads = new Set\(\["Alpha", "Bravo", "Charlie", "Delta"\]\)/);
  assert.match(api, /!row\.squad \|\| row\.squad === user\.squad/);
  assert.doesNotMatch(api, /start_emergency|update_emergency_response|close_emergency|view_emergency_contact/);
  assert.doesNotMatch(api, /UPDATE members SET rank/);
});

test("active operations are linked into the shared role-aware shell", async () => {
  const [shell, standalone, centre, roles, automation, journey, styles] = await Promise.all([
    source("../app/AppShell.tsx"),
    source("../app/StandaloneApp.tsx"),
    source("../app/CompanyOperationsCentre.tsx"),
    source("../app/CustomRoleManager.tsx"),
    source("../lib/automation.ts"),
    source("../app/MemberJourney.tsx"),
    source("../app/globals.css"),
  ]);
  for (const route of ["parades", "duties", "committees", "leave", "promotion", "service", "band"])
    assert.match(shell, new RegExp(`"${route}"`));
  assert.doesNotMatch(shell, /Emergency roll call|route: "emergency"/);
  assert.match(standalone, /CompanyOperationsCentre/);
  assert.match(centre, /Parade planner/);
  assert.doesNotMatch(centre, /Emergency roll call|Start roll call/);
  assert.match(centre, /<option value="">Everyone<\/option>/);
  assert.doesNotMatch(centre, /<input name="squad"/);
  assert.match(roles, /programme\.plans\.manage/);
  assert.doesNotMatch(roles, /emergency\.manage|emergency\.view_contacts/);
  assert.match(automation, /band_maintenance/);
  assert.match(automation, /committee_tasks/);
  assert.match(journey, /Promotion readiness/);
  assert.match(journey, /VERIFIED SERVICE/);
  assert.match(styles, /\.operations-callout \{[^}]*padding: 24px;[^}]*display: flex;/);
  assert.match(styles, /\.operations-callout > \.primary \{[^}]*display: inline-flex;/);
});
