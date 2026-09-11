/**
 * The agency reviewed these two exact notices as one camizestrant action.
 * Keep this deliberately narrow: a shared drug, tumor, or generic FDA domain
 * is not enough to merge two published editorial selections.
 */
const CAMIZESTRANT_APPROVAL = "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-grants-accelerated-approval-camizestrant-cdk46-inhibitor-esr1-mutated-hr-positive-her2-negative";
const CAMIZESTRANT_COMPANION_NOTICE = "https://www.fda.gov/news-events/press-announcements/fda-grants-accelerated-approval-new-breast-cancer-treatment";

type RegulatoryEditorialIdentityInput = {
  evidence?: string | null;
  url?: string | null;
};

function officialRegulatoryUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !["fda.gov", "www.fda.gov"].includes(url.hostname) ||
      !/^\/(?:drugs\/|news-events\/press-announcements\/|safety\/)/.test(url.pathname)) return null;
    url.hostname = "www.fda.gov";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** An exact, reviewed FDA event identity; null for every other editorial card. */
export function readoutRegulatoryIdentity(item: RegulatoryEditorialIdentityInput): string | null {
  if (!/^(?:FDA approval|FDA safety|Regulatory action|Regulatory alert)$/i.test(item.evidence ?? "")) return null;
  const url = officialRegulatoryUrl(item.url);
  return url === CAMIZESTRANT_COMPANION_NOTICE ? CAMIZESTRANT_APPROVAL : url;
}

export function sameReadoutRegulatoryIdentity(
  left: RegulatoryEditorialIdentityInput,
  right: RegulatoryEditorialIdentityInput,
): boolean {
  const leftKey = readoutRegulatoryIdentity(left);
  return !!leftKey && leftKey === readoutRegulatoryIdentity(right);
}

/** Prefer the reviewed detailed agency notice, otherwise retain the earlier
 * canonical occurrence so the seven-day union keeps its morning order. */
export function preferredReadoutRegulatoryItem<T extends RegulatoryEditorialIdentityInput>(left: T, right: T): T {
  const key = readoutRegulatoryIdentity(left);
  return key && officialRegulatoryUrl(right.url) === key && officialRegulatoryUrl(left.url) !== key ? right : left;
}
