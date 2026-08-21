import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const vm = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
const allView = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");

test("web trial summaries describe serialized evidence instead of raw mention totals", () => {
  assert.match(vm, /xEvidenceSourceCount/);
  assert.match(vm, /value\.posts\?\.length/);
  assert.match(vm, /value\.publisherPosts\?\.length/);
  assert.match(vm, /value\.otherPosts\?\.length/);
  assert.match(vm, /episodeKeys\.size/);
  assert.match(vm, /trial\.articles\.length/);
  assert.match(reader, /trialEvidenceLine\(t\)/);
  assert.doesNotMatch(reader, /t\.xMentions/);
  assert.doesNotMatch(reader, /t\.articleMentions/);
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
  assert.match(reader, /On X · physician posts/);
  assert.match(reader, /shared by \$\{n\} clinician/);
  assert.doesNotMatch(reader.slice(reader.indexOf("export const paperMeta"), reader.indexOf("export function PodCard")), /♥/);
  assert.doesNotMatch(reader, /publisherPosts!\.slice/);
  assert.doesNotMatch(reader, /otherPosts!\.slice/);
  assert.doesNotMatch(allView, /v\.posts\.slice/);
  assert.doesNotMatch(allView, /v\.articles\.slice/);
});

test("paper metadata is explicit when only a capped lower bound is known", () => {
  assert.match(reader, /shared by at least \$\{shown\} clinician/);
});
