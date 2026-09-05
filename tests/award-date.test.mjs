import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("awarded status records today automatically and permits a manual date", () => {
  const tracker = read("app/AwardTracker.tsx");
  const route = read("app/api/tracker/route.ts");

  assert.match(tracker, /function updateAwardDate/);
  assert.match(tracker, /action: "update_award_date"/);
  assert.match(tracker, /<span>Date awarded<\/span>/);
  assert.match(tracker, /type="date"/);
  assert.match(tracker, /max=\{localDateValue\(\)\}/);
  assert.match(route, /awarded_at=COALESCE\(awarded_at,date\('now'\)\)/);
  assert.match(route, /action === "update_award_date"/);
  assert.match(route, /isValidAwardDate\(awardedAt\)/);
  assert.match(route, /action: "award_date_updated"/);
});

test("manual dates update only an existing awarded record", () => {
  const route = read("app/api/tracker/route.ts");

  assert.match(
    route,
    /SELECT member_id FROM member_awards WHERE member_id=\? AND award_code=\? AND level=\? AND status='awarded'/,
  );
  assert.match(
    route,
    /UPDATE member_awards SET awarded_at=\?,updated_at=\?,updated_by=\?/,
  );
  assert.match(route, /value <= malaysiaDateValue\(\)/);
});
