import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const all = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
const standaloneFiles = ["Masthead.tsx", "PostCard.tsx", "PublicCard.tsx"];
const standalone = standaloneFiles.map((file) =>
  fs.readFileSync(new URL(`../app/r/[slug]/${file}`, import.meta.url), "utf8"),
);

test("web Readout secondary text meets the shared light-theme contrast token", () => {
  assert.match(reader, /const LIGHT_MUT2 = "#6d7074"/);
  assert.match(all, /const MUT2 = "#6d7074"/);
  for (const source of standalone) {
    assert.doesNotMatch(source, /#85878c/);
  }
});

test("web X receipts keep controls outside the outbound X link", () => {
  assert.match(reader, />\s*View on X ↗/);
  assert.doesNotMatch(reader, /<a[^>]+>\{body\}<\/a>/);
  assert.match(reader, /<button type="button" onClick=\{\(\) => setShowOriginal/);
});

test("web specialty menus expose keyboard popup semantics", () => {
  for (const source of [reader, all]) {
    assert.match(source, /<button ref=\{menuTriggerRef\} type="button" aria-haspopup="menu"/);
    assert.match(source, /ref=\{menuRef\} role="menu" aria-label="Tumor area"/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
    assert.match(source, /role="menuitem" tabIndex=\{on \? 0 : -1\}/);
    assert.match(source, /menuTriggerRef\.current\?\.focus\(\)/);
    assert.match(source, /querySelector<HTMLElement>\('\[aria-current="true"\]'\)/);
  }
});
