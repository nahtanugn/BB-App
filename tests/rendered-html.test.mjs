import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the Anchor Awards application shell and sharing metadata", async () => {
  const [layout, tracker] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AwardTracker.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Anchor Awards · BB Senior Award Tracker/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /\/og\.png/);
  assert.match(tracker, /Preparing your award records/);
  assert.match(tracker, /Attendance dates/);
  assert.match(tracker, /Member details/);
});

test("ships the Malaysia Senior Section catalogue and installable shell", async () => {
  const [route, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/api/tracker/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(route, /Members' Handbook · August 2024/);
  assert.match(route, /President's Award/);
  assert.match(route, /Financial Stewardship/);
  assert.match(route, /create_attendance_session/);
  assert.match(route, /update_attendance/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(serviceWorker, /anchor-awards-v2/);
});
