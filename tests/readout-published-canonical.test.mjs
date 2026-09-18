import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
function loader(overrides = {}) {
  const loaded = new Map();
  return function load(relative) {
    const filename = path.resolve(root, relative);
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const module = { exports: {} };
    loaded.set(filename, module);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function("require", "module", "exports", source)((name) => {
      if (name in overrides) return overrides[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        assert.ok(resolved, `Missing local dependency ${name} from ${filename}`);
        return load(resolved);
      }
      return require(name);
    }, module, module.exports);
    return module.exports;
  };
}

const load = loader({ "next/cache": { unstable_cache: (fn) => fn } });
const { activeReadoutEditionDate } = load("app/briefing-preview/readoutRequest.ts");
const { withReadoutSelectionVersion, getCachedReadoutWindow, warmReadoutWindowCache, fetchFreshReadoutWindowForPrepublication } = load("lib/readoutWindowServer.ts");

test("morning publisher preparation requires the matching service receipt and never caches or falls back", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL, originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://preparation.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
  const candidateBuild = { runId: "morning-run", generatedAt: "2026-09-13T09:00:00Z" };
  const anchor = { kind: "edition", editionDate: "2026-09-13", startAt: "2026-09-12T10:00:00Z", asOf: "2026-09-13T09:00:00Z" };
  const calls = [];
  let variant = "valid";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    assert.equal(init.headers.apikey, "sb_secret_test");
    if (variant === "failed") return new Response("publisher preparation unavailable", { status: 503 });
    return Response.json({ cards: [], sourcePreparation: variant === "missing" ? undefined : {
      version: 1, dryRun: variant === "dry", candidateBuild: variant === "mismatch" ? { ...candidateBuild, runId: "old-run" } : candidateBuild,
    } });
  };
  try {
    await fetchFreshReadoutWindowForPrepublication("All", "2026-09-13", anchor, { candidateBuild });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.mode, "readout-source-prepare");
    assert.equal(calls[0].body.repair, undefined, "ordinary morning requests cannot opt into saved-edition repair");
    assert.deepEqual(calls[0].body.candidateBuild, candidateBuild);
    assert.equal(calls[0].init.cache, "no-store");
    for (variant of ["missing", "mismatch", "dry", "failed"]) {
      await assert.rejects(fetchFreshReadoutWindowForPrepublication("All", "2026-09-13", anchor, { candidateBuild }), /preparation/);
    }
    assert.equal(calls.length, 5, "failures never read stale source cache or write a reader cache");
    await assert.rejects(fetchFreshReadoutWindowForPrepublication("GU", "2026-09-13", anchor, { candidateBuild }), /canonical All/);
    assert.equal(calls.length, 5);
    variant = "valid";
    await fetchFreshReadoutWindowForPrepublication("All", "2026-09-13", anchor, { candidateBuild, repair: true });
    assert.equal(calls[5].body.repair, true, "explicit private repair forwards its intent");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

function edition(editionDate, developments, regulatoryCards = []) {
  return {
    schemaVersion: 2, editionDate, generatedAt: `${editionDate}T10:00:00.000Z`, area: "All",
    developments: developments.map((development, position) => ({ development, episode: null, position })),
    relevant: [], listen: [], regulatoryCards, designationCards: [],
  };
}

test("finished cache rejects specialty rebuild and fallback selection paths", () => {
  const source = readFileSync(path.join(root, "lib/readoutWindowServer.ts"), "utf8");
  assert.match(source, /READOUT_WINDOW_CACHE_TAG = "readout-window-v25"/);
  assert.match(source, /readout-window:v7:/);
  assert.match(source, /readout-window:finished:v8:/);
  assert.match(source, /fetchFreshReadoutWindowForInsertions/);
  assert.doesNotMatch(source, /isEpisodeOnlyFallback/);
  assert.doesNotMatch(source, /resolveReadoutTodayEdition/);
  assert.doesNotMatch(source, /readoutEditionPreferNonEmpty/);
});

test("published Today and 7d windows project only durable canonical editions", async () => {
  const editionDate = activeReadoutEditionDate();
  const priorDate = new Date(Date.parse(`${editionDate}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const canonical = await withReadoutSelectionVersion(edition(editionDate, [{
    id: "breaking:nectin", area: "All", areas: ["GU"], site: "Oncology", nickname: "BREAKING", takeaway: "", finding: "",
    remember: "", journal: "Journal", title: "NECTIN4", url: "https://example.test/nectin", evidence: "Published research", sharedBy: 0, match: {},
  }], [{ id: "regulatory:official-gu", areas: ["GU"], headline: "Official GU action" }]));
  const prior = await withReadoutSelectionVersion(edition(priorDate, [{
    id: "breaking:prior", area: "All", areas: ["GU"], site: "Oncology", nickname: "BREAKING", takeaway: "", finding: "",
    remember: "", journal: "Journal", title: "Prior GU", url: "https://example.test/prior", evidence: "Published research", sharedBy: 0, match: {},
  }], [{ id: "regulatory:prior-gu", areas: ["GU"], headline: "Prior official action" }]));
  const raw = { generatedAt: new Date().toISOString(), windowDays: 1, area: "GU", cards: [], moreCards: [], episodes: [], overlays: [
    { id: "regulatory:official-gu", articleIds: ["regulatory-paper-current"], windowClinicianCount: 2, kolSharers: 2, windowSharerPeople: [] },
    { id: "regulatory:prior-gu", articleIds: ["regulatory-paper-prior"], windowClinicianCount: 0, kolSharers: 0, windowSharerPeople: [] },
  ],
    currentEdition: edition(editionDate, [{ id: "raw:wrong", area: "GU", site: "GU", nickname: "", takeaway: "", finding: "", remember: "", journal: "", title: "Raw", url: "https://example.test/raw", evidence: "", sharedBy: 0, match: {} }]),
    regulatoryCards: [{ id: "regulatory:raw", areas: ["GU"], headline: "Raw candidate" }], breakingCards: [], designationCards: [] };
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://canonical.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  const rawRequests = [];
  let activeRawReads = 0;
  let maxConcurrentRawReads = 0;
  let weeklyOnly = false;
  globalThis.fetch = async (url, init = {}) => {
    const value = decodeURIComponent(String(url));
    if (value.includes("/functions/v1/briefing")) {
      const request = JSON.parse(init.body);
      rawRequests.push(request);
      activeRawReads += 1;
      maxConcurrentRawReads = Math.max(maxConcurrentRawReads, activeRawReads);
      await new Promise((resolve) => setImmediate(resolve));
      try {
        if (weeklyOnly && request.days === 1) {
          throw new Error("Daily candidate building is unavailable");
        }
        return Response.json({ ...raw, windowDays: request.days });
      } finally {
        activeRawReads -= 1;
      }
    }
    if ((init.method ?? "GET") === "GET") {
      if (value.includes("edition:v2:")) return Response.json([{ card: canonical }]);
      if (value.includes("kind=eq.edition")) return Response.json([{ card: canonical }, { card: prior }]);
      return Response.json([]);
    }
    return new Response(null, { status: 201 });
  };
  try {
    const today = await getCachedReadoutWindow("GU", "today");
    assert.deepEqual(today.currentEdition.developments.map((entry) => entry.development.id), ["breaking:nectin"]);
    assert.deepEqual(today.regulatoryCards.map((item) => item.id), ["regulatory:official-gu"]);
    weeklyOnly = true;
    rawRequests.length = 0;
    const weekly = await getCachedReadoutWindow("GU", "7d");
    assert.deepEqual(weekly.editionHistory.map((snapshot) => snapshot.editionDate), [editionDate, priorDate]);
    assert.deepEqual(weekly.regulatoryCards.map((item) => item.id), ["regulatory:official-gu", "regulatory:prior-gu"]);
    assert.deepEqual(weekly.overlays.filter((item) => item.id.startsWith("regulatory:")).map((item) => [item.id, item.windowClinicianCount, item.kolSharers]), [
      ["regulatory:official-gu", 2, 2], ["regulatory:prior-gu", 0, 0],
    ]);
    assert.equal(weekly.stale, false, "a weekly refresh does not depend on daily candidate building");
    assert.deepEqual(rawRequests.map(request => [request.area, request.days]), [["All", 7]]);
    weeklyOnly = false;
    rawRequests.length = 0;
    const warmed = await warmReadoutWindowCache({ freshSource: true });
    assert.equal(warmed.length, 16);
    assert.equal(warmed.filter(item => item.error || item.stale).length, 0);
    assert.deepEqual(rawRequests.map(request => [request.area, request.days]).sort(), [["All", 1], ["All", 7]],
      "all specialty projections share exactly two raw observations");
    assert.equal(maxConcurrentRawReads, 1, "warming finishes Today before the weekly raw source starts");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test("reviewed FDA aliases hydrate to one source URL without changing saved IDs or routing", async () => {
  const date = activeReadoutEditionDate();
  const detailed = { id: "detail", areas: ["Breast"], area: "All", evidence: "FDA approval", title: "Detailed FDA notice",
    url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-camizestrant-cdk46-inhibitor-esr1-mutated-hr-positive-her2-negative" };
  const companion = { ...detailed, id: "companion", title: "FDA press notice",
    url: "https://fda.gov/news-events/press-announcements/fda-grants-accelerated-approval-new-breast-cancer-treatment" };
  const canonical = await withReadoutSelectionVersion(edition(date, [companion, detailed]));
  const repaired = { ...canonical, developments: [{ development: detailed, position: 0 }] };
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://aliases.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/functions/v1/briefing")) return Response.json({ area: "All", windowDays: 1,
      generatedAt: new Date().toISOString(), currentEdition: repaired, overlays: [] });
    if ((init.method ?? "GET") !== "GET") return new Response(null, { status: 201 });
    return Response.json(decodeURIComponent(String(url)).includes("edition:v2:") ? [{ card: canonical }] : []);
  };
  try {
    const result = await getCachedReadoutWindow("All", "today");
    assert.deepEqual(result.currentEdition.developments.map(e => e.development.id), ["companion", "detail"]);
    assert.deepEqual(result.currentEdition.developments.map(e => e.development.url), [detailed.url, detailed.url]);
    assert.deepEqual(result.currentEdition.developments.map(e => e.development.areas), [["Breast"], ["Breast"]]);
    assert.equal(result.currentEdition.selectionVersion, canonical.selectionVersion);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test("source display repair refreshes or clears canonical IDs without changing the frozen selection", async () => {
  const date = activeReadoutEditionDate();
  const paper = { id: "paper:refresh", area: "All", areas: ["GU"], site: "Oncology", nickname: "", takeaway: "", finding: "",
    remember: "", journal: "Journal", title: "Paper", url: "https://example.test/paper", evidence: "Published research", sharedBy: 1,
    match: {}, articleIds: ["frozen-paper-receipt"], canonicalArticleId: "stale-paper" };
  const unresolvedPaper = { ...paper, id: "paper:clear", articleIds: ["unresolved-paper-receipt"], canonicalArticleId: "stale-unresolved" };
  const regulatory = { id: "regulatory:refresh", areas: ["GU"], headline: "Action", canonicalArticleId: "stale-action", articleIds: ["frozen-action-receipt"] };
  const designation = { id: "designation:clear", areas: ["GU"], headline: "Designation", canonicalArticleId: "stale-designation", articleIds: ["unresolved-designation-receipt"] };
  const canonical = await withReadoutSelectionVersion({
    ...edition(date, [paper], [regulatory]),
    relevant: [{ article: unresolvedPaper, position: 0 }],
    designationCards: [designation],
  });
  const { canonicalArticleId: _oldUnresolvedPaper, ...sourceUnresolvedPaper } = unresolvedPaper;
  const { canonicalArticleId: _oldDesignation, ...sourceDesignation } = designation;
  const repaired = {
    ...canonical,
    developments: [{ development: { ...paper, canonicalArticleId: "fresh-paper" }, episode: null, position: 0 }],
    relevant: [{ article: sourceUnresolvedPaper, position: 0 }],
    regulatoryCards: [{ ...regulatory, canonicalArticleId: "fresh-action" }],
    designationCards: [{ ...sourceDesignation, canonicalArticleId: null }],
  };
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://display-repair.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/functions/v1/briefing")) return Response.json({
      area: "All", windowDays: 1, generatedAt: new Date().toISOString(), currentEdition: repaired,
      cards: [], moreCards: [], episodes: [], overlays: [], regulatoryCards: repaired.regulatoryCards,
      breakingCards: [], designationCards: repaired.designationCards,
    });
    if ((init.method ?? "GET") !== "GET") return new Response(null, { status: 201 });
    return Response.json(decodeURIComponent(String(url)).includes("edition:v2:") ? [{ card: canonical }] : []);
  };
  try {
    const result = await getCachedReadoutWindow("All", "today");
    const [currentPaper] = result.currentEdition.developments.map((entry) => entry.development);
    const [currentUnresolved] = result.currentEdition.relevant.map((entry) => entry.article);
    assert.equal(currentPaper.canonicalArticleId, "fresh-paper");
    assert.deepEqual(currentPaper.articleIds, paper.articleIds, "source display repair never replaces frozen evidence receipts");
    assert.equal(currentUnresolved.canonicalArticleId, undefined, "an unresolved current source clears a stale scalar");
    assert.equal(result.currentEdition.regulatoryCards[0].canonicalArticleId, "fresh-action");
    assert.equal(result.currentEdition.designationCards[0].canonicalArticleId, undefined);
    assert.equal(result.currentEdition.selectionVersion, canonical.selectionVersion);
    assert.deepEqual(result.currentEdition.developments.map((entry) => entry.development.id), canonical.developments.map((entry) => entry.development.id));
    assert.deepEqual(result.currentEdition.relevant.map((entry) => entry.article.id), canonical.relevant.map((entry) => entry.article.id));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});
