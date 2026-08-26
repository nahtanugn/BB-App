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

  assert.match(wizard, /Set up your company/);
  assert.match(wizard, /设置您的连队/);
  assert.match(wizard, /Sediakan aplikasi kompeni/);
  assert.match(wizard, /max="8"/);
  assert.match(wizard, /localStorage/);
  assert.match(wizard, /\/api\/setup-status/);
  assert.doesNotMatch(wizard, /type=["']password["']/);
  assert.doesNotMatch(wizard, /name=["'](?:token|secret|password)/i);
  assert.match(setupStatus, /setupRequired/);
  assert.match(setupStatus, /database: "available"/);
  assert.doesNotMatch(setupStatus, /adminEmail|memberCount|userCount/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /default-bb-logo\.png/);
  assert.match(readme, /multilingual guided company setup/);
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
