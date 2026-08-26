import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("tutorials are available before connection and to every signed-in role", () => {
  const launcher = read("src-tauri/setup/index.html");
  const shell = read("app/AppShell.tsx");
  const app = read("app/StandaloneApp.tsx");
  const help = read("app/HelpCentre.tsx");

  assert.match(launcher, /Help &amp; tutorials/);
  assert.match(launcher, /Officer or Member joining an existing company/);
  assert.match(launcher, /Administrator creating a new company/);
  assert.match(shell, /onHelp/);
  assert.match(shell, /Page-aware BB Guide/);
  assert.match(app, /\["home", "manage", "help"\]/);
  assert.match(app, /<HelpCentre \/>/);
  for (const roleGuide of ["First sign-in", "Member essentials", "Squad management", "Company administration", "Stock and uniform requests"])
    assert.match(help, new RegExp(roleGuide));
  assert.match(help, /BB-App-User-Guide\.pptx/);
  assert.match(help, /New company setup/);
  assert.match(help, /Help me/);
  assert.match(help, /English, 中文 or Bahasa Malaysia/);
});
