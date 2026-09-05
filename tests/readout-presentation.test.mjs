import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { articleExpansion, articleTextPreview } from "../lib/readoutPresentation.ts";
import { readoutAudioDates } from "../lib/readoutAudio.ts";

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

test("written Today uses the saved Listen selection and visible regulatory events", () => {
  assert.match(renderer, /sevenDayEditionListen\(\[todayEdition\], currentWorth\)/);
  assert.doesNotMatch(renderer, /listenForArea/);
  assert.match(renderer, /const hasRegulatoryDevelopment = renderedDevelopments\.some/);
  assert.match(renderer, /alsoOpen \? relevant : relevant\.slice\(0, 1\)/);
  assert.match(renderer, /moreOpen \? moreFromSevenDays : \[\]/);
  assert.doesNotMatch(renderer, /const hasRegulatoryDevelopment = .*regulatoryCards/);
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

test("web audio only exposes published playback fields through the reader gate", () => {
  const route = read("app/api/readout-audio/route.ts");
  assert.match(route, /currentContactId\(req\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(route, /SERVICE_ROLE|select: "\*"|script,/);
  assert.match(route, /status: "eq.ready"/);
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
