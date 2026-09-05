"use client";

import { useEffect, useState } from "react";
import AudioQuote from "@/components/AudioQuote";
import { readoutAudioDates, type ReadoutAudioEdition } from "@/lib/readoutAudio";

const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));

export default function DailyReadoutAudio({ dates }: { dates: string[] }) {
  const key = readoutAudioDates(dates).join(",");
  const [editions, setEditions] = useState<ReadoutAudioEdition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [seek, setSeek] = useState<{ seconds: number; requestId: number }>();
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
  return <section className="er-daily-audio" aria-label="Daily Readout Audio">
    <div className="er-daily-audio-heading">
      <div><p>ALL ONCOLOGY</p><h3>Daily Readout Audio</h3></div>
      <select aria-label="Audio edition" value={edition.id} onChange={(event) => { setSelected(event.target.value); setSeek(undefined); }}>
        {editions.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.edition_date)}</option>)}
      </select>
    </div>
    <p className="er-daily-audio-summary">{edition.summary}</p>
    {edition.source_generated_at && <p className="er-audio-asof">Recorded edition as of {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(edition.source_generated_at))}. Later updates may appear below.</p>}
    <AudioQuote key={edition.audio_url} audioUrl={edition.audio_url} startMs={0} durationSeconds={edition.duration_seconds}
      eventId={edition.id} eventLabel={edition.title} tone="dark" accent="#fff" seekRequest={seek} />
    {edition.chapters.length > 0 && <details className="er-audio-chapters"><summary>Chapters</summary>
      <ol>{edition.chapters.map((chapter, index) => <li key={`${chapter.startSeconds}-${index}`} className={chapter.depth ? "is-subchapter" : ""}>
        <button type="button" onClick={() => setSeek({ seconds: chapter.startSeconds, requestId: Date.now() })}>
          {chapter.source && <strong>{chapter.source}</strong>}<span>{chapter.headline}</span>
          <time>{Math.floor(chapter.startSeconds / 60)}:{String(Math.floor(chapter.startSeconds % 60)).padStart(2, "0")}</time>
        </button>
      </li>)}</ol>
    </details>}
  </section>;
}
