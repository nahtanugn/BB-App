import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Officer Section is linked to Company Statistics and the People hub", () => {
  const shell = read("app/AppShell.tsx");
  const standalone = read("app/StandaloneApp.tsx");
  const statistics = read("app/CompanyStatisticsCentre.tsx");
  assert.match(shell, /route: "officers"/);
  assert.match(shell, /Officer Section and statistics details/);
  assert.match(standalone, /<OfficerSection role=\{currentUser\.role\}/);
  assert.match(statistics, /open=officers/);
});

test("Officer Section stores statistics classifications on existing accounts", () => {
  const api = read("app/api/officers/route.ts");
  const page = read("app/OfficerSection.tsx");
  assert.match(api, /role IN \('admin', 'officer'\)/);
  assert.match(api, /officer_profile_updated/);
  for (const field of ["officer_rank", "gender", "ethnicity", "religion", "spiritual_status", "officer_work_status"]) assert.match(api, new RegExp(field));
  for (const rank of ["Staff Sergeant", "Warrant Officer", "Lieutenant", "Captain", "Honorary Captain", "Chaplain"]) assert.match(page, new RegExp(rank));
  assert.match(page, /Spiritual status \(optional\)/);
  assert.match(page, /role === "viewer"/);
});
