import {
  ALSO_RELEVANT,
  FEATURED_EPISODES,
  SPECIALTY_FALLBACKS,
  WORTH_YOUR_TIME,
  visibleForArea,
  type EditorialArticle,
  type EditorialDevelopment,
  type EditionArea,
} from "./edition";

export type ReadoutWindow = "today" | "7d";

export type ReadoutEvidenceTarget = {
  id: string;
  title: string;
  url: string;
  doi: string | null;
  pmid: string | null;
  titleIncludes: string | null;
  articleIds: string[];
  windowHours: 24 | 72 | 168;
};

export function isEpisodeDevelopment(item: EditorialDevelopment): boolean {
  return "kind" in item && item.kind === "episode";
}

export function evidenceTarget(item: EditorialArticle) {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    doi: item.match.doi ?? null,
    pmid: item.match.pmid ?? null,
    titleIncludes: item.match.titleIncludes ?? null,
    articleIds: item.articleIds ?? [],
  };
}

export function readoutWindowEvidenceTargets(area: EditionArea, window: ReadoutWindow): ReadoutEvidenceTarget[] {
  const todayDevelopments: EditorialDevelopment[] = area === "All"
    ? WORTH_YOUR_TIME
    : [...WORTH_YOUR_TIME, ...FEATURED_EPISODES];
  const leadArticles = visibleForArea(todayDevelopments, area)
    .filter((item): item is EditorialArticle => !isEpisodeDevelopment(item));
  const fallbackArticles = area === "All" ? [] : visibleForArea(SPECIALTY_FALLBACKS, area);
  const items = [...leadArticles, ...fallbackArticles, ...visibleForArea(ALSO_RELEVANT, area)];
  const fallbackIds = new Set(SPECIALTY_FALLBACKS.map((item) => item.id));

  return items
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 12)
    .map((item) => ({
      ...evidenceTarget(item),
      windowHours: window === "7d" ? 168 : fallbackIds.has(item.id) ? 72 : 24,
    }));
}

export function readoutWindowDays(window: ReadoutWindow): 1 | 7 {
  return window === "7d" ? 7 : 1;
}
