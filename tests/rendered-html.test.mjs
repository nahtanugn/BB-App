import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the 11KCHBB App application shell and sharing metadata", async () => {
  const [layout, tracker, standalone] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/StandaloneApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /11KCHBB App · BB Senior Award Tracker/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /\/app-photo\.jpeg/);
  assert.match(layout, /\/app-photo\.jpeg/);
  assert.match(tracker, /Preparing your award records/);
  assert.match(tracker, /Attendance dates/);
  assert.match(tracker, /Member details/);
  assert.match(standalone, /Company portal/);
  assert.match(standalone, /Create your administrator account/);
});

test("ships the Malaysia Senior Section catalogue, resource-only member access and installable shell", async () => {
  const [route, authRoute, resourcesRoute, resourceLibrary, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/resources/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ResourceLibrary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(route, /Members' Handbook · August 2024/);
  assert.match(route, /President's Award/);
  assert.match(route, /Financial Stewardship/);
  assert.match(route, /create_attendance_session/);
  assert.match(route, /update_attendance/);
  assert.match(route, /Sign in required/);
  assert.match(route, /user\.role === "member"/);
  assert.match(route, /Member accounts can access resources only/);
  assert.match(authRoute, /PBKDF2|passwordDigest/);
  assert.match(authRoute, /Administrator access required/);
  assert.match(authRoute, /requestedRole === "admin" \|\| requestedRole === "member"/);
  assert.match(resourcesRoute, /user\.role === "member"/);
  assert.match(resourcesRoute, /Resources are read-only for members/);
  assert.match(resourceLibrary, /Member resources/);
  assert.match(resourceLibrary, /user\.role !== "member"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /app-photo\.jpeg/);
  assert.match(serviceWorker, /11kchbb-app-v1/);
});
