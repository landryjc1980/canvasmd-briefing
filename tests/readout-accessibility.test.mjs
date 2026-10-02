import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const hero = fs.readFileSync(new URL("../app/HeroCards.tsx", import.meta.url), "utf8");
const stance = fs.readFileSync(new URL("../app/StanceBlock.tsx", import.meta.url), "utf8");
const audio = fs.readFileSync(new URL("../components/AudioQuote.tsx", import.meta.url), "utf8");
const standaloneFiles = ["Masthead.tsx", "PostCard.tsx", "PublicCard.tsx"];
const standalone = standaloneFiles.map((file) =>
  fs.readFileSync(new URL(`../app/r/[slug]/${file}`, import.meta.url), "utf8"),
);

test("web Readout secondary text meets the shared light-theme contrast token", () => {
  for (const source of standalone) {
    assert.doesNotMatch(source, /#85878c/);
  }
});

test("web X receipts keep controls outside the outbound X link", () => {
  assert.match(reader, />\s*View on X ↗/);
  assert.doesNotMatch(reader, /<a[^>]+>\{body\}<\/a>/);
  assert.match(reader, /<button type="button" onClick=\{\(\) => setShowOriginal/);
});

test("web like counts meet normal-text contrast", () => {
  assert.doesNotMatch(reader, /#e08aa0/);
  assert.match(reader, /#a93658/);
});

test("hero controls include the story headline in accessible names", () => {
  assert.match(hero, /aria-label=\{`Read \$\{ev\.contextLabel.*for \$\{c\.headline\}`\}/);
  assert.match(hero, /conversation and evidence for \$\{c\.headline\}/);
  assert.match(hero, /aria-label=\{`Share \$\{c\.headline\}`\}/);
});

test("stance receipt disclosure announces its expansion state and target", () => {
  assert.match(stance, /aria-expanded=\{open\}/);
  assert.match(stance, /aria-controls=\{receiptsId\}/);
  assert.match(stance, /id=\{receiptsId\}/);
});

test("audio controls expose their exact state and target", () => {
  assert.match(audio, /Play" : "Pause|Pause" : "Play/);
  assert.match(audio, /controlLabel/);
  assert.match(audio, /Seek \$\{controlLabel\}/);
});
