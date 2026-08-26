import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FEATURED_EPISODES, cleanReadoutExcerpt, listenForArea, regulatoryEditorialArticle, relatedCoverageLinks, sameEditorialArticle, visibleForArea } from "../app/briefing-preview/edition.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const preview = read("app/briefing-preview/EditorialReadout.tsx");
const edition = read("app/briefing-preview/edition.ts");
const previewCss = read("app/briefing-preview/preview.css");
const briefingRoute = read("app/api/briefing/route.ts");
const readoutRequest = read("app/briefing-preview/readoutRequest.ts");
const readoutServer = read("lib/readoutWindowServer.ts");
const readoutCacheRoute = read("app/api/readout-cache/route.ts");
const readoutArchiveRoute = read("app/api/readout-archive/route.ts");
const readoutEditionArchive = read("lib/readoutEditionArchive.ts");
const editionSnapshot = read("app/briefing-preview/editionSnapshot.ts");
const middleware = read("middleware.ts");
const readoutNextPage = read("app/readout-next/page.tsx");
const vercelConfig = read("vercel.json");

test("the compact briefing keeps the physician evidence layer intact", () => {
  assert.match(preview, /PhysicianVoices/);
  assert.match(preview, /Shared, no commentary yet\./);
  assert.match(preview, /is-single/);
  assert.match(preview, /isTitleOnlyShare/);
  assert.match(preview, /posts\.slice\(0, 2\)/);
  assert.match(preview, /\$\{extraComments\} more comment/);
  assert.match(preview, /\{post\.text\}/);
  assert.match(preview, /post\.tweetUrl/);
  assert.match(preview, /article\?\.faces/);
  assert.match(preview, /function xAvatars/);
  assert.doesNotMatch(preview, /Promise\.allSettled/);
  assert.match(preview, /const sharedBy = article\?\.kolSharers \?\? item\.sharedBy/);
  assert.match(preview, /function shareCommentaryLabel/);
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
  assert.match(preview, /function PeerRow/);
  assert.match(preview, /<PeerRow article=\{article\} sharedBy=\{sharedBy\} \/>/);
  assert.match(preview, /article\.sharerPeople/);
  assert.match(preview, /clinicianSharers\(article\)\.slice\(0, sharedBy\)/);
  assert.match(preview, /other clinician/);
  assert.match(preview, /function CompactClinicianComment/);
  assert.match(preview, /applyEvidenceOverlay/);
  assert.match(preview, /function articleWithLiveEvidence/);
  assert.match(preview, /const base = overlay \? findArticle\(item, briefs\) \?\? articleFromEditorial\(item\) : articleFromEditorial\(item\)/);
  assert.doesNotMatch(preview, /applyEvidenceOverlay\(findArticle\(item, briefs\)/);
  assert.match(preview, /windowPayload\?\.overlays/);
  assert.doesNotMatch(preview, /EVIDENCE_REFRESH_MS|mode: "evidence-overlay"/);
  assert.doesNotMatch(preview, /window\.setInterval|window\.addEventListener\("focus"/);
  assert.match(edition, /articleEvidencePool/);
  assert.match(edition, /brief\.topStories/);
  assert.match(edition, /brief\.movers/);
  assert.match(edition, /brief\.trials/);
  assert.doesNotMatch(preview, /er-conversation-toggle/);
  assert.doesNotMatch(preview, /summari[sz]e.*post|synthetic.*quote/i);
});

test("live evidence overlay cannot rewrite frozen editorial prose", () => {
  assert.doesNotMatch(preview, /<h3>\{item\.takeaway\}<\/h3>/);
  assert.doesNotMatch(preview, /<h3>\{item\.hook\}<\/h3>/);
  assert.match(preview, /function SourceHeadline/);
  assert.match(preview, /<SourceHeadline href=\{href\} source=\{item\.journal\} title=\{article\?\.title \|\| item\.title\} compact=\{compact\} \/>/);
  assert.match(preview, /<DevelopmentFinding text=\{item\.finding\} label=\{excerptLabel\(item\)\} expanded=\{open\} \/>/);
  assert.doesNotMatch(preview, /<strong>Key takeaway:<\/strong>/);
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

test("the 7-day tab reads exact morning editions and never quota-fills", () => {
  assert.match(preview, /mode: "readout-window"/);
  assert.match(preview, /days: readoutWindowDays\(readoutWindow\)/);
  assert.match(preview, /windowPayload\?\.editionHistory/);
  assert.match(preview, /windowPayload\?\.historyDays/);
  assert.match(preview, /sevenDayEditionDevelopments\(editionHistory\)/);
  assert.match(preview, /sevenDayEdition\.developments\.slice\(0, 5\)/,
    "the initial seven-day scan remains capped at five");
  assert.match(preview, /historyReady && <button[^>]*type="button"[^>]*role="tab"/,
    "the public tab stays hidden until seven exact edition dates exist");
  assert.match(preview, /More from the last 7 days/);
  assert.match(preview, /aria-expanded=\{moreOpen\}/);
  assert.match(preview, /moreFromSevenDays\.map\(\(item\)/,
    "every remaining qualifying card is available after expansion");
  assert.doesNotMatch(preview, /moreFromSevenDays\.slice\(/,
    "the expanded remainder is not given another arbitrary cap");
  assert.match(preview, /const relevant = useMemo\(\(\) => readoutWindow === "7d" \? \[\]/,
    "the static Today-only Also Relevant slate does not compete with the seven-day remainder");
  assert.match(readoutRequest, /window === "7d" \? 168 : fallbackIds\.has\(item\.id\) \? 72 : 24/);
  assert.match(preview, /setLoadingWindow\(true\)/);
  assert.match(preview, /<ReadoutLoading \/>/);
  assert.match(preview, /const pageReady = !loadingWindow/);
  assert.match(preview, /activeEvidenceOverlays\.get\(item\.id\)\?\.windowClinicianCount \?\? 0\) > 0/);
  assert.match(preview, /kolSharers: overlay\.kolSharers/, "the visible Shared by count comes from lifetime overlay evidence");
  assert.doesNotMatch(preview, /\[\.\.\.todayDevelopments, \.\.\.SPECIALTY_FALLBACKS\]/);
  assert.doesNotMatch(preview, /archivedEditorialArticle/,
    "legacy shared-link archive cards no longer stand in for displayed morning editions");
  assert.match(preview, /sevenDayEditionListen\(editionHistory, currentWorth\)/,
    "Listen comes from the exact daily selections and retains featured episodes outside the top five");
  assert.match(briefingRoute, /"readout-window"/);
});

test("seven-day edition history dedupes exact cards while preserving frozen daily position", () => {
  assert.match(editionSnapshot, /snapshots = \[\.\.\.history\]\.sort/);
  assert.match(editionSnapshot, /sameDevelopment\(existing\.development, entry\.development\)/);
  assert.match(editionSnapshot, /sameEditorialArticle\(existing\.article, entry\.article\)/);
  assert.match(editionSnapshot, /left\.position - right\.position \|\| right\.editionDate\.localeCompare\(left\.editionDate\)/,
    "daily editorial position ranks first and the newer edition breaks ties");
  assert.match(editionSnapshot, /entry\.episode/,
    "archived featured episodes retain their exact playable audio metadata");
  assert.match(editionSnapshot, /displayedIds\.has\(entry\.development\.id\)/,
    "a podcast already displayed in the top five is not repeated in Listen");
});

test("the exact morning edition archive is DST-safe, idempotent, and service-only", () => {
  assert.match(editionSnapshot, /timeZone: "America\/New_York"/);
  assert.match(editionSnapshot, /hourCycle: "h23"/);
  assert.match(editionSnapshot, /developments: developments\.map/);
  assert.match(editionSnapshot, /relevant: relevant\.map/);
  assert.match(editionSnapshot, /listenItems\.map/);
  assert.match(readoutEditionArchive, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readoutEditionArchive, /kind: "edition"/);
  assert.match(readoutEditionArchive, /edition:\$\{snapshot\.editionDate\}:\$\{area\}/);
  assert.match(readoutEditionArchive, /resolution=ignore-duplicates/);
  assert.match(readoutEditionArchive, /etEditionHour\(now\) !== 6/);
  assert.match(readoutArchiveRoute, /archiveCurrentReadoutEdition\(\)/);
  assert.match(readoutArchiveRoute, /revalidateTag\(READOUT_WINDOW_CACHE_TAG\)/);
  assert.match(readoutArchiveRoute, /warmReadoutWindowCache\(\)/);
  assert.match(vercelConfig, /"5 10 \* \* \*"/);
  assert.match(vercelConfig, /"5 11 \* \* \*"/);
});

test("the browser receives one server-cached payload and never refreshes evidence after paint", () => {
  assert.match(readoutNextPage, /await getCachedReadoutWindow\("All", "today"\)/);
  assert.doesNotMatch(readoutNextPage, /catch\(\(\) => null\)/);
  assert.match(readoutNextPage, /initialPayload=\{initialPayload\}/);
  assert.match(preview, /useState<ReadoutWindowPayload \| null>\(initialPayload\)/);
  assert.match(preview, /body: JSON\.stringify\(\{ mode: "readout-window", area, days: readoutWindowDays\(readoutWindow\) \}\)/);
  assert.doesNotMatch(preview, /cards: windowEvidenceTargets/);
  assert.match(preview, /windowPayload\?\.area === area && windowPayload\.windowDays === readoutWindowDays\(readoutWindow\)/);
  assert.doesNotMatch(preview, /setInterval|addEventListener\("focus"|visibilitychange/);
  assert.match(readoutServer, /unstable_cache/);
  assert.match(readoutServer, /READOUT_WINDOW_REVALIDATE_SECONDS = 60 \* 60/);
  assert.match(readoutServer, /tags: \[READOUT_WINDOW_CACHE_TAG\]/);
  assert.match(readoutCacheRoute, /revalidateTag\(READOUT_WINDOW_CACHE_TAG\)/);
  assert.match(readoutCacheRoute, /warmReadoutWindowCache\(\)/);
  assert.match(vercelConfig, /"\/api\/readout-cache"/);
  assert.match(vercelConfig, /"50 \* \* \* \*"/);
});

test("attached related coverage is compact, validated, and deduped from the primary source", () => {
  const links = [
    { id: "primary", kind: "paper", title: "Paper", url: "https://journal.example/paper", sourceLabel: "Journal", relationshipType: "primary_source", occurredAt: null },
    { id: "same", kind: "article", title: "Same", url: "https://journal.example/paper", sourceLabel: "Journal", relationshipType: "coverage", occurredAt: null },
    { id: "same-title", kind: "article", title: "Paper", url: "https://publisher.example/paper", sourceLabel: "Publisher", relationshipType: "coverage", occurredAt: null },
    { id: "coverage", kind: "article", title: "Coverage", url: "https://onclive.com/story", sourceLabel: "OncLive", relationshipType: "coverage", occurredAt: null },
    { id: "duplicate", kind: "article", title: "Coverage copy", url: "https://onclive.com/story", sourceLabel: "OncLive", relationshipType: "coverage", occurredAt: null },
    { id: "bad", kind: "article", title: "Bad", url: "javascript:alert(1)", sourceLabel: "Bad", relationshipType: "coverage", occurredAt: null },
  ];
  assert.deepEqual(relatedCoverageLinks(links, "https://journal.example/paper", "Paper").map((link) => link.sourceLabel), ["OncLive"]);
  assert.match(preview, /Related coverage/);
  assert.match(preview, /er-related-links/);
  assert.match(preview, /<CoverageLinks item=\{item\}/);
});

test("an attached podcast episode plays on the development card without becoming coverage", () => {
  assert.match(preview, /relatedEpisodes = relatedLinks\.filter\(\(link\) => link\.kind === "episode"\)\.slice\(0, 1\)/);
  assert.match(preview, /related = relatedLinks\.filter\(\(link\) => link\.kind !== "episode"\)\.slice\(0, 4\)/);
  assert.match(preview, /function RelatedEpisode/);
  assert.match(preview, /audioUrl=\{link\.audioUrl\}/);
  assert.match(preview, /<RelatedEpisode item=\{item\} primaryUrl=\{href\} \/>/);
  assert.match(previewCss, /\.er-related-episode \{/);
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
  assert.match(preview, /if \(!expanded\) return null/,
    "supporting studies and related coverage stay in the footer and expanded source list");
  assert.doesNotMatch(preview, /className="er-also"/);
  assert.match(preview, /relatedLinks = relatedCoverageLinks\(item\.relatedCoverage, primaryUrl, item\.title\)/);
  assert.match(preview, /related = relatedLinks\.filter\(\(link\) => link\.kind !== "episode"\)\.slice\(0, 4\)/);
});

test("only the primary development stack is numbered as a finite edition", () => {
  assert.match(preview, /worth\.map\(\(item, index\) => <NumberedDevelopment[^>]*position=\{index \+ 1\}/);
  assert.match(preview, /className="er-story-order">\{position\} <span>·<\/span> \{contentType\}/);
  assert.match(preview, /<Development item=\{item\} briefs=\{briefs\} overlays=\{overlays\} numbered \/>/);
  assert.match(preview, /\{item\.site\}\{numbered \? "" : ` · \$\{articleContentType\(item\)\}`\}/);
  assert.doesNotMatch(previewCss, /\.er-numbered-development \{[^}]*border-top/);
  assert.match(previewCss, /\.er-numbered-development > \.er-development \{[^}]*margin-top: 7px/);
  assert.doesNotMatch(preview, /<CompactDevelopment[^>]*position=/);
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
  assert.match(preview, /Full abstract/);
  assert.match(preview, /function SourceHeadline/);
  assert.match(preview, /er-source-headline/);
  assert.match(preview, /\{title\} <span className="er-ext" aria-hidden="true">↗<\/span>/);
  assert.match(preview, /From the paper/);
  assert.match(preview, /er-peers-who/);
  assert.match(previewCss, /\.er-finding\.is-collapsed/);
  assert.match(previewCss, /-webkit-line-clamp: 3/);
  assert.match(previewCss, /\.er-disclose/);
  assert.match(previewCss, /\.er-source-title/);
  assert.match(previewCss, /\.er-compact-list \.er-source-title a \{ color: var\(--er-ink\)/);
  assert.match(previewCss, /\.er-proof-count \{ white-space: normal/);
  assert.match(previewCss, /\.er-voice-secondary:not\(\.is-mobile-open\)/);
  assert.match(previewCss, /\.er-related-links:not\(\.is-open\)/);
});

test("briefing cards use source identity as the headline and a warmer reading surface", () => {
  assert.match(preview, /function articleContentType/);
  assert.match(preview, /<b>Podcast<\/b>/);
  assert.match(preview, /<SourceHeadline href=\{sourceHref\} source=\{episode\?\.show \|\| item\.show\} title=\{episode\?\.title \|\| item\.title\} \/>/);
  assert.match(previewCss, /--er-paper: #f2f1ec/);
  assert.match(previewCss, /--er-soft: #fbfaf7/);
});

test("desktop reading columns are centered and the specialty menu aligns right", () => {
  assert.match(preview, /<header className="er-header">/);
  assert.match(previewCss, /\.er-page \{[^}]*max-width: 720px;[^}]*margin: 0 auto;[^}]*padding: 0 0 56px/);
  assert.match(previewCss, /\.er-header \{[^}]*grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.doesNotMatch(preview, /er-edition-meta|Past 7 days|Last 24h/,
    "the window picker is the single masthead signal for Today versus 7 days");
  assert.match(previewCss, /\.er-filters \{[^}]*justify-content: flex-end/);
  assert.match(previewCss, /\.er-worth \{[^}]*margin-inline: auto/);
  assert.match(previewCss, /\.er-relevant \{[^}]*margin: 16px auto 0/);
  assert.match(previewCss, /@media \(max-width: 800px\) \{[\s\S]*\.er-filters \{[^}]*justify-content: flex-start/);
});

test("archived cards do not render boilerplate as an editorial takeaway", () => {
  assert.match(edition, /ARCHIVED_TAKEAWAY_FALLBACK/);
  assert.doesNotMatch(preview, /<strong>Key takeaway:<\/strong>/);
  assert.match(preview, /No additional oncology approval, safety warning, or designation in this window\./);
  assert.match(preview, /hasRegulatoryDevelopment \? "Covered above" : "Clear"/);
  assert.match(preview, /if \(!finding\) return null/);
});

test("source excerpts drop PDF labels without adding editorial judgment", () => {
  assert.equal(
    cleanReadoutExcerpt("RISK STRATIFICATION: High risk. KEY FINDINGS: Median OS was 90 months. NCT03425643."),
    "High risk. Median OS was 90 months.",
  );
  assert.doesNotMatch(edition, /It belongs in the briefing as context|not a practice-changing comparison/);
  assert.match(preview, /cleanReadoutExcerpt\(text\)/);
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
  assert.match(previewCss, /er-peers/);
  assert.match(edition, /remember: string/);
  assert.doesNotMatch(preview, /<strong>Key takeaway:<\/strong>/);
  assert.doesNotMatch(preview, /<strong>Remember:<\/strong>/);
  assert.match(preview, /relevant\.slice\(0, 1\)/);
});

test("specialty filters are lenses on the same earned briefing", () => {
  for (const area of ["All", "GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"]) {
    assert.match(edition, new RegExp(`\\b${area}\\b`));
  }
  assert.match(edition, /area === "All" \? items : items\.filter/);
  assert.match(edition, /SPECIALTY_FALLBACKS/);
  assert.match(preview, /No new development cleared the bar in 24 hours/);
  assert.match(preview, /Showing the strongest qualifying development from the past 72 hours/);
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
