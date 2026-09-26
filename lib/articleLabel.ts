export type ArticleLabelInput = {
  url: string;
  publicationClass?: string | null;
  journal?: string | null;
  evidence?: string | null;
  sourceAction?: string | null;
  sourceName?: string | null;
};

const PUBLICATION_CLASS_LABELS: Record<string, string> = { review: "Review", commentary: "Commentary", preprint: "Preprint", guideline: "Guideline" };

function bareDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}

// A source with no class, no journal, no paper-shaped link, and a source name that is only
// its own domain is a web page, not a paper. Today's items carry no sourceName, so they never
// reach this branch.
function isWebPage(input: ArticleLabelInput): boolean {
  if (input.publicationClass && input.publicationClass !== "unknown") return false;
  if (input.journal?.trim()) return false;
  if (/doi\.org\/|10\.\d{4,}\//i.test(input.url)) return false;
  if (/pubmed|ncbi\.nlm\.nih\.gov\/pmc|pmc\.ncbi\.nlm\.nih\.gov|europepmc\.org/i.test(input.url)) return false;
  if (/biorxiv|medrxiv|researchsquare|ssrn|arxiv|preprints\.org/i.test(input.url)) return false;
  const domain = bareDomain(input.url);
  const name = input.sourceName?.trim().toLowerCase().replace(/^www\./, "");
  return Boolean(domain && name && name === domain);
}

export function articleContentType(input: ArticleLabelInput): string {
  // NEJM encodes the article form in the DOI suffix: NEJMc is Correspondence.
  if (/10\.1056\/NEJMc\d/i.test(input.url)) return "Correspondence";
  // "unknown" means the classifier has not looked; fall through to the ordinary
  // label rather than announce it (parity with native readout-display.ts).
  if (input.publicationClass && input.publicationClass !== "research" && input.publicationClass !== "unknown") return PUBLICATION_CLASS_LABELS[input.publicationClass];
  const hay = `${input.evidence ?? ""} ${input.sourceAction ?? ""} ${input.journal ?? ""} ${input.sourceName ?? ""}`;
  if (/approval/i.test(hay)) return "FDA approval";
  if (/safety|warning/i.test(hay)) return "FDA safety";
  if (/label|regulatory|fast track|priority review|breakthrough/i.test(hay)) return "Regulatory";
  if (/preprint|biorxiv|medrxiv|research\s*square|ssrn/i.test(hay)) return "Preprint";
  if (isWebPage(input)) return "Web page";
  return "Paper";
}
