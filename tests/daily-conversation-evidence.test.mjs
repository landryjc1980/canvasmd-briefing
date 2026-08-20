import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = fs.readFileSync(new URL("../app/DailyConversationEvidence.tsx", import.meta.url), "utf8");
const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const all = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");

test("web Daily renders exact, specialty-scoped physician evidence", () => {
  assert.match(evidence, /Physician conversation/);
  assert.match(evidence, /reaction\.sourceAreas\?\.length[\s\S]+reaction\.sourceAreas\.includes\(area\)/);
  assert.match(evidence, /<blockquote/);
  assert.match(evidence, /reaction\.text/);
  assert.match(reader, /<DailyConversationEvidence[^>]+area=\{area\}/);
  assert.match(all, /<DailyConversationEvidence/);
});
