import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url), loaded = new Map();
function load(file) { const filename = path.resolve(root, file); if (loaded.has(filename)) return loaded.get(filename).exports; const module = { exports: {} }; loaded.set(filename, module); const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; new Function("require", "module", "exports", source)((name) => { if (name === "server-only") return {}; if (name.startsWith("@/") || name.startsWith(".")) { const base = name.startsWith("@/") ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(filename), name); for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) if (fs.existsSync(candidate)) return load(candidate); } return nativeRequire(name); }, module, module.exports); return module.exports; }
const { buildReadoutEditionSnapshot } = load("app/briefing-preview/editionSnapshot.ts");
const { canonicalReadoutEditionSnapshot, readoutEditionForArea } = load("app/briefing-preview/editionHistory.ts");
const areas=["All","GU","Breast","Lung","GI","Heme","Skin","Gyn"], now=new Date("2026-09-11T14:27:10Z"), date="2026-09-11";
const ep=(id,show,title,area,hour)=>({episodeId:id,title,show,sourceUrl:`https://example.test/${id}`,audioUrl:`https://example.test/${id}.mp3`,publishedAt:`2026-09-11T${String(hour).padStart(2,"0")}:00:00Z`,areas:[area],description:"Recent oncology discussion",durationSeconds:1200,showArt:null});
const episodes=[ep("gu-1","The Uromigos","GU RCC update","GU",14),ep("gu-2","The Uromigos","GU prostate update","GU",13),ep("lung-1","Lung Cancer Considered","Lung EGFR update","Lung",12),ep("lung-2","Lung Cancer Considered","Lung SCLC update","Lung",11),ep("heme-1","Blood Podcast","Heme myeloma update","Heme",10),ep("heme-2","Blood Podcast","Heme AML update","Heme",9)];
const payload=(eps)=>({area:"All",generatedAt:now.toISOString(),windowDays:1,cards:[],moreCards:[],episodes:eps,regulatoryCards:[],designationCards:[],breakingCards:[],overlays:[]});
const make=(byArea)=>canonicalReadoutEditionSnapshot(areas.map(a=>buildReadoutEditionSnapshot(a,byArea[a],now,[],date)));
const listen=(s,a)=>readoutEditionForArea(s,a).listen.map(x=>x.episode?.episodeId ?? x.item.episodeId ?? x.item.id);
test("one All Listen supply preserves specialty caps and canonical union beyond All UI cap", () => {
  const oldInputs = Object.fromEntries(areas.map((area) => [area, payload(area === "All" ? episodes : episodes.filter((entry) => entry.areas.includes(area)))]));
  const oneInputs = Object.fromEntries(areas.map((area) => [area, payload(episodes)]));
  const old = make(oldInputs), one = make(oneInputs);
  for (const area of areas) assert.deepEqual(listen(one, area), listen(old, area), area);
  assert.deepEqual(listen(one, "GU"), ["gu-1", "gu-2"]);
  assert.deepEqual(listen(one, "Lung"), ["lung-1", "lung-2"]);
  assert.deepEqual(listen(one, "Heme"), ["heme-1", "heme-2"]);
  assert.equal(listen(one, "All").length, 6, "canonical merge retains the specialty union; the reader UI applies its own All cap");
  assert.equal(new Set([...listen(one, "GU"), ...listen(one, "Lung"), ...listen(one, "Heme")]).size, 6);
});
