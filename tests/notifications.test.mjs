import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("implements durable, role-targeted and optional device notifications", async () => {
  const [api, delivery, submissions, onboarding, uniforms, ui, worker] =
    await Promise.all([
      read("app/api/notifications/route.ts"),
      read("lib/notifications.ts"),
      read("app/api/submissions/route.ts"),
      read("app/api/onboarding/route.ts"),
      read("app/api/uniform-requests/route.ts"),
      read("app/NotificationCentre.tsx"),
      read("public/sw.js"),
    ]);

  assert.match(api, /recipient_user_id = \?/);
  assert.match(api, /mark_all_read/);
  assert.match(api, /subscribe_push/);
  assert.match(api, /endpoint\.startsWith\("https:\/\/"\)/);
  assert.match(delivery, /account_status = 'active'/);
  assert.match(delivery, /ON CONFLICT\(recipient_user_id, entity_key\) DO NOTHING/);
  assert.match(delivery, /Never fail or duplicate the primary workflow/);
  assert.match(submissions, /Award submission awaiting review/);
  assert.match(submissions, /Award application approved/);
  assert.match(onboarding, /Member access request/);
  assert.match(onboarding, /role IN \('nco', 'squad_leader'\) AND squad = \?/);
  assert.match(uniforms, /stock\.manage_uniform_requests/);
  assert.match(ui, /Notification\.requestPermission/);
  assert.match(ui, /On iPhone, add the app to your Home Screen first/);
  assert.match(worker, /showNotification/);
  assert.doesNotMatch(worker, /evidence_url|contact_number|parents_name/);
});
