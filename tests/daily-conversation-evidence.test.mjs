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
});

// The All page no longer carries a Daily block (John, 2026-08-24). On-site it duplicated
// Since-your-last-read — the band knows what THIS reader has seen, the Daily only knows what
// happened in 24h — and scoped to all of oncology it read as seven unrelated storylines sitting
// above a ranked deck that does cross-specialty triage more legibly. These assertions pin the
// removal so it cannot creep back, and pin what deliberately SURVIVES: the specialty editions'
// Daily and the Daily email, which are separate decisions.
test("the All page carries no Daily block, while specialty editions keep theirs", () => {
  assert.doesNotMatch(all, /<DailyConversationEvidence/);
  assert.doesNotMatch(all, /The Daily</);
  assert.doesNotMatch(all, /Read the daily ↓/);
  assert.doesNotMatch(all, /Sources & items ↓/);
  // and the payload is not fetched for a page that no longer renders it
  const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(!area \|\| area === "All"\) return;/);
  // specialty editions are untouched
  assert.match(reader, /<DailyConversationEvidence/);
  assert.match(reader, /dailyOpen \? "Show less ↑" : "Read more ↓"/);
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
});

test("collapsed specialty Daily keeps its story headlines visible", () => {
  assert.match(reader, /dailyPreviewParas\.slice\(0, 3\)/);
  assert.match(reader, /stripEmph\(p\.head \?\? p\.text\)/);
});

test("Daily leads stay bold before and after expansion", () => {
  assert.equal((reader.match(/font: "700 (?:14\.5|15\.5)px\/1\.(?:65|55) 'Newsreader'/g) ?? []).length, 2);
});

test("a serialized quiet specialty edition still renders its honest lead", () => {
  assert.match(reader, /dailySection = \(dailyAll\.length > 0 \|\| !!dailyLead\)/);
  assert.match(reader, /\(!!dailyLead && dailyAll\.length > 0\)/);
  assert.match(reader, /dailyPreviewParas = dailyQuiet \? genDailyParas : areaDailyParas/);
  assert.match(reader, /dailyPreviewParas\.slice\(0, 3\)/);
});
