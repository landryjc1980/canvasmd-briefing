import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function load(path, stubs = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: path.split("/").pop(),
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((id) => id in stubs ? stubs[id] : {}, module, module.exports);
  return module.exports;
}

const label = load("../lib/articleLabel.ts");
const { coverageItem } = load("../app/conference/[key]/ConferenceCoverage.tsx", {
  "@/lib/articleLabel": label,
  "@/lib/conference": { parseConferencePublisherComments: () => [] },
});

test("the article classifier labels conference sources the way Today does, plus plain web pages", () => {
  assert.equal(label.articleContentType({ url: "https://myopenmedicine.com/2026/09/esmo-highlights", sourceName: "myopenmedicine.com" }), "Web page");
  assert.equal(label.articleContentType({ url: "https://pubmed.ncbi.nlm.nih.gov/41234567/", sourceName: "Blood Cancer Discovery", journal: "Blood Cancer Discovery" }), "Paper");
  assert.equal(label.articleContentType({ url: "https://www.nejm.org/doi/full/10.1056/NEJMc2601234" }), "Correspondence");
  assert.equal(label.articleContentType({ url: "https://example.org/paper", publicationClass: "preprint" }), "Preprint");
  assert.equal(label.articleContentType({ url: "https://www.medrxiv.org/content/10.1101/2026.09.01.26312345v1", sourceName: "medrxiv.org" }), "Preprint");
  assert.equal(label.articleContentType({ url: "https://www.fda.gov/drugs/resources", evidence: "FDA approval", journal: "FDA" }), "FDA approval");
});

test("conference report cards never fall through to a placeholder label", () => {
  const report = coverageItem({ title: "ESMO highlights", url: "https://myopenmedicine.com/2026/09/esmo-highlights", sourceName: "myopenmedicine.com" }, "reports", 0);
  assert.notEqual(report.label, "Source update");
  assert.equal(report.label, "Web page");
  const event = coverageItem({ title: "Late-breaking session", kind: "event", url: "https://example.org/session" }, "reports", 1);
  assert.equal(event.label, "Meeting update");
});
