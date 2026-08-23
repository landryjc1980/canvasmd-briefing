import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { canvasmdFile } from "./paired-repo.mjs";
import { paperClinicianMeta, representedClinicianCount } from "../app/heroEvidence.ts";

const webReader = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const webVm = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
const webFlat = fs.readFileSync(new URL("../app/ReaderViewFlat.tsx", import.meta.url), "utf8");
const webHero = fs.readFileSync(new URL("../app/HeroCards.tsx", import.meta.url), "utf8");
const webAudio = fs.readFileSync(new URL("../components/AudioQuote.tsx", import.meta.url), "utf8");
const webAll = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
const webDaily = fs.readFileSync(new URL("../app/DailyConversationEvidence.tsx", import.meta.url), "utf8");
const dailyMail = fs.readFileSync(new URL("../lib/dailyMail.ts", import.meta.url), "utf8");
const nativeCards = fs.readFileSync(canvasmdFile("components/readout/cards.tsx"), "utf8");
const nativeSections = fs.readFileSync(canvasmdFile("components/readout/sections.tsx"), "utf8");
const nativeTypes = fs.readFileSync(canvasmdFile("lib/briefing.ts"), "utf8");
const nativeDaily = fs.readFileSync(canvasmdFile("app/(tabs)/briefing.tsx"), "utf8");
const nativeStoryEvidence = fs.readFileSync(canvasmdFile("components/readout/StoryEvidence.tsx"), "utf8");
const archivePage = fs.readFileSync(new URL("../app/r/[slug]/page.tsx", import.meta.url), "utf8");
const heroPost = fs.readFileSync(new URL("../app/heroPost.ts", import.meta.url), "utf8");

function loadExportedFunction(source, name) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} must be exported`);
  const signatureEnd = source.indexOf("): number {", start);
  assert.notEqual(signatureEnd, -1, `${name} must declare a numeric result`);
  const open = signatureEnd + "): number ".length;
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  assert.notEqual(end, -1, `${name} must have a complete body`);
  const js = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  Function("exports", "module", js)(mod.exports, mod);
  return mod.exports[name];
}

const representedReceipts = [
  { name: "Toni Choueiri", handle: "DrChoueiri", tweetUrl: "https://x.com/DrChoueiri/1", repostedBy: [
    { name: "Tom Powles", handle: "tompowles1", tweetUrl: "https://x.com/tompowles1/2" },
    { name: "Toni Choueiri", handle: null, tweetUrl: null },
  ] },
  { name: "Toni Choueiri", handle: "@drchoueiri", tweetUrl: "https://x.com/DrChoueiri/3" },
  { name: "Sara Example", handle: null, tweetUrl: "https://x.com/sara/4" },
];

test("rendered paper evidence discloses receipts without inflating the authoritative census", () => {
  assert.equal(representedClinicianCount(representedReceipts), 3);
  assert.equal(representedClinicianCount(undefined), 0);
  const nativeRepresentedClinicianCount = loadExportedFunction(nativeCards, "representedClinicianCount");
  assert.equal(nativeRepresentedClinicianCount(representedReceipts), 3);
  assert.equal(nativeRepresentedClinicianCount(undefined), 0);
  assert.equal(paperClinicianMeta(9, 2), "shared by 2 clinicians");
  assert.equal(paperClinicianMeta(1, 8), "shared by 8 clinicians · 1 shown in sources");
  assert.equal(paperClinicianMeta(2), undefined);
  assert.match(webReader, /Math\.min\(paper\.kolSharers, paper\.revealableClinicianCount \?\? 0\)/);
  assert.match(webFlat, /Math\.min\(a\.kolSharers, a\.revealableClinicianCount \?\? 0\)/);
  assert.match(nativeSections, /Math\.min\(a\.kolSharers \?\? 0, a\.revealableClinicianCount \?\? 0\)/);
});

test("authored commentary excludes classic reposts, link-only shares, and nested reposters", () => {
  const authoredClinicianCount = loadExportedFunction(webVm, "authoredClinicianCount");
  assert.equal(authoredClinicianCount([
    { name: "A", handle: "a", text: "RT @journal: Paper https://t.co/a" },
    { name: "B", handle: "b", text: "https://t.co/b", repostedBy: [{ name: "C", handle: "c" }] },
    { name: "D", handle: "d", text: "These results may change how we sequence therapy." },
    { name: "E", handle: "e", text: "Paper: https://t.co/e", thread: [{ id: "e2", text: "This continuation contains a substantive clinical interpretation.", tweetUrl: null }] },
    { name: "F", handle: "f", text: "この結果は今後の治療選択を大きく変える可能性があります。" },
  ]), 3);
  const nativeVm = fs.readFileSync(canvasmdFile("components/readout/vm.ts"), "utf8");
  const nativeAuthoredClinicianCount = loadExportedFunction(nativeVm, "authoredClinicianCount");
  assert.equal(nativeAuthoredClinicianCount([
    { name: "A", handle: "a", text: "RT @journal: Paper" },
    { name: "D", handle: "d", text: "These results may change practice." },
    { name: "E", handle: "e", text: "https://t.co/e", thread: [{ id: "e2", text: "A substantive continuation from the same physician.", tweetUrl: null }] },
    { name: "F", handle: "f", text: "هذه النتائج قد تغير اختيار العلاج في المستقبل." },
  ]), 3);
});

test("public archives inventory grouped reposters as clinician receipts", () => {
  assert.match(archivePage, /representedClinicianCount\(clinicianPosts\)/);
  assert.match(archivePage, /"clinician receipt", "clinician receipts"/);
  assert.doesNotMatch(archivePage, /const clinicians = [^\n]+\.length/);
});

test("public archives and Daily email read only the activated briefing contract", () => {
  for (const source of [heroPost, dailyMail]) {
    assert.match(source, /briefing_active\?select=/);
    assert.doesNotMatch(source, /rest\/v1\/briefing_snapshots\?select=/);
  }
});

test("primary sources render in a distinct provenance group on web and native", () => {
  for (const source of [webReader, nativeStoryEvidence]) {
    assert.match(source, /primary_source: "Primary source"/);
    assert.match(source, />Primary sources</);
    assert.match(source, />Related coverage</);
    assert.match(source, /supportLinkGroups\(story\.supportLinks\)/);
  }
});

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

test("exact receipt links meet the web and native target-size contracts", () => {
  assert.match(webReader, /reposter\.tweetUrl[\s\S]{0,260}minHeight: 24/);
  assert.match(webDaily, /reaction\.url[\s\S]{0,260}minHeight: 44/);
  assert.match(nativeCards, /reposter\.tweetUrl[\s\S]{0,500}minHeight: 44/);
  assert.match(nativeDaily, /Open \$\{reaction\.name\}'s post on X[\s\S]{0,220}minHeight: 44/);
});

test("paper renderers keep source and classification parity", () => {
  assert.match(webReader, /href=\{paper\.url\}/);
  assert.match(webReader, /abstractOpen/);
  assert.match(webReader, /sourcesOpen/);
  assert.match(nativeTypes, /peerReviewed\?: boolean/);
  assert.match(nativeCards, /isNewsItem\(\{ peerReviewed, journal, domain \}\)/);
  assert.match(nativeSections, /hasPublisherNames/);
  assert.match(nativeSections, /Open article ↗/);
  assert.doesNotMatch(webReader, /hasSources = [^\n]+\|\| !!paper\.url/);
  assert.doesNotMatch(nativeSections, /hasSources = [^\n]+\|\| !!a\.url/);
  assert.doesNotMatch(nativeStoryEvidence, /publishers=\{p\.publishers\}/);
  assert.match(webReader, /shown in sources/);
  assert.match(nativeSections, /shown in sources/);
  assert.doesNotMatch(nativeSections, /\{i \+ 1\}/);
});

test("Daily email includes exact retained physician receipts and factual links", () => {
  assert.match(dailyMail, /Physician conversation/);
  assert.match(dailyMail, /reaction\.fullText\?\.trim\(\) \|\| reaction\.text/);
  assert.match(dailyMail, /partitionDailyReactions/);
  assert.match(dailyMail, /Across oncology/);
  assert.doesNotMatch(dailyMail, /\}\)\.slice\(0, 2\)/);
  assert.match(dailyMail, /story\.sources/);
  assert.match(dailyMail, /reaction\.url/);
  assert.match(dailyMail, /textTruncated/);
  assert.match(dailyMail, />Excerpt</);
  assert.match(dailyMail, /Read complete post on X/);
});

test("podcast moments render one timestamp and legacy Open links meet the 44px target", () => {
  assert.doesNotMatch(webHero, /label=\{`Listen @/);
  assert.doesNotMatch(webFlat, /label=\{`clip /);
  assert.match(webAudio, /labelAlreadyIncludesMoment/);
  assert.match(webAudio, /moment && !labelAlreadyIncludesMoment/);
  assert.match(webFlat, /display: "inline-flex", alignItems: "center", minHeight: 44[^\n]+>Open ↗<\/a>/);
});

test("reference status does not affect visible People ranking", () => {
  for (const source of [webReader, nativeDaily]) {
    assert.match(source, /\.filter\(\(k\) => \(k\.amp \?\? 0\) > 0\)/);
    assert.doesNotMatch(source, /Number\(b\.referenceKol === true\) - Number\(a\.referenceKol === true\)/);
  }
  assert.doesNotMatch(webAll, /referenceKol/);
  assert.doesNotMatch(webAll, /Number\(y\.referenceKol\) - Number\(x\.referenceKol\)/);
});
