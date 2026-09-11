import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Resolve these pure Next.js modules in Node without changing their production imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes("/app/briefing-preview/") && ["./edition", "./readoutRequest"].includes(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { buildReadoutEditionSnapshot, mergeReadoutEditionSnapshot } = await import("../app/briefing-preview/editionSnapshot.ts");
const { breakingEditorialArticle } = await import("../app/briefing-preview/edition.ts");

const now = new Date("2026-09-08T14:00:00Z");
const card = (id, publicationClass) => ({
  area: "GU", firstSeen: now.toISOString(), lastSeen: now.toISOString(),
  card: { id, kind: "paper", publicationClass, headline: `Source ${id}`, sourceLabel: "Oncology source",
    url: `https://example.org/${id}`, excerpt: "Source-provided context.", rankTrace: [{ input: "clinicianSharers", value: 3 }],
    conversation: { authoredClinicians: 0 }, support: { links: [] }, subAreas: [] },
});
const payload = (overrides = {}) => ({ generatedAt: now.toISOString(), cards: [], moreCards: [], episodes: [],
  regulatoryCards: [], designationCards: [], breakingCards: [], ...overrides });
const breaking = (id, publicationClass) => ({ id: `breaking:${id}`, kind: "paper", publicationClass,
  headline: `Trending ${id}`, sourceLabel: "Oncology source", url: `https://example.org/${id}`,
  doi: null, pmid: null, pubDate: null, areas: ["GU"], articleIds: [id], excerpt: null,
  excerptSourceLabel: "Oncology source", metrics: { totalSharers: 6, clinicians: 0, recentClinicians: 6, previousClinicians: 0 } });

test("morning can lead with reviews, commentary, and unclassified articles, keeping source labels", () => {
  const edition = buildReadoutEditionSnapshot("All", payload({ cards: [card("review", "review"), card("comment", "commentary"), card("news", "unknown")] }), now);
  assert.deepEqual(edition.developments.map(({ development }) => development.publicationClass), ["review", "commentary", "unknown"]);
  assert.equal(edition.developments.length, 3);
});

test("preprints stay in Also Relevant and cannot arrive as an hourly lead", () => {
  const morning = buildReadoutEditionSnapshot("All", payload({ cards: [card("preprint", "preprint"), card("review", "review")] }), now);
  assert.equal(morning.developments.length, 1);
  assert.equal(morning.relevant[0].article.publicationClass, "preprint");
  const merged = mergeReadoutEditionSnapshot(morning, payload({ breakingCards: [breaking("preprint-hourly", "preprint")] }), now);
  assert.deepEqual(merged, morning);
});

test("ordinary midday candidates wait while backend-qualified trending articles can be inserted", () => {
  const morning = buildReadoutEditionSnapshot("All", payload({ cards: [card("morning", "research")] }), now);
  const ordinary = mergeReadoutEditionSnapshot(morning, payload({ cards: [card("ordinary", "commentary")] }), now);
  assert.deepEqual(ordinary, morning);
  const merged = mergeReadoutEditionSnapshot(morning, payload({ breakingCards: [breaking("news", "unknown")] }), now);
  assert.equal(merged.developments[0].development.id, "breaking:news");
  assert.equal(merged.developments[1].development.finding, morning.developments[0].development.finding);
  assert.deepEqual(merged.middayInsertions, ["breaking:news"]);
});

test("hourly source types are not relabeled as major research papers", () => {
  for (const [classification, label] of [["review", "Review"], ["commentary", "Commentary"], ["unknown", "Article"], ["research", "Published research"]]) {
    const item = breakingEditorialArticle(breaking(classification, classification), "All");
    assert.equal(item.publicationClass, classification);
    assert.equal(item.evidence, label);
  }
});

test("the public editor keeps unknown classification honest without leaking an internal placeholder", () => {
  const renderer = readFileSync(new URL("../app/briefing-preview/EditorialReadout.tsx", import.meta.url), "utf8");
  assert.match(renderer, /unknown: "Article"/);
  assert.doesNotMatch(renderer, /Unclassified source/);
  const item = breakingEditorialArticle(breaking("unknown-public-label", "unknown"), "All");
  assert.equal(item.publicationClass, "unknown", "the neutral label does not promote the safety class to research");
  assert.equal(item.evidence, "Article");
});
