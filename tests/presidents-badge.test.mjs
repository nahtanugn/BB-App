import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("President's Badge exact profile is pinned without committing the official PDF", async () => {
  const helper = await source("lib/presidents-badge.ts");
  assert.match(helper, /AWA-SR01-2010-9/);
  assert.match(helper, /54e68dcc5536f389fce23a562b32b4b5c7103fc52f323ed17c9b852ee381664b/);
  assert.match(helper, /fileSize: 133_566/);
  assert.match(helper, /pageCount: 5/);
  assert.equal(existsSync(new URL("President's Badge.pdf", root)), false);
});

test("the supplied local master matches the mapped immutable profile when available", async (context) => {
  const path = process.env.PRESIDENTS_BADGE_MASTER;
  if (!path || !existsSync(path)) return context.skip("Official company-owned source is intentionally absent from generic distributions");
  const bytes = await readFile(path);
  assert.equal((await stat(path)).size, 133_566);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "54e68dcc5536f389fce23a562b32b4b5c7103fc52f323ed17c9b852ee381664b");
});

test("PDF generation appends overlays and retains original page streams", async () => {
  const pdf = await source("lib/presidents-badge-pdf.ts");
  const route = await source("app/api/presidents-badge/route.ts");
  assert.match(pdf, /existing instanceof PDFArray/);
  assert.match(pdf, /contents\.push\(existing\)/);
  assert.match(pdf, /field\.font \?\? "F2"/);
  assert.match(pdf, /repairZeroWidthAscii\(pdf, index, "F2"\)/);
  assert.match(pdf, /"@": 921/);
  assert.match(pdf, /widths\.lookup\(index, PDFNumber\)\.asNumber\(\) === 0/);
  assert.match(pdf, /nricFirst: \{ page: 1, x: 104, y: 455\.45/);
  assert.match(pdf, /nricMiddle: \{ page: 1, x: 184\.5, y: 455\.45/);
  assert.match(pdf, /nricLast: \{ page: 1, x: 260\.5, y: 455\.45/);
  assert.match(pdf, /birthDateDay: \{ page: 1, x: 365\.7, y: 455\.45, max: 2, size: 6 \}/);
  assert.match(pdf, /birthDateYear: \{ page: 1, x: 485\.6, y: 455\.45, max: 4, size: 6 \}/);
  assert.match(route, /nricDigits\.slice\(0, 6\)/);
  assert.match(route, /nricDigits\.slice\(6, 8\)/);
  assert.match(route, /nricDigits\.slice\(8, 12\)/);
  assert.match(route, /AWA_SR01_COORDINATES\.birthDateMonth/);
  assert.match(route, /AWA_SR01_COORDINATES\.birthDateYear, value: birth\[1\]/);
  assert.doesNotMatch(pdf, /drawRectangle\([^)]*color/);
});

test("only confirmed external BBM approval awards presidents_award", async () => {
  const route = await source("app/api/presidents-badge/route.ts");
  const screen = await source("app/PresidentsBadgeCentre.tsx");
  assert.match(route, /outcome === "approved" && confirmed/);
  assert.match(route, /'presidents_award','basic','awarded'/);
  assert.match(screen, /Finalising or submitting never awards/);
});

test("assessment links are hashed, expiring and record-isolated", async () => {
  const route = await source("app/api/presidents-badge/route.ts");
  const assessment = await source("app/api/presidents-badge/assessment/route.ts");
  assert.match(route, /14 \* 86_400_000/);
  assert.match(route, /tokenHash/);
  assert.doesNotMatch(route, /INSERT INTO presidents_badge_assessment_invitations[^\n]*token,/);
  assert.match(assessment, /candidate_name/);
  assert.doesNotMatch(assessment, /nric|birth_date|passport_photo/);
});
