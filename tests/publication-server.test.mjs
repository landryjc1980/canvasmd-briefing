import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire, registerHooks } from "node:module";
import ts from "typescript";

// Resolve the "@/" alias and the extensionless sibling imports, as the other edition tests do.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (context.parentURL?.includes("/app/briefing-preview/") && ["./edition", "./readoutRequest"].includes(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { isReadoutEditionSnapshot } = await import("../app/briefing-preview/editionSnapshot.ts");

const root = path.resolve(new URL("..", import.meta.url).pathname);
const nativeRequire = createRequire(import.meta.url);
function transpile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
const display = nativeRequire(path.join(root, "lib/publicationDisplay.ts"));
function load() {
  const m = { exports: {} };
  new Function("require", "module", "exports", transpile("lib/publicationServer.ts"))((name) => {
    if (name === "server-only") return {};
    if (name === "@/lib/readoutWindowServer") return { supabaseApiKeyHeaders: () => ({ apikey: "k" }) };
    if (name === "@/lib/publicationDisplay") return display;
    return assert.fail(`unexpected import ${name}`);
  }, m, m.exports);
  return m.exports;
}

const uuid = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const A = uuid(1), B = uuid(2), C = uuid(3), D = uuid(4);

function withEnv(fn) {
  return async () => {
    const old = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, fetch: globalThis.fetch, error: console.error };
    process.env.SUPABASE_URL = "https://db.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    console.error = () => {};
    try { await fn(); } finally {
      process.env.SUPABASE_URL = old.url; process.env.SUPABASE_SERVICE_ROLE_KEY = old.key;
      globalThis.fetch = old.fetch; console.error = old.error;
    }
  };
}

const registry = {
  rows: { [A]: { publication_id: "p1", status: "resolved" }, [B]: { publication_id: null, status: "unresolved" }, [C]: { publication_id: "p-nameless", status: "resolved" } },
  names: { p1: "The Breast", "p-nameless": "" },
};
function registryFetch(calls) {
  return async (url) => {
    const u = String(url);
    calls.push(u);
    const ids = decodeURIComponent(u.match(/in\.\(([^)]*)\)/)[1]).split(",");
    if (u.includes("/v_article_publication?")) {
      return new Response(JSON.stringify(ids.filter((id) => registry.rows[id]).map((id) => ({ article_id: id, ...registry.rows[id] }))));
    }
    return new Response(JSON.stringify(ids.map((id) => ({ id, name: registry.names[id] ?? null }))));
  };
}

test("101 ids are looked up in two batches; a resolved row without a name is dropped", withEnv(async () => {
  const api = load();
  const calls = [];
  globalThis.fetch = registryFetch(calls);
  const ids = [A, B, C, ...Array.from({ length: 98 }, (_, i) => uuid(100 + i))];
  const map = await api.fetchArticlePublications([...ids, A.toUpperCase(), "not-a-uuid"]);
  const viewCalls = calls.filter((u) => u.includes("/v_article_publication?"));
  assert.equal(viewCalls.length, 2);
  assert.equal(map.get(A).name, "The Breast");
  assert.deepEqual(map.get(B), { status: "unresolved", name: null });
  assert.equal(map.has(C), false);
}));

test("any non-OK response makes the whole lookup fail (null)", withEnv(async () => {
  const api = load();
  globalThis.fetch = async (url) => String(url).includes("/publications?") ? new Response("no", { status: 500 }) : new Response(JSON.stringify([{ article_id: A, publication_id: "p1", status: "resolved" }]));
  assert.equal(await api.fetchArticlePublications([A]), null);
  globalThis.fetch = async () => { throw new Error("network"); };
  assert.equal(await api.fetchArticlePublications([A]), null);
}));

const article = (id, extra = {}) => ({ id, area: "All", site: "Oncology", nickname: "", takeaway: "T", finding: "", remember: "", journal: "Legacy Journal", title: "T", url: "https://example.org", evidence: "Published evidence", sharedBy: 1, match: {}, ...extra });
const snapshot = () => ({
  schemaVersion: 2, editionDate: "2026-10-02", generatedAt: "2026-10-02T10:00:00Z", area: "All",
  developments: [
    { development: article("a", { articleId: A }), episode: null, position: 0 },
    { development: article("b", { canonicalArticleId: B }), episode: null, position: 1 },
    { development: { kind: "episode", id: "e", episodeId: "ep" }, episode: null, position: 2 },
  ],
  relevant: [
    { article: article("c", { publicationStatus: "resolved", publicationName: "Lung Cancer" }), position: 0 },
    { article: article("d"), position: 1 },
    { article: article("e", { articleIds: [A, D] }), position: 2 },
  ],
  listen: [], regulatoryCards: [], designationCards: [],
});
const windowPayload = () => ({
  generatedAt: "x", windowDays: 1, area: "All", cards: [], overlays: [], episodes: [], regulatoryCards: [], candidateGeneratedAt: null,
  currentEdition: snapshot(), editionHistory: [snapshot()],
  designationCards: [{ id: "des", sourceLabel: "Legacy", articleIds: [A] }, { id: "des2", sourceLabel: "Legacy", articleIds: [] }],
});

test("withPublicationNames decorates rule-1/2 items only and never mutates the input", withEnv(async () => {
  const api = load();
  const calls = [];
  globalThis.fetch = registryFetch(calls);
  const input = windowPayload();
  const before = JSON.stringify(input);
  const out = await api.withPublicationNames(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(calls.filter((u) => u.includes("/v_article_publication?")).length, 1, "one lookup for the whole payload");
  for (const edition of [out.currentEdition, out.editionHistory[0]]) {
    assert.ok(isReadoutEditionSnapshot(edition));
    assert.equal(edition.developments[0].development.sourceName, "The Breast");
    assert.equal(edition.developments[1].development.sourceName, null);
    assert.equal("sourceName" in edition.developments[2].development, false);
    assert.equal(edition.relevant[0].article.sourceName, "Lung Cancer");
    assert.equal("sourceName" in edition.relevant[1].article, false);
    assert.equal(edition.relevant[2].article.sourceName, null, "several ids and no single pick show nothing");
  }
  assert.equal(out.designationCards[0].sourceName, "The Breast");
  assert.equal("sourceName" in out.designationCards[1], false);
}));

test("a failed lookup keeps saved names and shows nothing for ids", withEnv(async () => {
  const api = load();
  globalThis.fetch = async () => new Response("down", { status: 503 });
  const out = await api.withPublicationNames(windowPayload());
  assert.equal(out.currentEdition.developments[0].development.sourceName, null);
  assert.equal(out.currentEdition.relevant[0].article.sourceName, "Lung Cancer");
  assert.equal("sourceName" in out.currentEdition.relevant[1].article, false);
}));

test("conference reports, cards and articles gain registrySource; episodes do not", withEnv(async () => {
  const api = load();
  globalThis.fetch = registryFetch([]);
  const payload = { meeting: null, generatedAt: "x", coverage: {
    reports: [{ id: A, title: "R", url: "u", sourceName: "Legacy Report" }, { id: "not-uuid", title: "R2", url: "u", sourceName: "L", publication_status: "conflict" }],
    cards: [{ headline: "H", sourceMetadata: { canonicalArticleId: B } }, { headline: "H2", articleIds: [A] }, { headline: "H3" }],
    articles: [{ title: "P", sourceMetadata: {}, articleIds: [A, D] }],
    episodes: [{ title: "E", kind: "episode" }],
  } };
  const out = await api.withConferencePublicationNames(payload);
  assert.equal(out.coverage.reports[0].registrySource, "The Breast");
  assert.equal(out.coverage.reports[0].sourceName, "Legacy Report");
  assert.equal(out.coverage.reports[1].registrySource, null);
  assert.equal(out.coverage.cards[0].registrySource, null);
  assert.equal(out.coverage.cards[1].registrySource, "The Breast");
  assert.equal("registrySource" in out.coverage.cards[2], false);
  assert.equal(out.coverage.articles[0].registrySource, "The Breast", "first articleIds entry when sourceMetadata has no id");
  assert.equal("registrySource" in out.coverage.episodes[0], false);
  assert.equal("registrySource" in payload.coverage.reports[0], false);
}));
