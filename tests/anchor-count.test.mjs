// Paper cards can only have one anchor. Both fallback renderers should show useful sharing
// activity without repeating "1 paper" or exposing the peak likes of one receipt.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canvasmdFile } from "./paired-repo.mjs";

const PAPER_TEMPLATE = /return `shared by \$\{s\.clinicianCount\} clinician\$\{s\.clinicianCount === 1 \? "" : "s"\}`;/;

test("web paper metric line omits redundant anchor and peak likes", () => {
  const src = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
  assert.match(src, PAPER_TEMPLATE);
  assert.doesNotMatch(src, /s\.kind === "paper"[\s\S]{0,260}s\.topLikes/);
});

test("native renderer carries the same concise paper metadata", () => {
  const src = fs.readFileSync(canvasmdFile("components/readout/vm.ts"), "utf8");
  assert.match(src, PAPER_TEMPLATE);
  assert.doesNotMatch(src, /s\.kind === "paper"[\s\S]{0,260}s\.topLikes/);
});
