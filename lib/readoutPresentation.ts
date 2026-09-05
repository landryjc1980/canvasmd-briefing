// Mirrors the small Native/backend excerpt policy; stored publisher text is never edited.
export function articleExcerptIsBoilerplate(value: string): boolean {
  return /(?:\b(?:conflicts? of interest|disclosure information|relationships are (?:considered|self-held)|relationships may not relate|immediate family member|view all available purchase options|all rights reserved|subscribe to (?:read|access)|get full access to this article)\b|^\s*(?:funded by|funding:|author disclosures?|references\s*:)|\b(?:consulting|consultancy|honoraria|speakers.? bureau)\b|\bUroToday\s*[-–—]\s*GU OncToday brings coverage\b)/i.test(value);
}

export function meaningfulArticleExcerpt(value: string): string {
  return value.split(/(?<=[.!?])\s+(?=[A-Z(])/).filter((sentence) => !articleExcerptIsBoilerplate(sentence)).join(" ").trim();
}

/** Hide boilerplate-only descriptions; preserve the complete source when real text exists. */
export function articleSourceText(preview: string, full: string): { preview: string; full: string } {
  const meaningful = meaningfulArticleExcerpt(full);
  return { preview: meaningfulArticleExcerpt(preview) || meaningful, full: meaningful ? full : "" };
}

/** Deterministic previews make disclosure depend on hidden content, not viewport width. */
export function articleTextPreview(text: string, maxChars = 360): string {
  if (text.length <= maxChars) return text;
  const prefix = text.slice(0, maxChars);
  return `${prefix.slice(0, prefix.lastIndexOf(" ") > maxChars / 2 ? prefix.lastIndexOf(" ") : maxChars).trimEnd()}…`;
}

export function articleExpansion(source: { preview: string; full: string }, comments: string[], availableComments = comments.length) {
  const preview = articleTextPreview(source.preview);
  const moreSource = Boolean(source.full && source.full !== preview);
  const count = Math.max(comments.length, availableComments);
  const moreComments = count > 1 || count > comments.length || comments.some((text) => articleTextPreview(text, 220) !== text);
  const commentLabel = `Read ${count} full comment${count === 1 ? "" : "s"}`;
  return {
    preview,
    canExpand: moreSource || moreComments,
    label: moreSource
      ? `Full source excerpt${moreComments ? ` + ${count} comment${count === 1 ? "" : "s"}` : ""}`
      : commentLabel,
  };
}

type DisplaySourceLink = {
  sourceLabel?: unknown;
  label?: unknown;
  title?: unknown;
  url?: unknown;
};

function linkText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Legacy regulatory links used `label`; preserve that reader-visible identity without changing the source. */
export function sourceLinkLabel(link: DisplaySourceLink): string {
  const explicit = linkText(link.sourceLabel) ?? linkText(link.label) ?? linkText(link.title);
  if (explicit) return explicit;
  const url = linkText(link.url);
  if (!url) return "Source";
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.hostname.replace(/^www\./, "") || "Source" : "Source";
  } catch {
    return "Source";
  }
}

/** Source rows can lack legacy IDs, but their validated URLs remain stable identities. */
export function sourceLinkKey(role: string, url: string): string {
  try {
    return `${role}:${new URL(url).toString().toLowerCase()}`;
  } catch {
    return `${role}:${url}`;
  }
}

export function readoutRegulatoryCoverage(
  published: Array<{ kind?: string; evidence?: string | null }>,
  visible: Array<{ kind?: string; evidence?: string | null }>,
) {
  const isRegulatory = (item: { kind?: string; evidence?: string | null }) => item.kind === "event"
    || (item.kind !== "episode" && /approval|label|safety|regulatory/i.test(item.evidence ?? ""));
  const hasPublished = published.some(isRegulatory);
  const hasVisible = visible.some(isRegulatory);
  return { hasPublished, status: hasVisible ? "Covered above" : hasPublished ? "Included in this edition" : "Nothing new" };
}
