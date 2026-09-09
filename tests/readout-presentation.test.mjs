import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { articleExpansion, articleSourceText, articleTextPreview, meaningfulArticleExcerpt, readoutRegulatoryCoverage, regulatoryApprovalSourceText, sourceLinkKey, sourceLinkLabel } from "../lib/readoutPresentation.ts";
import { cleanReadoutExcerpt, displayReadoutTitle, regulatoryWatchArticles } from "../app/briefing-preview/edition.ts";
import { audioReflectsEarlierUpdate, readoutAudioDates } from "../lib/readoutAudio.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const renderer = read("app/briefing-preview/EditorialReadout.tsx");

test("a short or already-truncated publisher preview does not promise expansion", () => {
  for (const text of ["", "Short full abstract.", "Publisher preview…"]) {
    assert.equal(articleExpansion({ preview: text, full: text }, []).canExpand, false);
  }
});

test("legacy source links retain a meaningful label and stable URL identity", () => {
  const legacyFdaLink = {
    url: "https://www.fda.gov/news-events/press-announcements/fda-grants-accelerated-approval-new-breast-cancer-treatment",
    label: "FDA companion notice",
  };
  assert.equal(sourceLinkLabel(legacyFdaLink), "FDA companion notice");
  assert.equal(sourceLinkLabel({ url: legacyFdaLink.url, title: "" }), "fda.gov");
  assert.equal(sourceLinkLabel({ url: "javascript:alert(1)" }), "Source");
  assert.equal(sourceLinkLabel({ url: "not a URL" }), "Source");
  assert.equal(sourceLinkKey("Anchor", legacyFdaLink.url), `Anchor:${legacyFdaLink.url}`);
  assert.match(renderer, /key=\{sourceLinkKey\(role, link\.url\)\}/);
  assert.match(renderer, /\{sourceLinkLabel\(link\)\}/);
});

test("a comment missing from the preview still has a full-comment disclosure", () => {
  const state = articleExpansion({ preview: "", full: "" }, [], 1);
  assert.equal(state.label, "Read 1 full comment");
  assert.equal(state.canExpand, true);
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

test("an approval keeps its full first FDA paragraph in the collapsed source preview", () => {
  const eligibility = "On September 4, 2026, the Food and Drug Administration granted accelerated approval to camizestrant (Etcamah, AstraZeneca), an estrogen receptor antagonist, in combination with a CDK4/6 inhibitor (abemaciclib, palbociclib, or ribociclib) for adults with hormone receptor (HR)-positive, human epidermal growth factor receptor 2 (HER2)-negative locally advanced or metastatic breast cancer upon detection of estrogen receptor-1 (ESR1) mutation during aromatase inhibitor and CDK4/6 inhibitor therapy, based on an FDA-authorized test.";
  const source = regulatoryApprovalSourceText(`${eligibility}\n\nFDA also approved the Guardant360 CDx assay as a companion diagnostic device.`);
  assert.deepEqual(source, { preview: eligibility, full: `${eligibility} FDA also approved the Guardant360 CDx assay as a companion diagnostic device.` });
  assert.ok(source.preview.length > 360);
  assert.equal(articleExpansion({ preview: eligibility, full: eligibility }, [], 0, true).canExpand, false);
  assert.equal(
    regulatoryApprovalSourceText("The U.S. Food and Drug Administration approved Acme, Inc. treatment for adults.\n\nA separate paragraph." ).preview,
    "The U.S. Food and Drug Administration approved Acme, Inc. treatment for adults.",
  );
  const cleaned = regulatoryApprovalSourceText(`${eligibility}\n\nFDA also approved the Guardant360 CDx assay as a companion diagnostic device.`);
  assert.equal(cleanReadoutExcerpt(cleaned.preview), eligibility,
    "cleaning after paragraph selection keeps the FDA eligibility paragraph as the collapsed preview");
  assert.equal(cleanReadoutExcerpt(cleaned.full), `${eligibility} FDA also approved the Guardant360 CDx assay as a companion diagnostic device.`);
  assert.match(renderer, /regulatoryApprovalSourceText\(rawSourceText\)/);
  assert.match(renderer, /cleanReadoutExcerpt\(approvalSource\.preview\)/);
  assert.match(renderer, /preservePreview=\{contentType === "FDA approval"\}/);
});

test("Regulatory Watch shows in-window specialty actions once and keeps main-card matches out", () => {
  const candidate = {
    id: "fda-camizestrant",
    kind: "event",
    regulatoryKind: "approval",
    eligibleLabel: "FDA approval",
    headline: "FDA approves camizestrant for ESR1-mutated breast cancer",
    sourceLabel: "FDA",
    url: "https://www.fda.gov/drugs/camizestrant",
    occurredOn: "2026-09-04",
    areas: ["Breast"],
    articleIds: [],
    finding: "FDA approved camizestrant for ESR1-mutated breast cancer.",
    primarySources: [
      { url: "https://www.fda.gov/news-events/companion-notice", label: "FDA companion notice" },
      { url: "javascript:alert(1)", label: "Invalid link" },
    ],
    metrics: { clinicians: 1, cliniciansFeedEligible: 1, reposters: 0, totalSharers: 1, lastSharedAt: "2026-09-04T12:00:00Z" },
  };
  assert.equal(regulatoryWatchArticles([candidate], "Breast", []).length, 1);
  assert.deepEqual(regulatoryWatchArticles([candidate], "Breast", [])[0].primarySources.map((link) => ({
    id: link.id, title: link.title, sourceLabel: link.sourceLabel,
  })), [{
    id: "https://www.fda.gov/news-events/companion-notice",
    title: "FDA companion notice",
    sourceLabel: "FDA companion notice",
  }], "legacy label-only primary links remain usable and unsafe URLs are omitted");
  assert.equal(regulatoryWatchArticles([candidate], "GU", []).length, 0);
  const alreadyPublished = {
    id: "saved-camizestrant",
    area: "Breast",
    site: "Breast",
    nickname: "REGULATORY",
    takeaway: candidate.headline,
    finding: candidate.finding,
    remember: "",
    journal: "FDA",
    title: candidate.headline,
    url: candidate.url,
    evidence: "Regulatory action",
    sharedBy: 1,
    match: { titleIncludes: candidate.headline },
  };
  assert.equal(regulatoryWatchArticles([candidate], "All", [{ ...alreadyPublished, kind: "event" }]).length, 0);
  assert.equal(regulatoryWatchArticles([candidate, { ...candidate, id: "fda-camizestrant-alias" }], "All", []).length, 1);
  assert.match(renderer, /const regulatoryArticles = useMemo\(\(\) => regulatoryWatchArticles/);
  assert.match(renderer, /const regulatoryHeader = \[/);
  assert.match(renderer, /!windowPayload\?\.designationCards\.length && !regulatoryArticles\.length/);
});

test("the duplicate upstream BRCA hyphen is repaired only for display", () => {
  assert.equal(displayReadoutTitle("BRCA2- -associated breast cancer"), "BRCA2-associated breast cancer");
  assert.equal(displayReadoutTitle("BRCA1- and BRCA2-associated breast cancer"), "BRCA1- and BRCA2-associated breast cancer");
  assert.match(renderer, /title=\{displayReadoutTitle\(article\?\.title \|\| item\.title\)\}/);
});

test("written Today uses the saved Listen selection and visible regulatory events", () => {
  assert.match(renderer, /sevenDayEditionListen\(\[todayEdition\], currentWorth\)/);
  assert.doesNotMatch(renderer, /listenForArea/);
  assert.match(renderer, /const publishedDevelopments = \[\.\.\.worth, \.\.\.relevant, \.\.\.moreFromSevenDays\]/);
  assert.match(renderer, /readoutRegulatoryCoverage\(publishedDevelopments, renderedDevelopments\)/);
  assert.match(renderer, /alsoOpen \? relevant : relevant\.slice\(0, 1\)/);
  assert.match(renderer, /moreOpen \? moreFromSevenDays : \[\]/);
  assert.match(renderer, /regulatoryWatchArticles\(/);
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

test("the first relevant FDA card counts as visible and the header includes regulatory actions", () => {
  const main = [{ evidence: "Phase 3 study" }];
  const relevant = [{ kind: "event", evidence: "FDA safety" }, { evidence: "Review" }];
  assert.equal(readoutRegulatoryCoverage([...main, ...relevant], [...main, ...relevant.slice(0, 1)]).status, "Covered above");
  assert.equal(readoutRegulatoryCoverage([{ kind: "episode", evidence: "FDA approval" }], []).hasPublished, false);
  assert.match(renderer, /const regulatoryHeader = \[/);
  assert.match(renderer, /regulatoryArticles\.length \? `\$\{regulatoryArticles\.length\} action/);
  assert.match(renderer, /windowPayload\?\.designationCards\.length \? `\$\{windowPayload\.designationCards\.length\} designation/);
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
  assert.match(card, /expectedVersion=\{expectedVersions\[edition\.edition_date\]\}/);
  assert.match(card, /audioReflectsEarlierUpdate\(expectedVersion, edition\.selection_version\)/);
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
  assert.match(card, /aria-label="Oncology Mornings"/);
  assert.match(card, /editions\[0\]/);
  assert.match(card, /aria-label="Audio edition"/);
  assert.match(card, /Recorded edition as of/);
  assert.match(card, /<summary><span>Chapters<\/span>/);
  assert.match(card, /seekRequest=\{seek\}/);
  assert.match(card, /window\.setInterval\(refresh, 60_000\)/);
  assert.match(card, /document\.visibilityState === "hidden"/);
  assert.match(card, /window\.clearInterval\(interval\)/);
});

test("the readout window switcher implements a complete keyboard tab pattern", () => {
  assert.match(renderer, /role="tablist"/);
  assert.match(renderer, /role="tab"/);
  assert.match(renderer, /aria-controls="readout-window-panel"/);
  assert.match(renderer, /role="tabpanel"/);
  assert.match(renderer, /aria-labelledby=\{`readout-window-tab-\$\{requestedWindow\}`\}/);
  assert.match(renderer, /readoutWindowKeyboardTarget\(candidate, event\.key\)/);
  assert.match(renderer, /windowTabRefs\.current\[next\]\?\.focus\(\)/);
});
