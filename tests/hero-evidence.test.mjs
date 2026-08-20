// Pins the hero→receipts resolution (Codex test gap): exact paper, article w/ publishers,
// episode EXACT moments (order preserved, missing refs dropped, no-ref → null), thread,
// and missing-evidence cases. The resolver never re-selects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickConversationPreview, resolveHeroEvidence } from "../app/heroEvidence.ts";

const pod = (episodeId, startMs, showArt = null) => ({ episodeId, startMs, showArt, gloss: "g", mentionCount: 2, episodeTitle: "t", show: "s", audioUrl: "a", publishedAt: "" });

test("conversation preview skips link-only shares for authored physician words", () => {
  const linkOnly = { text: "https://t.co/BOcBF0bXjB", likes: 3 };
  const repost = { text: "RT @JAMAOnc: New survival data in triple negative breast cancer.", likes: 8 };
  const authored = { text: "Very interesting survival data in patients with triple negative breast cancer.", likes: 0 };
  assert.equal(pickConversationPreview([linkOnly, repost, authored]), authored);
  assert.equal(pickConversationPreview([linkOnly, repost]), null);
});

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

test("episode moments resolve via the dedicated receipts channel when capped out of movers pods", () => {
  const heroCandidates = { cards: [], tieCount: 0, receipts: [pod("e1", 700), pod("e1", 800), pod("e1", 900)] };
  const r = resolveHeroEvidence({ kind: "episode", anchorId: "e1", url: "a", headline: "E", momentStartMs: [700, 800, 900] }, { topStories: [], topArticles: [], movers: [], heroCandidates });
  assert.equal(r?.kind, "episode");
  assert.deepEqual(r.pods.map((p) => p.startMs), [700, 800, 900], "all three resolve from receipts, none from movers");
});

test("paper receipts include publisher POSTS from the reading row on both join paths", () => {
  const pubPost = { name: "OncLive", handle: "OncLive", avatar: null, tweetUrl: "pt", text: "New data...", likes: 9, retweets: 1 };
  const otherPost = { name: "Research group", handle: "research", avatar: null, tweetUrl: "ot", text: "Study context...", likes: 3, retweets: 0 };
  const art = { url: "u3", title: "T3", journal: "J", domain: null, abstract: null, topLikes: 1, faces: [], posts: [], publishers: ["OncLive"], publisherPosts: [pubPost], otherPosts: [otherPost], kolSharers: 2 };
  const viaArticle = resolveHeroEvidence({ kind: "paper", anchorId: "u3", url: "u3", headline: "T3" }, { topStories: [], topArticles: [art], movers: [] });
  assert.deepEqual(viaArticle.publisherPosts, [pubPost]);
  assert.deepEqual(viaArticle.otherPosts, [otherPost]);
  const st = { kind: "paper", headline: "T3", papers: [{ url: "u3" }], posts: [] };
  const viaStory = resolveHeroEvidence({ kind: "paper", anchorId: "u3", url: "u3", headline: "T3" }, { topStories: [st], topArticles: [art], movers: [] });
  assert.deepEqual(viaStory.publisherPosts, [pubPost], "story-matched papers still carry the reading row's publisher posts");
  assert.deepEqual(viaStory.otherPosts, [otherPost], "neutral evidence survives both paper join paths");
});

test("paper receipts preserve exact supporting coverage without using it to resolve the anchor", () => {
  const link = { kind: "article", id: "a1", title: "Author discusses the study", url: "https://example.com/a1", sourceLabel: "OncLive", relationshipType: "interviews_author", occurredAt: "2026-08-14T00:00:00Z" };
  const st = { kind: "paper", headline: "H", papers: [{ url: "u4" }], posts: [] };
  const r = resolveHeroEvidence({ kind: "paper", anchorId: "u4", url: "u4", headline: "H", support: { clinicianPosts: [], publisherPosts: [], links: [link] } }, { topStories: [st], topArticles: [], movers: [] });
  assert.equal(r?.kind, "paper");
  assert.deepEqual(r.supportLinks, [link]);
});

test("event receipts resolve exact clinician, publisher, and coverage support", () => {
  const clinician = { name: "Dr C", handle: "doctor", avatar: "c.jpg", tweetUrl: "https://x.com/doctor/status/1", text: "Approval reaction", likes: 4, retweets: 0, quotes: 0, views: 10 };
  const publisher = { name: "OncLive", handle: "OncLive", avatar: "p.jpg", tweetUrl: "https://x.com/OncLive/status/2", text: "Approval coverage", likes: 2, retweets: 0, quotes: 0, views: 8 };
  const other = { name: "Research group", handle: "research", avatar: "o.jpg", tweetUrl: "https://x.com/research/status/3", text: "Approval context", likes: 1, retweets: 0, quotes: 0, views: 4 };
  const link = { kind: "article", id: "a2", title: "FDA expands Pluvicto", url: "https://example.com/a2", sourceLabel: "OncLive", relationshipType: "covers_approval", occurredAt: null };
  const r = resolveHeroEvidence({ kind: "event", anchorId: "event:fda-1", url: "https://fda.gov/approval", headline: "Pluvicto approval", support: { clinicianPosts: [clinician], publisherPosts: [publisher], otherPosts: [other], links: [link] } }, { topStories: [], topArticles: [], movers: [] });
  assert.equal(r?.kind, "event");
  assert.deepEqual(r.posts, [clinician]);
  assert.deepEqual(r.publisherPosts, [publisher]);
  assert.deepEqual(r.otherPosts, [other]);
  assert.deepEqual(r.supportLinks, [link]);
  assert.deepEqual(r.faces, ["c.jpg", "p.jpg", "o.jpg"]);
});

test("event without support has no drawer", () => {
  const card = { kind: "event", anchorId: "event:fda-2", url: "https://fda.gov/approval", headline: "Approval" };
  assert.equal(resolveHeroEvidence(card, { topStories: [], topArticles: [], movers: [] }), null);
});

test("anchored readout resolves its bundled physician words and primary source", () => {
  const clinician = { name: "Toni Choueiri", handle: "DrChoueiri", avatar: "toni.jpg", tweetUrl: "https://x.com/DrChoueiri/status/1", text: "Landmark moment for cancer immunotherapy.", likes: 61, retweets: 0, quotes: 0, views: 0 };
  const link = { kind: "article", id: "merck", title: "INTerpath-001 results", url: "https://merck.com/news/interpath", sourceLabel: "Merck press release", relationshipType: "primary_source", occurredAt: null };
  const card = { kind: "readout", anchorId: "development:interpath", url: link.url, headline: "INTerpath-001 meets RFS and DMFS endpoints in melanoma", support: { clinicianPosts: [clinician], publisherPosts: [], otherPosts: [], links: [link] } };
  const r = resolveHeroEvidence(card, { topStories: [], topArticles: [], movers: [] });
  assert.equal(r?.kind, "event");
  assert.deepEqual(r.posts, [clinician]);
  assert.deepEqual(r.supportLinks, [link]);
  assert.deepEqual(r.faces, ["toni.jpg"]);
});
