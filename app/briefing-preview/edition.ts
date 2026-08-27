import type { BriefingArticle, BriefingData, BriefingEpisode, BriefingPaper, HeroSupportLink, ReadoutArchivedCard, ReadoutArchivedCardSummary, ReadoutBreakingCandidate, ReadoutRegulatoryCandidate } from "@/lib/types";

export const EDITION_AREAS = ["All", "GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"] as const;
export type EditionArea = (typeof EDITION_AREAS)[number];
export type SpecialtyArea = Exclude<EditionArea, "All">;
export type EditorialArea = SpecialtyArea | "All";

export type EditorialArticle = {
  id: string;
  area: EditorialArea;
  site: string;
  nickname: string;
  takeaway: string;
  finding: string;
  findingSource?: "source" | "summary";
  findingLabel?: string;
  remember: string;
  journal: string;
  title: string;
  url: string;
  evidence: string;
  sharedBy: number;
  match: { doi?: string; pmid?: string; titleIncludes?: string };
  articleIds?: string[];
  sourceAction?: string;
  primarySources?: HeroSupportLink[];
  supportingEvidence?: HeroSupportLink[];
  relatedCoverage?: HeroSupportLink[];
  occurredOn?: string | null;
};

export type EditorialEpisode = {
  id: string;
  area: SpecialtyArea;
  hook: string;
  show: string;
  title: string;
  url: string;
  match: string;
};

export type EditorialEpisodeFeature = EditorialEpisode & {
  kind: "episode";
  site: string;
  nickname: string;
  finding: string;
  remember: string;
  evidence: string;
};

export type EditorialDevelopment = EditorialArticle | EditorialEpisodeFeature;

const LISTEN_HOLD_HOURS = 72;
const SPECIALTY_HELD_EPISODE_CAP = 2;
const ALL_LISTEN_CAP = 3;

const CORE_LISTEN_HOLD_SHOWS: Record<SpecialtyArea, string[]> = {
  GU: ["The Uromigos", "GU Cast | Urology Podcast"],
  Lung: ["Lung Cancer Considered"],
  Heme: ["Blood Podcast"],
  Breast: ["The Breast Friends Podcast"],
  Skin: ["Melanoma Matters"],
  GI: [],
  Gyn: [],
};

const CROSS_SPECIALTY_LISTEN_HOLD_SHOWS = [
  "The Lancet Oncology in conversation with",
  "ASCO Guidelines",
  "Oncology Brothers: Practice-Changing Cancer Discussions",
];

const EXCLUDED_LISTEN_HOLD_SHOWS = [
  "Oncology Today with Dr Neil Love",
  "Research To Practice | Oncology Videos",
  "OncLive® On Air",
  "PeerView Oncology & Hematology CME/CNE/CPE Audio Podcast",
  "Two Onc Docs",
  "BackTable Urology",
  "BackTable Tumor Board",
  "AUAUniversity",
  "Lymphoma Hub",
];

const CONDITIONAL_GU_SHOW = "Oncology Insights with Petros Grivas";
const CONDITIONAL_HEALTHCARE_UNFILTERED_SHOW = "Healthcare Unfiltered";

const SPECIALTY_TITLE_CUES: Record<SpecialtyArea, RegExp> = {
  GU: /\b(prostate|bladder|urothelial|renal|kidney|rcc|testicular|gu)\b/i,
  Lung: /\b(lung|nsclc|sclc|alk|egfr)\b/i,
  Heme: /\b(myeloma|leukemia|lymphoma|aml|cll|heme|haematolog|hematolog|celmod)\b/i,
  Breast: /\b(breast|her2|er-positive|hr-positive|tnbc)\b/i,
  Skin: /\b(melanoma|skin|cutaneous)\b/i,
  GI: /\b(gi|colorectal|rectal|colon|pancrea|gastric|esophageal|hepatocellular|liver|biliary)\b/i,
  Gyn: /\b(ovarian|endometrial|cervical|gynecologic|gyn)\b/i,
};

export const WORTH_YOUR_TIME: EditorialArticle[] = [
  {
    id: "harmoni",
    area: "Lung",
    site: "Lung",
    nickname: "HARMONi",
    takeaway: "A PFS win after third-generation EGFR-TKI treatment; survival is still open.",
    finding: "Ivonescimab plus chemotherapy improved PFS after EGFR-TKI progression (6.8 versus 4.4 months; HR 0.52, p<0.0001). Overall survival was 16.8 versus 14.0 months (HR 0.79) and was not statistically significant.",
    remember: "This is a PFS result after EGFR-TKI progression; OS remains unproven.",
    journal: "The Lancet Oncology",
    title: "Ivonescimab plus chemotherapy versus placebo plus chemotherapy in patients with advanced EGFR-mutated non-small-cell lung cancer after disease progression on EGFR tyrosine kinase inhibitor therapy (HARMONi): a multicentre, randomised, double-blind, phase 3 trial",
    url: "https://doi.org/10.1016/S1470-2045(26)00282-2",
    evidence: "Phase 3",
    sharedBy: 0,
    match: { doi: "10.1016/s1470-2045(26)00282-2", pmid: "42636833", titleIncludes: "Ivonescimab plus chemotherapy versus placebo" },
  },
  {
    id: "getug-afu-18",
    area: "GU",
    site: "Prostate",
    nickname: "GETUG AFU 18",
    takeaway: "Dose escalation improved long-term disease control with similar late severe toxicity.",
    finding: "With long-term ADT, 80 Gy improved 10-year PFS versus 70 Gy (83.6% versus 72.2%; HR 0.56, p<0.0001). Late grade 3 or worse toxicity was similar (8% versus 7%); an overall-survival benefit has not been shown.",
    remember: "Escalate dose for disease control; do not promise a survival benefit.",
    journal: "The Lancet Oncology",
    title: "High-dose radiotherapy in patients with high-risk prostate cancers treated with long-term androgen deprivation therapy (GETUG AFU 18): a randomised, phase 3 trial",
    url: "https://doi.org/10.1016/S1470-2045(26)00277-9",
    evidence: "Phase 3",
    sharedBy: 0,
    match: { doi: "10.1016/s1470-2045(26)00277-9", pmid: "42636837", titleIncludes: "GETUG AFU 18" },
  },
  {
    id: "emerald-3",
    area: "GI",
    site: "Liver",
    nickname: "EMERALD-3",
    takeaway: "STRIDE plus TACE improved PFS; adding lenvatinib did not establish an OS gain.",
    finding: "STRIDE plus lenvatinib and TACE improved PFS versus TACE alone (13.0 versus 9.8 months; HR 0.70, p=0.0007), but OS was not significantly different (39.5 versus 34.7 months; HR 0.84, p=0.18). STRIDE plus TACE also improved PFS (12.9 versus 8.1 months; HR 0.71).",
    remember: "The signal is PFS, not OS; lenvatinib did not prove a survival gain.",
    journal: "The Lancet Oncology",
    title: "Durvalumab and tremelimumab, with or without lenvatinib, combined with transarterial chemoembolisation in participants with embolisation-eligible hepatocellular carcinoma (EMERALD-3): a global, randomised, open-label, sponsor-blinded, phase 3 study",
    url: "https://doi.org/10.1016/S1470-2045(26)00278-0",
    evidence: "Phase 3",
    sharedBy: 0,
    match: { doi: "10.1016/s1470-2045(26)00278-0", pmid: "42636832", titleIncludes: "embolisation-eligible hepatocellular carcinoma" },
  },
];

export const FEATURED_EPISODES: EditorialEpisodeFeature[] = [
  {
    id: "ovarian-guideline",
    kind: "episode",
    area: "Gyn",
    site: "Ovary",
    nickname: "ASCO Living Guideline",
    hook: "A living guideline gives ovarian recurrence a durable treatment backbone.",
    finding: "ASCO released its first living guideline dedicated to systemic treatment after ovarian cancer recurrence, covering both platinum-sensitive and platinum-resistant disease. The episode is a practical route into the recommendations and the evidence behind them.",
    remember: "Use the living guideline as the starting point when treatment choices change after recurrence.",
    show: "ASCO Guidelines",
    title: "Systemic Treatment of Ovarian Cancer Recurrence: ASCO Living Guideline 2026.1.0",
    url: "https://guideline.libsyn.com/systemic-treatment-of-ovarian-cancer-recurrence-asco-living-guideline-202610",
    evidence: "Living guideline",
    match: "Systemic Treatment of Ovarian Cancer Recurrence",
  },
];

// Specialty lenses may use this earned 72-hour layer when their 24-hour slate is empty.
// These remain editorially selected developments; the longer window never lowers the bar.
export const SPECIALTY_FALLBACKS: EditorialArticle[] = [
  {
    id: "litespark-011",
    area: "GU",
    site: "Kidney",
    nickname: "LITESPARK-011",
    takeaway: "Belzutifan plus lenvatinib improved PFS after prior immunotherapy, without a proven survival gain.",
    finding: "In previously treated advanced clear-cell RCC, belzutifan plus lenvatinib improved median PFS versus cabozantinib (14.8 versus 10.7 months; HR 0.70). Overall survival was not significantly different at the interim analysis (HR 0.85).",
    remember: "A meaningful post-IO PFS option; OS remains unproven.",
    journal: "The Lancet",
    title: "Belzutifan plus lenvatinib versus cabozantinib in patients with previously treated advanced renal cell carcinoma (LITESPARK-011): an open-label, randomised, controlled, phase 3 trial",
    url: "https://pubmed.ncbi.nlm.nih.gov/42586114/",
    evidence: "Phase 3",
    sharedBy: 5,
    match: { doi: "10.1016/S0140-6736(26)01089-5", pmid: "42586114", titleIncludes: "LITESPARK-011" },
  },
];

export const ALSO_RELEVANT: EditorialArticle[] = [
  {
    id: "maia-final-os",
    area: "Heme",
    site: "Myeloma",
    nickname: "MAIA",
    takeaway: "Final MAIA follow-up sets a 90.3-month median OS benchmark for frontline D-Rd.",
    finding: "In transplant-ineligible newly diagnosed multiple myeloma, median OS was 90.3 months with daratumumab, lenalidomide, and dexamethasone versus 64.1 months with lenalidomide and dexamethasone (HR 0.67) after 89.3 months of follow-up.",
    remember: "Long follow-up reinforces frontline D-Rd in transplant-ineligible disease.",
    journal: "Leukemia",
    title: "Daratumumab, lenalidomide, and dexamethasone in transplant-ineligible newly diagnosed multiple myeloma: MAIA final survival analysis",
    url: "https://doi.org/10.1038/s41375-026-03097-9",
    evidence: "Phase 3 final analysis",
    sharedBy: 0,
    match: { doi: "10.1038/s41375-026-03097-9", pmid: "42637879", titleIncludes: "MAIA final survival analysis" },
  },
  {
    id: "elevate",
    area: "Breast",
    site: "Breast",
    nickname: "ELEVATE",
    takeaway: "An all-oral SERD combination produced an 8.3-month median PFS after CDK4/6 inhibition.",
    finding: "Elacestrant plus everolimus showed similar activity in ESR1-mutant and wild-type tumors.",
    remember: "Treat this as a phase 2 combination signal, not a new standard.",
    journal: "Clinical Cancer Research",
    title: "Elacestrant in Combination with Everolimus for Estrogen Receptor-Positive, HER2-Negative Previously Treated Advanced Breast Cancer: Results from ELEVATE",
    url: "https://aacrjournals.org/clincancerres/article/doi/10.1158/1078-0432.CCR-26-1816/787626/Elacestrant-in-Combination-with-Everolimus-for",
    evidence: "Phase 2",
    sharedBy: 3,
    match: { doi: "10.1158/1078-0432.CCR-26-1816", titleIncludes: "Results from ELEVATE" },
  },
  {
    id: "olympia",
    area: "Breast",
    site: "Breast",
    nickname: "OlympiA",
    takeaway: "Longer follow-up confirms adjuvant olaparib benefit without expanding the population.",
    finding: "At 6.1 years, one year of adjuvant olaparib continued to reduce invasive and distant disease events (HR 0.65) and death (OS HR 0.72; six-year OS 87.5% versus 83.2%), including in high-risk hormone receptor-positive disease, without more MDS or AML.",
    remember: "Keep using adjuvant olaparib in the established high-risk population.",
    journal: "Annals of Oncology",
    title: "Sustained benefit of adjuvant olaparib in women with germline BRCA1- and BRCA2-associated high-risk HER2-negative early breast cancer: Updated results from the OlympiA phase III trial",
    url: "https://doi.org/10.1016/j.annonc.2026.08.002",
    evidence: "Phase 3 update",
    sharedBy: 0,
    match: { doi: "10.1016/j.annonc.2026.08.002", pmid: "42636977", titleIncludes: "Sustained benefit of adjuvant olaparib" },
  },
  {
    id: "mibc-meta",
    area: "GU",
    site: "Bladder",
    nickname: "MIBC",
    takeaway: "A useful synthesis of newer perioperative strategies, not a new trial readout.",
    finding: "The systematic review and meta-analysis compares novel approaches with gemcitabine-cisplatin in muscle-invasive bladder cancer.",
    remember: "Useful context, but not a new randomized result.",
    journal: "JCO Oncology Advances",
    title: "Defining the Optimal Therapeutic Approach in Muscle-Invasive Bladder Cancer",
    url: "https://ascopubs.org/doi/10.1200/OA-26-00058",
    evidence: "Systematic review and meta-analysis",
    sharedBy: 4,
    match: { doi: "10.1200/OA-26-00058", titleIncludes: "Optimal Therapeutic Approach in Muscle-Invasive Bladder Cancer" },
  },
];

export const NEW_TO_LISTEN: EditorialEpisode[] = [
  {
    id: "loi-tils",
    area: "Breast",
    hook: "TILs as a decision tool in breast cancer, not just a biomarker.",
    show: "The Lancet Oncology in conversation with",
    title: "Tumour-infiltrating lymphocytes in breast cancer with Professor Sherene Loi",
    url: "https://lancetonc.podbean.com/e/tumour-infiltrating-lymphocytes-in-breast-cancer-with-professor-sherene-loi/",
    match: "Tumour-infiltrating lymphocytes in breast cancer",
  },
  {
    id: "ovarian-guideline",
    area: "Gyn",
    hook: "The first ASCO living guideline on systemic treatment after ovarian cancer recurrence.",
    show: "ASCO Guidelines",
    title: "Systemic Treatment of Ovarian Cancer Recurrence: ASCO Living Guideline 2026.1.0",
    url: "https://guideline.libsyn.com/systemic-treatment-of-ovarian-cancer-recurrence-asco-living-guideline-202610",
    match: "Systemic Treatment of Ovarian Cancer Recurrence",
  },
  {
    id: "myeloma-rapid-fire",
    area: "Heme",
    hook: "A rapid, practical pass through current myeloma sequencing.",
    show: "Oncology Brothers",
    title: "Rapid Fire Rounds - Multiple Myeloma Management with Dr. Joseph Mikhael",
    url: "https://infoaj7.podbean.com/e/myeloma-rapid-fire-rounds-v4/",
    match: "Rapid Fire Rounds",
  },
];

function norm(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();
}

function validHttpUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function relatedCoverageLinks(
  links: HeroSupportLink[] | null | undefined,
  primaryUrl: string | null | undefined,
  primaryTitle?: string | null,
): HeroSupportLink[] {
  const primary = validHttpUrl(primaryUrl)?.toLowerCase() ?? null;
  const primaryTitleKey = norm(primaryTitle);
  const seen = new Set<string>();
  return (links ?? []).filter((link) => {
    if (link.relationshipType === "primary_source") return false;
    const url = validHttpUrl(link.url);
    const key = url?.toLowerCase() ?? "";
    if (!url || !key || key === primary || (primaryTitleKey && norm(link.title) === primaryTitleKey) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sameEditorialArticle(left: EditorialArticle, right: EditorialArticle): boolean {
  const leftDoi = norm(left.match.doi);
  const rightDoi = norm(right.match.doi);
  if (leftDoi && rightDoi && leftDoi === rightDoi) return true;
  const leftPmid = norm(left.match.pmid);
  const rightPmid = norm(right.match.pmid);
  if (leftPmid && rightPmid && leftPmid === rightPmid) return true;
  const leftUrl = validHttpUrl(left.url)?.toLowerCase();
  const rightUrl = validHttpUrl(right.url)?.toLowerCase();
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true;
  const leftTitle = norm(left.title);
  const rightTitle = norm(right.title);
  return leftTitle.length >= 12 && leftTitle === rightTitle;
}

export function sameEditorialDevelopment(left: EditorialDevelopment, right: EditorialDevelopment): boolean {
  if ("kind" in left || "kind" in right) {
    return "kind" in left && "kind" in right &&
      (left.id === right.id || norm(left.title) === norm(right.title));
  }
  return left.id === right.id || sameEditorialArticle(left, right);
}

export const ARCHIVED_TAKEAWAY_FALLBACK = "Review the primary source and attached evidence for the exact population and result.";

export function cleanReadoutExcerpt(value: string): string {
  return value
    .replace(/\b(?:RISK STRATIFICATION|KEY FINDINGS):\s*/gi, "")
    .replace(/(^|[.!?]\s+)NCT\d{8}\.?(?=\s|$)/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function archivedEditorialArticle(item: ReadoutArchivedCard | ReadoutArchivedCardSummary): EditorialArticle {
  const card = item.card;
  const clinicianRank = card.rankTrace?.find((entry) => entry.input === "clinicianSharers")?.value ?? 0;
  const supportLinks = card.support?.links ?? [];
  const articleIds = supportLinks
    .filter((link) => link.kind === "article" || link.kind === "paper")
    .map((link) => link.id)
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const primarySource = supportLinks.find((link) => link.relationshipType === "primary_source");
  const primaryDescription = primarySource?.description;
  const sourceFinding = primaryDescription || card.excerpt || "";
  const findingLabel = primaryDescription
    ? "From the source"
    : card.kind === "paper" || card.kind === "readout"
      ? "From the abstract"
      : "From the source";
  const sourceTitle = primarySource?.title || card.headline;
  const sourceUrl = validHttpUrl(primarySource?.url) || validHttpUrl(card.url) || validHttpUrl(supportLinks[0]?.url) || "";
  const sourceLabel = primarySource?.sourceLabel || card.sourceLabel;
  const site = item.area === "All" ? "Oncology" : item.area;
  return {
    id: `archive-${card.id}`,
    area: item.area as EditorialArea,
    site,
    nickname: card.kind === "event" ? "REGULATORY" : "",
    takeaway: card.headline,
    finding: sourceFinding ? cleanReadoutExcerpt(sourceFinding) : "",
    findingSource: sourceFinding ? "source" : undefined,
    findingLabel: sourceFinding ? findingLabel : undefined,
    remember: ARCHIVED_TAKEAWAY_FALLBACK,
    journal: sourceLabel,
    title: sourceTitle,
    url: sourceUrl,
    evidence: card.kind === "event" ? "Regulatory action" : card.kind === "readout" ? "Trial readout" : "Published evidence",
    sharedBy: Math.max(card.conversation?.authoredClinicians ?? 0, clinicianRank),
    match: { doi: card.doi ?? undefined, titleIncludes: sourceTitle },
    articleIds,
    primarySources: supportLinks.filter((link) => link.relationshipType === "primary_source"),
    relatedCoverage: supportLinks,
    occurredOn: card.occurredOn ?? null,
  };
}

export function findArchivedEditorialSource(item: EditorialArticle, cards: Array<ReadoutArchivedCard | ReadoutArchivedCardSummary>): ReadoutArchivedCard | ReadoutArchivedCardSummary | null {
  const itemUrl = validHttpUrl(item.url)?.toLowerCase() ?? null;
  const needle = norm(item.match.titleIncludes || item.title);
  return cards.find(({ card }) => {
    const cardUrl = validHttpUrl(card.url)?.toLowerCase() ?? null;
    if (itemUrl && cardUrl && itemUrl === cardUrl) return true;
    const headline = norm(card.headline);
    return !!needle && (headline.includes(needle) || needle.includes(headline));
  }) ?? null;
}

export function regulatoryEditorialArticle(candidate: ReadoutRegulatoryCandidate, area: EditionArea): EditorialArticle {
  const primaryStudy = candidate.primaryStudy;
  const studyUrl = validHttpUrl(primaryStudy?.url);
  const supportingEvidence: HeroSupportLink[] = primaryStudy && studyUrl && studyUrl.toLowerCase() !== candidate.url.toLowerCase()
    ? [{
        id: primaryStudy.id,
        kind: "paper",
        title: primaryStudy.title,
        url: studyUrl,
        sourceLabel: primaryStudy.sourceLabel,
        relationshipType: "supporting_evidence",
        occurredAt: candidate.metrics.lastSharedAt,
      }]
    : [];
  const remember = candidate.regulatoryKind === "approval"
    ? "This is an FDA approval, not a designation."
    : candidate.regulatoryKind === "label"
      ? "This is an FDA label change; confirm the exact indicated population."
      : "This is an FDA safety update; review the source before changing care.";
  return {
    id: candidate.id,
    area,
    site: candidate.areas[0] ?? "Oncology",
    nickname: candidate.eligibleLabel,
    takeaway: candidate.headline,
    finding: candidate.finding || primaryStudy?.description || "",
    findingSource: candidate.finding || primaryStudy?.description ? "source" : undefined,
    findingLabel: candidate.finding || primaryStudy?.description ? "From the supporting study" : undefined,
    remember,
    journal: candidate.sourceLabel,
    title: candidate.headline,
    url: candidate.url,
    evidence: candidate.eligibleLabel,
    sharedBy: candidate.metrics.totalSharers,
    match: { titleIncludes: candidate.headline },
    articleIds: candidate.articleIds,
    sourceAction: "View FDA source",
    primarySources: [],
    supportingEvidence,
    relatedCoverage: candidate.relatedCoverage ?? [],
    occurredOn: candidate.occurredOn,
  };
}

export function breakingEditorialArticle(candidate: ReadoutBreakingCandidate, area: EditionArea): EditorialArticle {
  return {
    id: candidate.id,
    area,
    site: candidate.areas[0] ?? "Oncology",
    nickname: "BREAKING",
    takeaway: candidate.headline,
    finding: candidate.excerpt ? cleanReadoutExcerpt(candidate.excerpt) : "",
    findingSource: candidate.excerpt ? "source" : undefined,
    findingLabel: candidate.excerpt ? `From ${candidate.excerptSourceLabel}` : undefined,
    remember: "",
    journal: candidate.sourceLabel,
    title: candidate.headline,
    url: candidate.url,
    evidence: "Major paper",
    sharedBy: candidate.metrics.totalSharers,
    match: { doi: candidate.doi ?? undefined, pmid: candidate.pmid ?? undefined, titleIncludes: candidate.headline },
    articleIds: candidate.articleIds,
  };
}

export function findArticle(item: EditorialArticle, briefs: BriefingData[]): BriefingArticle | null {
  const articles = briefs.flatMap(articleEvidencePool);
  return articles.find((article) => {
    if (item.match.doi && norm(article.doi) === norm(item.match.doi)) return true;
    if (item.match.pmid && norm(article.pmid) === norm(item.match.pmid)) return true;
    return item.match.titleIncludes
      ? norm(article.title).includes(norm(item.match.titleIncludes))
      : false;
  }) ?? null;
}

function articleEvidencePool(brief: BriefingData): BriefingArticle[] {
  const articles = [...(brief.topArticles ?? [])];
  const seen = new Set(articles.map(articleKey));
  const addPaper = (paper: BriefingPaper) => {
    const article = articleFromPaper(paper);
    const key = articleKey(article);
    if (seen.has(key)) return;
    seen.add(key);
    articles.push(article);
  };

  for (const story of brief.topStories ?? []) for (const paper of story.papers ?? []) addPaper(paper);
  for (const mover of brief.movers ?? []) for (const paper of mover.papers ?? []) addPaper(paper);
  for (const trial of brief.trials ?? []) for (const paper of trial.articles ?? []) addPaper(paper);
  for (const topic of brief.topics ?? []) for (const paper of topic.papers ?? []) addPaper(paper);

  return articles;
}

function articleFromPaper(paper: BriefingPaper): BriefingArticle {
  const paperWithIds = paper as BriefingPaper & Pick<Partial<BriefingArticle>, "doi" | "pmid" | "publishedAt">;
  const kolSharers = paper.sharerCount ?? paper.sharers.length;
  return {
    title: paper.title,
    url: paper.url,
    journal: paper.journal,
    domain: paper.domain,
    doi: paperWithIds.doi,
    pmid: paperWithIds.pmid,
    abstract: paper.abstract,
    description: paper.description,
    publishedAt: paperWithIds.publishedAt,
    sharers: kolSharers + (paper.publishers?.length ?? 0),
    kolSharers,
    publishers: paper.publishers ?? [],
    publisherPosts: paper.publisherPosts,
    otherPosts: paper.otherPosts,
    faces: paper.sharers.map((sharer) => sharer.avatar).filter(Boolean).slice(0, 5) as string[],
    topLikes: paper.topLikes,
    posts: paper.posts ?? [],
    peerReviewed: paper.peerReviewed,
  };
}

function articleKey(article: Pick<BriefingArticle, "doi" | "pmid" | "url" | "title">): string {
  return norm(article.doi) || norm(article.pmid) || norm(article.url) || norm(article.title);
}

export function findEpisode(item: EditorialEpisode, briefs: BriefingData[]): BriefingEpisode | null {
  return briefs.flatMap((brief) => brief.episodes ?? [])
    .find((episode) => norm(episode.title).includes(norm(item.match))) ?? null;
}

export function listenForArea(
  baseItems: EditorialEpisode[],
  briefs: BriefingData[],
  area: EditionArea,
  featuredItems: EditorialEpisode[] = [],
  now = new Date(),
): EditorialEpisode[] {
  const featured = new Set(featuredItems.flatMap((item) => episodeKeys(item)));
  const base = visibleForArea(baseItems, area).filter((item) => !hasAnyKey(item, featured));
  const held = heldEpisodesForArea(briefs, area, featured, now);
  const seen = new Set(held.flatMap((item) => episodeKeys(item)));
  const remainder = base.filter((item) => {
    if (hasAnyKey(item, seen)) return false;
    for (const key of episodeKeys(item)) seen.add(key);
    return true;
  });
  const items = [...held, ...remainder];
  return area === "All" ? items.slice(0, ALL_LISTEN_CAP) : items;
}

function heldEpisodesForArea(
  briefs: BriefingData[],
  area: EditionArea,
  featured: Set<string>,
  now: Date,
): EditorialEpisode[] {
  const heldByArea = new Map<SpecialtyArea, EditorialEpisode[]>();
  for (const brief of briefs) {
    const briefArea = asEditionArea(brief.area);
    if (!briefArea || (area !== "All" && area !== briefArea)) continue;
    const episodes = (brief.episodes ?? [])
      .filter((episode) => isListenHoldEpisode(episode, briefArea, now))
      .map((episode) => heldEpisodeFromBriefEpisode(episode, briefArea))
      .filter((episode) => !hasAnyKey(episode, featured))
      .sort((left, right) => publishedTime(findEpisode(right, briefs)) - publishedTime(findEpisode(left, briefs)));
    const existing = heldByArea.get(briefArea) ?? [];
    const seen = new Set(existing.flatMap((episode) => episodeKeys(episode)));
    const unique = episodes.filter((episode) => {
      if (hasAnyKey(episode, seen)) return false;
      for (const key of episodeKeys(episode)) seen.add(key);
      return true;
    });
    heldByArea.set(briefArea, [...existing, ...unique].slice(0, SPECIALTY_HELD_EPISODE_CAP));
  }
  const held = [...heldByArea.values()].flat();
  return held.sort((left, right) => publishedTime(findEpisode(right, briefs)) - publishedTime(findEpisode(left, briefs)));
}

function heldEpisodeFromBriefEpisode(episode: BriefingEpisode, area: SpecialtyArea): EditorialEpisode {
  return {
    id: episode.episodeId ?? `held-${slug([area, episode.show, episode.title].filter(Boolean).join("-"))}`,
    area,
    hook: episode.title,
    show: episode.show ?? "Podcast",
    title: episode.title,
    url: episode.sourceUrl || episode.audioUrl || "",
    match: episode.title,
  };
}

function isListenHoldEpisode(episode: BriefingEpisode, area: SpecialtyArea, now: Date): boolean {
  const show = episode.show ?? "";
  if (!show || EXCLUDED_LISTEN_HOLD_SHOWS.some((excluded) => sameText(show, excluded))) return false;
  if (!withinHours(episode.publishedAt, now, LISTEN_HOLD_HOURS)) return false;
  if (CORE_LISTEN_HOLD_SHOWS[area].some((candidate) => sameText(show, candidate))) return true;
  if (CROSS_SPECIALTY_LISTEN_HOLD_SHOWS.some((candidate) => sameText(show, candidate))) return true;
  if (sameText(show, CONDITIONAL_GU_SHOW)) return area === "GU" && hasSpecialtyCue(area, episode);
  if (sameText(show, CONDITIONAL_HEALTHCARE_UNFILTERED_SHOW)) return hasSpecialtyCue(area, episode);
  return false;
}

function hasSpecialtyCue(area: SpecialtyArea, episode: BriefingEpisode): boolean {
  const text = [episode.title, episode.description, ...(episode.subAreas ?? [])].filter(Boolean).join(" ");
  return SPECIALTY_TITLE_CUES[area].test(text);
}

function withinHours(value: string | null | undefined, now: Date, hours: number): boolean {
  if (!value) return false;
  const published = Date.parse(value);
  if (!Number.isFinite(published)) return false;
  const elapsed = now.getTime() - published;
  return elapsed >= 0 && elapsed <= hours * 60 * 60 * 1000;
}

function publishedTime(episode: BriefingEpisode | null): number {
  return episode ? Date.parse(episode.publishedAt) || 0 : 0;
}

function asEditionArea(value: string | null | undefined): SpecialtyArea | null {
  return EDITION_AREAS.includes(value as EditionArea) && value !== "All" ? value as SpecialtyArea : null;
}

function episodeKeys(item: Pick<EditorialEpisode, "id" | "show" | "title" | "match">): string[] {
  return [item.id, `title:${item.title}`, `${item.show}:${item.title}`, item.match].map(norm).filter(Boolean);
}

function hasAnyKey(item: EditorialEpisode, keys: Set<string>): boolean {
  return episodeKeys(item).some((key) => keys.has(key));
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return norm(left) === norm(right);
}

function slug(value: string) {
  return norm(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function visibleForArea<T extends { area: EditorialArea }>(items: T[], area: EditionArea) {
  return area === "All" ? items : items.filter((item) => item.area === area);
}
