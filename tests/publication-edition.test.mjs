import test from "node:test";
import assert from "node:assert/strict";
import { archivedEditorialArticle, breakingEditorialArticle } from "../app/briefing-preview/edition.ts";

const ID = "ABCDEF01-2345-4678-89AB-CDEF01234567";
const now = "2026-10-02T10:00:00Z";
const archived = (extra = {}) => ({
  area: "All", firstSeen: now, lastSeen: now,
  card: { id: "paper:1", kind: "paper", anchorId: "1", headline: "A paper", why: "", sourceLabel: "Breast (Edinburgh, Scotland)",
    url: "https://example.org/1", support: { links: [] }, ...extra },
});
const breaking = (extra = {}) => ({
  id: "b1", kind: "paper", headline: "Breaking", sourceLabel: "guoncologynow.com", url: "https://example.org/b", doi: null, pmid: null,
  pubDate: null, areas: ["GU"], articleIds: [], excerpt: null, excerptSourceLabel: "x",
  metrics: { clinicians: 1, cliniciansFeedEligible: 1, reposters: 0, totalSharers: 1, lastSharedAt: null, recentClinicians: 1, previousClinicians: 0 },
  ...extra,
});

test("the edition whitelist keeps the card's own id and saved registry fields", () => {
  const item = archivedEditorialArticle(archived({ article_id: ID, publication_status: "resolved", publication_name: " The Breast " }));
  assert.equal(item.articleId, ID.toLowerCase());
  assert.equal(item.publicationStatus, "resolved");
  assert.equal(item.publicationName, "The Breast");
  assert.equal(item.journal, "Breast (Edinburgh, Scotland)", "the legacy label is untouched");
  assert.equal("sourceName" in item, false, "the render-time field is never written by the builder");
});

test("malformed or partial registry fields are dropped, never written as undefined", () => {
  const item = archivedEditorialArticle(archived({ article_id: "paper:1", publication_status: "maybe", publication_name: "X" }));
  for (const key of ["articleId", "publicationStatus", "publicationName"]) assert.equal(key in item, false, key);
  const unresolved = archivedEditorialArticle(archived({ publication_status: "unresolved", publication_name: "Ignored" }));
  assert.equal(unresolved.publicationStatus, "unresolved");
  assert.equal("publicationName" in unresolved, false);
  const blank = archivedEditorialArticle(archived({ publication_status: "resolved", publication_name: "  " }));
  assert.equal("publicationName" in blank, false);
});

test("breaking cards copy the same fields", () => {
  const item = breakingEditorialArticle(breaking({ article_id: ID, publication_status: "resolved", publication_name: "GU Oncology Now" }));
  assert.equal(item.articleId, ID.toLowerCase());
  assert.equal(item.publicationStatus, "resolved");
  assert.equal(item.publicationName, "GU Oncology Now");
  const plain = breakingEditorialArticle(breaking());
  for (const key of ["articleId", "publicationStatus", "publicationName"]) assert.equal(key in plain, false, key);
});

test("the Readout renders the registry-aware source, not the bare frozen journal", async () => {
  const { readFileSync } = await import("node:fs");
  const renderer = readFileSync(new URL("../app/briefing-preview/EditorialReadout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(renderer, /source=\{item\.journal\}/);
  assert.doesNotMatch(renderer, /\{item\.journal\}/);
  assert.match(renderer, /shownSource\(item, item\.journal\)/);
  assert.match(renderer, /shownSource\(designation, designation\.sourceLabel\)/);
  for (const file of ["app/page.tsx", "app/api/briefing/route.ts"]) {
    assert.match(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), /withPublicationNames\(await getCachedReadoutWindow\(/, file);
  }
});
