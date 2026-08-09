// Pins the hero-mode rendering contract (Codex test gap): hero → cards ?? [] (authoritative,
// empty = quiet week), legacy → null (views fall through to topStories).
import { test } from "node:test";
import assert from "node:assert/strict";
import { heroDeckOf } from "../app/heroContract.ts";

test("hero mode: the deck is authoritative — cards ?? []", () => {
  const cards = [{ id: "paper:x" }];
  assert.deepEqual(heroDeckOf({ mode: "hero", heroCandidates: { cards, tieCount: 0 } }), cards);
});
test("hero mode with an EMPTY deck returns [] — a signed quiet week, never a legacy fallback", () => {
  assert.deepEqual(heroDeckOf({ mode: "hero", heroCandidates: { cards: [], tieCount: 0 } }), []);
  assert.deepEqual(heroDeckOf({ mode: "hero" }), [], "hero without a deck object still renders empty, not legacy");
});
test("legacy mode returns null so views render topStories", () => {
  assert.equal(heroDeckOf({ mode: "legacy" }), null);
  assert.equal(heroDeckOf({}), null, "old snapshots without mode are legacy");
  assert.equal(heroDeckOf({ heroCandidates: { cards: [{ id: "x" }], tieCount: 0 } }), null, "a deck WITHOUT hero mode never renders");
});
