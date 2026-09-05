import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";

const root=new URL("../",import.meta.url);const source=async path=>readFile(new URL(path,root),"utf8");

test("Junior Gold Award exact template profile is pinned without committing the official form",async()=>{const helper=await source("lib/junior-gold.ts");assert.match(helper,/AWA-JR01-2010-9/);assert.match(helper,/a466daca54cffaaaa558a07752282e68eed7a114ba74e6368d4f21f6f88e6c82/);assert.match(helper,/fileSize: 82_506/);assert.match(helper,/pageCount: 2/);assert.equal(existsSync(new URL("Junior Gold Award.pdf",root)),false);});

test("supplied Junior Gold Award master matches the immutable profile",async t=>{const path="/Users/nathan/Downloads/Junior Gold Award.pdf";if(!existsSync(path)){t.skip("Local official master is not available");return;}const bytes=await readFile(path);assert.equal((await stat(path)).size,82506);assert.equal(createHash("sha256").update(bytes).digest("hex"),"a466daca54cffaaaa558a07752282e68eed7a114ba74e6368d4f21f6f88e6c82");});

test("Gold Award workflow is available in both section views and uses linked source records",async()=>{const shell=await source("app/AppShell.tsx"),standalone=await source("app/StandaloneApp.tsx"),route=await source("app/api/junior-gold/route.ts"),helper=await source("lib/junior-gold.ts");assert.match(shell,/route: "junior-gold"/);assert.match(shell,/label: "Gold Award"/);assert.match(standalone,/JuniorGoldCentre activeSection=\{activeSection\}/);assert.match(helper,/section='junior'/);assert.match(helper,/junior_white/);assert.match(helper,/junior_silver/);assert.match(route,/gold_award','basic','awarded/);});

test("Junior Gold PDF preserves the two-page master and appends overlays",async()=>{const pdf=await source("lib/junior-gold-pdf.ts"),route=await source("app/api/junior-gold/route.ts");assert.match(pdf,/PDFRawStream\.of/);assert.match(pdf,/existing instanceof PDFArray/);assert.match(pdf,/birthDateYear:\{page:1,x:485\.6,y:455\.45,max:4/);assert.match(route,/generateJuniorGoldPdf/);assert.match(route,/Junior Gold Award eligibility requirements are not complete/);assert.match(route,/junior_gold_versions/);});
