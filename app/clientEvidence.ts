export function clipSecond(ms: number | null): number {
  return ms == null ? 0 : Math.max(0, Math.round(ms / 1000));
}

export const DAILY_MUTED = "#5f6267";

export function dailyAccentOf(area: string, accent: string): string {
  return area === "GI" ? "#8c4b05" : accent;
}

export function evidenceBackedHeroWhy(why: string | null | undefined, hasEvidence: boolean): string | null {
  const text = why?.trim();
  return hasEvidence && text ? text : null;
}

type PublisherReceipt = { name?: string | null; handle?: string | null };

const publisherKey = (value: string | null | undefined): string =>
  (value ?? "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]+/g, "");

export function unrepresentedPublishers(names: string[] | null | undefined, posts: PublisherReceipt[] | null | undefined): string[] {
  const receiptKeys = (posts ?? []).flatMap((post) => [publisherKey(post.name), publisherKey(post.handle)]).filter(Boolean);
  return [...new Set(names ?? [])].filter((name) => {
    const key = publisherKey(name);
    return key && !receiptKeys.some((receipt) => receipt === key || receipt.includes(key) || key.includes(receipt));
  });
}

type SourceAnchoredItem = {
  kind?: string | null;
  id?: string | null;
  anchorId?: string | null;
  papers?: { url?: string | null; doi?: string | null; pmid?: string | null; title?: string | null }[] | null;
  podcast?: { episodeId?: string | null; audioUrl?: string | null; episodeTitle?: string | null }[] | null;
};

/** Count developments, never receipts, so All Oncology ordering remains comparable. */
export function distinctSourceAnchorCount(items: SourceAnchoredItem[] | null | undefined): number {
  const anchors = new Set<string>();
  for (const item of items ?? []) {
    const paper = item.papers?.[0];
    const episode = item.podcast?.[0];
    const identity = item.anchorId
      ?? paper?.doi ?? paper?.pmid ?? paper?.url ?? paper?.title
      ?? episode?.episodeId ?? episode?.audioUrl ?? episode?.episodeTitle
      ?? item.id;
    if (identity) anchors.add(`${item.kind ?? "story"}:${identity}`.toLowerCase());
  }
  return anchors.size;
}
