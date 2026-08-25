import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const preview = read("app/briefing-preview/EditorialReadout.tsx");
const edition = read("app/briefing-preview/edition.ts");
const middleware = read("middleware.ts");

test("the compact briefing keeps the physician evidence layer intact", () => {
  assert.match(preview, /What physicians are saying/);
  assert.match(preview, /Shared, no commentary yet\./);
  assert.match(preview, /isTitleOnlyShare/);
  assert.match(preview, /posts\.slice\(0, 3\)/);
  assert.match(preview, /<p>\{post\.text\}<\/p>/);
  assert.match(preview, /post\.tweetUrl/);
  assert.match(preview, /shared by \{item\.sharedBy\} clinician/);
  assert.doesNotMatch(preview, /summari[sz]e.*post|synthetic.*quote/i);
});

test("the briefing is editorial rather than a repackaged catalog", () => {
  assert.match(preview, /Worth Your Time/);
  assert.match(preview, /Also Relevant/);
  assert.match(preview, /Regulatory Watch/);
  assert.match(preview, /No development cleared the bar/);
  assert.doesNotMatch(preview, />Papers<|>Trials<|>People<|>Drugs</);
  assert.match(edition, /remember: string/);
  assert.match(preview, /<strong>Remember:<\/strong>/);
  assert.match(preview, /relevant\.slice\(0, 1\)/);
});

test("specialty filters are lenses on the same earned briefing", () => {
  for (const area of ["All", "GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"]) {
    assert.match(edition, new RegExp(`\\b${area}\\b`));
  }
  assert.match(edition, /area === "All" \? items : items\.filter/);
  assert.match(edition, /SPECIALTY_FALLBACKS/);
  assert.match(preview, /best of past 72h ET/);
  assert.match(preview, /No new development cleared the bar in 24 hours/);
});

test("the preview is public locally without weakening the production gate", () => {
  assert.match(middleware, /NODE_ENV !== "production"/);
  assert.match(middleware, /pathname\.startsWith\("\/briefing-preview"\)/);
});
