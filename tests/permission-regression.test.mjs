import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("tracker enforces section and squad boundaries for NCO and Squad Leader accounts", async () => {
  const tracker = await source("../app/api/tracker/route.ts");

  assert.match(tracker, /const squadLimited = \["nco", "squad_leader"\]\.includes\(user\.role\)/);
  assert.match(tracker, /section !== user\.member_section/);
  assert.match(tracker, /members\.squad = \?/);
  assert.match(tracker, /m\.squad = \?/);
  assert.match(tracker, /target\.squad !== user\.squad/);
  assert.match(tracker, /You can only edit members in your assigned squad/);
  assert.match(tracker, /user\.squad/);
  assert.match(tracker, /NCO and Squad Leader accounts can add or edit members and manage attendance only/);
});

test("custom permissions are allow-listed, expire automatically, and cannot bypass Viewer read-only", async () => {
  const [auth, stock, stockApi, customRoles] = await Promise.all([
    source("../lib/auth.ts"),
    source("../lib/stock.ts"),
    source("../app/api/stock/route.ts"),
    source("../app/CustomRoleManager.tsx"),
  ]);

  assert.match(auth, /ur\.expires_at IS NULL OR ur\.expires_at > \?/);
  assert.match(auth, /if \(user\.role === "viewer"\) return \{ \.\.\.withOnboarding, custom_permissions: \[\] \}/);
  assert.match(stock, /return APP_PERMISSIONS\.filter\(\(permission\) => granted\.has\(permission\)\)/);
  assert.match(stock, /if \(user\.role === "viewer"\)/);
  assert.match(stock, /temporary_access_role === "temporary_admin"/);
  assert.match(stockApi, /Only administrators can manage custom roles/);
  assert.match(stockApi, /expires_at = excluded\.expires_at/);
  assert.match(customRoles, /resources\.view_all/);
  assert.match(customRoles, /stock\.view_uniform/);
});

test("restricted APIs keep mutations behind explicit permissions", async () => {
  const [resources, stock, submissions, auth] = await Promise.all([
    source("../app/api/resources/route.ts"),
    source("../app/api/stock/route.ts"),
    source("../app/api/submissions/route.ts"),
    source("../app/api/auth/route.ts"),
  ]);

  assert.match(resources, /Resources are read-only for this account/);
  assert.match(resources, /resources\.manage/);
  assert.match(stock, /Stock catalogue permission required/);
  assert.match(stock, /Issue permission required/);
  assert.match(stock, /Stock management permission required/);
  assert.match(submissions, /Admin, Temporary Admin or Officer access required/);
  assert.match(submissions, /submissions\.review/);
  assert.match(auth, /Administrator access required/);
  assert.match(auth, /action === "update_user"/);
  assert.match(auth, /action === "delete_user"/);
});

test("section boundaries prevent Junior data from entering the Senior submission portal", async () => {
  const [submissions, shell, tracker] = await Promise.all([
    source("../app/api/submissions/route.ts"),
    source("../app/AppShell.tsx"),
    source("../app/api/tracker/route.ts"),
  ]);

  assert.match(submissions, /requestedSection === "junior"/);
  assert.match(submissions, /Junior Section submission portal has been removed/);
  assert.match(submissions, /const section = "senior"/);
  assert.match(shell, /user\.member_section !== "junior"/);
  assert.match(tracker, /allowedSections/);
});

