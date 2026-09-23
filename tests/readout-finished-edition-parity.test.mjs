import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import { canvasmdFile } from "./paired-repo.mjs";

// The edge function mirrors the web's finished-edition rule
// (validFinishedEdition + readoutEditionForArea) to decide whether a previous
// edition may be served when today's is missing. This test runs both on the
// same fixtures; if either side changes alone, it fails.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
function loader() {
  const loaded = new Map();
  return function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const module = { exports: {} };
    loaded.set(filename, module);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function("require", "module", "exports", source)((name) => {
      if (name === "server-only") return {};
      if (name === "next/cache") return { unstable_cache: (fn) => fn };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const resolved = [base, `${base}.ts`, `${base}.tsx`, base.replace(/\.js$/, ".ts")].find(existsSync);
        assert.ok(resolved, `Missing ${name}`);
        return load(resolved);
      }
      return require(name);
    }, module, module.exports);
    return module.exports;
  };
}
const edgeFile = canvasmdFile("supabase/functions/_shared/readoutFinishedEdition.ts");
const pairedHasRule = existsSync(edgeFile);
const load = loader();
const web = { ...load(path.join(root, "lib/readoutWindowServer.ts")), ...load(path.join(root, "app/briefing-preview/editionHistory.ts")) };
const edge = pairedHasRule ? load(edgeFile) : null;

const story = (id, areas, extra = {}) => ({ id, area: "All", areas, title: `Readout story number ${id}`, url: `https://example.org/${id}`, match: {}, ...extra });
const all = {
  schemaVersion: 2, area: "All", editionDate: "2026-09-22", generatedAt: "2026-09-22T10:00:00.000Z", selectionVersion: "readout-v1-x",
  attentionAnchor: { version: 1, startAt: "2026-09-21T09:00:00.000Z" },
  developments: [story("1", ["GU"]), story("2", ["Breast", "GU"]), story("3", []), { ...story("ep", ["GU"]), kind: "episode", episodeId: "ep" }]
    .map((development, position) => ({ development, episode: null, position })),
  relevant: [story("4", ["GU"]), story("5", ["GU"], { url: "https://www.example.org/1/?utm_source=x" }), story("6", ["GU"]), story("7", ["GU"]), story("8", ["GU"], { subAreas: ["Prostate"] }), story("9", ["Lung"])]
    .map((article, position) => ({ article, position })),
  listen: [{ item: story("l1", ["GU"], { episodeId: "l1" }), episode: null }],
  regulatoryCards: [{ id: "r1", areas: ["GU"] }, { id: "r2", areas: ["Lung"] }],
  designationCards: [{ id: "d1", areas: ["Breast"] }],
  middayInsertions: ["7", "9"],
};

test("edge and web project the canonical edition identically for every area", { skip: !pairedHasRule && "paired canvasmd has no readoutFinishedEdition.ts (merge both branches together)" }, () => {
  for (const area of ["All", "GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"]) {
    assert.deepEqual(JSON.parse(JSON.stringify(edge.readoutEditionForArea(all, area))), JSON.parse(JSON.stringify(web.readoutEditionForArea(all, area))), area);
  }
});

test("edge and web accept and refuse the same finished editions", { skip: !pairedHasRule && "paired canvasmd has no readoutFinishedEdition.ts (merge both branches together)" }, () => {
  const variants = (area) => {
    const good = web.readoutEditionForArea(all, area);
    return [
      good,
      { ...good, selectionVersion: undefined },
      { ...good, selectionVersion: "other" },
      { ...good, generatedAt: "2026-09-22T11:00:00.000Z" },
      { ...good, updatedAt: "2026-09-22T15:00:00.000Z" },
      { ...good, attentionAnchor: { version: 1, startAt: "2026-09-20T09:00:00.000Z" } },
      { ...good, developments: good.developments.slice(1) },
      { ...good, developments: [...good.developments].reverse() },
      { ...good, relevant: good.relevant.map((entry) => ({ ...entry, article: { ...entry.article, subAreas: ["Bladder"] } })) },
      { ...good, listen: [] },
      { ...good, regulatoryCards: [] },
      { ...good, editionDate: "2026-09-21" },
    ];
  };
  const canonicals = [all, { ...all, selectionVersion: undefined }, { ...all, updatedAt: "2026-09-22T15:00:00.000Z" }, null, { ...all, area: "GU" }];
  let checked = 0;
  for (const area of ["All", "GU", "Breast", "Lung"]) {
    for (const edition of variants(area)) {
      for (const canonical of canonicals) {
        assert.equal(edge.validFinishedEdition(area, edition, canonical), web.validFinishedEdition(area, edition, canonical));
        checked++;
      }
    }
  }
  assert.ok(checked >= 200);
  assert.equal(edge.validFinishedEdition("GU", web.readoutEditionForArea(all, "GU"), all), true, "the fixture has an accepted case");
});
