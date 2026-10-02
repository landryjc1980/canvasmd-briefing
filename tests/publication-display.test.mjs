import test from "node:test";
import assert from "node:assert/strict";
import { articleKey, ownArticlePick, publicationName, savedPublicationName, shownSource } from "../lib/publicationDisplay.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const entries = new Map([
  [A, { status: "resolved", name: "The Breast" }],
  [B, { status: "unresolved", name: null }],
  [C, { status: "conflict", name: null }],
]);

test("articleKey accepts only UUIDs and lower-cases them", () => {
  assert.equal(articleKey(A.toUpperCase()), A);
  assert.equal(articleKey("paper:10.1/abc"), null);
  assert.equal(articleKey(42), null);
});

test("own-id pick order: article_id, then canonicalArticleId, then a single articleIds entry", () => {
  assert.deepEqual(ownArticlePick({ article_id: A, canonicalArticleId: B, articleIds: [C] }), { kind: "id", id: A });
  assert.deepEqual(ownArticlePick({ articleId: A, canonicalArticleId: B }), { kind: "id", id: A });
  assert.deepEqual(ownArticlePick({ article_id: "not-a-uuid", canonicalArticleId: B, articleIds: [C] }), { kind: "id", id: B });
  assert.deepEqual(ownArticlePick({ articleIds: [C, C.toUpperCase()] }), { kind: "id", id: C });
  assert.deepEqual(ownArticlePick({ articleIds: [A, B] }), { kind: "undecided" });
  assert.deepEqual(ownArticlePick({ articleIds: ["paper:x"] }), { kind: "none" });
  assert.deepEqual(ownArticlePick({}), { kind: "none" });
  assert.deepEqual(ownArticlePick(null), { kind: "none" });
});

test("rule 1: an own id shows the registry name, or nothing when unresolved or in conflict", () => {
  assert.equal(publicationName({ pick: { kind: "id", id: A }, entries }), "The Breast");
  assert.equal(publicationName({ pick: { kind: "id", id: B }, entries }), null);
  assert.equal(publicationName({ pick: { kind: "id", id: C }, entries, saved: { publication_status: "resolved", publication_name: "Saved" } }), null);
});

test("an id with no row or a failed lookup uses the saved fields, else shows nothing", () => {
  const missing = { kind: "id", id: "44444444-4444-4444-8444-444444444444" };
  assert.equal(publicationName({ pick: missing, entries }), null);
  assert.equal(publicationName({ pick: missing, entries: null }), null);
  assert.equal(publicationName({ pick: missing, entries: null, saved: { publicationStatus: "resolved", publicationName: "Lung Cancer" } }), "Lung Cancer");
  assert.equal(publicationName({ pick: missing, entries: null, saved: { publication_status: "unresolved" } }), null);
});

test("rule 2: saved fields in snake or camel case; rule 3: undefined", () => {
  const none = { kind: "none" };
  assert.equal(publicationName({ pick: none, entries, saved: { publication_status: "resolved", publication_name: " GU Oncology Now " } }), "GU Oncology Now");
  assert.equal(publicationName({ pick: none, entries, saved: { publicationStatus: "resolved", publicationName: "Cancer Therapy Advisor" } }), "Cancer Therapy Advisor");
  assert.equal(publicationName({ pick: none, entries, saved: { publicationStatus: "conflict", publicationName: "X" } }), null);
  assert.equal(publicationName({ pick: none, entries, saved: { publication_status: "resolved", publication_name: "" } }), null);
  assert.equal(publicationName({ pick: none, entries, saved: { publication_status: "bogus" } }), undefined);
  assert.equal(publicationName({ pick: none, entries }), undefined);
  assert.equal(savedPublicationName(null), undefined);
});

test("undecided shows nothing, even with saved fields", () => {
  assert.equal(publicationName({ pick: { kind: "undecided" }, entries, saved: { publication_status: "resolved", publication_name: "X" } }), null);
});

test("shownSource prefers the decorated key, including null, over the legacy label", () => {
  assert.equal(shownSource({ sourceName: "New England Journal of Medicine" }, "The New England Journal of Medicine"), "New England Journal of Medicine");
  assert.equal(shownSource({ sourceName: null }, "guoncologynow.com"), null);
  assert.equal(shownSource({}, "guoncologynow.com"), "guoncologynow.com");
  assert.equal(shownSource({}, undefined), null);
});
