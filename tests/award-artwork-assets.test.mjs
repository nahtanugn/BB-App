import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const approvedArtwork = [
  "athletics",
  "citizenship",
  "cross_of_heroism",
  "duke_of_edinburgh_gold",
  "duke_of_edinburgh_silver",
  "drill",
  "gold_award",
  "martial_arts",
  "gallant_conduct",
];

test("confirmed award artwork assets exist in supported image formats", async () => {
  for (const key of approvedArtwork) {
    const extension = ["athletics", "citizenship", "martial_arts", "gallant_conduct"].includes(key) ? "png" : "webp";
    const file = path.join(root, "public", "award-badges", `${key}.${extension}`);
    const [metadata, bytes] = await Promise.all([stat(file), readFile(file)]);
    assert.ok(metadata.size > 1000, `${key} image should not be empty`);
    if (extension === "png") {
      assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a", `${key} should be PNG`);
    } else {
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF", `${key} should be a RIFF image`);
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP", `${key} should be WebP`);
    }
  }
});

test("Drill artwork stays sourced from the handbook, not the mismatched composite crop", async () => {
  const extractor = await readFile(path.join(root, "scripts", "extract-award-badges.py"), "utf8");
  assert.match(extractor, /Drill artwork is maintained separately from the composite proficiency sheet:[\s\S]*?page 128/);
  assert.doesNotMatch(extractor, /"drill": \(/);
});

test("handbook-only artwork crops cover Athletics backing, Martial Arts, and Gallant Conduct", async () => {
  const extractor = await readFile(path.join(root, "scripts", "extract-handbook-badges.swift"), "utf8");
  assert.match(extractor, /Printed page 136: clean badge face without the advanced red cloth backing/);
  assert.match(extractor, /\("martial_arts", Crop\(pageNumber: 169/);
  assert.match(extractor, /\("gallant_conduct", Crop\(pageNumber: 123/);
  for (const key of ["athletics", "martial_arts", "gallant_conduct"]) {
    const bytes = await readFile(path.join(root, "public", "award-badges", `${key}.png`));
    assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a", `${key} should be PNG`);
  }
});

test("Citizenship artwork uses the supplied badge proportions with a transparent background", async () => {
  const processor = await readFile(path.join(root, "scripts", "process-citizenship-badge.swift"), "utf8");
  assert.match(processor, /remove the white page/);
  assert.match(processor, /CGRect\(x: 14, y: 0, width: 151, height: 230\)/);
  assert.match(processor, /keyWhite/);
  const bytes = await readFile(path.join(root, "public", "award-badges", "citizenship.png"));
  assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 151, "crop should use the badge's natural portrait width");
  assert.equal(bytes.readUInt32BE(20), 230, "crop should preserve the supplied portrait height");
  assert.equal(bytes[25], 6, "PNG should retain an alpha channel for transparency");
});

test("Junior Service artwork keeps the One-Year badge logo visible inside a navy outline", async () => {
  const processor = await readFile(path.join(root, "scripts", "process-junior-service-badge.swift"), "utf8");
  assert.match(processor, /logoScale = 0\.68/);
  assert.match(processor, /context\.setLineWidth\(3\)/);
  assert.match(processor, /context\.strokeEllipse\(in: CGRect/);
  assert.doesNotMatch(processor, /fillEllipse\(/, "the blue backing should be an outline, not a filled disk");
  const bytes = await readFile(path.join(root, "public", "award-badges", "junior_service_award.png"));
  assert.equal(bytes.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 474);
  assert.equal(bytes.readUInt32BE(20), 789);
  assert.equal(bytes[25], 6, "PNG should preserve its transparent background");
});
