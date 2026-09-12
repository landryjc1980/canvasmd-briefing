import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as presentation from "../lib/morningsPresentation.ts";
import * as audio from "../lib/readoutAudio.ts";

const { morningsProducerSummary, morningsPlayableChapters, morningsEditionDate } = presentation;
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const require = createRequire(import.meta.url);
const source = read("components/DailyReadoutAudio.tsx");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const module = { exports: {} };
new Function("require", "module", "exports", compiled)((name) => {
  if (name === "@/lib/morningsPresentation") return presentation;
  if (name === "@/lib/readoutAudio") return audio;
  if (name === "@/components/AudioQuote") return { default: (props) => React.createElement("div", { "data-audio": props.audioUrl, "data-label": props.eventLabel, "data-chapter": props.label }) };
  return require(name);
}, module, module.exports);
const { MorningsAudioCard } = module.exports;

const intro = { headline: "Today’s briefing", summary: "0 papers · 4 podcast episodes · Regulatory Watch", startSeconds: 0 };
const listen = { headline: "4 new episodes", source: "Listen", startSeconds: 12 };
const topic = { headline: "Recorded source episode title", source: "Podcast", summary: "Original producer topic description.", startSeconds: 15, depth: 1 };
const authoredPodcastSegment = { headline: "Practice-changing podcast discussion", source: "Podcast", summary: "An authored segment with source-grounded claims.", startSeconds: 21, depth: 1 };
const emptyReg = { headline: "Regulatory Watch", summary: "No new actions in this edition.", startSeconds: 140 };
const receipts = { headline: "Sources and receipts", summary: "See the written edition.", startSeconds: 150 };
const edition = {
  id: "edition-7", edition_date: "2026-09-07", selection_version: "recorded-v1", title: "All Oncology — September 7",
  summary: "A narrated briefing of 0 papers, 4 podcast episodes, and Regulatory Watch. Written-only items remain in the Readout.",
  audio_url: "https://audio.example/recording-v1.m4a", duration_seconds: 180, source_generated_at: "2026-09-07T10:00:00Z",
  chapters: [intro, listen, topic, emptyReg, receipts],
};
const render = (overrides = {}, expectedVersion = "recorded-v1") => {
  const selected = { ...edition, ...overrides };
  return renderToStaticMarkup(React.createElement(MorningsAudioCard, { edition: selected, editions: [selected], onEditionChange() {}, expectedVersion }));
};

test("web Mornings removes only empty scaffolding and preserves source timestamps and objects", () => {
  const before = JSON.stringify(edition);
  const chapters = morningsPlayableChapters(edition.chapters);
  assert.deepEqual(chapters.map((item) => item.startSeconds), [0, 12, 15]);
  assert.equal(chapters[2], topic);
  assert.equal(chapters[0].summary, "0 papers · 4 podcast episodes");
  assert.equal(JSON.stringify(edition), before);
});

test("only exact structural transition rows are removed from authored chapters", () => {
  const transition = { headline: "Next", summary: "A new story.", startSeconds: 5 };
  const sourcedNext = { headline: "Next", source: "JCO", summary: "A new story.", startSeconds: 5.5 };
  const meaningfulNext = { headline: "Next", summary: "A new story with a source-grounded clinical claim.", startSeconds: 6 };
  const omissionNotice = { headline: "Omissions", summary: "No episode claim was added without a verified source.", startSeconds: 7 };
  const closing = { headline: "Closing", summary: "Read the written edition for links and source context.", startSeconds: 8 };
  const chapters = morningsPlayableChapters([transition, sourcedNext, meaningfulNext, authoredPodcastSegment, omissionNotice, closing]);
  assert.deepEqual(chapters.map((chapter) => chapter.startSeconds), [5.5, 6, 21, 7, 8]);
  assert.equal(chapters[0], sourcedNext);
  assert.equal(chapters[1], meaningfulNext);
  assert.equal(chapters[2], authoredPodcastSegment);
  assert.equal(chapters[3], omissionNotice);
  assert.equal(chapters[4], closing);
});

test("legacy captions are normalized without manufacturing chapters or changing new captions", () => {
  const hook = { headline: "Hook", summary: "A recorded opening.", startSeconds: 0, endSeconds: 5 };
  const note = { headline: "Edition note", summary: "A recorded omission notice.", startSeconds: 5, endSeconds: 8 };
  const welcome = { headline: "Welcome", summary: "A new recorded welcome.", startSeconds: 0, endSeconds: 5 };
  const paper = { headline: "Actual paper title", source: "JCO", summary: "Recorded paper summary.", startSeconds: 5, endSeconds: 30 };
  const notes = { headline: "Edition notes", summary: "A new recorded omission notice.", startSeconds: 30, endSeconds: 34 };
  const closing = { headline: "Closing", summary: "Recorded closing.", startSeconds: 34, endSeconds: 40 };
  const chapters = morningsPlayableChapters([hook, note, welcome, paper, notes, closing]);
  assert.deepEqual(chapters.map((chapter) => chapter.headline), ["Opening", "Edition notes", "Welcome", "Actual paper title", "Edition notes", "Closing"]);
  assert.notEqual(chapters[0], hook);
  assert.notEqual(chapters[1], note);
  assert.equal(chapters[2], welcome);
  assert.equal(chapters[3], paper);
  assert.equal(chapters[4], notes);
  assert.equal(chapters[5], closing);
  assert.deepEqual(chapters.map((chapter) => [chapter.startSeconds, chapter.endSeconds]), [[0, 5], [5, 8], [0, 5], [5, 30], [30, 34], [34, 40]]);
});

test("Mornings descriptions omit false regulatory promises but retain written-only disclosure", () => {
  assert.equal(morningsProducerSummary(edition), "A narrated briefing of 4 podcast episodes. Written-only items remain in the Readout.");
  for (const summary of ["No new oncology approval, safety warning, or designation cleared today.", "No new regulatory actions."]) {
    assert.equal(morningsPlayableChapters([{ ...emptyReg, summary }]).length, 0);
  }
});

test("substantive regulatory coverage is retained even when it contains negative language", () => {
  const real = { ...emptyReg, summary: "No new warnings were found; the FDA approved the treatment today." };
  assert.equal(morningsPlayableChapters([real])[0], real);
  assert.equal(morningsProducerSummary({ ...edition, chapters: [real] }), edition.summary);
  const pointer = { ...emptyReg, summary: "Covered in today’s lead stories." };
  assert.equal(morningsPlayableChapters([pointer]).length, 0);
  assert.equal(morningsProducerSummary({ ...edition, chapters: [pointer] }), edition.summary);
});

test("edition date is calendar-correct and never silently becomes today", () => {
  assert.equal(morningsEditionDate("2026-09-07"), "September 7, 2026");
  for (const date of ["", "bad", "2026-02-30", "2026-13-01"]) assert.equal(morningsEditionDate(date), "Edition date unavailable");
});

test("actual card rendering uses Mornings brand, recorded date and immutable audio URL", () => {
  const html = render();
  assert.match(html, /aria-label="Oncology Mornings"/);
  assert.match(html, /The daily audio edition/);
  assert.match(html, /er-mornings-oncology">Oncology/);
  assert.match(html, /er-mornings-title">Mornings/);
  assert.match(html, /AI-narrated/);
  assert.match(html, /September 7, 2026/);
  assert.match(html, /data-audio="https:\/\/audio.example\/recording-v1.m4a"/);
  assert.doesNotMatch(html, /All Oncology —|Daily Readout Audio|and Regulatory Watch|Sources and receipts/);
});

test("card starts chapters collapsed with nested Listen disclosure and retains provenance", () => {
  // "Oncology Mornings: chapters as a timeline rail" (fffdc65) dropped the old producer-blurb
  // paragraph (which used to carry a written-only disclosure via edition.summary) in favor of
  // a leaner "N chapters · duration" header, and moved any omission notice — an "Edition note"
  // chapter — into a footnote beside the recorded-at line instead.
  const note = { headline: "Edition note", summary: "Written-only items remain in the Readout.", startSeconds: 6 };
  const html = render({ chapters: [intro, note, listen, topic, emptyReg, receipts] });
  assert.match(html, /<details class="er-audio-chapters">/);
  assert.match(html, /aria-expanded="false" aria-label="Expand Listen episodes"/);
  // The old vague "Recorded edition as of" copy is now an explicit formatted timestamp.
  assert.match(html, /<span>Recorded [^<]+\.<\/span>/);
  assert.match(html, /Written-only items remain in the Readout/);
  assert.doesNotMatch(html, /Recorded source episode title/);
});

test("authored depth-one podcast chapters remain visible without a Listen parent", () => {
  const html = render({ chapters: [intro, authoredPodcastSegment] });
  assert.match(html, /Practice-changing podcast discussion/);
  assert.doesNotMatch(html, /Expand Listen episodes/);
});

test("revision mismatch stays visible outside the collapsed chapters", () => {
  const html = render({}, "written-v2");
  assert.ok(html.indexOf("Audio reflects an earlier update") < html.indexOf("<details"));
  assert.doesNotMatch(render(), /Audio reflects an earlier update/);
});

test("picker pills retain native keyboard behavior and a 44px target around a slimmer surface", () => {
  const css = read("app/briefing-preview/preview.css");
  assert.match(render(), /class="er-picker"><select aria-label="Audio edition"/);
  assert.match(read("app/briefing-preview/EditorialReadout.tsx"), /className="er-picker er-specialty-picker"><select/);
  assert.match(css, /\.er-picker::before \{[^}]*inset: 4px 0/);
  assert.match(css, /\.er-picker::after \{[^}]*right: 14px/);
  assert.match(css, /\.er-picker select \{[^}]*min-height: 44px;[^}]*padding: 6px 34px 6px 12px/);
  assert.match(css, /--er-mornings-bg: #263B59/);
  assert.match(css, /--er-mornings-peach: #F0C9A9/);
  assert.match(css, /--er-mornings-edge: #CE986F/);
});

test("chapter chevrons use centered SVG geometry instead of baseline-dependent text arrows", () => {
  const html = render();
  assert.match(html, /<summary><span>Chapters<\/span><svg class="er-mornings-chevron"/);
  assert.doesNotMatch(html, /⌄|⌃/);
  assert.match(read("app/briefing-preview/preview.css"), /\.er-mornings-chevron \{[^}]*align-self: center/);
  assert.match(source, /key=\{`\$\{edition.id\}:\$\{edition.audio_url\}`\}/);
});
