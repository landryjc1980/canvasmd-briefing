import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const evidence = fs.readFileSync(new URL("../app/heroEvidence.ts", import.meta.url), "utf8");

test("web drawers expose every promised X lane", () => {
  assert.match(reader, /From publishers &amp; journals/);
  assert.match(reader, /Additional posts on X/);
});

test("web evidence disclosures do not present unrendered activity as receipt counts", () => {
  assert.doesNotMatch(reader, /reposts\/quotes ↓/);
  assert.doesNotMatch(reader, /What clinicians said/);
  assert.doesNotMatch(reader, /Shared on X ·/);
  assert.match(evidence, /shared by \$\{n\} clinician/);
  assert.doesNotMatch(evidence, /♥/);
  assert.doesNotMatch(reader, /publisherPosts!\.slice/);
  assert.doesNotMatch(reader, /otherPosts!\.slice/);
});

test("paper metadata abstains when no authoritative clinician census exists", () => {
  assert.match(evidence, /if \(total == null\) return undefined/);
  assert.doesNotMatch(evidence, /shared by at least/);
});
