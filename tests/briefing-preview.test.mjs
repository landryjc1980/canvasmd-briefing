import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { ARCHIVED_LISTEN_MEDIA, FEATURED_EPISODES, archivedEditorialArticle, breakingEditorialArticle, canonicalEditorialUrl, cleanClinicianText, cleanReadoutExcerpt, editorialBelongsToArea, editorialScopeLabel, editorialStoryAreas, listenForArea, readoutFindingExcerpt, readoutFocusLabel, regulatoryEditorialArticle, regulatoryWatchArticles, relatedCoverageLinks, sameEditorialArticle, sameEditorialDevelopment, visibleForArea } from "../app/briefing-preview/edition.ts";
import {
  canonicalReadoutEditionSnapshot,
  readoutEditionForArea,
  readoutEditionHistoryIncludingCurrent,
} from "../app/briefing-preview/editionHistory.ts";
import { archiveCardForArticle } from "../app/archiveCard.ts";
import { activeReadoutEditionDate, hasFrozenPrepublishedEdition, hasScheduledReadoutSourceRun, prepublicationEditionDate, readoutWindowKeyboardTarget, scheduledReadoutSourceRunId } from "../app/briefing-preview/readoutRequest.ts";

// editionSnapshot uses extensionless local imports that Node's TypeScript runner does not resolve.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  }
  if (context.parentURL?.includes("/app/briefing-preview/") && ["./edition", "./readoutRequest"].includes(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { buildReadoutEditionSnapshot } = await import("../app/briefing-preview/editionSnapshot.ts");

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const preview = read("app/briefing-preview/EditorialReadout.tsx");
const readoutVoice = read("components/ReadoutVoice.tsx");
const readoutArticleCard = read("components/ReadoutArticleCard.tsx");
const readoutSourceHeadline = read("components/ReadoutSourceHeadline.tsx");

test("clinician commentary cards show names without redundant X handles", () => {
  assert.doesNotMatch(preview, /post\.handle\.replace/);
  assert.doesNotMatch(preview, /er-handle/);
});
const edition = read("app/briefing-preview/edition.ts");
const previewCss = read("app/briefing-preview/preview.css");
const briefingRoute = read("app/api/briefing/route.ts");
const readoutRequest = read("app/briefing-preview/readoutRequest.ts");
const readoutServer = read("lib/readoutWindowServer.ts");
const readoutCacheRoute = read("app/api/readout-cache/route.ts");
const readoutArchiveRoute = read("app/api/readout-archive/route.ts");
const readoutPrearchiveRoute = read("app/api/readout-prearchive/route.ts");
const readoutEditionArchive = read("lib/readoutEditionArchive.ts");
const heroPost = read("app/heroPost.ts");
const archiveCard = read("app/archiveCard.ts");
const editionSnapshot = read("app/briefing-preview/editionSnapshot.ts");
const middleware = read("middleware.ts");
const rootPage = read("app/page.tsx");
const legacyPage = read("app/LegacyBriefingPage.tsx");
const readoutNextPage = read("app/readout-next/page.tsx");
const vercelConfig = read("vercel.json");

test("the compact briefing keeps the physician evidence layer intact", () => {
  assert.match(preview, /PhysicianVoices/);
  assert.doesNotMatch(preview, /Shared, no commentary yet\./);
  assert.doesNotMatch(preview, /comment receipts are available|receipts unavailable/);
  assert.match(preview, /is-single/);
  assert.match(preview, /isTitleOnlyShare/);
  assert.match(preview, /post\.thread \?\? \[\]/,
    "an authored thread may supply the substantive verbatim comment when its root is title-only");
  assert.match(preview, /isSubstantiveClinicianText/);
  assert.match(preview, /cleanClinicianText/);
  assert.match(preview, /expanded \? posts\.slice\(1\) : \[\]/,
    "the collapsed card keeps one preview while the expansion renders every remaining comment");
  assert.doesNotMatch(preview, /previewPosts|posts\.slice\(0, 2\)/);
  assert.match(preview, /articleExpansion\(\s*source,\s*usefulPosts\(article\)\.map/);
  // The per-comment preview/expand toggle now lives in the shared ReadoutVoice component
  // ("Readout cards: the replies under posts about the paper"), where an open thread
  // also reveals the full text.
  assert.match(readoutVoice, /expanded \|\| threadOpen \? post\.text : articleTextPreview\(post\.text \?\? "", 220\)/);
  assert.match(preview, /post\.tweetUrl/);
  assert.match(preview, /article\?\.faces/);
  assert.match(preview, /function xAvatars/);
  assert.doesNotMatch(preview, /Promise\.allSettled/);
  assert.match(preview, /const sharedBy = article\?\.kolSharers \?\? item\.sharedBy/);
  assert.match(preview, /function shareCommentaryLabel/);
  // "Readout cards: the count that earned the slot, with its period and a breakdown" (373cfb4)
  // replaced the plain "N commented" tally with a `wrote` count fed by authoredClinicianCount,
  // and a fuller breakdown of who wrote, who only reposted, and how many replies came in.
  assert.match(preview, /const wrote = Math\.max\(loadedComments, article\?\.authoredClinicianCount \?\? 0\)/,
    "the compact card keeps the total commenter count separate from available receipts");
  assert.match(preview, /\$\{own\} wrote about it/);
  assert.match(preview, /\$\{rest\} reposted or shared the link/);
  // Same commit (373cfb4) moved this from a template literal to inline JSX so the row
  // could also show the period the count covers ("since yesterday morning", "this week").
  assert.match(preview, /Shared by \{sharedBy\} clinician\{sharedBy === 1 \? "" : "s"\}\{period &&/);
  assert.match(preview, /function clinicianSharers/);
  assert.match(preview, /post\.repostedBy/);
  assert.match(preview, /engagementScore/);
  assert.match(preview, /right\.score - left\.score/);
  assert.match(preview, /SHARER_PREVIEW_LIMIT = 3/);
  assert.match(preview, /FRCPC\|FASTRO/,
    "fellowship credentials cannot become a displayed surname");
  assert.match(preview, /replace\(\/\[\.,;:\]\+\$\//,
    "display-name punctuation cannot become part of a surname label");
  assert.match(preview, /function PeerRow/);
  assert.match(preview, /<PeerRow article=\{article\} sharedBy=\{sharedBy\} \/>/);
  assert.match(preview, /article\.sharerPeople/);
  assert.match(preview, /clinicianSharers\(article\)\.slice\(0, sharedBy\)/);
  assert.match(preview, /other clinician/);
  assert.match(preview, /applyEvidenceOverlay/);
  assert.match(preview, /function articleWithLiveEvidence/);
  assert.match(preview, /const base = overlay \? findArticle\(item, briefs\) \?\? articleFromEditorial\(item\) : articleFromEditorial\(item\)/);
  assert.doesNotMatch(preview, /applyEvidenceOverlay\(findArticle\(item, briefs\)/);
  assert.match(preview, /windowPayload\?\.overlays/);
  assert.doesNotMatch(preview, /EVIDENCE_REFRESH_MS/);
  assert.match(preview, /function loadFullEvidenceOverlay/);
  assert.match(preview, /mode: "evidence-overlay"/);
  assert.match(preview, /if \(!nextOpen \|\| detailOverlay \|\| loadingDetails \|\| authoredCount >= availableComments\) return/,
    "full comment bodies load only when the reader expands a card that has more comments");
  assert.match(preview, /payloadCache\.current\.clear\(\)/);
  assert.match(edition, /articleEvidencePool/);
  assert.match(edition, /brief\.topStories/);
  assert.match(edition, /brief\.movers/);
  assert.match(edition, /brief\.trials/);
  assert.doesNotMatch(preview, /er-conversation-toggle/);
  assert.doesNotMatch(preview, /summari[sz]e.*post|synthetic.*quote/i);
  assert.doesNotMatch(preview, /er-footer|Evidence connected to the live Readout/);
});

test("live evidence overlay cannot rewrite frozen editorial prose", () => {
  assert.doesNotMatch(preview, /<h3>\{item\.takeaway\}<\/h3>/);
  assert.doesNotMatch(preview, /<h3>\{item\.hook\}<\/h3>/);
  // SourceHeadline is now the shared ReadoutArticleCard/ReadoutSourceHeadline pair; every
  // development renders its frozen title and source through that path, not an inline h3.
  assert.match(readoutArticleCard, /function ReadoutArticleCard/);
  assert.match(preview, /<ReadoutArticleCard[\s\S]{0,200}href=\{href\}\s+source=\{item\.journal\}\s+title=\{displayReadoutTitle\(article\?\.title \|\| item\.title\)\}\s+compact=\{compact\}/);
  assert.match(readoutSourceHeadline, /<a href=\{href\}[^>]*>\{title\}<\/a>/);
  assert.match(preview, /const rawSourceText = item\.sourceExcerpt \|\| item\.finding/);
  assert.match(preview, /<DevelopmentFinding text=\{source\.preview\} expandedText=\{source\.full\} expanded=\{open\}/);
  assert.doesNotMatch(preview, /<strong>Key takeaway:<\/strong>/);
  // "Readout cards: the count that earned the slot, with its period and a breakdown" (373cfb4)
  // scoped Today's counts to the edition window when the overlay carries one; the fallback
  // remains the same overlay-sourced fields, never anything read back off the frozen item.
  assert.match(preview, /kolSharers: windowed \? overlay\.windowClinicianCount : overlay\.kolSharers/);
  assert.match(preview, /faces: windowed && overlay\.windowFaces\?\.length \? overlay\.windowFaces : overlay\.faces/);
  assert.match(preview, /posts: overlay\.posts/);
  assert.match(preview, /sharerPeople: windowed && overlay\.windowSharerPeople\?\.length \? overlay\.windowSharerPeople : overlay\.sharerPeople/);
  assert.doesNotMatch(preview, /setWorth|setRelevant|setCurrentWorth/);
  assert.match(briefingRoute, /export async function POST/);
  assert.match(briefingRoute, /body\?\.mode !== "evidence-overlay"/);
  assert.match(briefingRoute, /OVERLAY_TTL_MS = 60_000/);
  assert.match(briefingRoute, /windowHours/);
  assert.match(briefingRoute, /JSON\.stringify\(upstreamBody\)/);
});

test("a midday insertion preserves every existing card while fresh evidence stays outside the edition", () => {
  assert.match(editionSnapshot, /const existingDevelopments = snapshot\.developments\.map\(\(entry\) => entry\.development\)/);
  assert.match(editionSnapshot, /const additions = liveInsertionDevelopments\(payload, snapshot\.area\)\.filter/);
  assert.match(editionSnapshot, /!existingDevelopments\.some/,
    "a candidate already frozen into the edition is never regenerated");
  assert.match(editionSnapshot, /uniqueRelevant\(\[\.\.\.existingRelevant, \.\.\.additions\], existingDevelopments\)/,
    "new qualifying developments are appended to the labeled remainder");
  assert.match(editionSnapshot, /developments: snapshot\.developments/,
    "morning positions and attached episodes stay unchanged");
  assert.doesNotMatch(editionSnapshot, /overlay.*development|development.*overlay/i,
    "live evidence is never copied into frozen editorial card content");
  assert.match(editionSnapshot, /!appearedInAnyEarlierEdition\(candidate, previousEditions\)/,
    "the hourly breaking merge cannot reinsert a story from an earlier edition");
  assert.match(readoutEditionArchive, /priorEditions\(editionDate, \[\]\)/);
  assert.match(readoutEditionArchive, /mergeReadoutEditionSnapshot\(currentForArea, payload, now, previousForArea\)/);
  assert.match(readoutEditionArchive, /canonicalReadoutEditionSnapshot\(mergedByArea\)/);
  assert.match(readoutEditionArchive, /updateEditionRow\(merged, signal\)/);
});

test("the 7-day tab reads exact daily editions and never quota-fills", () => {
  assert.match(preview, /mode: "readout-window"/);
  assert.match(preview, /days: readoutWindowDays\(window\)/);
  assert.match(preview, /windowPayload\?\.editionHistory/);
  assert.match(preview, /windowPayload\?\.historyDays/);
  assert.match(preview, /sevenDayEditionDevelopments\(editionHistory\)/);
  assert.match(preview, /sevenDayEdition\.developments\.slice\(0, 5\)/,
    "the initial seven-day scan remains capped at five");
  assert.match(preview, /READOUT_WINDOWS\.map\(\(candidate\) => <button/,
    "the archive remains reachable while its first seven morning editions accumulate");
  assert.match(preview, /Showing \{historyDays\} daily edition/);
  assert.match(preview, /More from the last 7 days/);
  assert.match(preview, /aria-expanded=\{moreOpen\}/);
  assert.match(preview, /moreFromSevenDays\.map\(\(item\)/,
    "every remaining qualifying card is available after expansion");
  assert.doesNotMatch(preview, /moreFromSevenDays\.slice\(/,
    "the expanded remainder is not given another arbitrary cap");
  assert.match(preview, /const relevant = useMemo\(\(\) => readoutWindow === "7d"/,
    "the static Today-only Also Relevant slate does not compete with the seven-day remainder");
  assert.doesNotMatch(preview, /windowPayload\?\.fallbackWindowHours/,
    "no live payload can arm the 72-hour rescue note — the backend always returns null now");
  assert.match(preview, /todayEdition\?\.fallbackWindowHours === 72/,
    "a morning edition FROZEN before the cutover stays labeled for as long as it renders");
  assert.match(preview, /setLoadingWindow\(true\)/);
  assert.match(preview, /<ReadoutLoading \/>/);
  assert.match(preview, /const pageReady = !!windowPayload/);
  assert.doesNotMatch(preview, /setWindowPayload\(null\)/,
    "the current edition remains visible while another view loads");
  assert.match(preview, /kolSharers: windowed \? overlay\.windowClinicianCount : overlay\.kolSharers/,
    "the visible Shared by count is the edition window on Today and the seven-day count otherwise (decided 2026-09-12)");
  assert.doesNotMatch(preview, /\[\.\.\.todayDevelopments, \.\.\.SPECIALTY_FALLBACKS\]/);
  assert.doesNotMatch(preview, /archivedEditorialArticle/,
    "legacy shared-link archive cards no longer stand in for displayed morning editions");
  assert.match(preview, /sevenDayEditionListen\(editionHistory, currentWorth\)/,
    "Listen comes from the exact daily selections and retains featured episodes outside the top five");
  assert.match(briefingRoute, /"readout-window"/);
  assert.match(readoutServer, /readDurableCanonicalEdition\(\)/,
    "the one canonical daily edition is the source for every lens");
  assert.match(readoutServer, /readoutEditionForArea\(hydratedCanonicalCurrent, area\)/,
    "Today is a specialty filter over the canonical edition");
  assert.match(readoutServer, /readoutEditionForArea\(snapshot, area\)/,
    "each archived day is filtered through the same specialty lens");
  assert.match(readoutServer, /readoutEditionHistoryIncludingCurrent/);
  assert.match(preview, /payloadCache\.current\.get\(payloadKey\(area, "today"\)\)/,
    "the seven-day view includes the exact Today edition the reader just saw");
});

test("seven days starts with Today and replaces a stale copy of the same edition", () => {
  const snapshot = (editionDate, title) => ({
    schemaVersion: 2,
    editionDate,
    generatedAt: `${editionDate}T10:05:00.000Z`,
    area: "GU",
    developments: title ? [{ development: { id: title, title }, episode: null, position: 0 }] : [],
    relevant: [],
    listen: [],
    regulatoryCards: [],
    designationCards: [],
  });
  const current = snapshot("2026-08-27", "Current GU paper");
  const history = [
    snapshot("2026-08-27", null),
    ...[26, 25, 24, 23, 22, 21, 20].map((day) => snapshot(`2026-08-${day}`, `Paper ${day}`)),
  ];
  const merged = readoutEditionHistoryIncludingCurrent(current, history);

  assert.equal(merged.length, 7);
  assert.equal(merged[0], current);
  assert.equal(merged[0].developments[0].development.title, "Current GU paper");
  assert.deepEqual(merged.map((edition) => edition.editionDate), [
    "2026-08-27", "2026-08-26", "2026-08-25", "2026-08-24", "2026-08-23", "2026-08-22", "2026-08-21",
  ]);
  assert.deepEqual(
    readoutEditionHistoryIncludingCurrent(current, [snapshot("2026-08-25", "Paper 25"), snapshot("2026-08-20", "Paper 20")])
      .map((edition) => edition.editionDate),
    ["2026-08-27", "2026-08-25"],
    "a missing archive date stays missing instead of pulling in an eighth calendar day",
  );
});

test("a stale current edition cannot displace a durable three-by-three daily selection", () => {
  const article = (id) => ({ id, area: "All", title: `Title ${id}`, url: `https://example.com/${id}` });
  const snapshot = (editionDate, ids) => ({
    schemaVersion: 2,
    editionDate,
    generatedAt: `${editionDate}T10:05:00.000Z`,
    area: "All",
    developments: ids.slice(0, 3).map((id, position) => ({ development: article(id), episode: null, position })),
    relevant: ids.slice(3).map((id, position) => ({ article: article(id), position })),
    listen: [],
    regulatoryCards: [],
    designationCards: [],
  });
  const oldCurrent = snapshot("2026-09-08", ["old-1", "old-2", "old-3", "old-4", "old-5", "old-6"]);
  const durableToday = snapshot("2026-09-09", ["new-1", "new-2", "new-3", "new-4", "new-5", "new-6"]);
  const selected = readoutEditionForArea(durableToday, "All");

  assert.ok(selected);
  assert.equal(selected.developments.length, 3);
  assert.equal(selected.relevant.length, 3);
  assert.deepEqual(
    [...selected.developments.map((entry) => entry.development.id), ...selected.relevant.map((entry) => entry.article.id)],
    ["new-1", "new-2", "new-3", "new-4", "new-5", "new-6"],
  );
  assert.equal(selected.editionDate === oldCurrent.editionDate, false);
  assert.match(readoutServer, /const sourceSnapshots = canonicalSourceSnapshots\(rawAllToday, rawAllWeek \?\? rawAllToday\)/,
    "fresh source snapshots are isolated from the durable canonical selection");
  assert.match(readoutServer, /hydrateCanonicalDisplayFields\(canonicalCurrent, sourceSnapshots\)/,
    "fresh source copy may repair display fields without replacing the saved selection");
});

test("one complete canonical daily edition supplies every specialty lens without an admission cap", () => {
  const article = (id, area) => ({ id, area, title: `${area} ${id}`, url: `https://example.com/${id}` });
  const snapshot = (area, developments = [], relevant = []) => ({
    schemaVersion: 2,
    editionDate: "2026-08-29",
    generatedAt: "2026-08-29T10:05:00.000Z",
    area,
    developments: developments.map((development, position) => ({ development, episode: null, position })),
    relevant: relevant.map((item, position) => ({ article: item, position })),
    listen: [],
    regulatoryCards: [],
    designationCards: [],
  });
  const allLeads = ["GI", "Lung", "Breast", "Heme", "Gyn"].map((area, index) => article(`lead-${index + 1}`, area));
  const guStories = [1, 2, 3, 4, 5, 6, 7].map((id) => article(`gu-${id}`, "GU"));
  const cnsStory = { ...article("cns-1", "All"), site: "CNS" };
  const canonical = canonicalReadoutEditionSnapshot([
    snapshot("All", allLeads, [cnsStory]),
    snapshot("GU", guStories),
  ]);
  assert.ok(canonical);
  assert.equal(canonical.area, "All");
  assert.deepEqual(canonical.developments.map((entry) => entry.development.id), allLeads.map((item) => item.id));
  assert.deepEqual(canonical.relevant.map((entry) => entry.article.id), [cnsStory.id, ...guStories.map((item) => item.id)],
    "five higher-ranked All stories do not delete the displaced GU supply or the unsupported-area paper");

  const gu = readoutEditionForArea(canonical, "GU");
  assert.ok(gu);
  assert.deepEqual(gu.developments.map((entry) => entry.development.id), guStories.slice(0, 5).map((item) => item.id));
  assert.deepEqual(gu.relevant.map((entry) => entry.article.id), guStories.slice(5).map((item) => item.id),
    "all seven GU papers survive the specialty lens as five leads plus two under More");
  assert.equal(readoutEditionForArea(canonical, "GI").developments.some((entry) => entry.development.id === cnsStory.id), false);
  assert.equal(readoutEditionForArea(canonical, "Heme").developments.some((entry) => entry.development.id === cnsStory.id), false,
    "an unsupported-area paper does not leak into an unrelated specialty");
  const [sevenDayGu] = readoutEditionHistoryIncludingCurrent(gu, []);
  assert.deepEqual(
    [
      ...sevenDayGu.developments.map((entry) => entry.development),
      ...sevenDayGu.relevant.map((entry) => entry.article),
    ].map((item) => item.id),
    guStories.map((item) => item.id),
    "the exact daily archive and seven-day union retain every displaced specialty story",
  );
});

test("legacy fallback disclosure survives canonical consolidation and specialty projection", () => {
  const snapshot = (area, fallbackWindowHours) => ({
    schemaVersion: 2,
    editionDate: "2026-08-28",
    generatedAt: "2026-08-28T10:05:00.000Z",
    area,
    developments: [],
    relevant: [],
    listen: [],
    regulatoryCards: [],
    designationCards: [],
    fallbackWindowHours,
  });
  const canonical = canonicalReadoutEditionSnapshot([snapshot("All", null), snapshot("GU", 72)]);
  assert.equal(canonical?.fallbackWindowHours, 72);
  assert.equal(readoutEditionForArea(canonical, "GU")?.fallbackWindowHours, 72);
});

test("paper archive ranking uses the signed clinician weight", () => {
  const card = archiveCardForArticle({
    title: "Practice-changing paper",
    url: "https://doi.org/10.1000/readout",
    journal: "Journal of Oncology",
    domain: "example.org",
    doi: "10.1000/readout",
    pmid: null,
    peerReviewed: true,
    kolSharers: 4,
    publishedAt: "2026-08-28",
  });
  assert.ok(card);
  assert.equal(card.rankTotal, 40);
  assert.deepEqual(card.rankTrace.find((entry) => entry.input === "clinicianSharers"), {
    input: "clinicianSharers", value: 4, weight: 10, contribution: 40,
  });
});

test("Readout finding excerpts select results sections without inventing findings", () => {
  assert.equal(
    readoutFindingExcerpt("BACKGROUND: Context. RESULTS: OS improved. CONCLUSIONS: Benefit confirmed."),
    "OS improved. Benefit confirmed.",
  );
  assert.equal(
    readoutFindingExcerpt("BACKGROUND: Context. FINDINGS: Responses deepened. INTERPRETATION: Activity was durable. FUNDING: Sponsor."),
    "Activity was durable.",
  );
  assert.equal(readoutFindingExcerpt("Unstructured source prose stays intact."), "Unstructured source prose stays intact.");
  assert.equal(
    readoutFindingExcerpt("BACKGROUND: Context only. METHODS: Patients were enrolled."),
    "BACKGROUND: Context only. METHODS: Patients were enrolled.",
  );
});

// Drift pin for lib/readoutLeadFinding.ts, a mirror of the engine's abstractFindings. These are
// the exact sentences the engine chose for two real September 11 cards; if either changes here
// without changing in canvasmd/_shared/briefingCore.ts, Today and 7 days will open differently.
test("Readout cards lead with the same abstract sentence the engine picks", () => {
  const review = "Revolutions in transplantation and targeted and immune therapies have transformed multiple myeloma from a disease with an associated survival of a few years into one for which functional cure is an emerging goal. This abundance of effective therapies has created clinical complexity. Here we provide a practical framework, anchored in trial evidence and informed by emerging biologic discoveries, for the navigation of treatment decisions across the disease spectrum. We outline how cytogenetic and genomic risk stratification, functional fitness, and measurable residual disease status individualize therapy in newly diagnosed disease, in which quadruplet induction therapy is now standard and the role of autologous transplantation is being reevaluated. Regarding relapse, we address the sequencing of B-cell maturation antigen-directed chimeric antigen receptor (CAR) T cells, bispecific antibodies, and antibody-drug conjugates, emphasizing T-cell fitness and multiantigen targeting to counter exhaustion and antigen escape.";
  assert.equal(
    readoutFindingExcerpt(review),
    "We outline how cytogenetic and genomic risk stratification, functional fitness, and measurable residual disease status individualize therapy in newly diagnosed disease, in which quadruplet induction therapy is now standard and the role of autologous transplantation is being reevaluated.",
  );
  const structured = "IMPORTANCE: Geographic disparities in cancer clinical trial access are well described in the US.\nRESULTS: The study identified 436 bladder cancer trials across 713 US counties. A higher bladder cancer mortality rate was associated with lower trial rates (IRR, 0.80; 95% CI, 0.73-0.88).\nCONCLUSIONS AND RELEVANCE: In this cross-sectional study, most counties lacked trials.";
  assert.equal(
    readoutFindingExcerpt(structured),
    "A higher bladder cancer mortality rate was associated with lower trial rates (IRR, 0.80; 95% CI, 0.73-0.88).",
  );
});

test("archived and breaking papers retain reliable publication dates", () => {
  const archived = archivedEditorialArticle({
    area: "GU",
    card: {
      id: "paper:dated", kind: "paper", anchorId: "dated", headline: "Dated paper", why: "",
      sourceLabel: "Journal", url: "https://example.com/dated", excerpt: "RESULTS: Benefit.", excerptVerbatim: false,
      drugTags: [], nct: null, doi: null, eventId: null, siblings: [], rankTrace: [], rankTotal: 30, counts: {},
      support: { clinicianPosts: [], publisherPosts: [], otherPosts: [], links: [{
        id: "11111111-1111-1111-1111-111111111111", kind: "paper", title: "Dated paper",
        url: "https://example.com/dated", sourceLabel: "Journal", relationshipType: "primary_source",
        occurredAt: "2026-08-27",
      }] },
    },
    evidence: {}, firstSeen: "2026-08-28T12:00:00Z", lastSeen: "2026-08-28T12:00:00Z",
  });
  assert.equal(archived.occurredOn, "2026-08-27");

  const breaking = breakingEditorialArticle({
    id: "breaking:dated", kind: "paper", headline: "Breaking paper", sourceLabel: "Journal",
    url: "https://example.com/breaking", doi: null, pmid: "123", pubDate: "2026-08-29",
    areas: ["GU"], articleIds: ["22222222-2222-2222-2222-222222222222"], excerpt: null,
    excerptSourceLabel: "Journal", metrics: { clinicians: 3, cliniciansFeedEligible: 1, reposters: 0,
      totalSharers: 6, lastSharedAt: "2026-08-29T15:00:00Z", recentClinicians: 6, previousClinicians: 0 },
  }, "GU");
  assert.equal(breaking.occurredOn, "2026-08-29");
});

test("archived grouped cards preserve their explicit evidence IDs", () => {
  const supportId = "11111111-1111-1111-1111-111111111111";
  const groupedIds = [
    "22222222-2222-2222-2222-222222222222",
    "33333333-3333-3333-3333-333333333333",
    "22222222-2222-2222-2222-222222222222",
    "not-an-article-id",
  ];
  const card = {
    id: "paper:grouped", kind: "paper", anchorId: "grouped", headline: "Grouped papers", why: "",
    sourceLabel: "Journal", url: "https://example.com/grouped", excerpt: null, excerptVerbatim: false,
    drugTags: [], nct: null, doi: null, eventId: null, siblings: [], rankTrace: [], rankTotal: 30, counts: {},
    articleIds: groupedIds,
    support: { clinicianPosts: [], publisherPosts: [], otherPosts: [], links: [{
      id: supportId, kind: "paper", title: "Only one linked paper", url: "https://example.com/linked",
      sourceLabel: "Journal", relationshipType: "primary_source", occurredAt: null,
    }] },
  };
  const archived = archivedEditorialArticle({
    area: "GU", card, evidence: {}, firstSeen: "2026-09-12T12:00:00Z", lastSeen: "2026-09-12T12:00:00Z",
  });
  assert.deepEqual(archived.articleIds, groupedIds.slice(0, 2),
    "explicit grouped IDs are validated and deduplicated without rebuilding from support links");

  const snapshot = buildReadoutEditionSnapshot("All", {
    generatedAt: "2026-09-12T12:00:00Z", windowDays: 1, area: "All", cards: [], moreCards: [{
      area: "GU", card, evidence: {}, firstSeen: "2026-09-12T12:00:00Z", lastSeen: "2026-09-12T12:00:00Z",
    }], episodes: [], regulatoryCards: [], breakingCards: [], designationCards: [], overlays: [], candidateGeneratedAt: null,
  }, new Date("2026-09-12T12:00:00Z"));
  const canonical = canonicalReadoutEditionSnapshot([snapshot]);
  const canonicalArticle = canonical?.relevant.find(({ article }) => article.id === archived.id)?.article;
  assert.deepEqual(canonicalArticle?.articleIds, groupedIds.slice(0, 2),
    "canonical edition assembly retains every grouped evidence ID");
  assert.match(preview, /articleIds: item\.articleIds \?\? \[\],[\s\S]*?cards: \[card\]/,
    "the evidence-overlay request forwards every canonical article ID");

  const explicitEmpty = archivedEditorialArticle({
    area: "GU", card: { ...card, articleIds: [] }, evidence: {},
    firstSeen: "2026-09-12T12:00:00Z", lastSeen: "2026-09-12T12:00:00Z",
  });
  assert.deepEqual(explicitEmpty.articleIds, [], "an explicit empty evidence set is authoritative");

  const legacy = archivedEditorialArticle({
    area: "GU", card: (() => { const { articleIds, ...legacyCard } = card; return legacyCard; })(), evidence: {},
    firstSeen: "2026-09-12T12:00:00Z", lastSeen: "2026-09-12T12:00:00Z",
  });
  assert.deepEqual(legacy.articleIds, [supportId], "legacy cards still derive valid article IDs from support links");
});

test("seven-day edition history dedupes exact cards while preserving frozen daily position", () => {
  assert.match(editionSnapshot, /snapshots = \[\.\.\.history\]\.sort/);
  assert.match(editionSnapshot, /sameEditorialDevelopment\(existing\.development, entry\.development\)/);
  assert.match(editionSnapshot, /sameEditorialArticle\(existing\.article, entry\.article\)/);
  assert.match(editionSnapshot, /left\.position - right\.position \|\| right\.editionDate\.localeCompare\(left\.editionDate\)/,
    "daily editorial position ranks first and the newer edition breaks ties");
  assert.match(editionSnapshot, /snapshots\[0\]\?\.area !== "All" && developments\.length === 0 && uniqueRelevant\.length > 0/,
    "an archived specialty with no main story promotes its best qualifying relevant story");
  assert.match(editionSnapshot, /const \[lead\] = uniqueRelevant\.splice\(0, 1\)/);
  assert.match(editionSnapshot, /development: lead\.article/);
  assert.match(editionSnapshot, /entry\.episode/,
    "archived featured episodes retain their exact playable audio metadata");
  assert.match(editionSnapshot, /const displayedKeys = new Set/);
  assert.match(editionSnapshot, /editorialEpisodeIdentityKeys\(entry\.item, entry\.episode\)/);
  assert.match(editionSnapshot, /displayedKeys\.has\(key\) \|\| seen\.has\(key\)/,
    "a podcast already displayed in the top five is not repeated in Listen, even through an alternate URL");
});

test("a morning story does not repeat, while a prior midday insertion gets one next-day pass", () => {
  assert.match(editionSnapshot, /function appearedInMorningEdition/);
  assert.match(editionSnapshot, /const priorEditionDate = history\.reduce/);
  assert.match(editionSnapshot, /const middayIds = new Set\(snapshot\.middayInsertions \?\? \[\]\)/);
  assert.match(editionSnapshot, /snapshot\.editionDate === priorEditionDate && middayIds\.has\(match\.id\)/,
    "only an insertion from the immediately prior edition receives the one-morning exception");
  assert.match(editionSnapshot, /function appearedInAnyEarlierEdition/,
    "the hourly merge uses a stricter no-exception history gate");
  assert.match(editionSnapshot, /snapshot\.relevant\.some/);
  assert.ok((editionSnapshot.match(/filter\(\(item\) => !appearedInMorningEdition\(item, previousEditions\)\)/g) ?? []).length >= 2,
    "the no-repeat gate applies to both main stories and Also Relevant");
});

test("the canonical daily edition is DST-safe, idempotent, and service-only", () => {
  assert.match(readoutRequest, /timeZone: "America\/New_York"/);
  assert.match(readoutRequest, /hourCycle: "h23"/);
  assert.match(editionSnapshot, /developments: developments\.map/);
  assert.match(editionSnapshot, /relevant: relevant\.map/);
  assert.match(editionSnapshot, /listenItems\.map/);
  assert.match(readoutEditionArchive, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readoutEditionArchive, /kind: "edition"/);
  assert.match(readoutEditionArchive, /edition:v2:\$\{snapshot\.editionDate\}:All/);
  assert.match(readoutEditionArchive, /canonicalReadoutEditionSnapshot\(snapshots\)/,
    "the saved edition consolidates every specialty into one canonical day");
  assert.match(readoutEditionArchive, /resolution=ignore-duplicates/);
  assert.match(readoutEditionArchive, /etEditionHour\(now\) !== 6/);
  assert.match(readoutArchiveRoute, /archiveCurrentReadoutEdition/);
  assert.match(readoutArchiveRoute, /canonical-edition[\s\S]*?verify-all-today-reader/,
    "the 6am job freezes or reuses the dated edition before checking the bounded All reader path");
  assert.match(readoutArchiveRoute, /revalidateTag\(READOUT_WINDOW_CACHE_TAG\)/);
  assert.match(readoutArchiveRoute, /warmReadoutWindow\("All", "today", \{ freshSource: true, canonicalOnly: true, signal \}\)/);
  assert.match(readoutPrearchiveRoute, /prepublishCurrentReadoutEdition/);
  assert.doesNotMatch(readoutPrearchiveRoute, /warmReadoutWindowCache/,
    "prepublication must not promote a future edition into the reader cache");
  assert.match(readoutEditionArchive, /export async function prepublishCurrentReadoutEdition/);
  assert.match(readoutEditionArchive, /edition:v2:<today ET>:All/);
  assert.match(readoutEditionArchive, /fetchFreshReadoutWindowForPrepublication/);
  assert.match(readoutEditionArchive, /withReadoutSelectionVersion/);
  assert.match(vercelConfig, /"\/api\/readout-prearchive"/);
  assert.match(vercelConfig, /"0 9 \* \* \*"/);
  assert.match(vercelConfig, /"0 10 \* \* \*"/);
  assert.match(vercelConfig, /"5 9 \* \* \*"/);
  assert.match(vercelConfig, /"5 10 \* \* \*"/);
  assert.match(vercelConfig, /"0 10 \* \* \*"/);
  assert.match(vercelConfig, /"0 11 \* \* \*"/);
  assert.match(vercelConfig, /"5 10 \* \* \*"/);
  assert.match(vercelConfig, /"5 11 \* \* \*"/);
  assert.equal(activeReadoutEditionDate(new Date("2026-08-27T09:59:00Z")), "2026-08-26");
  assert.equal(activeReadoutEditionDate(new Date("2026-08-27T10:00:00Z")), "2026-08-27");
  assert.equal(activeReadoutEditionDate(new Date("2026-12-15T10:59:00Z")), "2026-12-14");
  assert.equal(activeReadoutEditionDate(new Date("2026-12-15T11:00:00Z")), "2026-12-15");
  assert.equal(readoutWindowKeyboardTarget("today", "ArrowRight"), "7d");
  assert.equal(readoutWindowKeyboardTarget("today", "ArrowDown"), "7d");
  assert.equal(readoutWindowKeyboardTarget("7d", "ArrowLeft"), "today");
  assert.equal(readoutWindowKeyboardTarget("7d", "ArrowUp"), "today");
  assert.equal(readoutWindowKeyboardTarget("7d", "Home"), "today");
  assert.equal(readoutWindowKeyboardTarget("today", "End"), "7d");
  assert.equal(readoutWindowKeyboardTarget("today", "Enter"), null);
  assert.match(readoutEditionArchive, /const editionDate = activeReadoutEditionDate\(now\)/,
    "the hourly merge keeps updating yesterday's frozen edition until the 6am replacement exists");
});

test("pre-6am preparation uses today's explicit edition date and only today's promoted source", () => {
  const now = new Date("2026-08-27T09:05:00Z"); // 05:05 ET
  assert.equal(activeReadoutEditionDate(now), "2026-08-26");
  assert.equal(prepublicationEditionDate(now), "2026-08-27",
    "prepublication must not inherit the public pre-6am date");
  assert.equal(scheduledReadoutSourceRunId(now), "scheduled-2026082706");
  assert.equal(hasScheduledReadoutSourceRun("scheduled-2026082706", now), true);
  assert.equal(hasScheduledReadoutSourceRun("scheduled-2026082606", now), false);
  assert.equal(hasScheduledReadoutSourceRun(null, now), false, "missing source provenance fails closed");
  const frozen = { schemaVersion: 2, area: "All", editionDate: "2026-08-27", selectionVersion: `readout-v1-${"a".repeat(64)}` };
  assert.equal(hasFrozenPrepublishedEdition(frozen, "2026-08-27"), true);
  assert.equal(hasFrozenPrepublishedEdition({ ...frozen, selectionVersion: null }, "2026-08-27"), false);
  assert.match(readoutEditionArchive, /MORNING_SOURCE_AREAS = EDITION_AREAS\.filter\(\(area\) => area !== "All"\)/,
    "source provenance is checked against the seven persisted specialty snapshots, not a nonexistent All row");
  assert.match(readoutEditionArchive, /const existing = await readEditionRow\(editionDate\);[\s\S]*?if \(validPrepublishedEdition\(existing, editionDate\)\)[\s\S]*?already-prepublished[\s\S]*?await assertScheduledMorningSource\(now\)/,
    "a retry returns the frozen canonical selection before reading fresh source data");
  assert.match(readoutEditionArchive, /if \(validPrepublishedEdition\(existing, editionDate\)\)[\s\S]*?skipped: "prepublished"/,
    "the 6am archive respects a valid prepublished canonical row");
});

test("the browser receives one server-cached payload and never refreshes evidence after paint", () => {
  assert.match(rootPage, /await getCachedReadoutWindow\("All", "today"\)/);
  assert.doesNotMatch(rootPage, /catch\(\(\) => null\)/);
  assert.match(rootPage, /initialPayload=\{initialPayload\}/);
  assert.match(preview, /useState<ReadoutWindowPayload \| null>\(initialPayload\)/);
  assert.match(preview, /body: JSON\.stringify\(\{ mode: "readout-window", area, days: readoutWindowDays\(window\) \}\)/);
  assert.doesNotMatch(preview, /cards: windowEvidenceTargets/);
  assert.match(preview, /payloadCache\.current\.get\(key\)/,
    "already visited tabs reuse their server-cached payload instead of flashing another skeleton");
  assert.match(preview, /\["All", "7d"\]/,
    "the most likely next view is prefetched after the initial paint");
  assert.match(preview, /EDITION_AREAS\.filter/,
    "specialty Today views prefetch in the background");
  assert.match(preview, /5 \* 60_000/);
  assert.match(preview, /visibilitychange/);
  assert.match(readoutServer, /unstable_cache/);
  assert.match(readoutServer, /READOUT_WINDOW_REVALIDATE_SECONDS = 60 \* 60/);
  assert.match(readoutServer, /READOUT_WINDOW_CACHE_TAG = "readout-window-v24"/);
  assert.match(readoutServer, /readout-window:finished:v7:\$\{area\}:\$\{window\}/,
    "each reader selection resolves to one finished prebuilt payload");
  assert.doesNotMatch(readoutServer, /fetchFinishedReadoutWindow/,
    "durable-edition validation runs outside the framework data cache on every reader request");
  assert.match(readoutServer, /const finished = await readFinishedWindow\(area, window\)/);
  // Codex's shadow work threaded an AbortSignal through the scheduled warmer's persistence
  // call (warmReadoutWindowCache), so the 4-arg form is now the one that runs per window.
  assert.match(readoutServer, /await persistFinishedWindow\(area, window, payload, options\.signal\)/,
    "the scheduled warmer writes all finished views before readers request them");
  assert.doesNotMatch(readoutServer, /posts: overlay\.posts\.slice\(0, 1\)/,
    "published comments remain available to guests in the bounded saved edition");
  assert.match(readoutServer, /readout-window:v6:\$\{area\}:\$\{window\}/,
    "a new atomic payload schema cannot reuse a legacy last-good window");
  assert.match(readoutServer, /kind=eq\.edition&area=eq\.All&order=last_seen\.desc/,
    "the seven-day reader window is reconstructed from persisted canonical All history");
  assert.match(readoutServer, /sameEditionVersion\(edition, durableForArea\)/);
  assert.match(readoutServer, /value\.updatedAt \?\? null\) === \(durable\.updatedAt \?\? null\)/,
    "an hourly insertion with the same morning generation time invalidates an old finished selection");
  assert.match(readoutServer, /!durable\.selectionVersion \|\| value\.selectionVersion === durable\.selectionVersion/,
    "legacy durable snapshots do not reject an otherwise matching hydrated source merely because they predate selectionVersion");
  assert.match(readoutServer, /withReadoutSelectionVersion[\s\S]*?readout-v1-/,
    "a durable fallback receives the Native-compatible public selection revision before it is persisted");
  assert.match(readoutServer, /if \(!isReadoutEditionSnapshot\(edition\) \|\| !edition\.selectionVersion\) return false/,
    "a finished v5 row from before revisions is rebuilt rather than remaining indefinitely accepted");
  assert.match(readoutServer, /sameSelectionMembership\(value, durable\)/,
    "a persisted reader selection must retain the durable membership");
  // "Preserve reviewed FDA source aliases across readers" (ed47af7) widened the match from a
  // plain id lookup to repairedSourceFor, which also matches by regulatory identity so an
  // aliased FDA source can still be found.
  assert.match(readoutServer, /sourceDisplayRepair\(entry\.development, repairedSourceFor\(entry\.development\), PAPER_DISPLAY_FIELDS\)/,
    "source repairs are field-only and matched by the frozen story id or its regulatory identity");
  assert.match(readoutServer, /tags: \[READOUT_WINDOW_CACHE_TAG\]/);
  assert.match(readoutServer, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(readoutServer, /SUPABASE_ANON_KEY/);
  assert.match(readoutServer, /key\.startsWith\("sb_"\)/);
  assert.match(readoutServer, /\? \{ apikey: key \}/,
    "opaque Supabase keys are sent only as API keys, never as bearer JWTs");
  assert.doesNotMatch(readoutServer, /readoutWindowEvidenceTargets/,
    "the live candidate payload does not fetch evidence for the retired static slate");
  assert.match(readoutServer, /persistLastGoodWindow/);
  assert.match(readoutServer, /cache write failed; serving fresh payload/,
    "a successful source read is not replaced by an older payload when persistence fails");
  assert.match(readoutServer, /readLastGoodWindow/);
  assert.match(readoutServer, /return \{ \.\.\.fallback, stale: true \}/);
  assert.match(readoutServer, /try \{[\s\S]*?buildFinishedReadoutWindow\(area, window,[\s\S]*?persistFinishedWindow\(area, window, payload, options\.signal\)[\s\S]*?catch \(error\)/,
    "one failed area is recorded without aborting the remaining cache warm");
  const postRoute = briefingRoute.slice(briefingRoute.indexOf("export async function POST"));
  assert.match(postRoute, /const key = process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
    "server-only Readout modes authenticate to the edge function with the service credential");
  assert.doesNotMatch(postRoute, /SUPABASE_ANON_KEY/);
  // "Instrument Readout rollover and persist private selection receipts" (5f9fcbc) wrapped
  // both calls in an abortable job.stage pipeline, so each now carries a signal.
  assert.match(readoutCacheRoute, /revalidateTag\(READOUT_WINDOW_CACHE_TAG\)/);
  assert.match(readoutCacheRoute, /warmReadoutWindowCache\(refreshOnly \? \{ freshSource: true, signal \} : \{ signal \}\)/);
  assert.match(readoutCacheRoute, /mergeCurrentReadoutEditionInsertions\(new Date\(\), signal\)/);
  assert.match(readoutCacheRoute, /if \(edition\.changed\)/,
    "an inserted midday card is included in the recached payload served to the next reader");
  assert.match(vercelConfig, /"\/api\/readout-cache"/);
  assert.match(vercelConfig, /"50 \* \* \* \*"/);
});

test("the live archive includes independently identified top articles, not company releases", () => {
  assert.match(heroPost, /for \(const article of r\.data\?\.topArticles \?\? \[\]\)/);
  assert.match(archiveCard, /article\.peerReviewed !== true && !article\.doi && !article\.pmid/);
  assert.match(heroPost, /archiveCardForArticle\(article\)/);
});

test("the daily archive reads every prior canonical edition before deduplicating", () => {
  assert.match(readoutEditionArchive, /readEditionRows\(\)/);
  assert.match(readoutEditionArchive, /snapshot\.editionDate < editionDate/);
  assert.match(readoutEditionArchive, /buildReadoutEditionSnapshot\([\s\S]*?previousForArea/);
});

test("preprints remain discoverable but cannot occupy lead-paper slots", () => {
  assert.match(editionSnapshot, /export function isPreprintEditorialArticle/);
  assert.match(editionSnapshot, /biorxiv\|medrxiv/);
  assert.match(editionSnapshot, /const leadRanked = ranked\.filter\(\(item\) => !isPreprintEditorialArticle\(item\)\)/);
  assert.doesNotMatch(editionSnapshot, /\["research", "guideline"\]\.includes\(item\.publicationClass\)/);
  assert.match(editionSnapshot, /const preprints = ranked\.filter\(\(item\) => !leadRanked\.includes\(item\)\)/);
  assert.match(editionSnapshot, /\.\.\.preprints,/,
    "preprints are demoted to Also Relevant rather than silently discarded");
});

test("an authenticated repair can deterministically replace a bad saved morning edition", () => {
  assert.match(readoutArchiveRoute, /req\.nextUrl\.searchParams\.get\("repair"\) === "1"/);
  assert.match(readoutArchiveRoute, /rebuildCurrentReadoutEdition\(new Date\(\), signal\)/);
  assert.match(readoutEditionArchive, /export async function rebuildCurrentReadoutEdition/);
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

test("cards use source-backed excerpts and visually separate the source from the title", () => {
  assert.match(edition, /const sourceFinding = card\.sourceExcerpt \|\| primaryDescription \|\| card\.excerpt \|\| ""/);
  assert.match(edition, /"From the abstract"/);
  assert.match(previewCss, /\.er-source \{[^}]*color: var\(--er-muted\)[^}]*font-family: inherit[^}]*font-weight: 450/);
});

test("expanding a paper replaces the concise finding with the full source abstract", () => {
  assert.match(preview, /expanded\s*\? cleanReadoutExcerpt\(expandedText \|\| text\)/);
  assert.match(preview, /const rawSourceText = item\.sourceExcerpt \|\| item\.finding/);
  assert.match(preview, /: articleSourceText\(readoutFindingExcerpt\(item\.finding \|\| rawSourceText\), cleanReadoutExcerpt\(rawSourceText\)\)/);
  assert.match(preview, /expandedText=\{source\.full\}/);
});

test("Listen cards use framed artwork and a full-width editorial audio row", () => {
  assert.match(preview, /<img className="er-listen-art" src=\{showArt\}/);
  assert.match(preview, /`er-listen-card\$\{showArt/);
  assert.match(preview, /className="er-listen-art-frame"/);
  assert.match(preview, /className="er-listen-show"/);
  assert.match(previewCss, /\.er-listen-card \{ display: grid; grid-template-columns: 104px minmax\(0, 1fr\); grid-template-areas: "art copy" "art audio"/);
  assert.match(previewCss, /\.er-listen-art-frame \{[^}]*border: 1px solid var\(--er-line\)[^}]*background: #f1efe9/);
  assert.match(previewCss, /\.er-listen-audio \{ grid-area: audio; min-width: 0; \}/);
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
    finding: "Legacy trial background that is not the FDA action copy.",
    sourceExcerpt: "FDA approved Ziihera for first-line treatment of adults with HER2-positive gastroesophageal cancer.",
    primarySources: [{
      id: "fda-release",
      kind: "article",
      title: "FDA approval announcement",
      url: "https://fda.gov/ziihera-approval-announcement",
      sourceLabel: "U.S. Food and Drug Administration",
      relationshipType: "primary_source",
      occurredAt: "2026-08-25T17:00:00Z",
    }],
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
  assert.equal(approval.finding, "FDA approved Ziihera for first-line treatment of adults with HER2-positive gastroesophageal cancer.");
  assert.equal(approval.sourceExcerpt, approval.finding);
  assert.equal(approval.findingLabel, "From U.S. Food and Drug Administration");
  assert.deepEqual(approval.primarySources?.map((link) => link.sourceLabel), ["U.S. Food and Drug Administration"]);
  assert.deepEqual(approval.supportingEvidence?.map((link) => link.sourceLabel), ["New England Journal of Medicine"]);
  assert.deepEqual(approval.relatedCoverage?.map((link) => link.sourceLabel), ["Targeted Oncology"]);
  assert.equal(approval.occurredOn, "2026-08-25");
  assert.match(preview, /const dateWord = isResearch \? "Published" : "Action date"/,
    "approval developments retain the regulator's action date");
  assert.match(preview, /<time dateTime=\{item\.occurredOn \?\? undefined\} title=/);
  assert.match(preview, /<time dateTime=\{designation\.occurredOn \?\? undefined\}>/);
  assert.match(preview, /designation\.dateLabel \?\? "First shared"/,
    "designation coverage never presents an X discovery date as an FDA action date");
  assert.match(previewCss, /\.er-action-date/);
  assert.match(previewCss, /\.er-regulatory-date/);
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
  // "Move Readout numbering above cards" (20bb34b) also threaded the active window down so
  // the lead's windowed evidence overlay can be applied.
  assert.match(preview, /<Development item=\{item\} briefs=\{briefs\} overlays=\{overlays\} numbered window=\{window\} \/>/);
  // "Complete Readout canonical publication contract" (e5da119) inserted a PRECLINICAL
  // tag between the scope label and the content-type suffix.
  assert.match(preview, /\{editorialScopeLabel\(item\)\}\{item\.studySetting === "preclinical" \? " · PRECLINICAL" : ""\}\{numbered \? "" : ` · \$\{contentType\}`\}/);
  assert.doesNotMatch(previewCss, /\.er-numbered-development \{[^}]*border-top/);
  assert.match(previewCss, /\.er-numbered-development > \.er-development \{[^}]*margin-top: 7px/);
  assert.doesNotMatch(preview, /<CompactDevelopment[^>]*position=/);
});

test("card kickers pair specialty with one reliable tumor focus", () => {
  assert.equal(readoutFocusLabel(["kidney"]), "Kidney");
  assert.equal(readoutFocusLabel(["myeloma"]), "Myeloma");
  assert.equal(readoutFocusLabel(["leukemia"]), "Leukemia");
  assert.equal(readoutFocusLabel(["melanoma"]), "Melanoma");
  assert.equal(readoutFocusLabel(["nsclc"]), "NSCLC");
  assert.equal(readoutFocusLabel(["kidney", "bladder"]), null,
    "a multi-focus story keeps the broader specialty label");
  assert.equal(editorialScopeLabel({ area: "GU", site: "Kidney" }), "GU");
  assert.equal(editorialScopeLabel({
    area: "GU",
    site: "GU",
    title: "Panitumumab-Based EGFR Blockade in SMARCB1-Deficient Renal Medullary Carcinoma",
  }), "GU", "a title cannot manufacture a kidney focus");
  assert.equal(editorialScopeLabel({ area: "Heme", site: "Myeloma" }), "Heme");
  assert.equal(editorialScopeLabel({ area: "Skin", site: "Skin", title: "Adjuvant nivolumab in melanoma" }), "Skin");
  assert.equal(editorialScopeLabel({ area: "Skin", site: "Skin", title: "Non-melanoma skin cancer incidence" }), "Skin");
  assert.equal(editorialScopeLabel({ area: "All", site: "GI" }), "Oncology");
  assert.equal(editorialScopeLabel({ area: "All", site: "GI", title: "Metastatic pancreatic cancer" }), "Oncology");
  assert.equal(editorialScopeLabel({ area: "GU", areas: ["GU"], subAreas: ["kidney"], site: "Oncology" }), "GU · Kidney");
});

test("explicit story areas drive every specialty lens without text inference", () => {
  const nection4 = { id: "breaking:2230ae59-4ab3-42ba-bbcc-d99d1a383253", area: "All", areas: ["GU"], title: "NECTIN4 urothelial carcinoma" };
  const camizestrant = { id: "regulatory:fded311c-201a-48a0-b000-90f075a5dc08", area: "All", areas: ["Breast"], title: "FDA grants accelerated approval to camizestrant" };
  const multiArea = { id: "multi", area: "All", areas: ["GU", "Breast"], title: "Shared trial" };
  const general = { id: "general", area: "All", areas: [], title: "Kidney cancer mentioned in an oncology-wide methods paper" };
  const explicitAllOnly = { id: "explicit-all-only", area: "GU", areas: [], title: "A kidney title cannot restore GU membership" };
  const legacy = { id: "legacy", area: "GU", title: "Legacy bladder item" };

  assert.deepEqual(editorialStoryAreas(nection4), ["GU"]);
  assert.equal(editorialBelongsToArea(nection4, "GU"), true);
  assert.equal(editorialBelongsToArea(nection4, "Breast"), false);
  assert.equal(editorialBelongsToArea(camizestrant, "Breast"), true);
  assert.deepEqual(visibleForArea([nection4, camizestrant, multiArea, general, legacy], "All").map((item) => item.id), [nection4.id, camizestrant.id, multiArea.id, general.id, legacy.id]);
  assert.deepEqual(visibleForArea([nection4, camizestrant, multiArea, general, explicitAllOnly, legacy], "GU").map((item) => item.id), [nection4.id, multiArea.id, legacy.id]);
  assert.deepEqual(visibleForArea([nection4, camizestrant, multiArea, general, legacy], "Breast").map((item) => item.id), [camizestrant.id, multiArea.id]);
  assert.equal(editorialBelongsToArea(general, "GU"), false, "an explicit empty array is All-only despite a kidney title");
  assert.equal(editorialBelongsToArea(explicitAllOnly, "GU"), false, "an explicit empty array overrides a contradictory legacy scalar");
  assert.deepEqual(editorialStoryAreas(legacy), ["GU"], "a legacy scalar remains a narrow compatibility fallback");
  assert.equal(editorialScopeLabel({ ...general, site: "GU", subAreas: [] }), "Oncology", "labels use explicit membership, not title or site text");
});

test("mixed source payloads and canonical dedupe retain, rather than invent, membership", () => {
  const snapshotSource = read("app/briefing-preview/editionSnapshot.ts");
  assert.match(snapshotSource, /liveInsertionDevelopments\(payload: ReadoutWindowPayload, area: EditionArea\)/);
  assert.match(snapshotSource, /editorialBelongsToArea\(item, area\)/);

  const snapshot = (area, article, listen = []) => ({
    schemaVersion: 2, editionDate: "2026-09-11", generatedAt: "2026-09-11T12:00:00.000Z", area,
    developments: article ? [{ development: article, episode: null, position: 0 }] : [], relevant: [], listen,
    regulatoryCards: [], designationCards: [],
  });
  const legacyAll = { id: "shared", area: "All", title: "shared" };
  const specialtyProof = { id: "shared", area: "GU", areas: ["GU", "Breast"], title: "shared" };
  const explicitAllOnly = { id: "all-only", area: "All", areas: [], title: "all-only" };
  const conflictingSpecialty = { id: "all-only", area: "GU", areas: ["GU"], title: "all-only" };
  const listenItem = { id: "episode:multi", area: "All", areas: ["GU", "Breast"], show: "Podcast", title: "Multi-area listen", url: "https://example.com/audio", hook: "", match: "Multi-area" };
  const allSnapshot = snapshot("All", legacyAll, [{ item: listenItem, episode: null }]);
  allSnapshot.relevant = [{ article: explicitAllOnly, position: 0 }];
  const canonical = canonicalReadoutEditionSnapshot([
    allSnapshot,
    snapshot("GU", specialtyProof),
    snapshot("Breast", conflictingSpecialty),
  ]);
  assert.deepEqual(canonical?.developments.find((entry) => entry.development.id === "shared")?.development.areas, ["GU", "Breast"]);
  assert.deepEqual(canonical?.relevant.find((entry) => entry.article.id === "all-only")?.article.areas, [], "explicit All-only must not be overwritten by a specialty copy");
  assert.equal(readoutEditionForArea(canonical, "GU")?.listen.length, 1);
  assert.equal(readoutEditionForArea(canonical, "Breast")?.listen.length, 1);
  const regulatory = { id: "regulatory:breast", kind: "event", regulatoryKind: "approval", eligibleLabel: "FDA approval", headline: "Breast approval", sourceLabel: "FDA", url: "https://example.com/fda", occurredOn: "2026-09-11", areas: ["Breast"], articleIds: [], metrics: { clinicians: 1, cliniciansFeedEligible: 1, reposters: 0, totalSharers: 1, lastSharedAt: null } };
  assert.equal(regulatoryWatchArticles([regulatory], "GU", []).length, 0);
  assert.equal(regulatoryWatchArticles([regulatory], "Breast", []).length, 1);
});

test("canonical Today and seven-day projections preserve explicit specialty membership", () => {
  const nection4 = { id: "breaking:2230ae59-4ab3-42ba-bbcc-d99d1a383253", area: "All", areas: ["GU"], title: "NECTIN4" };
  const camizestrant = { id: "regulatory:fded311c-201a-48a0-b000-90f075a5dc08", area: "All", areas: ["Breast"], title: "camizestrant" };
  const canonical = {
    schemaVersion: 2,
    editionDate: "2026-09-11",
    generatedAt: "2026-09-11T12:00:00.000Z",
    area: "All",
    developments: [{ development: nection4, episode: null, position: 0 }],
    relevant: [{ article: camizestrant, position: 0 }],
    listen: [],
    regulatoryCards: [],
    designationCards: [],
  };
  assert.deepEqual(readoutEditionForArea(canonical, "GU")?.developments.map((entry) => entry.development.id), [nection4.id]);
  assert.deepEqual(readoutEditionForArea(canonical, "Breast")?.developments.map((entry) => entry.development.id), [camizestrant.id]);
  assert.deepEqual(readoutEditionForArea(canonical, "Lung")?.developments, []);
});

test("legacy midday ids never displace saved leads or promote added relevant cards", () => {
  const article = (id, area = "GU") => ({ id, area: "All", areas: [area], title: id, url: `https://example.com/${id}` });
  const nection4 = article("NECTIN4");
  const morningRelevant = article("morning-relevant");
  const added = article("added-after-morning");
  const canonical = {
    schemaVersion: 2,
    editionDate: "2026-09-11",
    generatedAt: "2026-09-11T12:00:00.000Z",
    area: "All",
    developments: [{ development: nection4, episode: null, position: 0 }],
    relevant: [{ article: morningRelevant, position: 0 }, { article: added, position: 1 }],
    listen: [], regulatoryCards: [], designationCards: [],
    middayInsertions: [nection4.id, added.id],
  };
  const gu = readoutEditionForArea(canonical, "GU");
  assert.deepEqual(gu?.developments.map((entry) => entry.development.id), [nection4.id, morningRelevant.id]);
  assert.deepEqual(gu?.relevant.map((entry) => entry.article.id), [added.id]);
  assert.deepEqual(gu?.middayInsertions, [added.id]);
  assert.match(preview, /return todayEdition\.relevant\.map\(\(entry\) => entry\.article\)/,
    "only saved relevant entries can render in Added since morning");
  assert.doesNotMatch(preview, /developments\.map\(\(entry\) => entry\.development\)\n      \.filter\(\(item\) => !todayEdition\.middayInsertions/,
    "saved lead order is never filtered by a legacy midday log");
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
  assert.match(editionSnapshot, /sameArticleDevelopment\(item, lead\)/);
});

test("cards use explicit previews and meaningful disclosure at every viewport", () => {
  assert.match(preview, /articleTextPreview\(cleanReadoutExcerpt\(text\), LEAD_SENTENCE_CHARS\)/);
  assert.match(preview, /expansion\.canExpand \|\| hasMoreLinks/);
  assert.match(preview, /Full source excerpt/);
  // SourceHeadline lives in the shared ReadoutArticleCard/ReadoutSourceHeadline components now.
  assert.match(readoutArticleCard, /function ReadoutArticleCard/);
  assert.match(readoutArticleCard, /er-source-headline/);
  assert.match(readoutSourceHeadline, /rel="noreferrer">\{title\}<\/a>/);
  assert.doesNotMatch(preview, /↗/);
  assert.doesNotMatch(preview, /er-provenance|From the source/);
  assert.doesNotMatch(previewCss, /\.er-provenance/);
  assert.match(preview, /er-peers-who/);
  assert.doesNotMatch(previewCss, /\.er-finding\.is-collapsed/);
  assert.match(preview, /scrollIntoView\(\{ block: "start", behavior: "auto" \}\)/);
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
  assert.match(preview, /<ReadoutArticleCard[\s\S]{0,120}href=\{sourceHref\}\s+source=\{episode\?\.show \|\| item\.show\}\s+title=\{episode\?\.title \|\| item\.title\}/);
  assert.match(previewCss, /--er-paper: #F7F6F2/);
  assert.match(previewCss, /--er-soft: #fbfaf7/);
});

test("reading columns stay centered with a compact accessible specialty dropdown", () => {
  assert.match(preview, /<header className="er-header">/);
  assert.match(previewCss, /\.er-page \{[^}]*max-width: 720px;[^}]*margin: 0 auto;[^}]*padding: 0 0 56px/);
  assert.match(previewCss, /\.er-header \{[^}]*grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.doesNotMatch(preview, /er-edition-meta|Past 7 days|Last 24h/,
    "the window picker is the single masthead signal for Today versus 7 days");
  assert.match(preview, /<select className="er-specialty-select" aria-label="Specialty"/);
  assert.match(preview, /EDITION_AREAS\.map\(\(candidate\) => <option/);
  assert.match(previewCss, /\.er-worth \{[^}]*margin-inline: auto/);
  assert.match(previewCss, /\.er-relevant \{[^}]*margin: 16px auto 0/);
  assert.match(previewCss, /\.er-specialty-picker \{[^}]*max-width: 190px/);
  assert.match(previewCss, /\.er-picker select \{[^}]*min-height: 44px/);
  assert.match(previewCss, /\.er-worth > \.er-section-title \{[^}]*flex-wrap: wrap/);
  assert.match(previewCss, /\.er-readout-heading \{[^}]*flex-wrap: wrap/);
});

test("archived cards do not render boilerplate as an editorial takeaway", () => {
  assert.match(edition, /ARCHIVED_TAKEAWAY_FALLBACK/);
  assert.doesNotMatch(preview, /<strong>Key takeaway:<\/strong>/);
  assert.match(preview, /No additional \$\{area === "All" \? "oncology" : AREA_LABELS\[area\]\.toLowerCase\(\)\} approval/);
  assert.match(preview, /\]\.filter\(Boolean\)\.join\(" · "\) \|\| regulatoryCoverage\.status/);
  assert.match(preview, /className="er-regulatory-empty">\{regulatoryCoverage\.hasPublished/);
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

test("web Readout uses the native-parity clinician cleaner", () => {
  assert.equal(
    cleanClinicianText("RT @drenriquegrande: ⚡ IBCG changes practice https://t.co/example\n@EuropeanUrology #BladderCancer"),
    "⚡ IBCG changes practice",
  );
  assert.equal(cleanClinicianText("Benefit seen in HER2 disease #BreastCancer"), "Benefit seen in HER2 disease #BreastCancer");
});

test("web Readout canonical identity removes tracking and joins episode aliases", () => {
  assert.equal(
    canonicalEditorialUrl("https://www.example.com/paper/?utm_source=x&ref=home#results"),
    "https://example.com/paper",
  );
  const article = (url, title) => ({ id: url, url, title, match: {}, area: "GU" });
  assert.equal(
    sameEditorialArticle(
      article("https://example.com/paper?utm_source=x", "A study of PSMA-617"),
      article("https://www.example.com/paper?ref=feed", "A study of PSMA 617"),
    ),
    true,
  );
  const episode = (id, audioUrl, title = "Casdatifan Clinical Data in RCC") => ({
    id,
    kind: "episode",
    area: "GU",
    title,
    hook: title,
    show: "The Uromigos",
    url: `https://example.com/${id}`,
    audioUrl,
  });
  assert.equal(
    sameEditorialDevelopment(
      episode("episode-517", "https://cdn.example.com/517.mp3?utm_source=rss"),
      episode("rss-copy", "https://cdn.example.com/517.mp3"),
    ),
    true,
  );
});

test("the canonical Readout owns the root while the retired canary redirects", () => {
  assert.match(rootPage, /EditorialReadout/);
  assert.match(rootPage, /getCachedReadoutWindow\("All", "today"\)/);
  assert.match(rootPage, /canonical: "https:\/\/briefing\.canvasmd\.io\/"/);
  assert.match(rootPage, /robots: \{ index: true, follow: true \}/);
  assert.match(readoutNextPage, /permanentRedirect\("\/"\)/);
  assert.doesNotMatch(readoutNextPage, /EditorialReadout|getCachedReadoutWindow/);
  assert.match(legacyPage, /export default function LegacyBriefingPage/);
  assert.match(legacyPage, /ReaderView/);
  assert.doesNotMatch(rootPage, /LegacyBriefingPage|ReaderView/);
  assert.doesNotMatch(middleware, /readout-next/);
});

test("the briefing is editorial rather than a repackaged catalog", () => {
  assert.match(preview, /CanvasMdLogo/);
  assert.match(preview, /aria-label="CanvasMD"/);
  assert.match(preview, /<h2>The Readout<\/h2>/);
  assert.match(preview, /<p className="er-readout-dek">The papers, approvals, and episodes oncology clinicians are sharing\.<\/p>/);
  assert.match(previewCss, /\.er-readout-dek \{[^}]*font-size: 13px/);
  assert.match(preview, /candidate === "today" \? "Today" : "7 days"/);
  assert.doesNotMatch(preview, /This week/);
  assert.doesNotMatch(preview, /<h1>The Readout<\/h1>/);
  assert.doesNotMatch(preview, /Key Developments/);
  assert.doesNotMatch(preview, /Today's Readout/);
  assert.doesNotMatch(preview, />Worth Your Time</);
  assert.match(preview, /More to read/);
  assert.match(preview, />Listen</);
  assert.match(preview, /Regulatory Watch/);
  assert.match(preview, /No development cleared the bar/);
  assert.match(preview, /readoutWindow === "today" && area !== "All"/);
  assert.match(preview, /Nothing new cleared the bar in \{AREA_LABELS\[area\]\} today\./);
  assert.match(preview, /onClick=\{\(\) => chooseWindow\("7d"\)\}>See the last 7 days/);
  assert.match(previewCss, /\.er-empty-history \{[^}]*min-height: 44px/);
  assert.doesNotMatch(preview, />Papers<|>Trials<|>People<|>Drugs</);
  assert.doesNotMatch(preview, /CANVASMD/);
  assert.match(previewCss, /--er-accent: #9b451f/);
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
  // The "All" special-case now lives inside editorialBelongsToArea itself (storyMembership.js),
  // so every area filter — including "All" — routes through one filter(...) call.
  assert.match(edition, /items\.filter\(\(item\) => editorialBelongsToArea\(item, area\)\)/);
  assert.match(edition, /SPECIALTY_FALLBACKS/);
  // A quiet specialty day stays quiet (72h rescue removed 2026-08-29): the honest empty
  // state names the area and routes to the 7-day view rather than widening the window.
  assert.doesNotMatch(preview, /Showing the strongest qualifying development from the past 72 hours/);
  assert.match(preview, /Nothing new cleared the bar in \{AREA_LABELS\[area\]\} today\./);
  assert.match(preview, /See the last 7 days/);
});

test("All can carry oncology-wide developments without leaking them into specialty tabs", () => {
  const oncologyWide = { id: "tumor-agnostic-safety", area: "All", title: "Tumor-agnostic safety warning" };
  const lung = { id: "lung-paper", area: "Lung", title: "Lung paper" };
  const items = [oncologyWide, lung];
  assert.deepEqual(visibleForArea(items, "All").map((item) => item.id), ["tumor-agnostic-safety", "lung-paper"]);
  assert.deepEqual(visibleForArea(items, "Lung").map((item) => item.id), ["lung-paper"]);
  assert.deepEqual(visibleForArea(items, "GU").map((item) => item.id), []);
  assert.match(edition, /type EditorialArea = SpecialtyArea \| "All"/);
  assert.match(edition, /areas\?: SpecialtyArea\[\]/);
  assert.match(edition, /editorialBelongsToArea\(item, area\)/);
});

test("a transcript-supported episode can lead a specialty without duplicating Listen", () => {
  assert.match(edition, /FEATURED_EPISODES/);
  assert.match(edition, /Systemic Treatment of Ovarian Cancer Recurrence/);
  assert.match(preview, /EpisodeDevelopment/);
  assert.match(preview, /<EpisodeDevelopment item=\{item\} briefs=\{briefs\} overlays=\{overlays\}/,
    "promoted podcasts receive the same evidence overlay map as article leads");
  assert.match(preview, /episodeId: item\.episodeId/,
    "expanded podcast evidence is requested by the stable episode id");
  assert.match(preview, /<PeerRow article=\{article\} sharedBy=\{sharedBy\}/,
    "promoted podcasts show clinician avatars, counts, and names");
  assert.match(preview, /<PhysicianVoices article=\{article\} sharedBy=\{sharedBy\}/,
    "promoted podcasts use the article commentary receipt treatment");
  assert.match(preview, /AudioQuote/);
  assert.match(preview, /audioUrl=\{audioUrl\}/);
  assert.match(preview, /eventLabel=\{title\}/);
  assert.match(preview, /Episode page/);
  assert.match(preview, /Listen here/);
  assert.match(preview, /sevenDayEditionListen\(\[todayEdition\], currentWorth\)/);
  assert.doesNotMatch(preview, /listenForArea/);
  assert.match(preview, /episode\?\.audioUrl \?\? item\.audioUrl \?\? null/,
    "a promoted episode keeps its player after the backend removes it from Listen");
  assert.match(preview, /episode\?\.episodeId \?\? item\.episodeId \?\? item\.id/);
  assert.match(preview, /Specialty lead selected from the 72-hour Listen window\./);
});

test("podcast Listen holds use exact show titles and preserve episode metadata", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const briefing = brief("GU", [
    episode("The Uromigos", "Episode 516: The Influence of Hypoxia on Response and Resistance in RCC", "2026-08-24T16:00:00Z", "https://uromigos.example/516"),
    episode("The Uromigos Extra", "Episode 517: The Influence of Hypoxia on Response and Resistance in RCC", "2026-08-24T17:00:00Z"),
  ]);
  const listen = listenForArea([briefing], "GU", [], now);
  assert.deepEqual(listen.map((item) => item.show), ["The Uromigos"]);
  assert.equal(listen[0].title, "Episode 516: The Influence of Hypoxia on Response and Resistance in RCC");
  assert.equal(listen[0].hook, listen[0].title);
  assert.equal(listen[0].url, "https://uromigos.example/516");
});

test("saved Listen cards retain archived media without becoming timeless selections", () => {
  for (const item of ARCHIVED_LISTEN_MEDIA) {
    assert.ok(item.episodeId);
    assert.ok(item.showArt);
    assert.ok(item.audioUrl);
    assert.ok(item.durationSeconds);
  }
  assert.match(preview, /episode\?\.showArt \?\? item\.showArt \?\? archivedMedia\?\.showArt/);
  assert.match(preview, /episode\?\.audioUrl \?\? item\.audioUrl \?\? archivedMedia\?\.audioUrl/);
  assert.match(preview, /audioUrl=\{audioUrl\}/);
});

test("cross-specialty podcast holds route by episode area only", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const breast = brief("Breast", [
    episode("The Lancet Oncology in conversation with", "Tumour-infiltrating lymphocytes in breast cancer with Professor Sherene Loi", "2026-08-24T21:30:00Z"),
  ]);
  assert.equal(listenForArea([breast], "Breast", [], now).length, 1);
  assert.equal(listenForArea([breast], "GU", [], now).length, 0);
  assert.equal(listenForArea([breast], "All", [], now).length, 1);
});

test("Healthcare Unfiltered is held on All and only on an explicitly assigned specialty", () => {
  const now = new Date("2026-09-02T12:00:00Z");
  const general = brief("All", [
    episode("Healthcare Unfiltered", "How AI Helps Logistics in Oncology", "2026-09-01T12:00:00Z"),
  ]);
  assert.deepEqual(listenForArea([general], "All", [], now).map((item) => item.title), [
    "How AI Helps Logistics in Oncology",
  ]);
  assert.deepEqual(listenForArea([general], "GU", [], now), []);

  const heme = brief("Heme", [
    episode("Healthcare Unfiltered", "Cell therapy logistics", "2026-09-01T13:00:00Z"),
  ]);
  assert.deepEqual(listenForArea([heme], "Heme", [], now).map((item) => item.title), [
    "Cell therapy logistics",
  ]);
  assert.deepEqual(listenForArea([heme], "GU", [], now), []);
  assert.deepEqual(listenForArea([heme], "All", [], now).map((item) => item.title), [
    "Cell therapy logistics",
  ]);
});

test("podcast Listen holds expire after 72 hours", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const heme = brief("Heme", [
    episode("Blood Podcast", "Balancing Infection and Thrombosis: Bispecific Antibodies and the Many Roles of HRG", "2026-08-22T15:59:59Z"),
  ]);
  assert.deepEqual(listenForArea([heme], "Heme", [], now), []);
});

test("new Listen selections require a current timestamped episode and never fall back to archived media", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const breast = brief("Breast", [
    episode("The Lancet Oncology in conversation with", "Eligible breast episode", "2026-08-24T16:01:00Z"),
    episode("The Lancet Oncology in conversation with", "Expired breast episode", "2026-08-22T15:59:59Z"),
    episode("The Lancet Oncology in conversation with", "Future breast episode", "2026-08-25T16:00:01Z"),
    episode("The Lancet Oncology in conversation with", "Undated breast episode", "not-a-date"),
  ]);
  assert.deepEqual(listenForArea([breast], "All", [], now).map((item) => item.title), ["Eligible breast episode"]);
  assert.deepEqual(listenForArea([], "All", [], now), [], "archived media must not enter a new Today selection");
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
  assert.deepEqual(listenForArea([gu], "GU", [], now).map((item) => item.title), ["Newest prostate cancer sequencing", "New prostate guidelines"]);
  assert.equal(listenForArea([gu, breast], "All", [], now).length, 3);
});

test("podcast holds do not become lead developments without transcript support", () => {
  const now = new Date("2026-08-25T16:00:00Z");
  const gyn = brief("Gyn", [
    episode("ASCO Guidelines", "Systemic Treatment of Ovarian Cancer Recurrence: ASCO Living Guideline 2026.1.0", "2026-08-24T20:00:00Z"),
  ]);
  const listen = listenForArea([gyn], "Gyn", FEATURED_EPISODES, now);
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
  assert.deepEqual(listenForArea([gu], "GU", [], now), []);
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
