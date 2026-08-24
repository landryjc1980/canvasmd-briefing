import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { featuredHeroPaperKeys, visibleAllHeroCards } from "../app/allHeroContract.ts";

const cards = Array.from({ length: 5 }, (_, i) => ({ id: String(i), kind: i === 0 ? "paper" : "episode", anchorId: `a${i}`, headline: `Card ${i}`, url: `u${i}`, why: "", sourceLabel: "" }));

test("All Oncology keeps the signed order and caps only the initial scan", () => {
  assert.deepEqual(visibleAllHeroCards(cards, false, false).map((x) => x.id), ["0", "1", "2"]);
  assert.deepEqual(visibleAllHeroCards(cards, true, false).map((x) => x.id), ["0", "1"]);
  assert.deepEqual(visibleAllHeroCards(cards, true, true).map((x) => x.id), ["0", "1", "2", "3", "4"]);
});

test("featured-paper identity comes only from hero paper anchors", () => {
  const keys = featuredHeroPaperKeys(cards);
  assert.equal(keys.has("u:a0"), true);
  assert.equal(keys.has("u:u0"), true);
  assert.equal(keys.has("t:card 0"), true);
  assert.equal(keys.has("u:a1"), false);
});

test("All Oncology uses the current light Readout shell and Hero tokens", () => {
  const source = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
  assert.match(source, /className="reader-editorial"/);
  assert.match(source, /background: PAPER, color: INK/);
  assert.match(source, /ink=\{\{ soft: INK_2, softer: MUT, line: LINE, ring: PAPER, surface: SURFACE \}\}/);
  assert.doesNotMatch(source, /root\.style\.backgroundColor = INK/);
});

test("All Oncology exposes the same listening and paper interactions as specialty editions", () => {
  const source = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
  assert.match(source, /id="all-listen"/);
  assert.match(source, />Podcasts from current specialty briefs</);
  assert.match(source, />Papers being shared</);
  assert.match(source, /contextLabel=\{area\}/);
  assert.match(source, /\{groupsJsx\}\{podcastsJsx\}\{readingJsx\}\{voicesInline\}/);
});

test("All Oncology does not collapse distinct podcast titles by a shared prefix", () => {
  const source = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
  const episodeKey = source.match(/const epKey = [^;]+;/)?.[0] ?? "";
  assert.match(episodeKey, /replace\(\/\\s\+\/g, ""\)/);
  assert.doesNotMatch(episodeKey, /slice\(0,\s*34\)/);
  assert.match(source, /eps\.set\(e\.recordingKey \|\| e\.episodeId \|\| epKey\(e\.title\)/,
    "distinct recordings with the same title keep separate faculty appearances");
});
