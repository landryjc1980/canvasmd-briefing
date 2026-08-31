import type { SourceConversation } from "../fixture";
import type { SourceTranscriptRecord, TranscriptSegment } from "../reviewModel";

export const MAX_TRANSCRIPT_CONTEXTS_PER_SOURCE = 8;
export const MAX_TRANSCRIPT_CONTEXTS = 40;

export type SearchableTranscriptSource = {
  source: SourceConversation;
  transcript: SourceTranscriptRecord;
};

export type TranscriptSearchContext = {
  id: string;
  anchorSegment: TranscriptSegment;
  contextLabel: string;
  contextText: string;
  matchKind: "Source metadata" | "Transcript wording";
};

export type TranscriptSearchGroup = SearchableTranscriptSource & {
  totalMatchCount: number;
  matches: TranscriptSearchContext[];
};

export type TranscriptSearchResults = {
  totalMatchCount: number;
  shownMatchCount: number;
  groups: TranscriptSearchGroup[];
};

export function normalizeTranscriptSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTranscriptSearchResults(
  sources: SearchableTranscriptSource[],
  rawQuery: string,
): TranscriptSearchResults {
  const query = normalizeTranscriptSearch(rawQuery);
  if (!query) {
    return { totalMatchCount: 0, shownMatchCount: 0, groups: [] };
  }

  let totalMatchCount = 0;
  let shownMatchCount = 0;
  const groups: TranscriptSearchGroup[] = [];

  for (const sourceRecord of sources) {
    const { source, transcript } = sourceRecord;
    const metadata = normalizeTranscriptSearch([
      source.citationLabel,
      source.show,
      source.episode,
      source.published,
      transcript.origin,
      transcript.methodLabel,
    ].join(" "));
    const sourceMatches: TranscriptSearchContext[] = [];
    let sourceMatchCount = 0;

    if (metadata.includes(query) && transcript.segments[0]) {
      const anchorSegment = transcript.segments[0];
      sourceMatchCount += 1;
      sourceMatches.push({
        id: `${source.id}:metadata`,
        anchorSegment,
        contextLabel: "Source metadata",
        contextText: `${source.show} · ${source.episode} · Published ${source.published}`,
        matchKind: "Source metadata",
      });
    }

    let lastAcceptedWindowEnd = -1;
    for (let index = 0; index < transcript.segments.length; index += 1) {
      const currentSegment = transcript.segments[index];
      if (!currentSegment) continue;
      const nextSegment = transcript.segments[index + 1];
      const searchablePair = normalizeTranscriptSearch([
        currentSegment.text,
        nextSegment?.text,
      ].filter(Boolean).join(" "));
      const searchableTimestamps = normalizeTranscriptSearch([
        currentSegment.timestamp,
        nextSegment?.timestamp,
      ].filter(Boolean).join(" "));
      if (!searchablePair.includes(query) && !searchableTimestamps.includes(query)) continue;

      const windowStart = Math.max(0, index - 1);
      const windowEnd = Math.min(transcript.segments.length - 1, index + 1);
      if (windowStart <= lastAcceptedWindowEnd) continue;
      lastAcceptedWindowEnd = windowEnd;
      sourceMatchCount += 1;

      if (sourceMatches.length >= MAX_TRANSCRIPT_CONTEXTS_PER_SOURCE) continue;
      const contextSegments = transcript.segments.slice(windowStart, windowEnd + 1);
      const firstContextSegment = contextSegments[0] ?? currentSegment;
      const lastContextSegment = contextSegments.at(-1) ?? currentSegment;
      sourceMatches.push({
        id: `${source.id}:${firstContextSegment.id}:${lastContextSegment.id}`,
        anchorSegment: currentSegment,
        contextLabel: firstContextSegment.id === lastContextSegment.id
          ? firstContextSegment.timestamp
          : `${firstContextSegment.timestamp}–${lastContextSegment.timestamp}`,
        contextText: contextSegments.map((segment) => segment.text).join(" "),
        matchKind: "Transcript wording",
      });
    }

    totalMatchCount += sourceMatchCount;
    const remainingGlobalSlots = Math.max(0, MAX_TRANSCRIPT_CONTEXTS - shownMatchCount);
    const shownMatches = sourceMatches.slice(0, remainingGlobalSlots);
    if (shownMatches.length > 0) {
      groups.push({
        ...sourceRecord,
        totalMatchCount: sourceMatchCount,
        matches: shownMatches,
      });
      shownMatchCount += shownMatches.length;
    }
  }

  return { totalMatchCount, shownMatchCount, groups };
}
