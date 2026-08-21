import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { clipSecond, dailyAccentOf, DAILY_MUTED, distinctSourceAnchorCount, evidenceBackedHeroWhy, unrepresentedPublishers } from "../app/clientEvidence.ts";

const audio = fs.readFileSync(new URL("../components/AudioQuote.tsx", import.meta.url), "utf8");
const storyView = fs.readFileSync(new URL("../app/StoryView.tsx", import.meta.url), "utf8");
const briefVM = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");

const luminance = (hex) => {
  const values = hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};

const contrast = (foreground, background) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test("fractional podcast offsets use one rounded second for labels and seeks", () => {
  assert.equal(clipSecond(59_600), 60);
  assert.match(briefVM, /const s = clipSecond\(ms\)/);
  assert.match(audio, /const atSec = clipSecond\(startMs\)/);
  assert.doesNotMatch(audio, /Math\.floor\(startMs \/ 1000\)/);
  assert.doesNotMatch(storyView, /Math\.floor\(startMs \/ 1000\)/);
});

test("GI Daily small text clears normal-text contrast on its tinted surface", () => {
  assert.ok(contrast(dailyAccentOf("GI", "#a45c0a"), "#ebeae5") >= 4.5);
  assert.ok(contrast(DAILY_MUTED, "#ebeae5") >= 4.5);
  assert.equal(dailyAccentOf("GU", "#0369a1"), "#0369a1");
});

test("publisher disclosure lists only sources without a rendered publisher receipt", () => {
  assert.deepEqual(
    unrepresentedPublishers(["JAMA", "PubMed", "JAMA"], [{ name: "JAMA Network", handle: "@JAMANetwork" }]),
    ["PubMed"],
  );
});

test("hero activity claims render only with resolvable evidence", () => {
  assert.equal(evidenceBackedHeroWhy("1 paper · shared by 4 clinicians", false), null);
  assert.equal(evidenceBackedHeroWhy("1 paper · shared by 4 clinicians", true), "1 paper · shared by 4 clinicians");
  assert.equal(evidenceBackedHeroWhy("   ", true), null);
});

test("All Oncology activity counts source developments, not receipt volume", () => {
  assert.equal(distinctSourceAnchorCount([
    { kind: "paper", anchorId: "doi:10.1/a" },
    { kind: "paper", anchorId: "doi:10.1/a" },
    { kind: "episode", anchorId: "episode-2" },
  ]), 2);
  assert.equal(distinctSourceAnchorCount([
    { kind: "paper", id: "legacy-1", papers: [{ doi: "10.1/a" }] },
    { kind: "paper", id: "legacy-duplicate", papers: [{ doi: "10.1/a" }] },
    { kind: "topic", id: "legacy-2" },
  ]), 2);
});
