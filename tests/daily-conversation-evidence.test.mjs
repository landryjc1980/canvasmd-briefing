import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = fs.readFileSync(new URL("../app/DailyConversationEvidence.tsx", import.meta.url), "utf8");
const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const all = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");

test("web Daily renders all story-linked physician evidence in specialty and All views", () => {
  assert.match(evidence, /Physician conversation/);
  assert.match(evidence, /story\.reactions\.map/);
  assert.match(reader, /<DailyConversationEvidence/);
  assert.match(all, /<DailyConversationEvidence/);
});
