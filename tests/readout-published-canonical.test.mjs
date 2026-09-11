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
const { withReadoutSelectionVersion, getCachedReadoutWindow } = load("lib/readoutWindowServer.ts");

function edition(editionDate, developments, regulatoryCards = []) {
  return {
    schemaVersion: 2, editionDate, generatedAt: `${editionDate}T10:00:00.000Z`, area: "All",
    developments: developments.map((development, position) => ({ development, episode: null, position })),
    relevant: [], listen: [], regulatoryCards, designationCards: [],
  };
}

test("finished cache rejects specialty rebuild and fallback selection paths", () => {
  const source = readFileSync(path.join(root, "lib/readoutWindowServer.ts"), "utf8");
  assert.match(source, /READOUT_WINDOW_CACHE_TAG = "readout-window-v24"/);
  assert.match(source, /readout-window:finished:v7:/);
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
  const raw = { generatedAt: new Date().toISOString(), windowDays: 1, area: "GU", cards: [], moreCards: [], episodes: [], overlays: [],
    currentEdition: edition(editionDate, [{ id: "raw:wrong", area: "GU", site: "GU", nickname: "", takeaway: "", finding: "", remember: "", journal: "", title: "Raw", url: "https://example.test/raw", evidence: "", sharedBy: 0, match: {} }]),
    regulatoryCards: [{ id: "regulatory:raw", areas: ["GU"], headline: "Raw candidate" }], breakingCards: [], designationCards: [] };
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://canonical.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  globalThis.fetch = async (url, init = {}) => {
    const value = decodeURIComponent(String(url));
    if (value.includes("/functions/v1/briefing")) return Response.json({ ...raw, windowDays: JSON.parse(init.body).days });
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
    const weekly = await getCachedReadoutWindow("GU", "7d");
    assert.deepEqual(weekly.editionHistory.map((snapshot) => snapshot.editionDate), [editionDate, priorDate]);
    assert.deepEqual(weekly.regulatoryCards.map((item) => item.id), ["regulatory:official-gu", "regulatory:prior-gu"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});
