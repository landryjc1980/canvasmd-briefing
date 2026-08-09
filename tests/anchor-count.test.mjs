// Reconciliation (John, cutover consistency): every paper card's source summary counts its
// OWN anchor — "1 paper · N clinicians shared · ♥ L" — matching the hero lane's
// server-authored why-lines. Both briefVM.ts (web) and vm.ts (native) use RN/Next path
// aliases and cannot be imported under node:test, so this guards the SOURCE of the paper
// branch in both renderers: the anchor prefix must lead the template, exactly once.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PAPER_TEMPLATE = /const base = `1 paper · \$\{s\.clinicianCount\} clinician\$\{s\.clinicianCount === 1 \? "" : "s"\} shared`;/;

test("web paper metric line leads with the anchor, exactly once", () => {
  const src = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
  assert.match(src, PAPER_TEMPLATE, "web paper branch must lead with '1 paper · '");
  assert.equal(src.match(/`1 paper · /g)?.length, 1, "anchor prefix appears in exactly one template (no double-count)");
});

test("native renderer carries the same anchor prefix (cross-repo guard)", () => {
  const src = fs.readFileSync(new URL("../../canvasmd/components/readout/vm.ts", import.meta.url), "utf8");
  assert.match(src, PAPER_TEMPLATE, "native paper branch must lead with '1 paper · '");
  assert.equal(src.match(/`1 paper · /g)?.length, 1, "anchor prefix appears in exactly one template");
});
