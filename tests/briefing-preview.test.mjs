import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FEATURED_EPISODES, listenForArea, regulatoryEditorialArticle, relatedCoverageLinks, sameEditorialArticle, visibleForArea } from "../app/briefing-preview/edition.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const preview = read("app/briefing-preview/EditorialReadout.tsx");
const edition = read("app/briefing-preview/edition.ts");
const previewCss = read("app/briefing-preview/preview.css");
const briefingRoute = read("app/api/briefing/route.ts");
const middleware = read("middleware.ts");
const readoutNextPage = read("app/readout-next/page.tsx");

test("the compact briefing keeps the physician evidence layer intact", () => {
  assert.match(preview, /PhysicianVoices/);
  assert.match(preview, /Shared, no commentary yet\./);
  assert.match(preview, /is-single/);
  assert.match(preview, /isTitleOnlyShare/);
  assert.match(preview, /posts\.slice\(0, 2\)/);
  assert.match(preview, /Show \$\{visiblePosts\.length - 1\} more comment/);
  assert.match(preview, /<blockquote>\{post\.text\}<\/blockquote>/);
  assert.match(preview, /post\.tweetUrl/);
  assert.match(preview, /Promise\.allSettled/);
  assert.match(preview, /const sharedBy = article\?\.kolSharers \?\? item\.sharedBy/);
  assert.match(preview, /shareCommentaryLabel\(sharedBy, authoredCount, 2\)/);
  assert.match(preview, /shareCommentaryLabel\(sharedBy, authoredCount, 1\)/);
  assert.match(preview, /Shared by \$\{sharedBy\} clinician/);
  assert.match(preview, /1 commentary/);
  assert.match(preview, /visible < authoredCount/);
  assert.match(preview, /clinician comments/);
  assert.match(preview, /function clinicianSharers/);
  assert.match(preview, /post\.repostedBy/);
  assert.match(preview, /engagementScore/);
  assert.match(preview, /right\.score - left\.score/);
  assert.match(preview, /SHARER_PREVIEW_LIMIT = 3/);
  assert.match(preview, /SHARER_EXPANDED_LIMIT = 12/);
  assert.match(preview, /function SharerNames/);
  assert.match(preview, /<SharerNames article=\{article\} sharedBy=\{sharedBy\} \/>/);
  assert.match(preview, /article\.sharerPeople/);
  assert.match(preview, /clinicianSharers\(article\)\.slice\(0, sharedBy\)/);
  assert.match(preview, /\+\{expandableCount\} more/);
  assert.match(preview, /\+\{hiddenCount\} others counted/);
  assert.match(preview, /function CompactClinicianComment/);
  assert.match(preview, /<CompactClinicianComment article=\{article\} \/>/);
  assert.match(preview, /className="er-compact-proof"/);
  assert.match(preview, /applyEvidenceOverlay/);
  assert.match(preview, /function articleWithLiveEvidence/);
  assert.match(preview, /const base = overlay \? findArticle\(item, briefs\) \?\? articleFromEditorial\(item\) : articleFromEditorial\(item\)/);
  assert.doesNotMatch(preview, /applyEvidenceOverlay\(findArticle\(item, briefs\)/);
  assert.match(preview, /EVIDENCE_REFRESH_MS = 60 \* 60_000/);
  assert.match(preview, /mode: "evidence-overlay"/);
  assert.match(preview, /window\.addEventListener\("focus", onFocus\)/);
  assert.match(edition, /articleEvidencePool/);
  assert.match(edition, /brief\.topStories/);
  assert.match(edition, /brief\.movers/);
  assert.match(edition, /brief\.trials/);
  assert.doesNotMatch(preview, /er-conversation-toggle/);
  assert.doesNotMatch(preview, /summari[sz]e.*post|synthetic.*quote/i);
});

test("live evidence overlay cannot rewrite frozen editorial prose", () => {
  assert.match(preview, /<h3>\{item\.takeaway\}<\/h3>/);
  assert.match(preview, /<DevelopmentFinding text=\{item\.finding\} \/>/);
  assert.match(preview, /<strong>Key takeaway:<\/strong> \{item\.remember\}/);
  assert.match(preview, /kolSharers: overlay\.kolSharers/);
  assert.match(preview, /faces: overlay\.faces/);
  assert.match(preview, /posts: overlay\.posts/);
  assert.match(preview, /sharerPeople: overlay\.sharerPeople/);
  assert.doesNotMatch(preview, /setWorth|setRelevant|setCurrentWorth/);
  assert.match(briefingRoute, /export async function POST/);
  assert.match(briefingRoute, /body\?\.mode !== "evidence-overlay"/);
  assert.match(briefingRoute, /OVERLAY_TTL_MS = 60_000/);
  assert.match(briefingRoute, /windowHours/);
  assert.match(briefingRoute, /JSON\.stringify\(upstreamBody\)/);
});

test("the 7-day tab reads the promoted-card archive and never quota-fills", () => {
  assert.match(preview, /mode: "readout-window"/);
  assert.match(preview, /days: readoutWindow === "7d" \? 7 : 1/);
  assert.match(preview, /windowPayload\?\.cards/);
  assert.match(preview, /map\(archivedEditorialArticle\)/);
  assert.match(preview, /const evidenceWindowHours = readoutWindow === "7d" \? 168 : hasFallbackWindow \? 72 : 24/);
  assert.match(preview, /windowHours: evidenceWindowHours/);
  assert.match(preview, /setLoadingWindow\(true\)/);
  assert.match(preview, /setWindowPayload\(null\); setReadoutWindow\("7d"\)/);
  assert.match(preview, /readoutWindow === "7d" && loadingWindow/);
  assert.match(preview, /role="status">Loading the strongest developments from the past 7 days/);
  assert.match(preview, /Checking the strongest qualifying development from the past 72 hours/);
  assert.match(preview, /activeEvidenceOverlays\.get\(item\.id\)\?\.kolSharers \?\? 0\) > 0/);
  assert.doesNotMatch(preview, /\[\.\.\.todayDevelopments, \.\.\.SPECIALTY_FALLBACKS\]/);
  assert.match(briefingRoute, /"readout-window"/);
});

test("attached related coverage is compact, validated, and deduped from the primary source", () => {
  const links = [
    { id: "primary", kind: "paper", title: "Paper", url: "https://journal.example/paper", sourceLabel: "Journal", relationshipType: "primary_source", occurredAt: null },
    { id: "same", kind: "article", title: "Same", url: "https://journal.example/paper", sourceLabel: "Journal", relationshipType: "coverage", occurredAt: null },
    { id: "coverage", kind: "article", title: "Coverage", url: "https://onclive.com/story", sourceLabel: "OncLive", relationshipType: "coverage", occurredAt: null },
    { id: "duplicate", kind: "article", title: "Coverage copy", url: "https://onclive.com/story", sourceLabel: "OncLive", relationshipType: "coverage", occurredAt: null },
    { id: "bad", kind: "article", title: "Bad", url: "javascript:alert(1)", sourceLabel: "Bad", relationshipType: "coverage", occurredAt: null },
  ];
  assert.deepEqual(relatedCoverageLinks(links, "https://journal.example/paper").map((link) => link.sourceLabel), ["OncLive"]);
  assert.match(preview, /Related coverage/);
  assert.match(preview, /er-related-toggle/);
  assert.match(preview, /<CoverageLinks item=\{item\}/);
});

test("regulatory developments keep the regulator primary and the trial explicitly supporting", () => {
  const approval = regulatoryEditorialArticle({
    id: "regulatory:fda-ziihera",
    kind: "event",
    regulatoryKind: "approval",
    eligibleLabel: "FDA approval",
    headline: "FDA approves Ziihera for first-line HER2-positive gastroesophageal cancer",
    sourceLabel: "U.S. Food and Drug Administration",
    url: "https://fda.gov/ziihera-approval",
    occurredOn: "2026-08-25",
    areas: ["GI"],
    articleIds: ["fda", "nejm", "targeted"],
    primaryStudy: {
      id: "nejm",
      title: "Zanidatamab with and without Tislelizumab in HER2-Positive Gastroesophageal Cancer",
      url: "https://nejm.org/doi/full/10.1056/example",
      sourceLabel: "New England Journal of Medicine",
    },
    relatedCoverage: [{
      id: "targeted",
      kind: "article",
      title: "FDA Approves Zanidatamab Combinations",
      url: "https://targetedonc.com/ziihera",
      sourceLabel: "Targeted Oncology",
      relationshipType: "related_coverage",
      occurredAt: "2026-08-25T17:00:00Z",
    }],
    metrics: { clinicians: 2, cliniciansFeedEligible: 2, reposters: 5, totalSharers: 7, lastSharedAt: "2026-08-25T17:00:00Z" },
  }, "All");

  assert.equal(approval.url, "https://fda.gov/ziihera-approval");
  assert.equal(approval.title, approval.takeaway);
  assert.equal(approval.journal, "U.S. Food and Drug Administration");
  assert.equal(approval.sourceAction, "View FDA source");
  assert.deepEqual(approval.primarySources, []);
  assert.deepEqual(approval.supportingEvidence?.map((link) => link.sourceLabel), ["New England Journal of Medicine"]);
  assert.deepEqual(approval.relatedCoverage?.map((link) => link.sourceLabel), ["Targeted Oncology"]);
  assert.match(preview, /Supporting study/);
  assert.match(preview, /relatedCoverageLinks\(item\.relatedCoverage, primaryUrl\)\.slice\(0, 4\)/);
});

test("a development already leading a section is removed from Also Relevant by stable identity", () => {
  const article = (id, doi, url) => ({
    id,
    area: "Breast",
    site: "Breast",
    nickname: "",
    takeaway: id,
    finding: "",
    remember: "",
    journal: "Journal",
    title: "Elacestrant plus everolimus from ELEVATE",
    url,
    evidence: "Phase 2",
    sharedBy: 1,
    match: { doi },
  });
  assert.equal(sameEditorialArticle(
    article("lead", "10.1158/1078-0432.CCR-26-1816", "https://aacrjournals.org/article"),
    article("relevant", "10.1158/1078-0432.ccr-26-1816", "https://doi.org/10.1158/1078-0432.ccr-26-1816"),
  ), true);
  assert.match(preview, /sameEditorialArticle\(item, lead\)/);
});

test("cards keep long findings to four lines until expanded at any viewport", () => {
  assert.match(preview, /node\.scrollHeight > node\.clientHeight \+ 1/);
  assert.match(preview, /new ResizeObserver\(measure\)/);
  assert.match(preview, /Show full result/);
  assert.match(preview, /function SourceArticle/);
  assert.match(preview, /Read article/);
  assert.match(preview, /className="er-citation-topline"/);
  assert.match(preview, /<span className="er-sharer-label">Including<\/span>/);
  assert.match(previewCss, /\.er-finding\.is-collapsed/);
  assert.match(previewCss, /-webkit-line-clamp: 4/);
  assert.match(previewCss, /\.er-proof-count \{ white-space: normal/);
  assert.match(previewCss, /\.er-voice-secondary:not\(\.is-mobile-open\)/);
  assert.match(previewCss, /\.er-related-links:not\(\.is-open\)/);
});

test("archived cards do not render boilerplate as an editorial takeaway", () => {
  assert.match(edition, /ARCHIVED_TAKEAWAY_FALLBACK/);
  assert.match(preview, /item\.remember !== ARCHIVED_TAKEAWAY_FALLBACK/);
  assert.match(preview, /No additional oncology approval, safety warning, or designation in this window\./);
  assert.match(preview, /hasRegulatoryDevelopment \? "Covered above" : "Clear"/);
  assert.match(preview, /if \(!finding\) return null/);
});

test("the hidden production canary is gated, unlisted, and noindex", () => {
  assert.match(readoutNextPage, /EditorialReadout/);
  assert.match(readoutNextPage, /robots: \{ index: false, follow: false \}/);
  assert.doesNotMatch(middleware, /readout-next/);
});

test("the briefing is editorial rather than a repackaged catalog", () => {
  assert.match(preview, /CanvasMdLogo/);
  assert.match(preview, /aria-label="CanvasMD"/);
  assert.match(preview, /<h2>The Readout<\/h2>/);
  assert.match(preview, />Today<\/button>/);
  assert.match(preview, />7 days<\/button>/);
  assert.doesNotMatch(preview, /This week/);
  assert.doesNotMatch(preview, /<h1>The Readout<\/h1>/);
  assert.doesNotMatch(preview, /Key Developments/);
  assert.doesNotMatch(preview, /Today's Readout/);
  assert.doesNotMatch(preview, />Worth Your Time</);
  assert.match(preview, /Also Relevant/);
  assert.match(preview, />Listen</);
  assert.match(preview, /Regulatory Watch/);
  assert.match(preview, /No development cleared the bar/);
  assert.doesNotMatch(preview, />Papers<|>Trials<|>People<|>Drugs</);
  assert.doesNotMatch(preview, /CANVASMD/);
  assert.match(previewCss, /#C45B28/);
  assert.match(previewCss, /#1A1A2E/);
  assert.match(previewCss, /er-window-tabs/);
  assert.match(previewCss, /er-compact-comment/);
  assert.match(edition, /remember: string/);
  assert.match(preview, /<strong>Key takeaway:<\/strong>/);
  assert.doesNotMatch(preview, /<strong>Remember:<\/strong>/);
  assert.match(preview, /relevant\.slice\(0, 1\)/);
});

test("specialty filters are lenses on the same earned briefing", () => {
  for (const area of ["All", "GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"]) {
    assert.match(edition, new RegExp(`\\b${area}\\b`));
  }
  assert.match(edition, /area === "All" \? items : items\.filter/);
  assert.match(edition, /SPECIALTY_FALLBACKS/);
  assert.match(preview, /usingFallback \? "Best of 72h" : "Last 24h"/);
  assert.match(preview, /No new development cleared the bar in 24 hours/);
});

test("All can carry oncology-wide developments without leaking them into specialty tabs", () => {
  const oncologyWide = { id: "tumor-agnostic-safety", area: "All", title: "Tumor-agnostic safety warning" };
  const lung = { id: "lung-paper", area: "Lung", title: "Lung paper" };
  const items = [oncologyWide, lung];
  assert.deepEqual(visibleForArea(items, "All").map((item) => item.id), ["tumor-agnostic-safety", "lung-paper"]);
  assert.deepEqual(visibleForArea(items, "Lung").map((item) => item.id), ["lung-paper"]);
  assert.deepEqual(visibleForArea(items, "GU").map((item) => item.id), []);
  assert.match(edition, /type EditorialArea = SpecialtyArea \| "All"/);
  assert.match(edition, /area: EditorialArea/);
});

test("a transcript-supported episode can lead a specialty without duplicating Listen", () => {
  assert.match(edition, /FEATURED_EPISODES/);
  assert.match(edition, /Systemic Treatment of Ovarian Cancer Recurrence/);
  assert.match(preview, /EpisodeDevelopment/);
  assert.match(preview, /AudioQuote/);
  assert.match(preview, /audioUrl=\{audioUrl\}/);
  assert.match(preview, /audioUrl=\{episode\.audioUrl\}/);
  assert.match(preview, /Episode page ↗/);
  assert.match(preview, /Listen here/);
  assert.match(preview, /listenForArea/);
  assert.match(preview, /filter\(isEpisodeDevelopment\)/);
});

test("podcast Listen holds use exact show titles and preserve episode metadata", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const briefing = brief("GU", [
    episode("The Uromigos", "Episode 516: The Influence of Hypoxia on Response and Resistance in RCC", "2026-08-24T16:00:00Z", "https://uromigos.example/516"),
    episode("The Uromigos Extra", "Episode 517: The Influence of Hypoxia on Response and Resistance in RCC", "2026-08-24T17:00:00Z"),
  ]);
  const listen = listenForArea([], [briefing], "GU", [], now);
  assert.deepEqual(listen.map((item) => item.show), ["The Uromigos"]);
  assert.equal(listen[0].title, "Episode 516: The Influence of Hypoxia on Response and Resistance in RCC");
  assert.equal(listen[0].hook, listen[0].title);
  assert.equal(listen[0].url, "https://uromigos.example/516");
});

test("cross-specialty podcast holds route by episode area only", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const breast = brief("Breast", [
    episode("The Lancet Oncology in conversation with", "Tumour-infiltrating lymphocytes in breast cancer with Professor Sherene Loi", "2026-08-24T21:30:00Z"),
  ]);
  assert.equal(listenForArea([], [breast], "Breast", [], now).length, 1);
  assert.equal(listenForArea([], [breast], "GU", [], now).length, 0);
  assert.equal(listenForArea([], [breast], "All", [], now).length, 1);
});

test("podcast Listen holds expire after 72 hours", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const heme = brief("Heme", [
    episode("Blood Podcast", "Balancing Infection and Thrombosis: Bispecific Antibodies and the Many Roles of HRG", "2026-08-22T15:59:59Z"),
  ]);
  assert.deepEqual(listenForArea([], [heme], "Heme", [], now), []);
});

test("podcast Listen holds cap at two per specialty and three on All", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const gu = brief("GU", [
    episode("The Uromigos", "Older RCC episode", "2026-08-24T10:00:00Z"),
    episode("GU Cast | Urology Podcast", "New prostate guidelines", "2026-08-24T12:00:00Z"),
    episode("Oncology Brothers: Practice-Changing Cancer Discussions", "Newest prostate cancer sequencing", "2026-08-24T14:00:00Z"),
  ]);
  const breast = brief("Breast", [
    episode("The Breast Friends Podcast", "Breast ASCO takeaways", "2026-08-24T13:00:00Z"),
    episode("The Lancet Oncology in conversation with", "Breast TILs", "2026-08-24T11:00:00Z"),
  ]);
  assert.deepEqual(listenForArea([], [gu], "GU", [], now).map((item) => item.title), ["Newest prostate cancer sequencing", "New prostate guidelines"]);
  assert.equal(listenForArea([], [gu, breast], "All", [], now).length, 3);
});

test("podcast holds do not become lead developments without transcript support", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const gyn = brief("Gyn", [
    episode("ASCO Guidelines", "Systemic Treatment of Ovarian Cancer Recurrence: ASCO Living Guideline 2026.1.0", "2026-08-24T20:00:00Z"),
  ]);
  const listen = listenForArea([], [gyn], "Gyn", FEATURED_EPISODES, now);
  assert.deepEqual(listen, []);
  assert.match(edition, /FEATURED_EPISODES/);
  assert.match(preview, /const currentWorth = useMemo/);
});

test("conditional and explicitly excluded shows are not held by host identity alone", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const gu = brief("GU", [
    episode("Oncology Insights with Petros Grivas", "Head & Neck cancer updates", "2026-08-24T20:00:00Z"),
    episode("OncLive® On Air", "Prostate cancer update", "2026-08-24T20:00:00Z"),
  ]);
  assert.deepEqual(listenForArea([], [gu], "GU", [], now), []);
});

test("the preview is public locally without weakening the production gate", () => {
  assert.match(middleware, /NODE_ENV !== "production"/);
  assert.match(middleware, /pathname\.startsWith\("\/briefing-preview"\)/);
});

function brief(area, episodes) {
  return { area, episodes };
}

function episode(show, title, publishedAt, sourceUrl = "https://podcast.example/episode") {
  return {
    title,
    show,
    showArt: null,
    audioUrl: "https://podcast.example/audio.mp3",
    sourceUrl,
    durationSeconds: null,
    description: title,
    publishedAt,
  };
}
