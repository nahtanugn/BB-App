import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("publishes a privacy-safe multilingual company setup guide", async () => {
  const [wizard, setupStatus, workflow, readme] = await Promise.all([
    read("docs/setup/index.html"),
    read("app/api/setup-status/route.ts"),
    read(".github/workflows/pages-setup-guide.yml"),
    read("README.md"),
  ]);

  assert.match(wizard, /Set up BB App in three stages/);
  assert.match(wizard, /三个阶段设置 BB App/);
  assert.match(wizard, /Sediakan BB App dalam tiga peringkat/);
  assert.match(wizard, /Deploy company app/);
  assert.match(wizard, /Create administrator/);
  assert.match(wizard, /Finish company setup/);
  assert.match(wizard, /sessionStorage/);
  assert.match(wizard, /crypto\.getRandomValues/);
  assert.match(wizard, /type="password" readonly/);
  assert.match(wizard, /clearCode/);
  assert.match(wizard, /\/api\/setup-status/);
  assert.doesNotMatch(wizard, /[?&](?:token|secret|password)=/i);
  assert.doesNotMatch(wizard, /localStorage\.setItem\([^)]*(?:code|token|secret)/i);
  assert.match(setupStatus, /setupRequired/);
  assert.match(setupStatus, /database: "available"/);
  assert.match(setupStatus, /readiness/);
  assert.doesNotMatch(setupStatus, /adminEmail|memberCount|userCount/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /default-bb-logo\.png/);
  assert.match(readme, /multilingual guided company setup/);
});

test("gives only the first administrator a dedicated non-blocking setup checklist", async () => {
  const [flow, summary, shell, onboarding, styles] = await Promise.all([
    read("app/AdministratorSetupFlow.tsx"),
    read("app/api/company-setup/route.ts"),
    read("app/StandaloneApp.tsx"),
    read("app/api/onboarding/route.ts"),
    read("app/globals.css"),
  ]);

  assert.match(shell, /is_initial_administrator/);
  assert.match(shell, /AdministratorSetupFlow/);
  assert.match(summary, /Administrator access required/);
  assert.match(summary, /schoolCount/);
  assert.match(summary, /officerCount/);
  assert.match(summary, /requiredComplete/);
  assert.match(flow, /Confirm privacy/);
  assert.match(flow, /Company name/);
  assert.match(flow, /Company logo.*Optional/s);
  assert.match(flow, /School directory/);
  assert.match(flow, /First Officer/);
  assert.match(flow, /Share the company address/);
  assert.match(flow, /Finish and open BB App/);
  assert.match(onboarding, /Your BB Company/);
  assert.match(styles, /administrator-setup-options/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});

test("provides authenticated page-aware guidance and saved account progress", async () => {
  const [guide, route, panel, shell, migration, automation] = await Promise.all([
    read("lib/bb-guide.ts"),
    read("app/api/help/route.ts"),
    read("app/BBGuidePanel.tsx"),
    read("app/AppShell.tsx"),
    read("drizzle/0039_automated_bb_guide.sql"),
    read("lib/automation.ts"),
  ]);

  for (const language of ["en", "zh", "ms"]) assert.match(guide, new RegExp(`${language}:`));
  for (const area of ["members", "attendance", "awards", "events", "resources", "subscriptions", "stock", "accounts", "onboarding", "exports", "statistics"])
    assert.match(guide, new RegExp(`${area}:`));
  assert.match(route, /getCurrentUser/);
  assert.match(route, /Sign in required/);
  assert.match(route, /set_language/);
  assert.match(route, /complete_step/);
  assert.match(panel, /MutationObserver/);
  assert.match(panel, /bb-guide-panel/);
  assert.match(panel, /recoveryMessage/);
  assert.match(shell, /Help me/);
  assert.match(shell, /bb-guide-launcher/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS bb_guide_preferences/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS bb_guide_progress/);
  assert.match(automation, /guided_setup/);
  assert.match(automation, /Finish company branding/);
  assert.match(automation, /Create the first Officer account/);
  assert.match(automation, /Prepare the school directory/);
});

test("keeps help viewing separate from official audit actions", async () => {
  const helpRoute = await read("app/api/help/route.ts");
  assert.doesNotMatch(helpRoute, /recordAudit|audit_history|INSERT INTO audit/);
});
