import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the distribution contains generic deployment configuration and no tracked operational data", async () => {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n");
  const forbiddenExtensions = /\.(?:db|sqlite|sqlite3|csv|xlsx|xls|heic)$/i;
  assert.deepEqual(tracked.filter((name) => forbiddenExtensions.test(name)), []);

  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  const migrations = await readFile(new URL("../wrangler.migrations.jsonc", import.meta.url), "utf8");
  const deploy = await readFile(new URL("../.github/workflows/deploy-web.yml", import.meta.url), "utf8");
  const deploymentConfig = await readFile(new URL("../scripts/create-wrangler-config.mjs", import.meta.url), "utf8");
  const desktop = await readFile(new URL("../.github/workflows/desktop-release.yml", import.meta.url), "utf8");
  const tauri = await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8");
  const setup = await readFile(new URL("../src-tauri/setup/index.html", import.meta.url), "utf8");
  const source = `${config}\n${migrations}\n${deploy}\n${deploymentConfig}\n${desktop}\n${tauri}\n${setup}`;
  const legacyCompanyName = "11" + "KCHBB";
  const legacyDomain = "app." + "11kchbb.workers.dev";

  assert.doesNotMatch(source, new RegExp(legacyCompanyName, "i"));
  assert.doesNotMatch(source, new RegExp(legacyDomain.replaceAll(".", "\\."), "i"));
  assert.match(config, /process\.env\.D1_DATABASE_ID/);
  assert.match(config, /process\.env\.ADMIN_EMAIL/);
  assert.match(migrations, /00000000-0000-0000-0000-000000000000/);
  assert.match(deploy, /secrets\.D1_DATABASE_ID/);
  assert.match(deploy, /secrets\.ADMIN_EMAIL/);
  assert.match(deploy, /vars\.APP_URL/);
  assert.match(deploymentConfig, /relative\(dirname\(output\), resolve\("drizzle"\)\)/);
  assert.match(deploymentConfig, /migrations_dir: migrationsDir/);
  assert.doesNotMatch(desktop, /vars\.APP_URL|DESKTOP_APP_NAME|DESKTOP_PUBLISHER/);
  assert.match(desktop, /BB-App-Base/);
  assert.match(tauri, /"frontendDist": "setup"/);
  assert.match(setup, /bb-company-app-url/);
  assert.match(setup, /Company app address/);
});
