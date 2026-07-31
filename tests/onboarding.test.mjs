import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("implements controlled self-registration and account status handling", async () => {
  const [route, authRoute, auth, migration] = await Promise.all([
    readFile(new URL("../app/api/onboarding/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0021_stiff_callisto.sql", import.meta.url), "utf8"),
  ]);

  assert.match(route, /action === "request_access"/);
  assert.match(route, /passwordDigest\(password\)/);
  assert.match(route, /account_status = 'pending'/);
  assert.match(route, /suggested_member_id/);
  assert.match(route, /action === "review_registration"/);
  assert.match(route, /user\.role !== "admin"/);
  assert.match(route, /decision === "reject"/);
  assert.match(route, /decision !== "approve"/);
  assert.match(route, /The confirmed member must use the same email address/);
  assert.match(route, /INSERT INTO members/);
  assert.match(authRoute, /row\.account_status === "pending"/);
  assert.match(authRoute, /row\.account_status === "rejected"/);
  assert.match(authRoute, /must_change_password = 0/);
  assert.match(auth, /users\.account_status = 'active'/);
  assert.match(auth, /onboarding_required/);
  assert.match(migration, /CREATE TABLE `registration_details`/);
  assert.match(migration, /ALTER TABLE `users` ADD `account_status`/);
});

test("enforces guided onboarding, privacy choices and squad-scoped corrections", async () => {
  const [route, flow, centre, standalone, tracker] = await Promise.all([
    readFile(new URL("../app/api/onboarding/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/OnboardingFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OnboardingCentre.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StandaloneApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /action === "confirm_profile"/);
  assert.match(route, /action === "accept_privacy"/);
  assert.match(route, /action === "complete_tour"/);
  assert.match(route, /action === "submit_correction"/);
  assert.match(route, /members\.squad = \?/);
  assert.match(route, /correction\?\.squad === user\.squad/);
  assert.match(route, /user\.role !== "viewer"/);
  assert.match(route, /action === "update_privacy"/);
  assert.match(route, /requireReacknowledgement/);
  assert.match(route, /privacy_notice_version = \?/);
  assert.match(flow, /Secure account/);
  assert.match(flow, /Verify profile/);
  assert.match(flow, /Request a correction/);
  assert.match(flow, /Refresh review status/);
  assert.match(flow, /Finish onboarding/);
  assert.match(centre, /Member registrations/);
  assert.match(centre, /Member-proposed changes/);
  assert.match(centre, /Recent onboarding activity/);
  assert.match(standalone, /Request member access/);
  assert.match(standalone, /showOnboardingCentre/);
  assert.match(tracker, /onOpenOnboardingCentre/);
  assert.match(tracker, /onboardingPendingCount/);
});
