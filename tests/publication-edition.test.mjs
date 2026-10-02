import test from "node:test";
import assert from "node:assert/strict";
import { archivedEditorialArticle, breakingEditorialArticle } from "../app/briefing-preview/edition.ts";
import { archiveCardForArticle } from "../app/archiveCard.ts";

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

test("web-built archive cards carry the article's own id when it is a UUID", () => {
  const base = { title: "Paper", url: "https://doi.org/10.1/x", journal: "J", domain: "example.org", doi: "10.1/x", pmid: null, peerReviewed: true, kolSharers: 2 };
  assert.equal(archiveCardForArticle({ ...base, article_id: ID }).article_id, ID.toLowerCase());
  assert.equal("article_id" in archiveCardForArticle({ ...base, article_id: "nope" }), false);
  assert.equal("article_id" in archiveCardForArticle(base), false);
});
