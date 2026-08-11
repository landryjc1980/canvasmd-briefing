import test from "node:test";
import assert from "node:assert/strict";
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
