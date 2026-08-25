import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/design-lab/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/design-lab/design-lab.css", import.meta.url), "utf8");
const hero = fs.readFileSync(new URL("../app/HeroCards.tsx", import.meta.url), "utf8");
const liveCss = fs.readFileSync(new URL("../app/brief.css", import.meta.url), "utf8");
const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");

test("Readout Next makes source and physician conversation visible before expansion", () => {
  assert.match(page, /function ReadoutNext/);
  assert.match(page, /Physician conversation/);
  assert.match(page, /firstSourceTweet\(card, data\)/);
  assert.match(page, /View full conversation/);
});

test("Readout Next keeps one story-title size and a bounded editorial measure", () => {
  assert.match(css, /\.dl-next-story h2\s*\{[^}]*font:\s*700 27px/);
  assert.doesNotMatch(css, /\.dl-next-story\.is-lead[^}]*font-size/);
  assert.match(css, /\.dl-next main\s*\{[^}]*width:\s*min\(980px/);
});

test("podcast and paper sections share the Top Stories desktop measure", () => {
  assert.match(reader, /const EDITORIAL_MEASURE = 850/);
  assert.equal((reader.match(/className="rv-editorial-measure"/g) ?? []).length, 2);
  assert.match(reader, /maxWidth: wide \? EDITORIAL_MEASURE : undefined/);
});

test("the weekly story view does not lead with the generated recap", () => {
  const nextBlock = page.slice(page.indexOf("function ReadoutNext"), page.indexOf("function Essential"));
  assert.doesNotMatch(nextBlock, /data\.recap/);
});

test("live story cards show paper context and use one title size", () => {
  assert.match(hero, /\{c\.excerpt && \(/);
  assert.doesNotMatch(hero, /c\.excerpt && c\.kind !== ["']paper["']/);
  assert.match(liveCss, /\.readout-hero-card\.is-lead \.readout-hero-title \{[^}]*font-size: 20\.5px/);
  assert.match(liveCss, /@media \(max-width: 640px\)[\s\S]*\.readout-hero-card\.is-lead \.readout-hero-title \{[^}]*font-size: 16px/);
});

test("mobile story cards keep the live hero title bounded", () => {
  assert.match(liveCss, /@media \(max-width: 640px\)[\s\S]*\.readout-hero-card\.is-lead \.readout-hero-title \{[^}]*font-size: 16px/);
});
