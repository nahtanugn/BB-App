import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the 11KCHBB App application shell and sharing metadata", async () => {
  const [layout, tracker, standalone] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StandaloneApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /11KCHBB App · BB Section Tracker/);
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
  assert.match(tracker, /type="month"/);
  assert.match(tracker, /serviceYearsFromJoined\(joinedAtDraft\)/);
  assert.match(tracker, /Calculated automatically from joining month/);
  assert.match(tracker, /joinedMonth\(member\.joined_at\)/);
  assert.match(tracker, /Member created successfully/);
  assert.match(tracker, /Attendance meeting created successfully/);
  assert.match(tracker, /setSubmissionMember\(member\)/);
  assert.match(tracker, /memberId=\{submissionMember\.id\}/);
  assert.match(tracker, /SUBMISSION NOTIFICATIONS/);
  assert.match(tracker, /submissionPendingTotal/);
  assert.match(tracker, /className="nav-badge"/);
  assert.match(tracker, /member-new-marker/);
  assert.match(tracker, /member-detail-summary/);
  assert.match(tracker, /Edit details/);
  assert.match(standalone, /Company portal/);
  assert.match(standalone, /Create your administrator account/);
  assert.match(standalone, /Edit account/);
  assert.match(standalone, /Save changes/);
  assert.match(standalone, /Account created successfully/);
  assert.match(standalone, /Delete\s*<\/button>/);
  assert.match(standalone, /value="squad_leader"/);
  assert.match(standalone, /Assigned squad/);
  assert.match(standalone, /Squad Leader · full view & NCO controls/);
  assert.match(standalone, /editingUser\.role === "squad_leader"/);
  assert.match(standalone, /newUserRole === "squad_leader"/);
});

test("ships the Malaysia Senior Section catalogue, role-based portals and installable shell", async () => {
  const [
    route,
    authRoute,
    resourcesRoute,
    submissionsRoute,
    memberProgressRoute,
    resourceLibrary,
    submissionsPage,
    submissions,
    memberProgress,
    manifest,
    serviceWorker,
    tracker,
  ] = await Promise.all([
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/resources/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/submissions/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/member-progress/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/ResourceLibrary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/SubmissionsPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardSubmissions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MemberProgress.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
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
  assert.match(
    route,
    /const allowedSquads = \["Alpha", "Bravo", "Charlie", "Delta"\]/,
  );
  assert.match(route, /Select a valid joining month and year/);
  assert.match(route, /calculateServiceYears\(joinedAt\)/);
  assert.match(route, /getSubmissionNotifications/);
  assert.match(route, /award_submissions\.status = 'pending'/);
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
  assert.match(authRoute, /action === "delete_user"/);
  assert.match(authRoute, /You cannot delete your own account/);
  assert.match(
    authRoute,
    /\["admin", "officer", "nco", "squad_leader", "member"\]/,
  );
  assert.match(authRoute, /role === "squad_leader"/);
  assert.match(
    authRoute,
    /UPDATE users SET name = \?, email = \?, role = \?, squad = \?/,
  );
  assert.match(resourcesRoute, /user\.role === "member"/);
  assert.match(resourcesRoute, /user\.role === "nco"/);
  assert.match(resourcesRoute, /Resources are read-only for this account/);
  assert.match(
    route,
    /NCO and Squad Leader accounts can manage attendance and edit member details only/,
  );
  assert.match(
    route,
    /"create_attendance_session"[\s\S]*"update_attendance"[\s\S]*"update_member"/,
  );
  assert.match(route, /\["nco", "squad_leader"\]\.includes\(user\.role\)/);
  assert.match(tracker, /Awards are shown in read-only mode/);
  assert.match(tracker, /disabled=\{!canManageAwards \|\| saving === key\}/);
  assert.match(tracker, /!canManageAttendance \|\| saving === key/);
  assert.match(tracker, /canEditMembers/);
  assert.match(tracker, /section-switch/);
  assert.match(tracker, /switchSection\("junior"\)/);
  assert.match(tracker, /Junior Gold Award pathway/);
  assert.match(route, /const juniorAwards/);
  assert.match(route, /NCO Proficiency Star/);
  assert.match(route, /code: "nco_proficiency"[\s\S]*?basic: 1,[\s\S]*?advanced: 1/);
  assert.match(route, /Duke of Edinburgh Bronze/);
  assert.match(route, /Duke of Edinburgh Silver/);
  assert.match(route, /Duke of Edinburgh Gold/);
  assert.match(route, /"White"/);
  assert.match(route, /WHERE section = \?/);
  assert.match(route, /attendance_sessions WHERE section = \?/);
  assert.match(resourceLibrary, /Resource library/);
  assert.match(resourceLibrary, /user\.role !== "member"/);
  assert.match(resourceLibrary, /user\.role !== "nco"/);
  assert.match(resourceLibrary, /Resource created successfully/);
  assert.doesNotMatch(resourceLibrary, /import AwardSubmissions/);
  assert.match(submissionsPage, /<AwardSubmissions user=\{user\}/);
  assert.match(submissionsPage, /Award submissions/);
  assert.match(
    submissionsRoute,
    /Only member accounts can submit award applications/,
  );
  assert.match(submissionsRoute, /Officer access required/);
  assert.match(submissionsRoute, /WHERE member_id = \?/);
  assert.match(submissionsRoute, /Select a member to view submissions/);
  assert.match(submissionsRoute, /LOWER\(email\) = LOWER\(\?\)/);
  assert.match(submissions, /Apply for an award/);
  assert.match(submissions, /Submit application/);
  assert.match(submissions, /Approve/);
  assert.match(submissions, /Reject/);
  assert.match(memberProgressRoute, /user\.role !== "member"/);
  assert.match(memberProgressRoute, /LOWER\(email\) = LOWER\(\?\)/);
  assert.match(
    memberProgressRoute,
    /Math\.round\(\(present \/ total\) \* 100\)/,
  );
  assert.match(memberProgress, /MY PROGRESS/);
  assert.match(memberProgress, /AWARDS MATRIX/);
  assert.match(memberProgress, /View only/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /app-photo\.jpeg/);
  assert.match(serviceWorker, /11kchbb-app-v1/);
});
