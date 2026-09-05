import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { articleExpansion, articleSourceText, articleTextPreview, meaningfulArticleExcerpt, readoutRegulatoryCoverage } from "../lib/readoutPresentation.ts";
import { audioReflectsEarlierUpdate, readoutAudioDates } from "../lib/readoutAudio.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const renderer = read("app/briefing-preview/EditorialReadout.tsx");

test("a short or already-truncated publisher preview does not promise expansion", () => {
  for (const text of ["", "Short full abstract.", "Publisher preview…"]) {
    assert.equal(articleExpansion({ preview: text, full: text }, []).canExpand, false);
  }
});

test("a complete abstract or a truncated named comment has a meaningful disclosure", () => {
  const full = "Actual abstract detail. ".repeat(30);
  const source = articleExpansion({ preview: "Concise finding.", full }, []);
  assert.equal(source.canExpand, true);
  assert.equal(source.label, "Full source excerpt");
  assert.equal(articleExpansion({ preview: full, full }, []).preview, articleTextPreview(full));
  const comment = articleExpansion({ preview: "", full: "" }, ["A clinician's actual words. ".repeat(20)]);
  assert.equal(comment.canExpand, true);
  assert.equal(comment.label, "Read 1 full comment");
  assert.equal(articleExpansion({ preview: "", full: "" }, ["Short take."]).canExpand, false);
  assert.equal(articleExpansion({ preview: "", full: "" }, ["Short take."], 3).label, "Read 3 full comments");
});

test("author conflicts and site marketing cannot become an abstract or an empty disclosure", () => {
  for (const boilerplate of [
    "AUTHOR DISCLOSURES: Consulting for a pharmaceutical company.",
    "Relationships are self-held unless noted. Relationships may not relate to the subject matter.",
    "View all available purchase options.",
    "UroToday - GU OncToday brings coverage of the latest developments.",
  ]) {
    const source = articleSourceText(boilerplate, boilerplate);
    assert.deepEqual(source, { preview: "", full: "" });
    assert.equal(articleExpansion(source, []).canExpand, false);
  }
  const abstract = "Results: Median follow-up was 24 months. No new safety signals were observed.";
  const full = `${abstract} Conflicts of interest are listed below.`;
  assert.equal(meaningfulArticleExcerpt(full), abstract);
  assert.deepEqual(articleSourceText("View all available purchase options.", full), { preview: abstract, full });
  assert.match(renderer, /<DevelopmentFinding text=\{source\.preview\} expandedText=\{source\.full\}/);
});

test("written Today uses the saved Listen selection and visible regulatory events", () => {
  assert.match(renderer, /sevenDayEditionListen\(\[todayEdition\], currentWorth\)/);
  assert.doesNotMatch(renderer, /listenForArea/);
  assert.match(renderer, /const publishedDevelopments = \[\.\.\.worth, \.\.\.relevant, \.\.\.moreFromSevenDays\]/);
  assert.match(renderer, /readoutRegulatoryCoverage\(publishedDevelopments, renderedDevelopments\)/);
  assert.match(renderer, /alsoOpen \? relevant : relevant\.slice\(0, 1\)/);
  assert.match(renderer, /moreOpen \? moreFromSevenDays : \[\]/);
  assert.doesNotMatch(renderer, /const publishedDevelopments = .*regulatoryCards/);
});

test("a seven-day FDA item remains included when collapsed and becomes covered above when expanded", () => {
  const main = Array.from({ length: 5 }, () => ({ evidence: "Phase 3 study" }));
  const more = [{ kind: "event", evidence: "FDA approval" }];
  const published = [...main, ...more];
  assert.deepEqual(readoutRegulatoryCoverage(published, main), { hasPublished: true, status: "Included in this edition" });
  assert.deepEqual(readoutRegulatoryCoverage(published, [...main, ...more]), { hasPublished: true, status: "Covered above" });
  assert.deepEqual(readoutRegulatoryCoverage(main, main), { hasPublished: false, status: "Nothing new" });
  assert.match(renderer, /className="er-regulatory-empty">\{regulatoryCoverage\.hasPublished/);
});

test("the first relevant FDA card counts as visible and designation counters keep precedence", () => {
  const main = [{ evidence: "Phase 3 study" }];
  const relevant = [{ kind: "event", evidence: "FDA safety" }, { evidence: "Review" }];
  assert.equal(readoutRegulatoryCoverage([...main, ...relevant], [...main, ...relevant.slice(0, 1)]).status, "Covered above");
  assert.equal(readoutRegulatoryCoverage([{ kind: "episode", evidence: "FDA approval" }], []).hasPublished, false);
  assert.match(renderer, /windowPayload\?\.designationCards\.length[\s\S]{0,210}: regulatoryCoverage\.status/);
});

test("More to read expands below the visible article and collapse returns to the article", () => {
  const section = renderer.slice(renderer.indexOf('<h2>More to read</h2>'), renderer.indexOf('{pageReady && listenEntries.length'));
  assert.ok(section.indexOf("CompactDevelopment") < section.indexOf('className="er-more-toggle"'));
  assert.match(renderer, /scrollIntoView\(\{ block: "start", behavior: "auto" \}\)/);
});

test("audio dates are real, unique, newest-first, bounded dates, not query fragments", () => {
  assert.deepEqual(readoutAudioDates(["2026-09-04", "2026-09-03", "2026-09-04", "2026-99-99", "2026-02-30", "2026-09-01),status.eq.failed"]), ["2026-09-04", "2026-09-03"]);
  assert.equal(readoutAudioDates(Array.from({ length: 12 }, (_, n) => `2026-09-${String(n + 1).padStart(2, "0")}`)).length, 7);
});

test("audio version notices compare the selected edition only when the All Oncology revision is known", () => {
  for (const expected of [null, undefined, ""]) assert.equal(audioReflectsEarlierUpdate(expected, "older"), false);
  assert.equal(audioReflectsEarlierUpdate("same", "same"), false);
  assert.equal(audioReflectsEarlierUpdate("new", "older"), true);
  assert.equal(audioReflectsEarlierUpdate("new", null), true);
  assert.equal(audioReflectsEarlierUpdate("new"), true);
  assert.match(renderer, /const audioVersions = useMemo\(\(\) => area === "All"/);
  assert.match(renderer, /\[edition\.editionDate, edition\.selectionVersion\]/);
  assert.match(renderer, /expectedVersions=\{audioVersions\}/);
  assert.match(read("app/briefing-preview/editionSnapshot.ts"), /selectionVersion\?: string \| null/);
  const card = read("components/DailyReadoutAudio.tsx");
  assert.match(card, /audioReflectsEarlierUpdate\(expectedVersions\[edition\.edition_date\], edition\.selection_version\)/);
  assert.match(card, /Audio reflects an earlier update of this edition\./);
  assert.doesNotMatch(card, /if \(reflectsEarlierUpdate\) return|\{edition\.selection_version\}/);
});

test("web audio only exposes published playback fields through the reader gate", () => {
  const route = read("app/api/readout-audio/route.ts");
  assert.match(route, /currentContactId\(req\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(route, /SERVICE_ROLE|select: "\*"|script,/);
  assert.match(route, /status: "eq.ready"/);
  assert.match(route, /select: "[^"]*selection_version/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  const card = read("components/DailyReadoutAudio.tsx");
  assert.match(card, /ALL ONCOLOGY/);
  assert.match(card, /editions\[0\]/);
  assert.match(card, /aria-label="Audio edition"/);
  assert.match(card, /Recorded edition as of/);
  assert.match(card, /<summary>Chapters<\/summary>/);
  assert.match(card, /seekRequest=\{seek\}/);
  assert.match(card, /window\.setInterval\(refresh, 60_000\)/);
  assert.match(card, /document\.visibilityState === "hidden"/);
  assert.match(card, /window\.clearInterval\(interval\)/);
});
