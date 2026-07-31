import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("every portal uses one URL-aware, role-aware application shell", async () => {
  const [shell, standalone, submissions, resources, stock, uniforms, admin, onboarding] =
    await Promise.all([
      source("../app/AppShell.tsx"),
      source("../app/StandaloneApp.tsx"),
      source("../app/SubmissionsPage.tsx"),
      source("../app/ResourceLibrary.tsx"),
      source("../app/StockCentre.tsx"),
      source("../app/UniformRequests.tsx"),
      source("../app/AdminCentre.tsx"),
      source("../app/OnboardingCentre.tsx"),
    ]);

  assert.match(shell, /className="unified-sidebar"/);
  assert.match(shell, /className="unified-mobile-nav"/);
  assert.match(shell, /className="unified-more-menu"/);
  assert.match(shell, /aria-current=/);
  assert.match(shell, /aria-label="Mobile application navigation"/);
  assert.match(shell, /user\.member_section !== "junior"/);
  assert.match(standalone, /<AppShell/);
  assert.match(standalone, /window\.history\[replace \? "replaceState" : "pushState"\]/);
  assert.match(standalone, /popstate/);
  assert.match(standalone, /new URL\(window\.location\.href\)\.searchParams/);
  for (const page of [submissions, resources, stock, uniforms, admin, onboarding])
    assert.doesNotMatch(page, /AppNavigation/);
  assert.doesNotMatch(resources, /MemberProgress/);
  assert.doesNotMatch(submissions, /SeniorJuniorToggle/);
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
