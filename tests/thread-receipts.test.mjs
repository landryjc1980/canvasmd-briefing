import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const webCard = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const webVm = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
const nativeCard = fs.readFileSync(new URL("../../canvasmd/components/readout/cards.tsx", import.meta.url), "utf8");
const nativeVm = fs.readFileSync(new URL("../../canvasmd/components/readout/vm.ts", import.meta.url), "utf8");
const webHero = fs.readFileSync(new URL("../app/HeroCards.tsx", import.meta.url), "utf8");
const webAudio = fs.readFileSync(new URL("../components/AudioQuote.tsx", import.meta.url), "utf8");
const nativeHero = fs.readFileSync(new URL("../../canvasmd/components/readout/HeroCards.tsx", import.meta.url), "utf8");
const ingest = fs.readFileSync(new URL("../../canvasmd/supabase/functions/x-official-ingest/index.ts", import.meta.url), "utf8");
const briefing = fs.readFileSync(new URL("../../canvasmd/supabase/functions/briefing/index.ts", import.meta.url), "utf8");
const heroCards = fs.readFileSync(new URL("../../canvasmd/supabase/functions/_shared/heroCards.ts", import.meta.url), "utf8");

test("X ingestion preserves long posts and bounded same-author threads", () => {
  assert.match(ingest, /note_tweet/);
  assert.match(ingest, /conversation_id:/);
  assert.match(ingest, /thread_parts:/);
  assert.match(briefing, /thread_parts/);
});

test("web and native source receipts expose the same thread disclosure", () => {
  for (const source of [webCard, nativeCard]) {
    assert.match(source, /Show full thread/);
    assert.match(source, /Show full post/);
    assert.match(source, /Show less/);
  }
});

test("web and native remove labels orphaned by t.co cleanup", () => {
  const orphanLabelPattern = /\(\?:Article\|Paper\|Link\)/;
  assert.match(webVm, orphanLabelPattern);
  assert.match(nativeVm, orphanLabelPattern);
});

test("podcast stories expose a play icon before their listen action", () => {
  assert.match(webHero, /label={`Listen @/);
  assert.match(webAudio, /aria-label={playing \? "Pause" : "Play"}/);
  assert.match(nativeHero, /name="play\.circle\.fill"/);
  assert.match(nativeHero, />Listen @ /);
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

test("every briefing receipt lane preserves classic repost attribution", () => {
  assert.match(briefing, /const repostOriginal =/);
  assert.match(briefing, /x_posts_product[\s\S]*rt_tweet_id,rt_author_handle/);
  assert.match(briefing, /x_article_shares[\s\S]*rt_tweet_id,rt_author_handle/);
  assert.ok((briefing.match(/original: repostOriginal/g) ?? []).length >= 3);
  assert.match(heroCards, /!\/\^RT @\/i/);
});
