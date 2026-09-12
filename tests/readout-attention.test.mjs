import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import { readoutAttentionAnchor, validReadoutAttentionAnchor } from "../lib/readoutAttention.ts";

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
const { attentionWindowForPayload, attentionOverlayMatches, attentionSinceLabel, attentionExactStart, publicationSourceLabel } = load("lib/readoutAttentionPresentation.ts");
const { activeReadoutEditionDate } = load("app/briefing-preview/readoutRequest.ts");
const { buildReadoutEditionSnapshot, preparedMorningReadoutPayload, mergeReadoutEditionSnapshot, sevenDayEditionDevelopments } = load("app/briefing-preview/editionSnapshot.ts");
const { readoutEditionForArea, readoutEditionHistoryIncludingCurrent } = load("app/briefing-preview/editionHistory.ts");
const { withReadoutSelectionVersion, getCachedReadoutWindow } = load("lib/readoutWindowServer.ts");

const date = "2026-09-11";
const anchor = readoutAttentionAnchor(date);
const scope = { startAt: anchor.startAt, timeZone: anchor.timeZone, editionDate: date, kind: "edition" };
const observation = { id: "paper", windowStartAt: scope.startAt, windowAsOf: "2026-09-11T15:00:00Z", windowClinicianCount: 3,
  windowSharerPeople: [], windowPosts: [], kolSharers: 20, posts: [], faces: [], sharerPeople: [] };
const payload = (overrides = {}) => ({ generatedAt: "2026-09-11T09:00:00Z", windowDays: 1, area: "All", cards: [], moreCards: [],
  episodes: [], regulatoryCards: [], breakingCards: [], designationCards: [], overlays: [], candidateGeneratedAt: null, ...overrides });
const card = (id, count = 3) => ({ area: "GU", firstSeen: "2026-09-11T09:00:00Z", lastSeen: "2026-09-11T09:00:00Z",
  card: { id, kind: "paper", publicationClass: "research", headline: `Oncology source ${id}`, sourceLabel: "Journal",
    url: `https://example.org/${id}`, excerpt: "The source reports the prespecified results.",
    rankTrace: [{ input: "clinicianSharers", value: count }], conversation: { authoredClinicians: 0 }, support: { links: [] }, subAreas: [] } });
const breaking = (id) => ({ id: `breaking:${id}`, kind: "paper", publicationClass: "research", headline: `Oncology source ${id}`,
  sourceLabel: "Journal", url: `https://example.org/${id}`, doi: null, pmid: null, pubDate: null, areas: ["GU"], articleIds: [id],
  excerpt: null, metrics: { totalSharers: 6, clinicians: 0, recentClinicians: 6, previousClinicians: 0 } });

test("prior morning papers cannot consume lead slots before the prepared remainder is considered", () => {
  const rankedCard = (id, rank) => { const item = card(id); item.card.rankTotal = rank; return item; };
  const oldA = rankedCard("old-a", 100), oldB = rankedCard("old-b", 90);
  const previous = buildReadoutEditionSnapshot("All", payload({ cards: [oldA, oldB] }), new Date("2026-09-10T10:00:00Z"), [], "2026-09-10");
  const incomplete = rankedCard("incomplete", 85), nextA = rankedCard("next-a", 80), nextB = rankedCard("next-b", 70), extra = rankedCard("extra", 60);
  const input = payload({ cards: [oldA, oldB], moreCards: [incomplete, nextA, nextB, extra] });
  const prepared = preparedMorningReadoutPayload(input, [previous], new Set(["archive-next-a", "archive-next-b", "archive-extra"]));
  const edition = buildReadoutEditionSnapshot("All", prepared, new Date("2026-09-11T10:00:00Z"), [previous], date);
  assert.deepEqual(edition.developments.map(({ development }) => development.id), ["archive-next-a", "archive-next-b", "archive-extra"]);
  assert.deepEqual(edition.relevant.map(({ article }) => article.id), ["archive-incomplete"]);
  assert.deepEqual(input.cards.map(({ card }) => card.id), ["old-a", "old-b"], "existing payloads are not mutated");
});

test("prepared lead selection keeps preprints in the remainder and fills five globally ranked leads", () => {
  const pool = Array.from({ length: 8 }, (_, i) => {
    const item = card(`new-${i}`); item.area = i < 6 ? "Heme" : "GU";
    item.card.rankTotal = 100 - i; return item;
  });
  pool[0].card.publicationClass = "preprint";
  const prepared = preparedMorningReadoutPayload(payload({ moreCards: pool }), [], new Set(pool.map(({ card }) => `archive-${card.id}`)));
  assert.deepEqual(prepared.cards.map(({ card }) => card.id), ["new-1", "new-2", "new-3", "new-4", "new-5"]);
  assert.deepEqual(prepared.moreCards.map(({ card }) => card.id), ["new-0", "new-6", "new-7"]);
});

test("5 AM preparation and 6 AM publication share one immutable preceding-day start", () => {
  assert.deepEqual(anchor, { version: 1, timeZone: "America/New_York", startAt: "2026-09-10T09:00:00.000Z", sevenDayStartAt: "2026-09-04T09:00:00.000Z" });
  assert.equal(activeReadoutEditionDate(new Date("2026-09-11T09:59:59Z")), "2026-09-10");
  for (const instant of ["2026-09-11T10:00:00Z", "2026-09-11T15:00:00Z", "2026-09-11T21:00:00Z", "2026-09-12T09:59:59Z"]) {
    assert.deepEqual(readoutAttentionAnchor(activeReadoutEditionDate(new Date(instant))), anchor);
  }
  assert.notDeepEqual(readoutAttentionAnchor(activeReadoutEditionDate(new Date("2026-09-12T10:00:00Z"))), anchor);
});

test("anchors use New York calendar dates across DST, month, and year boundaries", () => {
  assert.equal(readoutAttentionAnchor("2026-03-08").startAt, "2026-03-07T10:00:00.000Z");
  assert.equal(readoutAttentionAnchor("2026-03-09").startAt, "2026-03-08T09:00:00.000Z");
  assert.equal(readoutAttentionAnchor("2026-11-01").startAt, "2026-10-31T09:00:00.000Z");
  assert.equal(readoutAttentionAnchor("2026-11-02").startAt, "2026-11-01T10:00:00.000Z");
  assert.equal(readoutAttentionAnchor("2027-01-01").startAt, "2026-12-31T10:00:00.000Z");
  assert.throws(() => readoutAttentionAnchor("2026-02-30"));
  assert.equal(validReadoutAttentionAnchor(anchor, "2026-09-12"), null);
});

test("missing or mismatched saved metadata never relabels a lifetime or rolling count", () => {
  assert.equal(validReadoutAttentionAnchor(undefined, date), null);
  assert.equal(validReadoutAttentionAnchor({ ...anchor, timeZone: "UTC" }, date), null);
  const fresh = payload({ currentEdition: { editionDate: date, attentionAnchor: anchor }, attentionWindow: scope });
  assert.deepEqual(attentionWindowForPayload(fresh), scope);
  assert.equal(attentionWindowForPayload({ ...fresh, currentEdition: { editionDate: date } }), null);
  assert.equal(attentionWindowForPayload({ ...fresh, attentionWindow: { ...scope, startAt: "2026-09-10T10:00:00Z" } }), null);
  assert.equal(attentionOverlayMatches(observation, scope), true);
  assert.equal(attentionOverlayMatches({ ...observation, windowStartAt: null }, scope), false);
  assert.equal(attentionOverlayMatches({ ...observation, windowAsOf: "invalid" }, scope), false);
  assert.equal(attentionOverlayMatches({ ...observation, windowClinicianCount: -1 }, scope), false);
  assert.equal(attentionOverlayMatches({ ...observation, windowClinicianCount: undefined }, scope), false);
  assert.equal(observation.kolSharers, 20);
});

test("relative labels stay honest after midnight while the preceding edition is still public", () => {
  assert.equal(attentionSinceLabel(scope, new Date("2026-09-11T15:00:00Z")), "since yesterday morning");
  assert.equal(attentionSinceLabel(scope, new Date("2026-09-12T09:59:00Z")), "since Sep 10");
  assert.equal(attentionExactStart(scope), "5 AM ET on Sep 10, 2026");
  assert.equal(publicationSourceLabel("Clinical Cancer Research", "2026-09-09"), "Clinical Cancer Research · published Sep 9");
});

test("the seven-day view accepts only its shared saved anchor and rejects daily counts", () => {
  const weekly = { ...scope, startAt: anchor.sevenDayStartAt, kind: "seven-day" };
  const source = payload({ windowDays: 7, currentEdition: { editionDate: date, attentionAnchor: anchor }, attentionWindow: weekly });
  assert.deepEqual(attentionWindowForPayload(source), weekly);
  assert.equal(attentionOverlayMatches(observation, weekly), false);
  assert.equal(attentionOverlayMatches({ ...observation, windowStartAt: weekly.startAt }, weekly), true);
  assert.equal(attentionSinceLabel(weekly, new Date("2026-09-11T15:00:00Z")), "since Sep 4");
  assert.equal(attentionWindowForPayload({ ...source, attentionWindow: scope }), null);
});

test("attention-only updates preserve the entire morning order and narration revision", async () => {
  const now = new Date("2026-09-11T09:00:00Z");
  const original = buildReadoutEditionSnapshot("All", payload({ cards: [card("a"), card("b"), card("c"), card("d"), card("e")] }), now, [], date);
  const morning = await withReadoutSelectionVersion({ ...original, attentionAnchor: anchor });
  const changed = payload({ cards: [card("e", 500), card("a", 2)], overlays: [{ ...observation, windowClinicianCount: 2 }] });
  const refreshed = mergeReadoutEditionSnapshot(morning, changed, new Date("2026-09-11T20:00:00Z"));
  assert.equal(refreshed, morning);
  assert.deepEqual(refreshed.developments, original.developments);
  const regenerated = await withReadoutSelectionVersion({ ...morning, selectionVersion: undefined,
    developments: morning.developments.map((entry) => ({ ...entry, development: { ...entry.development, sharedBy: 900 } })),
    updatedAt: "2026-09-11T20:00:00Z" });
  assert.equal(regenerated.selectionVersion, morning.selectionVersion);
});

test("qualified midday additions stay labeled in the remainder without displacing morning picks", () => {
  const morning = buildReadoutEditionSnapshot("All", payload({ cards: [card("a"), card("b"), card("c")] }), new Date("2026-09-11T09:00:00Z"), [], date);
  morning.selectionVersion = "fixed-recording";
  const merged = mergeReadoutEditionSnapshot(morning, payload({ breakingCards: [breaking("new")] }), new Date("2026-09-11T18:00:00Z"));
  assert.equal(merged.developments, morning.developments);
  assert.equal(merged.relevant.at(-1).article.id, "breaking:new");
  assert.deepEqual(merged.middayInsertions, ["breaking:new"]);
  assert.equal(merged.selectionVersion, morning.selectionVersion);
  assert.deepEqual(readoutEditionForArea(merged, "All").middayInsertions, ["breaking:new"]);
  const routed = { ...merged, relevant: merged.relevant.map((entry) => ({ ...entry, article: { ...entry.article, area: "GU" } })) };
  assert.deepEqual(readoutEditionForArea(routed, "GU").middayInsertions, ["breaking:new"]);
  const tomorrow = buildReadoutEditionSnapshot("All", payload({ cards: [card("new")] }), new Date("2026-09-12T09:00:00Z"), [merged], "2026-09-12");
  assert.equal(tomorrow.developments.length, 1, "yesterday's afternoon addition may enter the next morning edition");
});

test("seven-day membership comes from saved edition positions, never live count ordering", () => {
  const current = buildReadoutEditionSnapshot("All", payload({ cards: [card("current")] }), new Date("2026-09-11T09:00:00Z"), [], date);
  const old = buildReadoutEditionSnapshot("All", payload({ cards: [card("old")] }), new Date("2026-09-07T09:00:00Z"), [], "2026-09-07");
  const future = { ...current, editionDate: "2026-09-12" };
  const history = readoutEditionHistoryIncludingCurrent(current, [old, future]);
  assert.deepEqual(history.map((item) => item.editionDate), [date, "2026-09-07"]);
  assert.deepEqual(sevenDayEditionDevelopments(history).developments.map((item) => item.id), ["archive-current", "archive-old"]);
});

test("the hourly specialty path retains zero-count receipts for a paper in the saved canonical edition", async () => {
  const now = new Date();
  const editionDate = activeReadoutEditionDate(now);
  const attentionAnchor = readoutAttentionAnchor(editionDate);
  const canonical = await withReadoutSelectionVersion({
    ...buildReadoutEditionSnapshot("All", payload({ cards: [card("retained")] }), now, [], editionDate),
    attentionAnchor,
  });
  const fixedWindow = { startAt: attentionAnchor.startAt, editionDate, timeZone: attentionAnchor.timeZone, kind: "edition" };
  const zero = { ...observation, id: "archive-retained", windowStartAt: attentionAnchor.startAt,
    windowAsOf: now.toISOString(), windowClinicianCount: 0 };
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://attention.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/functions/v1/briefing")) {
      const body = JSON.parse(init.body);
      requests.push(body);
      return Response.json(payload({ generatedAt: now.toISOString(), area: body.area, attentionWindow: fixedWindow,
        currentEdition: body.area === "All" ? canonical : null,
        overlays: body.area === "All" ? [zero] : [] }));
    }
    if ((init.method ?? "GET") === "GET") {
      return Response.json(decodeURIComponent(String(url)).includes("edition:v2:") ? [{ card: canonical }] : []);
    }
    return new Response(null, { status: 201 });
  };
  try {
    const result = await getCachedReadoutWindow("GU", "today");
    assert.equal(result.currentEdition.developments[0].development.id, zero.id);
    assert.equal(result.overlays.find((item) => item.id === zero.id).windowClinicianCount, 0);
    assert.ok(requests.every((body) => body.editionDate === editionDate && body.attentionAnchor.startAt === attentionAnchor.startAt));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test("seven-day specialty reads keep archived positions and weekly receipts over daily overlays", async () => {
  const now = new Date();
  const editionDate = activeReadoutEditionDate(now);
  const attentionAnchor = readoutAttentionAnchor(editionDate);
  const priorDate = new Date(Date.parse(`${editionDate}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const canonical = await withReadoutSelectionVersion({
    ...buildReadoutEditionSnapshot("All", payload({ cards: [card("current-weekly")] }), now, [], editionDate), attentionAnchor,
  });
  const old = await withReadoutSelectionVersion(buildReadoutEditionSnapshot("All", payload({ cards: [card("archived-weekly")] }), now, [], priorDate));
  const history = [canonical, old];
  const rawCanonical = {
    ...canonical,
    developments: [
      { ...canonical.developments[0], development: { ...canonical.developments[0].development,
        title: "Clipped current weekly source title", studySetting: "preclinical" } },
      { ...canonical.developments[0], position: 99, development: { ...canonical.developments[0].development,
        id: "decoy-live-membership", title: "Must not enter the saved edition" } },
    ],
  };
  const rawOld = {
    ...old,
    developments: [{ ...old.developments[0], development: { ...old.developments[0].development,
      title: "Sevabertinib seven-day source title", sourceExcerpt: "The refreshed historical source excerpt." } }],
  };
  const ids = ["archive-current-weekly", "archive-archived-weekly"];
  const weeklyScope = { editionDate, startAt: attentionAnchor.sevenDayStartAt, timeZone: attentionAnchor.timeZone, kind: "seven-day" };
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://attention.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/functions/v1/briefing")) {
      const body = JSON.parse(init.body);
      const weekly = body.days === 7;
      const startAt = weekly ? attentionAnchor.sevenDayStartAt : attentionAnchor.startAt;
      return Response.json(payload({ generatedAt: now.toISOString(), area: body.area, windowDays: body.days,
        attentionWindow: weekly ? weeklyScope : { ...weeklyScope, startAt, kind: "edition" },
        currentEdition: body.area === "All" ? rawCanonical : null, editionHistory: weekly && body.area === "All" ? [rawCanonical, rawOld] : [],
        overlays: body.area === "All" ? ids.map((id, index) => ({ ...observation, id, windowStartAt: startAt,
          windowAsOf: now.toISOString(), windowClinicianCount: weekly ? 9 - index : 1 })) : [],
      }));
    }
    if ((init.method ?? "GET") === "GET") {
      const request = decodeURIComponent(String(url));
      return Response.json(request.includes("kind=eq.edition") ? [{ card: canonical }, { card: old }]
        : request.includes("edition:v2:") ? [{ card: canonical }] : []);
    }
    return new Response(null, { status: 201 });
  };
  try {
    const result = await getCachedReadoutWindow("GU", "7d");
    assert.deepEqual(sevenDayEditionDevelopments(result.editionHistory).developments.map((entry) => entry.id), ids);
    assert.deepEqual(result.editionHistory.map((entry) => entry.selectionVersion), history.map((entry) => entry.selectionVersion));
    assert.equal(result.currentEdition.developments[0].development.title, "Clipped current weekly source title");
    assert.equal(result.currentEdition.developments[0].development.studySetting, "preclinical");
    assert.equal(result.editionHistory[1].developments[0].development.title, "Sevabertinib seven-day source title");
    assert.equal(result.editionHistory[1].developments[0].development.sourceExcerpt, "The refreshed historical source excerpt.");
    assert.equal(result.currentEdition.developments.some((entry) => entry.development.id === "decoy-live-membership"), false);
    assert.deepEqual(attentionWindowForPayload(result), weeklyScope);
    for (const [index, id] of ids.entries()) {
      const receipt = result.overlays.find((entry) => entry.id === id);
      assert.equal(receipt.windowClinicianCount, 9 - index);
      assert.equal(attentionOverlayMatches(receipt, weeklyScope), true);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});
