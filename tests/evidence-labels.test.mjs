import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const vm = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
const allView = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
const evidence = fs.readFileSync(new URL("../app/heroEvidence.ts", import.meta.url), "utf8");

test("web trial summaries describe serialized evidence instead of raw mention totals", () => {
  assert.match(vm, /authoredClinicianCount\(trial\.posts\)/);
  assert.match(vm, /clinicianMentions/);
  assert.match(vm, /clinician mention/);
  assert.match(vm, /episodeKeys\.size/);
  assert.match(vm, /trial\.articles\.length/);
  assert.match(reader, /trialEvidenceLine\(t\)/);
  assert.doesNotMatch(reader, /t\.xMentions/);
  assert.doesNotMatch(reader, /t\.articleMentions/);
});

test("paper rows distinguish total reach from authored commentary", () => {
  assert.match(reader, /authoredClinicians/);
  assert.match(reader, /paper\.authoredClinicianCount \?\? authoredClinicianCount\(paper\.posts\)/);
  assert.match(reader, /authored post/);
  assert.doesNotMatch(reader, /commented/);
  assert.match(reader, /reposts only/);
});

test("web drawers expose every promised X lane", () => {
  assert.match(reader, /t\.publisherPosts/);
  assert.match(reader, /t\.otherPosts/);
  assert.match(reader, /From publishers &amp; journals/);
  assert.match(reader, /Additional posts on X/);
});

test("web evidence disclosures do not present unrendered activity as receipt counts", () => {
  assert.doesNotMatch(reader, /reposts\/quotes ↓/);
  assert.doesNotMatch(reader, /What clinicians said/);
  assert.doesNotMatch(reader, /Shared on X ·/);
  assert.match(reader, /On X · physician mentions/);
  assert.match(evidence, /shared by \$\{n\} clinician/);
  assert.doesNotMatch(evidence, /♥/);
  assert.doesNotMatch(reader, /publisherPosts!\.slice/);
  assert.doesNotMatch(reader, /otherPosts!\.slice/);
  assert.doesNotMatch(allView, /v\.posts\.slice/);
  assert.doesNotMatch(allView, /v\.articles\.slice/);
  assert.doesNotMatch(allView, /it\.line\s*&&/);
});

test("paper metadata abstains when no authoritative clinician census exists", () => {
  assert.match(evidence, /if \(total == null\) return undefined/);
  assert.doesNotMatch(evidence, /shared by at least/);
});
