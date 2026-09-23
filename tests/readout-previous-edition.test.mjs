import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// 2026-09-12, 06:00-07:45 ET: today's canonical edition was missing and web
// readers got an error page. The reader now serves the most recent GOOD edition
// under its own real date, labelled "Latest edition", and never as today's.

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
      if (name === "@/components/AudioQuote" || name === "@/components/DailyReadoutAudio") return { default: () => null };
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
const { resolveReadoutTodayEdition } = load("app/briefing-preview/editionSnapshot.ts");

const today = activeReadoutEditionDate();
const priorDate = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
const story = {
  id: "paper:prior", area: "All", areas: ["GU"], site: "Oncology", nickname: "", takeaway: "", finding: "Source-backed finding.",
  remember: "", journal: "Journal", title: "Prior edition paper", url: "https://example.test/prior", evidence: "Published research",
  sharedBy: 9, match: {}, occurredOn: priorDate,
};
const prior = await withReadoutSelectionVersion({
  schemaVersion: 2, editionDate: priorDate, generatedAt: `${priorDate}T10:00:00.000Z`, area: "All",
  developments: [{ development: story, episode: null, position: 0 }], relevant: [], listen: [],
  regulatoryCards: [], designationCards: [],
});
const finishedPrior = {
  generatedAt: `${priorDate}T22:00:00.000Z`, windowDays: 1, area: "All", cards: [], moreCards: [], episodes: [],
  overlays: [{ id: story.id, articleIds: [], kolSharers: 9, windowClinicianCount: 4, faces: [], posts: [], sharerPeople: [],
    windowFaces: [], windowPosts: [], windowSharerPeople: [] }],
  currentEdition: prior, editionHistory: [], regulatoryCards: [], breakingCards: [], designationCards: [], candidateGeneratedAt: null, stale: false,
};

async function withStore({ canonicalByDate, finished }, run) {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL, originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://fallback.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  const writes = [];
  globalThis.fetch = async (url, init = {}) => {
    const value = decodeURIComponent(String(url));
    if ((init.method ?? "GET") !== "GET") { writes.push(value); return new Response(null, { status: 201 }); }
    const date = value.match(/edition:v2:(\d{4}-\d{2}-\d{2}):All/)?.[1];
    if (date) return Response.json(canonicalByDate[date] ? [{ card: canonicalByDate[date] }] : []);
    if (value.includes("readout-window:finished:v8:All:today")) return Response.json(finished ? [{ card: finished }] : []);
    return Response.json([]);
  };
  try { return await run(writes); } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}

test("a missing morning edition serves the latest good edition under its own date, without persisting it", async () => {
  await withStore({ canonicalByDate: { [priorDate]: prior }, finished: finishedPrior }, async (writes) => {
    const payload = await getCachedReadoutWindow("All", "today");
    assert.equal(payload.previousEdition, true);
    assert.equal(payload.currentEdition.editionDate, priorDate, "the fallback keeps its real edition date");
    assert.notEqual(payload.currentEdition.editionDate, today);
    assert.equal(payload.generatedAt, finishedPrior.generatedAt, "the fallback is not re-stamped as generated now");
    assert.deepEqual(writes, [], "a previous edition is never written back as today's finished window");
  });
});

test("the fallback must still be a published edition; otherwise the original error stands", async () => {
  await withStore({ canonicalByDate: {}, finished: finishedPrior }, async () => {
    await assert.rejects(getCachedReadoutWindow("All", "today"), /canonical All Readout edition is not available/);
  });
  await withStore({ canonicalByDate: {}, finished: null }, async () => {
    await assert.rejects(getCachedReadoutWindow("All", "today"), /canonical All Readout edition is not available/);
  });
});

test("the reader resolves a previous-edition payload to that saved edition, never a rebuilt one for today", () => {
  const resolved = resolveReadoutTodayEdition("All", { ...finishedPrior, generatedAt: new Date().toISOString(), previousEdition: true });
  assert.equal(resolved.editionDate, priorDate);
  assert.deepEqual(resolved.developments.map((entry) => entry.development.id), [story.id]);
});

test("the page labels the fallback as the latest edition with its real date, keeps its counts and drops the period", () => {
  const { default: EditorialReadout } = load("app/briefing-preview/EditorialReadout.tsx");
  const html = renderToStaticMarkup(React.createElement(EditorialReadout, { initialPayload: { ...finishedPrior, previousEdition: true } }));
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })
    .format(new Date(`${priorDate}T12:00:00-04:00`));
  assert.match(html, new RegExp(`Latest edition: ${label}`));
  assert.match(html, new RegExp(`Today’s edition isn’t available yet\\. Showing the latest edition, ${label}\\.`));
  assert.doesNotMatch(html, /Edition: /, "the old edition is never labelled as the current Edition");
  assert.doesNotMatch(html, /since yesterday morning|this week/);
  assert.match(html, /Shared by 4 clinicians/, "the edition keeps its own window count");
  assert.doesNotMatch(html, /Shared by 9 clinicians/, "never swapped for the all-time count");
  assert.doesNotMatch(html, /class="er-since"/, "no period on a previous edition");
});
