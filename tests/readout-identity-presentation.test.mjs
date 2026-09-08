import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Resolve the pure Readout modules in Node without changing their production imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes("/app/briefing-preview/") && ["./edition", "./readoutRequest"].includes(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { ARCHIVED_LISTEN_MEDIA, listenCardTitle, sameEditorialArticle } = await import("../app/briefing-preview/edition.ts");
const { sevenDayEditionDevelopments, sevenDayEditionListen } = await import("../app/briefing-preview/editionSnapshot.ts");

const article = (id, { doi, pmid, url = `https://example.test/${id}`, title = "A source-identified oncology article" } = {}) => ({
  id,
  area: "Breast",
  site: "Breast",
  nickname: id,
  takeaway: "",
  finding: "",
  remember: "",
  journal: "Journal",
  title,
  url,
  evidence: "Research",
  sharedBy: 1,
  match: { doi, pmid },
});

const snapshot = (editionDate, { developments = [], relevant = [], listen = [] } = {}) => ({
  schemaVersion: 2,
  editionDate,
  generatedAt: `${editionDate}T12:00:00.000Z`,
  area: "All",
  developments,
  relevant,
  listen,
  regulatoryCards: [],
  designationCards: [],
});

test("saved Listen entries with no live episode display their preserved source title, never a hook", () => {
  const saved = ARCHIVED_LISTEN_MEDIA.find((item) => item.id === "loi-tils");
  assert.ok(saved);
  const history = [snapshot("2026-09-07", { listen: [{ item: saved, episode: null }] })];
  const [{ item, episode }] = sevenDayEditionListen(history);
  assert.equal(episode, null);
  assert.equal(listenCardTitle(episode?.title, item, saved), "Tumour-infiltrating lymphocytes in breast cancer with Professor Sherene Loi");
  assert.notEqual(listenCardTitle(episode?.title, item, saved), item.hook);
});

test("seven-day history keeps an older lead once when a newer edition carried it as relevant", () => {
  const lead = article("same-paper", { doi: "10.1000/Example.1" });
  const newerRelevant = article("same-paper-newer-copy", { doi: "https://doi.org/10.1000/example.1" });
  const result = sevenDayEditionDevelopments([
    snapshot("2026-09-08", { relevant: [{ article: newerRelevant, position: 0 }] }),
    snapshot("2026-09-07", { developments: [{ development: lead, episode: null, position: 0 }] }),
  ]);
  assert.deepEqual(result.developments.map((item) => item.id), ["same-paper"]);
  assert.deepEqual(result.relevant, []);
});

test("conflicting explicit DOI or PMID identities fail closed before URL or title matching", () => {
  const sameUrl = "https://example.test/source";
  assert.equal(
    sameEditorialArticle(article("doi-left", { doi: "10.1000/one", pmid: "111", url: sameUrl }), article("doi-right", { doi: "https://doi.org/10.1000/ONE", pmid: "222", url: sameUrl })),
    false,
  );
  assert.equal(
    sameEditorialArticle(article("pmid-left", { doi: "10.1000/one", pmid: "111", url: sameUrl }), article("pmid-right", { doi: "10.1000/two", pmid: "111", url: sameUrl })),
    false,
  );
  assert.equal(
    sameEditorialArticle(article("matching", { doi: "10.1000/ONE", pmid: "111" }), article("normalized", { doi: "https://doi.org/10.1000/one", pmid: "111" })),
    true,
  );
});
