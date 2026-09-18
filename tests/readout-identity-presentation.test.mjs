import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Resolve the pure Readout modules in Node without changing their production imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/readoutRegulatoryIdentity") {
    return nextResolve(new URL("../lib/readoutRegulatoryIdentity.ts", import.meta.url).href, context);
  }
  if (context.parentURL?.includes("/app/briefing-preview/") && ["./edition", "./readoutRequest"].includes(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });

const { ARCHIVED_LISTEN_MEDIA, archivedEditorialArticle, listenCardTitle, sameEditorialArticle } = await import("../app/briefing-preview/edition.ts");
const { sevenDayEditionDevelopments, sevenDayEditionListen } = await import("../app/briefing-preview/editionSnapshot.ts");
const { readoutRegulatoryIdentity } = await import("../lib/readoutRegulatoryIdentity.ts");

const article = (id, { doi, pmid, canonicalArticleId, articleIds, url = `https://example.test/${id}`, title = "A source-identified oncology article" } = {}) => ({
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
  ...(canonicalArticleId ? { canonicalArticleId } : {}),
  ...(articleIds ? { articleIds } : {}),
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

test("seven-day union keeps the reviewed FDA camizestrant notice once without changing its saved position", () => {
  const companion = article("fda-breast-companion", {
    title: "FDA Grants Accelerated Approval to a New Breast Cancer Treatment",
    url: "https://www.fda.gov/news-events/press-announcements/fda-grants-accelerated-approval-new-breast-cancer-treatment",
  });
  const approval = article("camizestrant", {
    title: "FDA grants accelerated approval to camizestrant",
    url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-camizestrant-cdk46-inhibitor-esr1-mutated-hr-positive-her2-negative",
  });
  companion.evidence = "FDA approval";
  approval.evidence = "FDA approval";
  assert.equal(readoutRegulatoryIdentity(companion), readoutRegulatoryIdentity(approval));
  const result = sevenDayEditionDevelopments([
    snapshot("2026-09-11", { developments: [{ development: companion, episode: null, position: 0 }] }),
    snapshot("2026-09-10", { developments: [{ development: approval, episode: null, position: 4 }] }),
  ]);
  assert.deepEqual(result.developments.map((item) => item.id), [approval.id]);
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

test("explicit canonical IDs govern live editorial identity without identifier inference", () => {
  const canonicalId = "11111111-1111-1111-1111-111111111111";
  assert.equal(
    sameEditorialArticle(
      article("alias", { canonicalArticleId: canonicalId, doi: "10.1000/one", pmid: "111" }),
      article("keeper", { canonicalArticleId: canonicalId, doi: "10.1000/two", pmid: "222" }),
    ),
    true,
  );
  assert.equal(
    sameEditorialArticle(
      article("first", { canonicalArticleId: canonicalId, doi: "10.1000/same", pmid: "111" }),
      article("second", { canonicalArticleId: "22222222-2222-2222-2222-222222222222", doi: "10.1000/same", pmid: "111" }),
    ),
    false,
  );
  assert.equal(
    sameEditorialArticle(
      article("live", { canonicalArticleId: canonicalId, doi: "10.1000/same", pmid: "111" }),
      article("frozen", { doi: "10.1000/same", pmid: "111" }),
    ),
    false,
  );
  assert.equal(
    sameEditorialArticle(
      article("unresolved-first", { articleIds: ["11111111-1111-1111-1111-111111111111"], doi: "10.1000/same", pmid: "111" }),
      article("unresolved-second", { articleIds: ["22222222-2222-2222-2222-222222222222"], doi: "10.1000/same", pmid: "111" }),
    ),
    false,
  );
  assert.equal(
    sameEditorialArticle(
      article("explicit-empty", { articleIds: [], doi: "10.1000/same", pmid: "111" }),
      article("legacy", { doi: "10.1000/same", pmid: "111" }),
    ),
    false,
  );
});

test("archived evidence-member arrays remain unchanged and are not treated as scalar identity", () => {
  const articleIds = [
    "11111111-1111-1111-1111-111111111111",
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
  ];
  const archived = archivedEditorialArticle({
    area: "Breast",
    firstSeen: "2026-09-18T12:00:00.000Z",
    lastSeen: "2026-09-18T12:00:00.000Z",
    card: {
      id: "paper:frozen",
      kind: "paper",
      anchorId: "https://example.test/frozen",
      headline: "Frozen source",
      why: "",
      sourceLabel: "Journal",
      url: "https://example.test/frozen",
      excerpt: null,
      drugTags: [],
      nct: null,
      doi: null,
      eventId: null,
      siblings: [],
      rankTrace: [],
      rankTotal: 0,
      counts: {},
      articleIds,
      canonicalArticleId: "33333333-3333-3333-3333-333333333333",
    },
  });
  assert.deepEqual(archived.articleIds, articleIds);
  assert.equal(archived.canonicalArticleId, "33333333-3333-3333-3333-333333333333");
  assert.equal(
    sameEditorialArticle(archived, article("same-members-different-paper", { articleIds })),
    false,
  );
});
