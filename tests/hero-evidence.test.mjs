// Pins the hero→receipts resolution (Codex test gap): exact paper, article w/ publishers,
// episode EXACT moments (order preserved, missing refs dropped, no-ref → null), thread,
// and missing-evidence cases. The resolver never re-selects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHeroEvidence } from "../app/heroEvidence.ts";

const pod = (episodeId, startMs, showArt = null) => ({ episodeId, startMs, showArt, gloss: "g", mentionCount: 2, episodeTitle: "t", show: "s", audioUrl: "a", publishedAt: "" });

test("paper resolves via topStories first", () => {
  const st = { kind: "paper", headline: "H", papers: [{ url: "u1" }], posts: [{ avatar: "av1" }] };
  const r = resolveHeroEvidence({ kind: "paper", anchorId: "u1", url: "u1", headline: "H" }, { topStories: [st], topArticles: [], movers: [] });
  assert.equal(r?.kind, "paper");
  assert.deepEqual(r.faces, ["av1"]);
});
test("paper falls back to topArticles WITH publisher receipts", () => {
  const a = { url: "u2", title: "T", journal: "J", domain: null, abstract: null, topLikes: 3, faces: ["f"], posts: [], publishers: ["OncLive", "NEJM"], kolSharers: 4 };
  const r = resolveHeroEvidence({ kind: "paper", anchorId: "u2", url: "u2", headline: "T" }, { topStories: [], topArticles: [a], movers: [] });
  assert.equal(r?.kind, "article");
  assert.deepEqual(r.publishers, ["OncLive", "NEJM"], "publisher names must reach the drawer");
});
test("episode resolves ALL moment refs in card order — or nothing (count must never silently shrink)", () => {
  const movers = [{ podcast: [pod("e1", 100), pod("e1", 300), pod("e1", 200), pod("e2", 999)] }];
  const full = resolveHeroEvidence({ kind: "episode", anchorId: "e1", url: "a", headline: "E", momentStartMs: [300, 100] }, { topStories: [], topArticles: [], movers });
  assert.equal(full?.kind, "episode");
  assert.deepEqual(full.pods.map((p) => p.startMs), [300, 100], "card order preserved, exactly the refs — 200 never re-selected in");
  const partial = resolveHeroEvidence({ kind: "episode", anchorId: "e1", url: "a", headline: "E", momentStartMs: [300, 100, 555] }, { topStories: [], topArticles: [], movers });
  assert.equal(partial, null, "ANY unresolvable ref → no drawer; a partial drawer would contradict the card count");
});
test("episode without moment refs returns null — no drawer beats a re-selected guess", () => {
  const movers = [{ podcast: [pod("e1", 100)] }];
  assert.equal(resolveHeroEvidence({ kind: "episode", anchorId: "e1", url: "a", headline: "E" }, { topStories: [], topArticles: [], movers }), null);
});
test("thread resolves its own post; missing evidence is null", () => {
  const post = { tweetUrl: "tw", avatar: "av", name: "n", handle: "h", text: "x", likes: 1, retweets: 0 };
  const r = resolveHeroEvidence({ kind: "thread", anchorId: "t", url: "tw", headline: "X" }, { topStories: [], topArticles: [], movers: [{ posts: [post] }] });
  assert.equal(r?.kind, "thread");
  assert.equal(resolveHeroEvidence({ kind: "thread", anchorId: "t", url: "none", headline: "X" }, { topStories: [], topArticles: [], movers: [] }), null);
  assert.equal(resolveHeroEvidence({ kind: "paper", anchorId: "u", url: "u", headline: "H" }, { topStories: [], topArticles: [], movers: [] }), null);
});
