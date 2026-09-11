import type { ReadoutAudioChapter, ReadoutAudioEdition } from "./readoutAudio";

const normalizedText = (value = "") => value.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const isEmptyRegulatoryWatch = (summary = "") =>
  /^(?:no new (?:(?:oncology|regulatory) )?actions?(?: in this edition)?|no new oncology approval, safety warning, or designation cleared today)[.!]?$/.test(normalizedText(summary));
const isRegulatoryRecapPointer = (summary = "") => /^covered in today'?s lead stories[.!]?$/.test(normalizedText(summary));

// Keep these presentation rules aligned with Native's mornings-presentation.ts.
// Only producer scaffolding changes; source claims, recordings and timestamps do not.
export function morningsHasRegulatoryCoverage(chapters: ReadoutAudioChapter[]): boolean {
  return chapters.some((chapter) => normalizedText(chapter.headline) === "regulatory watch"
    && Boolean(chapter.summary?.trim()) && !isEmptyRegulatoryWatch(chapter.summary));
}

export function morningsProducerSummary(audio: Pick<ReadoutAudioEdition, "chapters" | "summary">): string {
  if (morningsHasRegulatoryCoverage(audio.chapters)) return audio.summary.trim();
  return audio.summary
    .replace(/,?\s+and (?:a quiet )?Regulatory Watch(?=[.!]|$)/gi, "")
    .replace(/\s*·\s*Regulatory Watch(?=[.!]|$)/gi, "")
    .replace(/^A narrated briefing of (\d+) papers?, (\d+) podcast episodes?\./, (_match, papers, episodes) => {
      const parts = [Number(papers) ? `${papers} paper${Number(papers) === 1 ? "" : "s"}` : "", Number(episodes) ? `${episodes} podcast episode${Number(episodes) === 1 ? "" : "s"}` : ""].filter(Boolean);
      return parts.length ? `A narrated briefing of ${parts.join(" and ")}.` : "A narrated oncology briefing.";
    }).trim();
}

export function morningsPlayableChapters(chapters: ReadoutAudioChapter[]): ReadoutAudioChapter[] {
  const hasRegulatory = morningsHasRegulatoryCoverage(chapters);
  return chapters.filter((chapter) => {
    if (chapter.headline === "Next" && chapter.summary === "A new story.") return false;
    const headline = normalizedText(chapter.headline);
    if (/^sources?(?: and| &) receipts?$/.test(headline)) return false;
    return headline !== "regulatory watch" || !(isEmptyRegulatoryWatch(chapter.summary) || isRegulatoryRecapPointer(chapter.summary));
  }).map((chapter) => {
    if (hasRegulatory || !/^today'?s (briefing|readout)$/.test(normalizedText(chapter.headline))) return chapter;
    const summary = morningsProducerSummary({ chapters, summary: chapter.summary ?? "" });
    return summary === chapter.summary ? chapter : { ...chapter, summary };
  });
}

export function morningsEditionDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Edition date unavailable";
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Edition date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
