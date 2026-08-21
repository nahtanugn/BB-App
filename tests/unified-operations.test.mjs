import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("every portal uses one URL-aware, role-aware application shell", async () => {
  const [shell, standalone, manage, submissions, resources, stock, uniforms, admin, onboarding, events, journey] =
    await Promise.all([
      source("../app/AppShell.tsx"),
      source("../app/StandaloneApp.tsx"),
      source("../app/ManageHub.tsx"),
      source("../app/SubmissionsPage.tsx"),
      source("../app/ResourceLibrary.tsx"),
      source("../app/StockCentre.tsx"),
      source("../app/UniformRequests.tsx"),
      source("../app/AdminCentre.tsx"),
      source("../app/OnboardingCentre.tsx"),
      source("../app/EventCentre.tsx"),
      source("../app/MemberJourney.tsx"),
    ]);

  assert.match(shell, /className="unified-sidebar"/);
  assert.match(shell, /className="unified-mobile-nav"/);
  assert.match(shell, /className="unified-more-menu"/);
  assert.match(shell, /aria-current=/);
  assert.match(shell, /aria-label="Mobile application navigation"/);
  assert.match(shell, /type AppHub = "home" \| "people" \| "programme" \| "manage"/);
  assert.match(shell, /hubForRoute/);
  assert.match(shell, /unified-context-nav/);
  assert.match(shell, /unified-context-select/);
  assert.match(shell, /unified-section-control/);
  assert.match(shell, /unified-mobile-section-control/);
  assert.match(shell, /aria-label="Working section"/);
  assert.match(shell, /Notifications/);
  assert.match(manage, /Requests/);
  assert.match(manage, /Stock/);
  assert.match(manage, /Administration/);
  assert.match(manage, /Export Centre/);
  assert.match(shell, /People & Progress/);
  assert.match(shell, /Programme & Events/);
  assert.match(shell, /Requests & Operations/);
  assert.match(shell, /"events"/);
  assert.match(shell, /"journey"/);
  assert.match(shell, /user\.member_section !== "junior"/);
  assert.match(standalone, /<AppShell/);
  assert.match(standalone, /\["operations", "company-overview"\]\.includes\(next\) \? "home" : next/);
  assert.match(standalone, /<NotificationCentre>/);
  assert.match(standalone, /window\.history\[replace \? "replaceState" : "pushState"\]/);
  assert.match(standalone, /popstate/);
  assert.match(standalone, /11kchbb-active-section/);
  assert.match(standalone, /selectedSection=\{activeSection\}/);
  assert.match(manage, /activeSection !== "junior"/);
  assert.match(standalone, /new URL\(window\.location\.href\)\.searchParams/);
  for (const page of [submissions, resources, stock, uniforms, admin, onboarding])
    assert.doesNotMatch(page, /AppNavigation/);
  assert.doesNotMatch(resources, /MemberProgress/);
  assert.doesNotMatch(submissions, /SeniorJuniorToggle/);
  assert.match(events, /Create an attendance register/);
  assert.match(events, /Your RSVP/);
  assert.match(journey, /My goals/);
  assert.match(journey, /Recent progress/);
});

test("the simplified Home uses a lightweight summary and progressive task disclosure", async () => {
  const [home, trackerApi] = await Promise.all([
    source("../app/ActionCentre.tsx"),
    source("../app/api/tracker/route.ts"),
  ]);
  assert.match(home, /\/api\/tracker\?summary=1/);
  assert.match(home, /slice\(0, 3\)/);
  assert.match(home, /home-snapshot/);
  assert.match(home, /home-quick-actions/);
  assert.match(trackerApi, /searchParams\.get\("summary"\) === "1"/);
  assert.match(trackerApi, /completedRegisters/);
  assert.match(trackerApi, /attendancePercent/);
});

test("events and journeys are durable, linked and permission-safe", async () => {
  const [schema, eventsApi, journeyApi, eventMigration, eventLibrary] = await Promise.all([
    source("../db/schema.ts"), source("../app/api/events/route.ts"), source("../app/api/member-journey/route.ts"),
    source("../drizzle/0027_company_events_and_member_journey.sql"), source("../lib/events.ts"),
  ]);
  assert.match(schema, /companyEvents/);
  assert.match(schema, /eventRsvps/);
  assert.match(schema, /memberGoals/);
  assert.match(eventMigration, /CREATE TABLE `company_events`/);
  assert.match(eventsApi, /canManageEvents/);
  assert.match(eventsApi, /attendance_sessions/);
  assert.match(eventsApi, /event_rsvps/);
  assert.match(journeyApi, /member_goals/);
  assert.match(journeyApi, /linkedMember/);
  assert.match(eventLibrary, /CREATE INDEX IF NOT EXISTS idx_company_events_section_date/);
});

test("automation is durable, deduplicated, permission-aware and decision-safe", async () => {
  const [automation, schema, api, worker, health, workflow, recovery] =
    await Promise.all([
      source("../lib/automation.ts"),
      source("../db/schema.ts"),
      source("../app/api/automation/route.ts"),
      source("../worker/index.ts"),
      source("../app/api/health/route.ts"),
      source("../.github/workflows/deploy-web.yml"),
      source("../docs/RECOVERY.md"),
    ]);

  assert.match(schema, /automationActionItems/);
  assert.match(schema, /uniqueIndex\("automation_action_items_dedupe_unique"\)/);
  assert.match(schema, /automationScheduleRuns/);
  assert.match(automation, /ON CONFLICT\(dedupe_key\) DO UPDATE SET/);
  assert.match(automation, /runScheduledAutomationTick/);
  assert.match(automation, /company_subscription/);
  assert.match(automation, /band_member = 1/);
  assert.match(automation, /temporary_access_expired/);
  assert.match(automation, /candidate\.reminderDays/);
  assert.doesNotMatch(automation, /UPDATE award_submissions SET status = '(approved|rejected)'/);
  assert.doesNotMatch(automation, /UPDATE users SET account_status = '(active|rejected)'/);
  assert.match(api, /Administrator access required/);
  assert.match(api, /Viewer accounts are read-only/);
  assert.match(worker, /scheduled\(/);
  assert.match(worker, /runScheduledAutomationTick/);
  assert.match(health, /SELECT 1 AS healthy/);
  assert.doesNotMatch(health, /COUNT\(/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /d1 migrations apply/);
  assert.match(recovery, /time travel/i);
  assert.match(recovery, /Do not copy it into[\s\S]*GitHub artifacts/i);
});

test("feature expansion foundation keeps sensitive workflows additive and permission-safe", async () => {
  const [migration, featureApi, eventsApi, tracker, offline, eventCentre] = await Promise.all([
    source("../drizzle/0029_feature_expansion_foundation.sql"),
    source("../app/api/feature-expansion/route.ts"),
    source("../app/api/events/route.ts"),
    source("../app/AwardTracker.tsx"),
    source("../app/offlineAttendance.ts"),
    source("../app/EventCentre.tsx"),
  ]);
  assert.match(migration, /attendance_qr_codes/);
  assert.match(migration, /attendance_sync_conflicts/);
  assert.match(migration, /member_documents/);
  assert.match(migration, /parent_invitations/);
  assert.match(migration, /certificates/);
  assert.match(migration, /training_records/);
  assert.match(migration, /member_transfers/);
  assert.match(migration, /equipment_holdings/);
  assert.match(migration, /message_threads/);
  assert.match(migration, /import_jobs/);
  assert.match(featureApi, /action === "create_qr"/);
  assert.match(featureApi, /expires_at > \?/);
  assert.match(featureApi, /action === "check_in"/);
  assert.match(featureApi, /action === "sync_attendance"/);
  assert.match(featureApi, /attendance_sync_conflicts/);
  assert.match(featureApi, /action === "review_conflict"/);
  assert.match(featureApi, /Only verified or awarded records can receive a certificate/);
  assert.match(eventsApi, /Content-Type.*text\/calendar/);
  assert.match(eventsApi, /calendarEventId/);
  assert.match(eventCentre, /Add to calendar/);
  assert.match(offline, /indexedDB/);
  assert.match(offline, /sync_attendance/);
  assert.match(tracker, /queueOfflineAttendance/);
  assert.match(tracker, /flushOfflineAttendance/);
});

test("operations expansion keeps messaging, analytics, imports and public content restricted", async () => {
  const [featureApi, publicApi, migration, migration30] = await Promise.all([
    source("../app/api/feature-expansion/route.ts"),
    source("../app/api/public-content/route.ts"),
    source("../drizzle/0029_feature_expansion_foundation.sql"),
    source("../drizzle/0030_import_templates_and_trends.sql"),
  ]);
  assert.match(featureApi, /kind === "analytics"/);
  assert.match(featureApi, /kind === "messages"/);
  assert.match(featureApi, /action === "send_message"/);
  assert.match(featureApi, /action === "preview_import"/);
  assert.match(featureApi, /Duplicate email/);
  assert.match(featureApi, /This account cannot send staff messages/);
  assert.match(publicApi, /hasAdminOrTemporaryAccess/);
  assert.match(publicApi, /published = 1/);
  assert.match(publicApi, /action === "publish"/);
  assert.match(migration, /public_content/);
  assert.match(migration, /import_jobs/);
  assert.match(migration, /message_threads/);
  assert.match(migration30, /import_job_rows/);
  assert.match(migration30, /report_templates/);
  assert.match(featureApi, /commit_import/);
  assert.match(featureApi, /rollback_import/);
  assert.match(featureApi, /sendOptionalEmail/);
  assert.match(featureApi, /kind === "recipients"/);
});

test("new operations APIs are connected to the Manage hub without changing navigation", async () => {
  const [manage, expansion] = await Promise.all([
    source("../app/ManageHub.tsx"),
    source("../app/ExpansionCentre.tsx"),
  ]);
  assert.match(manage, /ExpansionCentre/);
  assert.match(manage, /staff && <ExpansionCentre/);
  assert.match(expansion, /Insights and communication/);
  assert.match(expansion, /Import members/);
  assert.match(expansion, /Only administrators can publish public information/);
  assert.match(expansion, /\/api\/feature-expansion\?kind=analytics/);
  assert.match(expansion, /accept="\.xlsx/);
  assert.match(expansion, /parseCsv/);
  assert.match(expansion, /attendanceTrend/);
  assert.match(expansion, /retention/);
  assert.match(expansion, /Commit import/);
  assert.match(expansion, /Report templates/);
});

test("notification feed hides legacy attendance reminders and collapses duplicate alerts", async () => {
  const sourceText = await source("../app/api/notifications/route.ts");
  assert.match(sourceText, /ROW_NUMBER\(\) OVER/);
  assert.match(sourceText, /duplicate_rank = 1/);
  assert.match(sourceText, /Attendance is incomplete/);
});
