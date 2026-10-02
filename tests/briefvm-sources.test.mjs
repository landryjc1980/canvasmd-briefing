import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";

// Resolve the "@/" alias and extensionless sibling imports, as the other web tests do.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (context.parentURL?.includes("/app/") && specifier.startsWith("./") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const vm = await import("../app/briefVM.ts");

test("stored journal fallback: the journal, never a web address (registry step 7)", () => {
  assert.equal(vm.storedJournal("  Annals of   Surgery "), "Annals of Surgery");
  for (const empty of ["", "  ", null, undefined]) assert.equal(vm.storedJournal(empty), null);
  for (const host of ["haematologica.org", "www.medrxiv.org", "https://linktr.ee", "t.co"]) assert.equal(vm.storedJournal(host), null, host);
});

test("News badge follows the peer-reviewed flag only", () => {
  assert.equal(vm.isNewsItem({ peerReviewed: false }), true);
  assert.equal(vm.isNewsItem({ peerReviewed: true }), false);
  assert.equal(vm.isNewsItem({}), false);
});

test("a news paper keeps its badge row without a source or metadata", () => {
  const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
  assert.match(reader, /\{\(src \|\| meta \|\| isNews\) && <div/);
});
