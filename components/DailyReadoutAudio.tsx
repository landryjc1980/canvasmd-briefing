"use client";

import { useEffect, useState } from "react";
import AudioQuote from "@/components/AudioQuote";
import { audioReflectsEarlierUpdate, readoutAudioDates, type ReadoutAudioEdition } from "@/lib/readoutAudio";
import { morningsEditionDate, morningsPlayableChapters } from "@/lib/morningsPresentation";
import type { ReadoutAudioChapter } from "@/lib/readoutAudio";

const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));

function ChapterChevron({ expanded = false }: { expanded?: boolean }) {
  return <svg className={`er-mornings-chevron${expanded ? " is-expanded" : ""}`} viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 7.5 5 5 5-5" />
  </svg>;
}

const clockTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export default function DailyReadoutAudio({ dates, expectedVersions = {} }: { dates: string[]; expectedVersions?: Record<string, string | null | undefined> }) {
  const key = readoutAudioDates(dates).join(",");
  const [editions, setEditions] = useState<ReadoutAudioEdition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    setSelected(null);
    setEditions([]);
    const refresh = async () => {
      if (!key || pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch(`/api/readout-audio?dates=${encodeURIComponent(key)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data?.editions)) {
          setEditions(data.editions);
          setSelected((current) => current ?? data.editions[0]?.id ?? null);
        }
      } catch { /* Missing audio must never block the written edition. */ }
      finally { pending = false; }
    };
    void refresh();
    // Audio may publish after the written edition. Refresh without clearing a playing card.
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [key]);
  const edition = editions.find((item) => item.id === selected) ?? editions[0];
  if (!edition) return null;
  return <MorningsAudioCard key={`${edition.id}:${edition.audio_url}`} edition={edition} editions={editions}
    onEditionChange={setSelected} expectedVersion={expectedVersions[edition.edition_date]} />;
}

export function MorningsAudioCard({ edition, editions, onEditionChange, expectedVersion }: {
  edition: ReadoutAudioEdition;
  editions: ReadoutAudioEdition[];
  onEditionChange: (id: string) => void;
  expectedVersion?: string | null;
}) {
  const [seek, setSeek] = useState<{ seconds: number; requestId: number }>();
  const [position, setPosition] = useState(0);
  const [listenOpen, setListenOpen] = useState(false);
  const chapters = morningsPlayableChapters(edition.chapters);
  const hasListenParent = chapters.some((chapter) => chapter.source === "Listen" && chapter.depth !== 1);
  const visibleChapters = chapters.filter((chapter) => chapter.depth !== 1 || !hasListenParent || listenOpen);
  // An edition note is the narrator's omission notice, not a story: it reads as a footnote under
  // the chapter list rather than as a chapter of its own.
  // `chapters` has already run through morningsPlayableChapters, which normalizes a legacy
  // "edition note" headline to the plural "Edition notes" — match both forms here.
  const isEditionNote = (chapter: ReadoutAudioChapter) => /^edition notes?$/i.test(chapter.headline.trim());
  const chapterRows = visibleChapters.filter((chapter) => !isEditionNote(chapter));
  const editionNotes = chapters.filter(isEditionNote).map((chapter) => chapter.summary?.trim()).filter((note): note is string => !!note);
  const activeChapter = [...chapters].reverse().find((chapter) => position >= chapter.startSeconds) ?? chapters[0];
  const reflectsEarlierUpdate = audioReflectsEarlierUpdate(expectedVersion, edition.selection_version);
  const title = `Oncology Mornings — ${morningsEditionDate(edition.edition_date)}`;
  return <section className="er-daily-audio" aria-label="Oncology Mornings">
    <div className="er-daily-audio-heading">
      <div className="er-mornings-brand">
        <p className="er-mornings-eyebrow">The daily audio edition</p>
        <h3><span className="er-mornings-oncology">Oncology</span><span className="er-mornings-title">Mornings</span></h3>
      </div>
      <div className="er-mornings-editions">
        <svg className="er-mornings-sunrise" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M3 23h26M6 28h20M8 23a8 8 0 0 1 16 0M16 5v5M4 13l3 3M28 13l-3 3M16 15V9m-3 3 3-3 3 3" />
        </svg>
        <label className="er-mornings-edition-picker"><span className="er-mornings-picker-label">Edition</span>
          <span className="er-picker"><select aria-label="Audio edition" value={edition.id} onChange={(event) => onEditionChange(event.target.value)}>
            {editions.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.edition_date)}</option>)}
          </select></span>
        </label>
      </div>
    </div>
    <p className="er-mornings-tagline">Your daily oncology briefing.</p>
    <p className="er-mornings-date">AI-narrated · <time dateTime={edition.edition_date}>{morningsEditionDate(edition.edition_date)}</time></p>
    {reflectsEarlierUpdate && <p className="er-audio-asof">Audio reflects an earlier update of this edition.</p>}
    <AudioQuote key={edition.audio_url} audioUrl={edition.audio_url} startMs={0} durationSeconds={edition.duration_seconds}
      eventId={edition.id} eventLabel={title} label={activeChapter?.headline} tone="dark" accent="#fff" seekRequest={seek} onPositionChange={setPosition} />
    {chapters.length > 0 && <details className="er-audio-chapters"><summary><span>Chapters</span><ChapterChevron /><span className="er-mornings-chapter-count">{chapterRows.length} chapter{chapterRows.length === 1 ? "" : "s"} · {clockTime(edition.duration_seconds)}</span></summary>
      <div className="er-mornings-chapter-panel">
        <ol>{chapterRows.map((chapter, index) => {
          const isListen = chapter.source === "Listen" && chapter.depth !== 1 && hasListenParent;
          const chapterTime = clockTime(chapter.startSeconds);
          const isCurrent = activeChapter === chapter;
          const isPlayed = !isCurrent && !!activeChapter && chapter.startSeconds < activeChapter.startSeconds;
          return <li key={`${chapter.startSeconds}-${index}`} className={`${chapter.depth ? "is-subchapter" : ""}${isCurrent ? " is-current" : ""}${isPlayed ? " is-played" : ""}`}>
            <button type="button" aria-current={isCurrent ? "true" : undefined}
              aria-expanded={isListen ? listenOpen : undefined}
              aria-label={isListen ? `${listenOpen ? "Collapse" : "Expand"} Listen episodes` : `Seek to ${chapter.headline} at ${chapterTime}`}
              onClick={() => isListen ? setListenOpen((value) => !value) : setSeek({ seconds: chapter.startSeconds, requestId: Date.now() })}>
              <time className="er-mornings-chapter-time">{chapterTime}</time>
              <span className="er-mornings-chapter-dot" aria-hidden="true" />
              <span className="er-mornings-chapter-copy">
                {chapter.source && <strong>{chapter.source}</strong>}
                <span className="er-mornings-chapter-title">{chapter.headline}{isListen && <ChapterChevron expanded={listenOpen} />}</span>
                {isCurrent && chapter.summary && <span className="er-mornings-chapter-summary">{chapter.summary}</span>}
              </span>
            </button>
          </li>;
        })}</ol>
        {(editionNotes.length > 0 || edition.source_generated_at) && <p className="er-mornings-chapter-foot">
          {editionNotes.map((note, index) => <span key={index}><i>{note}</i> </span>)}
          {edition.source_generated_at && <span>Recorded {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(edition.source_generated_at))}.</span>}
        </p>}
      </div>
    </details>}
  </section>;
}
