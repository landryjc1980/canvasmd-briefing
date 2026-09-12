import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { canvasmdFile } from "./paired-repo.mjs";

const webCard = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const webVm = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
const nativeCard = fs.readFileSync(canvasmdFile("components/readout/cards.tsx"), "utf8");
const nativeVm = fs.readFileSync(canvasmdFile("components/readout/vm.ts"), "utf8");
const webHero = fs.readFileSync(new URL("../app/HeroCards.tsx", import.meta.url), "utf8");
const editorialReadout = fs.readFileSync(new URL("../app/briefing-preview/EditorialReadout.tsx", import.meta.url), "utf8");
const readoutVoice = fs.readFileSync(new URL("../components/ReadoutVoice.tsx", import.meta.url), "utf8");
const threadPartsSource = fs.readFileSync(new URL("../app/briefing-preview/threadParts.ts", import.meta.url), "utf8");
const webAudio = fs.readFileSync(new URL("../components/AudioQuote.tsx", import.meta.url), "utf8");
const nativeHero = fs.readFileSync(canvasmdFile("components/readout/HeroCards.tsx"), "utf8");
const ingest = fs.readFileSync(canvasmdFile("supabase/functions/x-official-ingest/index.ts"), "utf8");
const briefing = fs.readFileSync(canvasmdFile("supabase/functions/briefing/index.ts"), "utf8");
const heroCards = fs.readFileSync(canvasmdFile("supabase/functions/_shared/heroCards.ts"), "utf8");
const xEvidence = fs.readFileSync(canvasmdFile("supabase/functions/_shared/xEvidence.ts"), "utf8");

test("X ingestion preserves long posts and bounded same-author threads", () => {
  assert.match(ingest, /note_tweet/);
  assert.match(ingest, /conversation_id:/);
  assert.match(ingest, /thread_parts:/);
  assert.match(briefing, /thread_parts/);
});

test("web and native source receipts expose the same thread disclosure", () => {
  for (const source of [webCard, nativeCard]) {
    assert.match(source, /Show available thread/);
    assert.doesNotMatch(source, /Show full thread/);
    assert.match(source, /Show longer excerpt/);
    assert.match(source, /View on X/);
    assert.match(source, /Show less/);
  }
});

const threadPartsModule = { exports: {} };
Function("exports", "module", ts.transpileModule(threadPartsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(threadPartsModule.exports, threadPartsModule);
const { availableThreadParts } = threadPartsModule.exports;

test("the canonical Readout expands only supplied thread continuations per comment", () => {
  // The thread-continuation UI now lives in the shared ReadoutVoice component (used by
  // every EditorialReadout comment), not inlined in EditorialReadout.tsx itself.
  assert.match(editorialReadout, /import ReadoutVoice from "@\/components\/ReadoutVoice"/);
  assert.match(editorialReadout, /<ReadoutVoice post=\{lead\} expanded=\{expanded\} cleanText=\{cleanClinicianText\}/);
  assert.match(readoutVoice, /Expand thread · \$\{availableThreadCount\} posts/);
  assert.match(readoutVoice, /availableThreadParts\(post\.thread, post\.tweetUrl, cleanText\)/);
  assert.match(readoutVoice, /part\.tweetUrl && <a className="er-thread-source"/);
  assert.match(readoutVoice, /aria-expanded=\{threadOpen\}/);
  assert.match(readoutVoice, /expanded \|\| threadOpen/);
  assert.match(readoutVoice, /className="er-thread-source"/);
  assert.doesNotMatch(readoutVoice, /Show full thread/);
  assert.doesNotMatch(readoutVoice, /index \+ 2/);
});

test("thread normalization orders stored reverse children without inventing parts or URLs", () => {
  const parts = availableThreadParts([
    { id: "2096278859310109023", text: "1/4 duplicate root", tweetUrl: "https://x.com/hassankwth/status/2096278859310109023" },
    { id: "2096278863714132321", text: "4/4", tweetUrl: "https://x.com/hassankwth/status/2096278863714132321" },
    { id: "2096278861960859934", text: "3/4", tweetUrl: null },
    { id: "2096278860702601433", text: "2/4", tweetUrl: "https://x.com/hassankwth/status/2096278860702601433" },
    { id: "2096278860702601433", text: "2/4 duplicate", tweetUrl: "https://x.com/hassankwth/status/2096278860702601433" },
    { id: "2096278865000000000", text: "   ", tweetUrl: "https://x.com/hassankwth/status/2096278865000000000" },
  ], "https://x.com/hassankwth/status/2096278859310109023", (text) => text?.trim() ?? "");
  assert.deepEqual(parts.map((part) => part.id), ["2096278860702601433", "2096278861960859934", "2096278863714132321"]);
  assert.equal(parts[1].tweetUrl, null, "a missing source URL remains unavailable");
});

test("web and native remove labels orphaned by t.co cleanup", () => {
  const orphanLabelPattern = /\(\?:Article\|Paper\|Link\)/;
  assert.match(webVm, orphanLabelPattern);
  assert.match(nativeVm, orphanLabelPattern);
});

test("podcast stories expose a play icon before their listen action", () => {
  assert.match(webHero, /label="Listen to the clip"/);
  assert.match(webAudio, /controlLabel/);
  assert.match(webAudio, /aria-label={`\$\{playing \? "Pause" : "Play"\}/);
  assert.match(nativeHero, /name="play\.circle\.fill"/);
  // Native now shows a loading state while the episode is buffering, so the "Listen @ …"
  // copy sits behind a ternary instead of appearing right after the JSX tag.
  assert.match(nativeHero, /`Listen @ \$\{/);
});

test("native source drawers card every receipt type and contain repost text", () => {
  assert.match(nativeCard, /flat \? sourceReceiptCard : cardBox/g);
  assert.match(nativeCard, /function EpisodeXReceipts/);
  assert.match(nativeCard, /fontSize: 13, flex: 1, minWidth: 0/);
  assert.match(webCard, /overflowWrap: "anywhere"/);
});

test("classic reposts render the original account as author on web and native", () => {
  for (const source of [webCard, nativeCard]) {
    assert.match(source, /const original = rtOf \? t\.original : undefined/);
    assert.match(source, /Reposted by/);
    assert.match(source, /original\?\.tweetUrl \?\? t\.tweetUrl/);
  }
});

test("podcast receipts show the source-authored announcement separately from amplification", () => {
  for (const source of [webCard, nativeCard]) {
    assert.match(source, /AmplifiedAnnouncementReceipt/);
    assert.match(source, /quoted this post/);
    assert.match(source, /reposted this post/);
    assert.match(source, /From the show on X/);
    assert.match(source, /Clinician commentary/);
    assert.match(source, /announcementId/);
  }
});

test("every briefing receipt lane groups classic reposts under the exact original", () => {
  assert.match(briefing, /makeEvidenceEntry/);
  assert.match(briefing, /mergeEvidenceEntry/);
  assert.match(briefing, /partitionEvidence/);
  assert.match(briefing, /x_posts_product[\s\S]*rt_tweet_id,rt_author_handle/);
  assert.match(briefing, /x_article_shares[\s\S]*rt_tweet_id,rt_author_handle/);
  assert.match(xEvidence, /const isClassicRepost/);
  assert.match(xEvidence, /repostedBy/);
  assert.match(xEvidence, /sourceLaneFor\(originSource/);
  assert.match(heroCards, /!\/\^RT @\/i/);
});
