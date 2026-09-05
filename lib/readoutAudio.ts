export type ReadoutAudioChapter = {
  headline: string;
  source?: string;
  summary?: string;
  startSeconds: number;
  endSeconds?: number;
  depth?: number;
};

/** Public playback fields only; scripts and internal generation details stay server-side. */
export type ReadoutAudioEdition = {
  id: string;
  edition_date: string;
  selection_version?: string | null;
  title: string;
  summary: string;
  audio_url: string;
  duration_seconds: number;
  source_generated_at: string | null;
  chapters: ReadoutAudioChapter[];
};

export function audioReflectsEarlierUpdate(expectedVersion?: string | null, recordedVersion?: string | null): boolean {
  return Boolean(expectedVersion && expectedVersion !== recordedVersion);
}

export function readoutAudioDates(values: string[]): string[] {
  return [...new Set(values.filter((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }))].sort().reverse().slice(0, 7);
}
