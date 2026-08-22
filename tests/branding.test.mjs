import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) { return readFile(new URL(path, import.meta.url), "utf8"); }

test("administrators can customise deployment branding without exposing logo data", async () => {
  const [api, settings, shell, context, migration] = await Promise.all([
    source("../app/api/branding/route.ts"),
    source("../app/BrandingSettings.tsx"),
    source("../app/AppShell.tsx"),
    source("../app/BrandingContext.tsx"),
    source("../drizzle/0032_custom_app_branding.sql"),
  ]);
  assert.match(api, /user\.role !== "admin"/);
  assert.match(api, /PNG, JPEG or WebP logo smaller than 750 KB/);
  assert.match(api, /logo_data_url IS NOT NULL AS has_custom_logo/);
  assert.doesNotMatch(api, /Response\.json\([^)]*logo_data_url/);
  assert.match(settings, /App name/);
  assert.match(settings, /Company logo/);
  assert.match(shell, /branding\.appName/);
  assert.match(context, /app-branding-updated/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `app_branding`/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/);
});
