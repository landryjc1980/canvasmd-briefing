import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = fs.readFileSync(new URL("../app/DailyConversationEvidence.tsx", import.meta.url), "utf8");
const reader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const all = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");

test("web Daily renders exact, specialty-scoped physician evidence", () => {
  assert.match(evidence, /Physician conversation/);
  assert.match(evidence, /partitionDailyReactions/);
  assert.match(evidence, /Across oncology/);
  assert.match(evidence, /<blockquote/);
  assert.match(evidence, /reaction\.text/);
  assert.match(evidence, /cleanTweetText\(reaction\.fullText\?\.trim\(\) \|\| reaction\.text\)/);
  assert.match(reader, /<DailyConversationEvidence[^>]+area=\{area\}/);
  assert.match(all, /<DailyConversationEvidence/);
});

test("Daily refreshes stale payloads and All renders complete source drawers", () => {
  const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\("focus"/);
  assert.match(page, /fetchedAt/);
  assert.match(page, /load\(target, true\)/);
  assert.doesNotMatch(all, /s\.items\.slice\(/);
  assert.match(all, /pickConversationPreview\(story\.posts/);
  assert.doesNotMatch(all, /resolved\.publisherPosts\[0\]/);
  assert.match(evidence, /minHeight: 44/);
  assert.match(all, /Sources & items ↓/);
});

test("collapsed specialty Daily keeps its story headlines visible", () => {
  assert.match(reader, /areaDailyParas\.slice\(0, 3\)/);
  assert.match(reader, /stripEmph\(p\.head \?\? p\.text\)/);
});
