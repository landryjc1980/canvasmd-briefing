export type ThreadPart = { id: string; text: string; tweetUrl: string | null };

function canonicalStatusId(url: string | null | undefined): string | null {
  return url?.match(/\/status\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
}

function chronologicalThreadOrder(left: ThreadPart, right: ThreadPart): number {
  // X IDs exceed Number.MAX_SAFE_INTEGER. Numeric-string comparison keeps their
  // canonical chronology without ever rounding an identifier.
  if (!/^\d+$/.test(left.id) || !/^\d+$/.test(right.id)) return 0;
  return left.id.length - right.id.length || left.id.localeCompare(right.id);
}

export function availableThreadParts(
  parts: readonly ThreadPart[] | null | undefined,
  rootTweetUrl: string | null | undefined,
  cleanText: (value: string | null | undefined) => string,
): ThreadPart[] {
  const seen = new Set<string>();
  const rootId = canonicalStatusId(rootTweetUrl);
  return (parts ?? []).flatMap((part) => {
    const text = cleanText(part.text);
    if (!text || part.id === rootId) return [];
    const key = part.id || `${part.tweetUrl ?? ""}:${text}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...part, text }];
  }).sort(chronologicalThreadOrder);
}
