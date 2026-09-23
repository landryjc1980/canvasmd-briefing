import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const loaded = new Map();
function load(filename) {
  filename = path.resolve(root, filename);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const module = { exports: {} };
  loaded.set(filename, module);
  const source = readFileSync(filename, "utf8") + (filename.endsWith("EditorialReadout.tsx") ? "\nexport { ArticleDevelopment };" : "");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "module", "exports", compiled)((name) => {
    if (name === "@/components/AudioQuote" || name === "@/components/DailyReadoutAudio") return { default: () => null };
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.resolve(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
      assert.ok(resolved, `Missing ${name}`);
      return load(resolved);
    }
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const { ArticleDevelopment } = load("app/briefing-preview/EditorialReadout.tsx");
const item = {
  id: "paper:restore", title: "Card restoration regression fixture", journal: "Journal", areas: ["GU"],
  area: "All", site: "GU", nickname: "", finding: "Source-backed summary.", takeaway: "", remember: "",
  evidence: "Published research", occurredOn: "2026-09-09", sharedBy: 3, match: {}, url: "https://example.org/paper",
};
const overlay = {
  id: item.id, kolSharers: 3, authoredClinicianCount: 1,
  faces: ["https://example.org/clinician-avatar.jpg"],
  sharerPeople: [{ name: "Alex Rivera", handle: "arivera", avatar: "https://example.org/clinician-avatar.jpg", tweetUrl: "https://x.com/arivera/status/123" }],
  posts: [{ name: "Alex Rivera", handle: "arivera", avatar: "https://example.org/clinician-avatar.jpg", text: "A useful discussion of the regression fixture's methods, its limitations, and what it changes for practice.", sourceLane: "clinician", tweetUrl: "https://x.com/arivera/status/123" }],
};
export function restoredCardHtml(observation = overlay, window = "today") {
  return renderToStaticMarkup(React.createElement(ArticleDevelopment, { item, briefs: [], overlays: new Map([[item.id, observation]]), numbered: true, window }));
}

test("actual collapsed research card retains avatars and clinician voices without attention metadata", () => {
  const html = restoredCardHtml();
  assert.match(html, /class="er-faces"/);
  assert.match(html, /src="https:\/\/example.org\/clinician-avatar.jpg"/);
  assert.match(html, /Shared by 3 clinicians/);
  assert.match(html, /What clinicians are saying/);
  assert.match(html, /A useful discussion of the regression fixture/);
  assert.doesNotMatch(html, /er-action-date/, "a collapsed daily-edition card carries no date stamp");
  assert.doesNotMatch(html, /Edition attention|er-overall-evidence|Clinician evidence|published Sep/);
});

test("an empty edition window falls back to the all-time count with no period", () => {
  const html = restoredCardHtml({ ...overlay, windowClinicianCount: 0, windowFaces: [], windowPosts: [], windowSharerPeople: [] });
  assert.match(html, /Shared by 3 clinicians/);
  assert.match(html, /class="er-faces"/);
  assert.match(html, /What clinicians are saying/);
  assert.doesNotMatch(html, /since yesterday|since .*morning/);
});

test("the 7-day view counts clinicians from the seven-day window, never the all-time count, as this week", () => {
  // Audit 2026-09-22: a card printed the all-time 39 as "this week" while 17 shared it in the window.
  const weekly = { ...overlay, kolSharers: 39, windowClinicianCount: 17, windowAuthoredClinicianCount: 1,
    windowFaces: ["https://example.org/window-avatar.jpg"], windowSharerPeople: overlay.sharerPeople };
  const html = restoredCardHtml(weekly, "7d");
  assert.match(html, /Shared by 17 clinicians<span class="er-since"> this week<\/span>/);
  assert.doesNotMatch(html, /Shared by 39/);
  assert.doesNotMatch(html, /since yesterday/);
});

test("with no seven-day window count the 7-day card shows the all-time count with no period", () => {
  const html = restoredCardHtml({ ...overlay, kolSharers: 39, windowClinicianCount: 0, windowFaces: [], windowPosts: [], windowSharerPeople: [] }, "7d");
  assert.match(html, /Shared by 39 clinicians/);
  assert.doesNotMatch(html, /this week/);
});

test("the edition window count leads the card on Today, with its period and the breakdown", () => {
  const html = restoredCardHtml({ ...overlay, windowClinicianCount: 2, windowAuthoredClinicianCount: 1, windowFaces: ["https://example.org/window-avatar.jpg"], windowSharerPeople: overlay.sharerPeople });
  assert.match(html, /Shared by 2 clinicians<span class="er-since"> since yesterday morning<\/span>/);
  assert.match(html, /1 wrote about it · 1 reposted or shared the link/);
  assert.match(html, /src="https:\/\/example.org\/window-avatar.jpg"/);
  assert.doesNotMatch(html, /Shared by 3 clinicians/);
});
