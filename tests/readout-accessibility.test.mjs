import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const all = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
const hero = fs.readFileSync(new URL("../app/HeroCards.tsx", import.meta.url), "utf8");
const flat = fs.readFileSync(new URL("../app/ReaderViewFlat.tsx", import.meta.url), "utf8");
const stance = fs.readFileSync(new URL("../app/StanceBlock.tsx", import.meta.url), "utf8");
const audio = fs.readFileSync(new URL("../components/AudioQuote.tsx", import.meta.url), "utf8");
const dailyConversation = fs.readFileSync(new URL("../app/DailyConversationEvidence.tsx", import.meta.url), "utf8");
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

test("web like counts meet normal-text contrast", () => {
  for (const source of [reader, flat]) {
    assert.doesNotMatch(source, /#e08aa0/);
    assert.match(source, /#a93658/);
  }
});

test("web specialty menus expose keyboard popup semantics", () => {
  for (const source of [reader, all]) {
    assert.match(source, /<button ref=\{menuTriggerRef\} type="button" aria-haspopup="menu"/);
    assert.match(source, /ref=\{menuRef\} role="menu" aria-label="Tumor area"/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
    assert.match(source, /event\.key === "Tab"/);
    assert.match(source, /onBlur=\{\(event\) => \{ if \(!event\.currentTarget\.contains/);
    assert.match(source, /role="menuitem" tabIndex=\{on \? 0 : -1\}/);
    assert.match(source, /menuTriggerRef\.current\?\.focus\(\)/);
    assert.match(source, /querySelector<HTMLElement>\('\[aria-current="true"\]'\)/);
  }
});

test("hero controls include the story headline in accessible names", () => {
  assert.match(hero, /aria-label=\{`Read abstract for \$\{c\.headline\}`\}/);
  assert.match(hero, /conversation and evidence for \$\{c\.headline\}/);
  assert.match(hero, /aria-label=\{`Share \$\{c\.headline\}`\}/);
});

test("flat fallback accordions are keyboard operable and separate paper disclosures", () => {
  assert.match(flat, /role=\{disabled \? undefined : "button"\}/);
  assert.match(flat, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(flat, /const \[abstractOpen, setAbstractOpen\]/);
  assert.match(flat, /const \[sourcesOpen, setSourcesOpen\]/);
  assert.match(flat, /Sources · \$\{revealableClinicians\} of \$\{totalClinicians\}/);
  assert.match(flat, /minHeight: 44/);
  assert.match(flat, /disabled=\{!eps\.length\}/);
});

test("stance receipt disclosure announces its expansion state and target", () => {
  assert.match(stance, /aria-expanded=\{open\}/);
  assert.match(stance, /aria-controls=\{receiptsId\}/);
  assert.match(stance, /id=\{receiptsId\}/);
});

test("audio and Daily conversation controls expose their exact state and target", () => {
  assert.match(audio, /Play" : "Pause|Pause" : "Play/);
  assert.match(audio, /controlLabel/);
  assert.match(audio, /Seek \$\{controlLabel\}/);
  assert.match(dailyConversation, /daily-conversation-more/);
  assert.match(dailyConversation, /daily-conversation-less/);
});
