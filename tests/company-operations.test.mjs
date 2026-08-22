import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("company operations migration is additive and covers all eight workspaces", async () => {
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
  assert.match(api, /emergency_contact_viewed/);
  assert.match(api, /operations_idempotency_keys/);
  assert.doesNotMatch(api, /UPDATE members SET rank/);
});

test("all operations are linked into the shared role-aware shell", async () => {
  const [shell, standalone, centre, roles, automation, journey] = await Promise.all([
    source("../app/AppShell.tsx"),
    source("../app/StandaloneApp.tsx"),
    source("../app/CompanyOperationsCentre.tsx"),
    source("../app/CustomRoleManager.tsx"),
    source("../lib/automation.ts"),
    source("../app/MemberJourney.tsx"),
  ]);
  for (const route of ["parades", "duties", "committees", "leave", "promotion", "service", "band", "emergency"])
    assert.match(shell, new RegExp(`"${route}"`));
  assert.match(standalone, /CompanyOperationsCentre/);
  assert.match(centre, /Parade planner/);
  assert.match(centre, /Emergency roll call/);
  assert.match(roles, /programme\.plans\.manage/);
  assert.match(roles, /emergency\.view_contacts/);
  assert.match(automation, /band_maintenance/);
  assert.match(automation, /committee_tasks/);
  assert.match(journey, /Promotion readiness/);
  assert.match(journey, /VERIFIED SERVICE/);
});
