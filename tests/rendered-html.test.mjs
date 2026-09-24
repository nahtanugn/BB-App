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
  assert.match(layout, /manifest: `\/manifest\.webmanifest\?v=/);
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
    /UPDATE users SET name = \?, email = \?, role = \?, squad = \?, officer_rank = \?, gender = \?, ethnicity = \?, religion = \?, spiritual_status = \?, officer_work_status = \?, temporary_access_role = \?, access_expires_at = \?/,
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
  assert.match(tracker, /One Year Service Badges/);
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
  assert.match(route, /attendance_sessions WHERE section IN/);
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
  assert.match(serviceWorker, /company-app-v7/);
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /setAppBadge/);
  assert.match(serviceWorker, /addEventListener\("notificationclick"/);
  assert.match(serviceWorker, /event\.request\.mode !== "navigate"/);
  assert.match(serviceWorker, /cache: "no-store"/);
  assert.match(serviceWorker, /You’re offline/);
  assert.match(serviceWorker, /Try again/);
  assert.doesNotMatch(serviceWorker, /cache\.addAll\(SHELL\)/);
});

test("renders awarded records with supplied badge artwork and handbook placement", async () => {
  const [tracker, route, metadata, styles, target, presidentsAward, serviceBadge, extractor] = await Promise.all([
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/awardBadgeArtwork.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/award-badges/target.webp", import.meta.url)),
    readFile(new URL("../public/award-badges/presidents_award.webp", import.meta.url)),
    readFile(new URL("../public/award-badges/one_year_service.webp", import.meta.url)),
    readFile(new URL("../scripts/extract-award-badges.py", import.meta.url), "utf8"),
  ]);

  assert.match(route, /row\.status !== "awarded"/);
  assert.match(route, /existing\.level !== "advanced" && row\.level === "advanced"/);
  assert.match(route, /awardLayouts/);
  assert.match(route, /pending_artwork/);
  assert.doesNotMatch(route, /code NOT IN \([^)]*three_year_service/);
  assert.match(route, /code: "three_year_service",\s*name: "Three Year Service Badge",\s*category: "Service"/);
  assert.match(route, /code: "link_badge",\s*name: "Link Badge",\s*category: "Special",\s*basic: 1,\s*advanced: 0/);
  assert.match(route, /code: "junior_service_award",\s*name: "Junior Service Award",\s*category: "Special",\s*basic: 1,\s*advanced: 0/);
  assert.match(route, /code: "martial_arts",\s*name: "Martial Arts",\s*category: "D · Physical"/);
  assert.match(metadata, /"martial_arts"/);
  assert.match(metadata, /\["founders_award", metadata\("founders_award", "left_arm_special", "special_top", 0/);
  assert.match(metadata, /\["presidents_award", metadata\("presidents_award", "left_arm_special", "president_doe_gold", 10/);
  assert.match(metadata, /\["gold_award", metadata\("gold_award", "left_arm_special", "president_doe_gold", 11/);
  assert.match(metadata, /\["duke_of_edinburgh_(?:bronze|silver|gold)", metadata\("duke_of_edinburgh_(?:bronze|silver|gold)", "left_arm_special", "president_doe_gold", 12/);
  assert.match(metadata, /\["scholastics_gold", metadata\("scholastics_gold", "left_arm_special", "scholastic", 20/);
  assert.match(metadata, /\["scholastics_bronze", metadata\("scholastics_bronze", "left_arm_special", "scholastic", 22/);
  assert.match(tracker, /\["special_top", "president_doe_gold", "scholastic", "special_row"/);
  assert.match(route, /\["duke_of_edinburgh_gold", "duke_of_edinburgh_silver", "duke_of_edinburgh_bronze"\][\s\S]*?find\(\(code\) => awardedByCode\.has\(code\)\)/);
  assert.match(metadata, /\["nco_proficiency", metadata\("nco_proficiency", "left_arm_special", "special_row"/);
  assert.match(metadata, /\["link_badge", metadata\("link_badge", "left_arm_special", "special_row", 31, "special"\)/);
  assert.match(metadata, /\["junior_service_award", metadata\("junior_service_award", "left_arm_special", "special_row", 32, "special"\)/);
  assert.match(route, /row\.award_code === "nco_proficiency" && row\.level !== "advanced"/);
  assert.match(route, /"one_year_service",\s*"long_year_service",\s*\]\.includes\(awardCode\)/);
  assert.match(tracker, /category !== "Service" \|\| \["one_year_service", "three_year_service"\]\.includes\(award\.code\)/);
  assert.match(metadata, /const rightArmOrder = \[\s*"target",\s*"arts",\s*"athletics"/);
  assert.match(metadata, /"scholastics_bronze"/);
  assert.match(metadata, /"duke_of_edinburgh_bronze"/);
  assert.match(metadata, /advanced_backing: region === "right_arm" && code !== "target"/);
  assert.match(tracker, /className="award-collection-grid"/);
  assert.match(tracker, /title: "Right armlet"/);
  assert.match(tracker, /title: "Left armlet"/);
  assert.match(tracker, /Left breast & medals/);
  assert.match(tracker, /badge\.region\?\.replaceAll\("_", " "\)/);
  assert.match(tracker, /Artwork pending/);
  assert.match(tracker, /View awarded badges as a list/);
  assert.match(tracker, /className="company-badge-board"/);
  assert.doesNotMatch(tracker, /uniform-figure|armlet-badge/);
  assert.match(tracker, /function NcoRankInsignia/);
  assert.match(tracker, /"Lance Corporal": 1[\s\S]*?Corporal: 2[\s\S]*?Sergeant: 3[\s\S]*?"Staff Sergeant": 4/);
  assert.match(tracker, /<NcoRankInsignia rank=\{member\.rank\} \/>/);
  assert.match(tracker, /uniform\.length \|\| hasNcoRank/);
  assert.match(styles, /\.right-arm-rank \{ flex:0 0 100%;/);
  assert.match(styles, /\.award-image-badge\.advanced/);
  assert.match(styles, /\.award-image-badge \{[^}]*padding:0;[^}]*border-radius:0;[^}]*background:transparent;[^}]*box-shadow:none/);
  assert.match(styles, /\.award-uniform-layout \{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.uniform-badge-row \{[^}]*display:flex; flex-wrap:wrap; align-items:center; justify-content:center/);
  assert.match(styles, /\.uniform-badge-cell \{ flex:0 0 calc\(\(100% - 40px\)\/5\)/);
  assert.match(styles, /\.uniform-badge-row\.special_row \.uniform-badge-cell \{ flex:0 0 auto; \}/);
  assert.match(styles, /\.uniform-fabric \{ --armlet-badge-size:clamp\(50px,7vw,74px\); \}/);
  assert.match(styles, /\.uniform-fabric \.award-image-badge \{ width:var\(--armlet-badge-size\); height:var\(--armlet-badge-size\); flex:0 0 var\(--armlet-badge-size\);/);
  assert.match(styles, /\.award-image-badge\.advanced \{ padding:0; background:transparent; box-shadow:none; \}/);
  assert.match(styles, /\.award-image-badge\.advanced::before \{[^}]*inset:0;[^}]*border-radius:50%/);
  assert.match(styles, /\.award-image-badge img \{[^}]*width:84%; height:84%; max-width:84%; max-height:84%; object-fit:contain/);
  assert.match(styles, /\.company-badge-board span\.advanced::before \{[^}]*inset:0;/);
  assert.match(styles, /\.award-badge-detail-image\.advanced::before \{[^}]*inset:0;/);
  assert.doesNotMatch(styles, /\.uniform-fabric \.award-image-badge(?:\.advanced)? img \{ transform:scale\(/);
  assert.match(extractor, /margin = max\(4, round\(max\(badge\.size\) \* 0\.04\)\)/);
  assert.match(styles, /\.uniform-fabric \{ min-height:190px; padding:18px; background:#000; \}/);
  assert.match(styles, /\.right-arm-fabric \{ display:flex; flex-wrap:wrap; justify-content:center/);
  assert.match(styles, /\.right-arm-badge-cell \{ flex:0 0 calc\(\(100% - 32px\)\/5\)/);
  assert.match(styles, /\.award-collection-groups \{ display:grid; grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.award-collection-grid \{ display:grid; grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,168px\),1fr\)\)/);
  assert.match(styles, /\.award-collection-item strong \{[^}]*width:100%;[^}]*overflow-wrap:normal; word-break:keep-all; hyphens:none/);
  assert.match(styles, /@media \(max-width:760px\)[\s\S]*?\.award-uniform-layout \{ grid-template-columns:1fr;/);
  assert.ok(target.byteLength > 1000);
  assert.ok(presidentsAward.byteLength > 1000);
  assert.ok(serviceBadge.byteLength > 1000);
  assert.doesNotMatch(extractor, /\/Users\/nathan/);
  assert.match(extractor, /key == "scholastics_silver" and badge\.height > badge\.width[\s\S]*?badge = badge\.crop\(\(0, 0, badge\.width, badge\.width\)\)/);
});

test("member profile overlay keeps the navigation footer outside the scrolling content", async () => {
  const [styles, tracker] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /\.modal\.member-profile-modal\s*\{[^}]*display:flex;[^}]*flex-direction:column;[^}]*overflow:hidden/);
  assert.match(styles, /\.member-profile-body\s*\{[^}]*flex:1 1 auto;[^}]*overflow-y:auto/);
  assert.match(styles, /\.member-profile-stats \{ min-height:96px;[^}]*grid-auto-rows:minmax\(94px,\s*auto\)/);
  assert.match(styles, /\.member-profile-stats span \{ box-sizing:border-box;[^}]*min-height:94px/);
  assert.match(styles, /\.member-profile-stats \{[^}]*grid-auto-rows:minmax\(94px, auto\)/);
  assert.match(tracker, /memberProfileBodyRef\.current\?\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(tracker, /className="member-profile-body" ref=\{memberProfileBodyRef\}/);
  assert.match(styles, /\.member-profile-footer\s*\{[^}]*position:\s*static;[^}]*flex:\s*0 0 auto/);
  assert.doesNotMatch(styles, /\.member-profile-body \{ padding: 14px 12px calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
});
