import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the customisable application shell and sharing metadata", async () => {
  const [layout, tracker, standalone, exportCentre, styles] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StandaloneApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ExportCentre.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /getBranding/);
  assert.match(layout, /branding\.appName/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /branding\.logoUrl/);
  assert.match(tracker, /Preparing your award records/);
  assert.match(tracker, /trackerMemoryCache/);
  assert.match(tracker, /cachedTrackerData/);
  assert.match(tracker, /className="tracker-loading-skeleton"/);
  assert.match(styles, /\.tracker-loading-skeleton/);
  assert.match(tracker, /Attendance dates/);
  assert.match(tracker, /aria-label="Attendance meeting date"/);
  assert.match(tracker, /Earliest to latest/);
  assert.match(tracker, /orderedAttendanceSessions/);
  assert.match(tracker, /closestAttendanceSession/);
  assert.match(tracker, /malaysiaDateKey/);
  assert.match(tracker, /closest meeting selected automatically/);
  assert.match(tracker, /className="session-date"/);
  assert.match(tracker, /dateTime=\{activeSession\.meeting_date\}/);
  assert.match(tracker, /className="session-count"/);
  assert.match(tracker, /Member details/);
  assert.match(tracker, /School/);
  assert.match(tracker, /Contact Number/);
  assert.match(tracker, /Emergency Contact Number/);
  assert.match(tracker, /Parents Name/);
  assert.match(tracker, /Allow incomplete profile/);
  assert.match(tracker, /Admin and Officer override only/);
  assert.match(tracker, /required=\{!overrideMemberDetails\}/);
  assert.match(tracker, /overrideRequiredDetails/);
  assert.match(tracker, /Open Export Centre/);
  assert.match(tracker, /canUseExportCentre/);
  assert.match(tracker, /Submission portal/);
  assert.match(tracker, /canReviewSubmissions/);
  assert.match(exportCentre, /Excel workbook/);
  assert.match(exportCentre, /Print \/ Save as PDF/);
  assert.match(exportCentre, /Quick CSV backup/);
  assert.match(exportCentre, /Senior & Junior/);
  assert.match(exportCentre, /All squads/);
  assert.match(exportCentre, /All matching members/);
  assert.match(exportCentre, /Reporting year/);
  assert.match(exportCentre, /Award Summary/);
  assert.match(exportCentre, /Attendance Records/);
  assert.match(exportCentre, /Award Submissions/);
  assert.match(exportCentre, /Requirements/);
  assert.match(tracker, /<option>Alpha<\/option>/);
  assert.match(tracker, /<option>Bravo<\/option>/);
  assert.match(tracker, /<option>Charlie<\/option>/);
  assert.match(tracker, /<option>Delta<\/option>/);
  assert.match(tracker, /Joined year/);
  assert.match(tracker, /type="number"/);
  assert.match(tracker, /serviceYearsFromJoined\(joinedAtDraft\)/);
  assert.match(tracker, /Calculated automatically from joining year/);
  assert.match(tracker, /joinedYear\(member\.joined_at\)/);
  assert.match(tracker, /Member created successfully/);
  assert.match(tracker, /Attendance meeting created successfully/);
  assert.match(tracker, /setSubmissionMember\(member\)/);
  assert.match(tracker, /memberId=\{submissionMember\.id\}/);
  assert.match(tracker, /SUBMISSION NOTIFICATIONS/);
  assert.match(tracker, /submissionPendingTotal/);
  assert.match(tracker, /className="nav-badge"/);
  assert.match(tracker, /member-new-marker/);
  assert.match(tracker, />\s*View\s*<\/button>/);
  assert.match(tracker, /MEMBER PROFILE/);
  assert.match(tracker, /member-profile-details/);
  assert.match(tracker, /memberAttendance\(viewingMember\)/);
  assert.match(tracker, /AWARD RECORD/);
  assert.match(tracker, /← Previous/);
  assert.match(tracker, /Next →/);
  assert.match(tracker, /Edit details/);
  assert.match(
    styles,
    /\.sidebar nav \{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/,
  );
  assert.match(styles, /\.sidebar nav\.nco-nav \{[^}]*repeat\(4, 1fr\)/);
  assert.match(
    styles,
    /\.sidebar nav\.squad-leader-nav \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/,
  );
  assert.match(tracker, /className="mobile-nav-menu"/);
  assert.match(tracker, /aria-controls="mobile-more-menu"/);
  assert.match(styles, /\.sidebar nav \.nav-secondary \{ display: none; \}/);
  assert.match(styles, /\.sidebar nav \.mobile-more \{ display: flex; \}/);
  assert.match(styles, /Responsive command-centre redesign/);
  assert.match(styles, /\.primary \{[\s\S]*?min-height: 46px;/);
  assert.match(styles, /\.auth-card input \{ min-height: 52px;/);
  assert.match(styles, /\.topbar \{[\s\S]*?backdrop-filter: blur\(16px\)/);
  assert.match(styles, /\.stat-card::after/);
  assert.match(styles, /\.member-card::before/);
  assert.match(tracker, /className="category-select"/);
  assert.match(tracker, /aria-label="Award category"/);
  assert.match(styles, /\.category-select \{ display: none; \}/);
  assert.match(styles, /\.category-tabs \{ display: none; \}/);
  assert.match(tracker, /className=\{`award-matrix\$\{category === "Service" \? " service-matrix" : ""\}`\}/);
  assert.match(styles, /\.service-matrix \.service-count-control button \{[\s\S]*?width: 46px;[\s\S]*?height: 46px;/);
  assert.match(styles, /\.modal \{[\s\S]*?max-height: 92dvh;/);
  assert.match(
    styles,
    /\.modal \{[\s\S]*?overflow-y: auto;[\s\S]*?touch-action: pan-y;/,
  );
  assert.match(
    styles,
    /\.account-modal \{[\s\S]*?overflow-y: auto;[\s\S]*?-webkit-overflow-scrolling: touch;/,
  );
  assert.match(
    styles,
    /\.account-modal \.modal-heading \{[\s\S]*?position: sticky;/,
  );
  assert.match(styles, /\.sidebar nav button \{[\s\S]*?min-height: 62px;/);
  assert.match(standalone, /branding\.companyName/);
  assert.match(standalone, /Create your administrator account/);
  assert.match(standalone, /Edit account/);
  assert.match(standalone, /Save changes/);
  assert.match(standalone, /Account created successfully/);
  assert.match(standalone, /Login not\s*created/);
  assert.match(standalone, /Create login/);
  assert.match(standalone, /Create member login/);
  assert.match(standalone, /must_change_password/);
  assert.match(standalone, /minLength=\{10\}/);
  assert.match(standalone, /onManageAccount=\{/);
  assert.match(standalone, /Delete\s*<\/button>/);
  assert.match(standalone, /value="squad_leader"/);
  assert.match(standalone, /value="viewer"/);
  assert.match(standalone, /Viewer · full read-only access/);
  assert.match(standalone, /Assigned squad/);
  assert.match(standalone, /Squad Leader · full view & NCO controls/);
  assert.match(standalone, /value="temporary_admin"/);
  assert.match(standalone, /name="temporaryAccessRole"/);
  assert.match(standalone, /Temporary Admin · operational access/);
  assert.match(
    standalone,
    /additional access and does not change the\s*account’s normal role/,
  );
  assert.match(standalone, /Access expires on/);
  assert.match(standalone, /accessExpiresOn/);
  assert.match(
    standalone,
    /\["nco", "squad_leader", "member"\]\.includes\(\s*editingUser\.role/,
  );
  assert.match(
    standalone,
    /\["nco", "squad_leader", "member"\]\.includes\(\s*newUserRole/,
  );
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
  assert.match(route, /name: "Gold Award"/);
  assert.match(route, /create_attendance_session/);
  assert.match(route, /update_attendance/);
  assert.match(
    route,
    /ORDER BY meeting_date ASC, id ASC/,
  );
  assert.match(route, /emergency_contact_number/);
  assert.match(route, /parents_name/);
  assert.match(
    route,
    /const allowedSquads = \["Alpha", "Bravo", "Charlie", "Delta"\]/,
  );
  assert.match(route, /Select a valid joining year/);
  assert.match(route, /Complete all member details/);
  assert.match(
    route,
    /Only Admins, Temporary Admins and Officers can override this requirement/,
  );
  assert.match(route, /canOverrideMemberDetails/);
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
  assert.match(authRoute, /pendingMembers/);
  assert.match(authRoute, /LEFT JOIN users u ON LOWER\(u\.email\)/);
  assert.match(authRoute, /section === "junior" \? "Pre-Junior" : "Private"/);
  assert.match(authRoute, /role === "member"/);
  assert.match(authRoute, /action === "delete_user"/);
  assert.match(authRoute, /You cannot delete your own account/);
  assert.match(authRoute, /action === "reset_password"/);
  assert.match(authRoute, /Temporary password must be at least 10 characters/);
  assert.match(authRoute, /DELETE FROM sessions WHERE user_id = \?/);
  assert.match(
    authRoute,
    /"admin",\s*"officer",\s*"nco",\s*"squad_leader",\s*"viewer",\s*"member"/,
  );
  assert.match(authRoute, /\["admin", "viewer"\]\.includes\(user\.role\)/);
  assert.doesNotMatch(
    authRoute,
    /const allowedRoles = \[[\s\S]*?"temporary_admin"[\s\S]*?\];/,
  );
  assert.match(authRoute, /temporaryAccessExpiry/);
  assert.match(authRoute, /temporaryAccessRole/);
  assert.match(authRoute, /access_expires_at/);
  assert.match(
    authRoute,
    /\["nco", "squad_leader", "member"\]\.includes\(role\)/,
  );
  assert.match(
    authRoute,
    /\["nco", "squad_leader", "member"\]\.includes\(requestedRole\)/,
  );
  assert.match(authRoute, /memberSection,\s*squad/);
  assert.match(
    authRoute,
    /UPDATE members SET name = \?, email = \?, squad = \?/,
  );
  assert.match(
    authRoute,
    /UPDATE users SET name = \?, email = \?, role = \?, squad = \?, temporary_access_role = \?, access_expires_at = \?/,
  );
  assert.match(resourcesRoute, /user\.role === "member"/);
  assert.match(resourcesRoute, /user\.role === "nco"/);
  assert.match(resourcesRoute, /Resources are read-only for this account/);
  assert.match(
    route,
    /NCO and Squad Leader accounts can add or edit members and manage attendance only/,
  );
  assert.match(
    route,
    /"create_member"[\s\S]*"create_attendance_session"[\s\S]*"update_attendance"[\s\S]*"update_member"/,
  );
  assert.match(route, /\["nco", "squad_leader"\]\.includes\(user\.role\)/);
  assert.match(route, /user\.role === "viewer"/);
  assert.match(route, /m\.squad = \?/);
  assert.match(
    route,
    /validAttendanceTarget\.squad !== user\.squad/,
  );
  assert.match(tracker, /Awards are shown in read-only mode/);
  assert.match(tracker, /className=\{`status-select \$\{status\}`\}/);
  assert.match(tracker, /value=\{status\}/);
  assert.match(tracker, /event\.target\.value as Status/);
  assert.match(tracker, /Choose an award status from each dropdown/);
  assert.match(tracker, /disabled=\{!canManageAwards \|\| saving === key\}/);
  assert.match(tracker, /!canManageAttendance \|\| saving === key/);
  assert.match(
    tracker,
    /filteredMembers\.filter\(\(member\) => member\.squad === user\?\.squad\)/,
  );
  assert.match(tracker, /\{present\}\/\{attendanceMembers\.length\}/);
  assert.match(tracker, /canEditMembers/);
  assert.match(tracker, /canAddMembers/);
  assert.match(tracker, /const isViewer = user\?\.role === "viewer"/);
  assert.match(tracker, /hasPermission\("members\.create"\)/);
  assert.match(tracker, /SUBSCRIPTION REGISTER/);
  assert.match(tracker, /updateSubscription/);
  assert.match(tracker, /updateBandSubscription/);
  assert.match(tracker, /No fee amount is recorded/);
  assert.match(tracker, /canManageSubscriptions/);
  assert.match(tracker, /Open Export Centre/);
  assert.match(tracker, /all-member-records-/);
  assert.match(
    tracker,
    /All Senior and Junior member records exported successfully/,
  );
  assert.match(tracker, /Attendance Percentage/);
  assert.match(tracker, /One-Year Service Awards/);
  assert.match(tracker, /Subscription \$\{year\}/);
  assert.match(route, /CREATE TABLE IF NOT EXISTS member_subscriptions/);
  assert.match(route, /action === "update_subscription"/);
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
  assert.doesNotMatch(resourceLibrary, /<AppNavigation/);
  assert.match(resourceLibrary, /branding\.companyName\.toUpperCase/);
  assert.match(resourceLibrary, /canManageResources/);
  assert.match(resourceLibrary, /hasTemporaryAdminAccess/);
  assert.doesNotMatch(resourceLibrary, /onManageAccount/);
  assert.match(resourceLibrary, /Resource created successfully/);
  assert.doesNotMatch(resourceLibrary, /import AwardSubmissions/);
  assert.match(submissionsPage, /<AwardSubmissions user=\{user\}/);
  assert.match(submissionsPage, /Award submissions/);
  assert.doesNotMatch(submissionsPage, /section === "junior"/);
  assert.match(submissionsPage, /Submission Portal/);
  assert.doesNotMatch(submissionsPage, /aria-label="Submission section"/);
  assert.match(submissionsPage, /section=\{section\}/);
  assert.match(
    submissionsPage,
    /update the Award Matrix automatically/,
  );
  assert.match(
    submissionsRoute,
    /Only linked member, NCO or squad leader accounts can submit award applications/,
  );
  assert.match(submissionsRoute, /\["member", "nco", "squad_leader"\]/);
  assert.match(submissions, /isPersonalApplicant/);
  assert.match(tracker, /My submissions/);
  assert.match(
    submissionsRoute,
    /Admin, Temporary Admin or Officer access required/,
  );
  assert.match(submissionsRoute, /INSERT INTO member_awards/);
  assert.match(submissionsRoute, /'in_progress'/);
  assert.match(submissions, /marked In progress in the Award Matrix/);
  assert.match(submissionsRoute, /status = 'not_started'/);
  assert.match(submissionsRoute, /member_awards\.status = 'awarded'/);
  assert.match(submissionsRoute, /WHERE member_id = \?/);
  assert.match(submissionsRoute, /Select a member to view submissions/);
  assert.match(submissionsRoute, /searchParams\.get\("all"\) === "1"/);
  assert.match(
    submissionsRoute,
    /Admin, Temporary Admin or Officer access required/,
  );
  assert.match(submissionsRoute, /LOWER\(email\) = LOWER\(\?\)/);
  assert.match(submissions, /Apply for an award/);
  assert.match(submissions, /Submit application/);
  assert.match(submissions, /"approved" \| "rejected"/);
  assert.match(submissions, /Reject/);
  assert.match(submissions, /Officer Submission Portal/);
  assert.match(submissions, /Review note/);
  assert.match(submissions, /Approve/);
  assert.match(submissions, /Verified submission/);
  assert.match(submissionsRoute, /review_notes/);
  assert.match(submissionsRoute, /m\.section = \?/);
  assert.match(
    submissionsRoute,
    /url\.searchParams\.get\("section"\)/,
  );
  assert.match(submissions, /marked Verified in the Award Matrix/);
  assert.match(submissions, /Edit review note/);
  assert.match(submissions, /\/api\/submissions\?all=1/);
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
  assert.match(manifest, /getBranding/);
  assert.match(manifest, /branding\.logoUrl/);
  assert.match(serviceWorker, /company-app-v5/);
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /addEventListener\("notificationclick"/);
  assert.match(serviceWorker, /event\.request\.mode !== "navigate"/);
  assert.match(serviceWorker, /cache: "no-store"/);
  assert.match(serviceWorker, /You’re offline/);
  assert.match(serviceWorker, /Try again/);
  assert.doesNotMatch(serviceWorker, /cache\.addAll\(SHELL\)/);
});
