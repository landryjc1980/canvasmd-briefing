import type { BriefingArticle, BriefingData, BriefingEpisode } from "@/lib/types";

export const EDITION_AREAS = ["All", "GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"] as const;
export type EditionArea = (typeof EDITION_AREAS)[number];

export type EditorialArticle = {
  id: string;
  area: Exclude<EditionArea, "All">;
  site: string;
  nickname: string;
  takeaway: string;
  finding: string;
  remember: string;
  journal: string;
  title: string;
  url: string;
  evidence: string;
  sharedBy: number;
  match: { doi?: string; pmid?: string; titleIncludes?: string };
};

export type EditorialEpisode = {
  id: string;
  area: Exclude<EditionArea, "All">;
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

export const WORTH_YOUR_TIME: EditorialArticle[] = [
  {
    id: "star-trec",
    area: "GI",
    site: "Rectal",
    nickname: "STAR-TREC",
    takeaway: "Long-course CRT strengthens the case for organ preservation.",
    finding: "Among patients who opted to defer total mesorectal excision, 12-month TME-free survival was 78.5% after long-course CRT versus 60.6% after short-course radiotherapy (HR 1.90). Selected patients may avoid radical surgery; long-course CRT looks like the stronger preservation path so far.",
    remember: "If organ preservation is the goal, long-course CRT is the stronger path so far.",
    journal: "The Lancet Oncology",
    title: "Chemoradiotherapy versus short-course radiotherapy for response-adapted organ preservation in early-stage and intermediate-stage rectal cancer (STAR-TREC): 12-month results of an international, multicentre, open-label, parallel-group, randomised, phase 2/3 trial",
    url: "https://thelancet.com/journals/lanonc/article/PIIS1470-2045(26)00228-7",
    evidence: "Phase 2/3",
    sharedBy: 3,
    match: { titleIncludes: "response-adapted organ preservation" },
  },
  {
    id: "emerald-3",
    area: "GI",
    site: "Liver",
    nickname: "EMERALD-3",
    takeaway: "PFS improved, but survival remains unproven.",
    finding: "STRIDE plus lenvatinib and TACE improved PFS versus TACE alone (13.0 versus 9.8 months; HR 0.70, p=0.0007). Overall survival was not significantly different (39.5 versus 34.7 months; HR 0.84, p=0.18).",
    remember: "Better PFS does not yet mean a proven survival gain.",
    journal: "The Lancet Oncology",
    title: "Durvalumab and tremelimumab, with or without lenvatinib, combined with transarterial chemoembolisation in participants with embolisation-eligible hepatocellular carcinoma (EMERALD-3): a global, randomised, open-label, sponsor-blinded, phase 3 study",
    url: "https://thelancet.com/journals/lanonc/article/PIIS1470-2045(26)00278-0",
    evidence: "Phase 3",
    sharedBy: 2,
    match: { titleIncludes: "embolisation-eligible hepatocellular carcinoma" },
  },
  {
    id: "olympia",
    area: "Breast",
    site: "Breast",
    nickname: "OlympiA",
    takeaway: "Confirmation to keep using adjuvant olaparib, not a new population.",
    finding: "At 6.1 years, one year of adjuvant olaparib continued to reduce invasive and distant disease events (HR 0.65) and death (OS HR 0.72; six-year OS 87.5% versus 83.2%), including in high-risk hormone receptor-positive disease, without more MDS or AML.",
    remember: "Longer follow-up confirms current adjuvant olaparib use; it does not expand the population.",
    journal: "Annals of Oncology",
    title: "Sustained benefit of adjuvant olaparib in women with germline BRCA1- and BRCA2-associated high-risk HER2-negative early breast cancer: Updated results from the OlympiA phase III trial",
    url: "https://doi.org/10.1016/j.annonc.2026.08.002",
    evidence: "Phase 3 update",
    sharedBy: 2,
    match: { doi: "10.1016/j.annonc.2026.08.002", titleIncludes: "Sustained benefit of adjuvant olaparib" },
  },
  {
    id: "skyscraper-07",
    area: "GI",
    site: "Esophagus",
    nickname: "SKYSCRAPER-07",
    takeaway: "The signal favors monotherapy IO after CRT, not dual checkpoint blockade.",
    finding: "The tiragolumab add-on missed its endpoints (investigator-assessed PFS HR 0.82, p=0.095; OS HR 0.91). Atezolizumab alone versus placebo improved OS (HR 0.69) and investigator-assessed PFS (HR 0.74).",
    remember: "Tiragolumab failed here; atezolizumab monotherapy carried the signal.",
    journal: "Annals of Oncology",
    title: "Atezolizumab with or without tiragolumab in unresectable esophageal squamous cell carcinoma following definitive concurrent chemoradiotherapy (SKYSCRAPER-07): a randomised, phase III study",
    url: "https://doi.org/10.1016/j.annonc.2026.07.413",
    evidence: "Phase 3",
    sharedBy: 1,
    match: { doi: "10.1016/j.annonc.2026.07.413", titleIncludes: "SKYSCRAPER-07" },
  },
  {
    id: "harmoni",
    area: "Lung",
    site: "Lung",
    nickname: "HARMONi",
    takeaway: "A PFS win in a common sequence; survival is still open.",
    finding: "Ivonescimab plus chemotherapy improved PFS after EGFR-TKI progression (6.8 versus 4.4 months; HR 0.52, p<0.0001). Overall survival was 16.8 versus 14.0 months (HR 0.79) and was not statistically significant.",
    remember: "PFS improved after EGFR-TKI progression, while OS remains unproven.",
    journal: "The Lancet Oncology",
    title: "Ivonescimab plus chemotherapy versus placebo plus chemotherapy in patients with advanced EGFR-mutated non-small-cell lung cancer after disease progression on EGFR tyrosine kinase inhibitor therapy (HARMONi): a multicentre, randomised, double-blind, phase 3 trial",
    url: "https://thelancet.com/journals/lanonc/article/PIIS1470-2045(26)00282-2",
    evidence: "Phase 3",
    sharedBy: 1,
    match: { titleIncludes: "Ivonescimab plus chemotherapy versus placebo" },
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
    id: "elevate",
    area: "Breast",
    site: "Breast",
    nickname: "ELEVATE",
    takeaway: "An all-oral SERD combination produced an 8.3-month median PFS after CDK4/6 inhibition.",
    finding: "Elacestrant plus everolimus showed similar activity in ESR1-mutant and wild-type tumors. This is a phase 2 signal, not a practice-changing comparison.",
    remember: "Treat this as a phase 2 combination signal, not a new standard.",
    journal: "Clinical Cancer Research",
    title: "Elacestrant in Combination with Everolimus for Estrogen Receptor-Positive, HER2-Negative Previously Treated Advanced Breast Cancer: Results from ELEVATE",
    url: "https://aacrjournals.org/clincancerres/article/doi/10.1158/1078-0432.CCR-26-1816/787626/Elacestrant-in-Combination-with-Everolimus-for",
    evidence: "Phase 2",
    sharedBy: 3,
    match: { doi: "10.1158/1078-0432.CCR-26-1816", titleIncludes: "Results from ELEVATE" },
  },
  {
    id: "mibc-meta",
    area: "GU",
    site: "Bladder",
    nickname: "MIBC",
    takeaway: "A useful synthesis of newer perioperative strategies, not a new trial readout.",
    finding: "The systematic review and meta-analysis compares novel approaches with gemcitabine-cisplatin in muscle-invasive bladder cancer. It belongs in the briefing as context, below new randomized evidence.",
    remember: "Useful context, but not a new randomized result.",
    journal: "JCO Oncology Advances",
    title: "Defining the Optimal Therapeutic Approach in Muscle-Invasive Bladder Cancer",
    url: "https://ascopubs.org/doi/10.1200/OA-26-00058",
    evidence: "Systematic review and meta-analysis",
    sharedBy: 4,
    match: { doi: "10.1200/OA-26-00058", titleIncludes: "Optimal Therapeutic Approach in Muscle-Invasive Bladder Cancer" },
  },
  {
    id: "talentop",
    area: "GI",
    site: "Liver",
    nickname: "TALENTOP",
    takeaway: "Conversion surgery lengthened time to treatment failure, with important limits.",
    finding: "Resection after atezolizumab and bevacizumab improved time to treatment failure (20.4 versus 11.8 months; HR 0.60), with more grade 3-4 toxicity. Overall survival is immature and the study was conducted in China.",
    remember: "The TTF gain comes with more toxicity, immature OS, and geographic limits.",
    journal: "The Lancet",
    title: "Liver resection after atezolizumab and bevacizumab versus maintenance therapy for locally advanced hepatocellular carcinoma (TALENTOP): a multicentre, open-label, randomised, phase 3 trial",
    url: "https://doi.org/10.1016/S0140-6736(26)01252-3",
    evidence: "Phase 3",
    sharedBy: 2,
    match: { doi: "10.1016/S0140-6736(26)01252-3", titleIncludes: "TALENTOP" },
  },
];

export const NEW_TO_LISTEN: EditorialEpisode[] = [
  {
    id: "loi-tils",
    area: "Breast",
    hook: "TILs as a decision tool in breast cancer, not just a biomarker.",
    show: "The Lancet Oncology in conversation",
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

export function findArticle(item: EditorialArticle, briefs: BriefingData[]): BriefingArticle | null {
  const articles = briefs.flatMap((brief) => brief.topArticles ?? []);
  return articles.find((article) => {
    if (item.match.doi && norm(article.doi) === norm(item.match.doi)) return true;
    if (item.match.pmid && norm(article.pmid) === norm(item.match.pmid)) return true;
    return item.match.titleIncludes
      ? norm(article.title).includes(norm(item.match.titleIncludes))
      : false;
  }) ?? null;
}

export function findEpisode(item: EditorialEpisode, briefs: BriefingData[]): BriefingEpisode | null {
  return briefs.flatMap((brief) => brief.episodes ?? [])
    .find((episode) => norm(episode.title).includes(norm(item.match))) ?? null;
}

export function visibleForArea<T extends { area: Exclude<EditionArea, "All"> }>(items: T[], area: EditionArea) {
  return area === "All" ? items : items.filter((item) => item.area === area);
}
