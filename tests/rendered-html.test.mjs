import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the 11KCHBB App application shell and sharing metadata", async () => {
  const [layout, tracker, standalone] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StandaloneApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /11KCHBB App · BB Senior Award Tracker/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /\/app-photo\.jpeg/);
  assert.match(layout, /\/app-photo\.jpeg/);
  assert.match(tracker, /Preparing your award records/);
  assert.match(tracker, /Attendance dates/);
  assert.match(tracker, /Member details/);
  assert.match(tracker, /School/);
  assert.match(tracker, /Contact Number/);
  assert.match(tracker, /Emergency Contact Number/);
  assert.match(tracker, /Parents Name/);
  assert.match(tracker, /<option>Alpha<\/option>/);
  assert.match(tracker, /<option>Bravo<\/option>/);
  assert.match(tracker, /<option>Charlie<\/option>/);
  assert.match(tracker, /<option>Delta<\/option>/);
  assert.match(standalone, /Company portal/);
  assert.match(standalone, /Create your administrator account/);
  assert.match(standalone, /Edit account/);
  assert.match(standalone, /Save changes/);
});

test("ships the Malaysia Senior Section catalogue, role-based portals and installable shell", async () => {
  const [route, authRoute, resourcesRoute, submissionsRoute, memberProgressRoute, resourceLibrary, submissions, memberProgress, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/resources/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/member-progress/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ResourceLibrary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardSubmissions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MemberProgress.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(route, /Members' Handbook · August 2024/);
  assert.match(route, /President's Award/);
  assert.match(route, /Financial Stewardship/);
  assert.match(route, /name: "Arts"/);
  assert.match(route, /name: "Crafts"/);
  assert.match(route, /name: "Hobbies"/);
  assert.match(route, /name: "Bandsman"/);
  assert.match(route, /name: "Bugler"/);
  assert.match(route, /name: "Drummer"/);
  assert.match(route, /name: "Piper"/);
  assert.match(route, /Scholastics Bronze/);
  assert.match(route, /Scholastics Silver/);
  assert.match(route, /Scholastics Gold/);
  assert.match(route, /create_attendance_session/);
  assert.match(route, /update_attendance/);
  assert.match(route, /emergency_contact_number/);
  assert.match(route, /parents_name/);
  assert.match(route, /const allowedSquads = \["Alpha", "Bravo", "Charlie", "Delta"\]/);
  assert.doesNotMatch(route, /Alicia Tan|Daniel Lim|Megan Lee|Joshua Wong/);
  assert.match(route, /Sign in required/);
  assert.match(route, /user\.role === "member"/);
  assert.match(route, /Member accounts can access resources only/);
  assert.match(authRoute, /PBKDF2|passwordDigest/);
  assert.match(authRoute, /Administrator access required/);
  assert.match(authRoute, /action === "update_user"/);
  assert.match(authRoute, /You cannot remove your own administrator role/);
  assert.match(authRoute, /createOrLinkMemberProfile/);
  assert.match(authRoute, /'Private', 'Alpha'/);
  assert.match(authRoute, /role === "member"/);
  assert.match(authRoute, /\["admin", "officer", "nco", "member"\]/);
  assert.match(resourcesRoute, /user\.role === "member"/);
  assert.match(resourcesRoute, /user\.role === "nco"/);
  assert.match(resourcesRoute, /Resources are read-only for this account/);
  assert.match(route, /NCO accounts can manage attendance only/);
  assert.match(route, /\["create_attendance_session", "update_attendance"\]/);
  assert.match(route, /awards: \[\]/);
  assert.match(resourceLibrary, /Resource library/);
  assert.match(resourceLibrary, /user\.role !== "member"/);
  assert.match(resourceLibrary, /user\.role !== "nco"/);
  assert.match(submissionsRoute, /Only member accounts can submit award applications/);
  assert.match(submissionsRoute, /Officer access required/);
  assert.match(submissionsRoute, /submitted_by_user_id = \?/);
  assert.match(submissions, /Apply for an award/);
  assert.match(submissions, /Submit application/);
  assert.match(submissions, /Approve/);
  assert.match(submissions, /Reject/);
  assert.match(memberProgressRoute, /user\.role !== "member"/);
  assert.match(memberProgressRoute, /LOWER\(email\) = LOWER\(\?\)/);
  assert.match(memberProgressRoute, /Math\.round\(\(present \/ total\) \* 100\)/);
  assert.match(memberProgress, /MY PROGRESS/);
  assert.match(memberProgress, /AWARDS MATRIX/);
  assert.match(memberProgress, /View only/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /app-photo\.jpeg/);
  assert.match(serviceWorker, /11kchbb-app-v1/);
});
