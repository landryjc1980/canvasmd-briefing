import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canvasmdFile } from "./paired-repo.mjs";

const webReader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const webDaily = fs.readFileSync(new URL("../app/DailyConversationEvidence.tsx", import.meta.url), "utf8");
const dailyMail = fs.readFileSync(new URL("../lib/dailyMail.ts", import.meta.url), "utf8");
const nativeCards = fs.readFileSync(canvasmdFile("components/readout/cards.tsx"), "utf8");
const nativeSections = fs.readFileSync(canvasmdFile("components/readout/sections.tsx"), "utf8");
const nativeTypes = fs.readFileSync(canvasmdFile("lib/briefing.ts"), "utf8");
const nativeDaily = fs.readFileSync(canvasmdFile("app/(tabs)/briefing.tsx"), "utf8");

test("Daily evidence expands honestly and renders every factual source", () => {
  for (const source of [webDaily, nativeDaily]) {
    assert.match(source, /Show longer excerpt/);
    assert.match(source, /Show full post/);
    assert.match(source, /textTruncated/);
    assert.match(source, /story\.sources/);
    assert.match(source, /source\.url/);
  }
});

test("podcast, continuation, and grouped-repost actions retain exact X URLs", () => {
  for (const source of [webReader, nativeCards]) {
    assert.match(source, /amplifier\.tweetUrl/);
    assert.match(source, /part\.tweetUrl/);
    assert.match(source, /reposter\.tweetUrl/);
  }
});

test("paper renderers keep source and classification parity", () => {
  assert.match(webReader, /href=\{paper\.url\}/);
  assert.match(webReader, /abstractOpen/);
  assert.match(webReader, /sourcesOpen/);
  assert.match(nativeTypes, /peerReviewed\?: boolean/);
  assert.match(nativeCards, /isNewsItem\(\{ peerReviewed, journal, domain \}\)/);
  assert.match(nativeSections, /hasPublisherNames/);
  assert.match(nativeSections, /Open article ↗/);
  assert.doesNotMatch(nativeSections, /\{i \+ 1\}/);
});

test("Daily email includes exact retained physician receipts and factual links", () => {
  assert.match(dailyMail, /Physician conversation/);
  assert.match(dailyMail, /reaction\.fullText\?\.trim\(\) \|\| reaction\.text/);
  assert.match(dailyMail, /\.slice\(0, 2\)/);
  assert.match(dailyMail, /story\.sources/);
  assert.match(dailyMail, /reaction\.url/);
});
