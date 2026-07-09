"use client";

import { useCallback, useRef, useState } from "react";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// Click-to-verify audio: expands an inline player seeked to the quoted moment so
// a pharma user can hear the take in context, not just read our transcript of it.
//
// Seeking podcast audio reliably needs two things working together:
//  1. a #t= MEDIA FRAGMENT on the src — the browser's own seeking machinery jumps
//     there natively (survives the CDN redirects podcast enclosures use), and
//  2. a JS fallback that re-seeks on loadedmetadata AND canplay, because autoplay
//     frequently starts at 0 before the fragment is honored. Idempotent: it only
//     nudges when playback is still off-target.
export default function AudioQuote({
  audioUrl,
  startMs,
  label,
}: {
  audioUrl: string;
  startMs: number | null;
  label?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);
  const atMs = startMs ?? 0;
  const atSec = Math.floor(atMs / 1000);
  const hasSeek = startMs != null && atSec > 0;
  const src = hasSeek ? `${audioUrl}#t=${atSec}` : audioUrl;

  const seek = useCallback(() => {
    const el = ref.current;
    if (!el || !hasSeek) return;
    if (Math.abs(el.currentTime - atSec) > 1.5) {
      try {
        el.currentTime = atSec;
      } catch {
        /* range requests unsupported on this source — plays from the top */
      }
    }
  }, [hasSeek, atSec]);

  return (
    <div className="audioq">
      <div className="audiorow">
        <button className="listenbtn" onClick={() => setOpen((o) => !o)}>
          {open ? "▾ Hide audio" : `▶ Listen${startMs != null ? ` at ${fmt(atMs)}` : ""}`}
        </button>
        {label && <span className="audiosrc">{label}</span>}
      </div>
      {open && (
        <audio
          ref={ref}
          src={src}
          controls
          autoPlay
          preload="metadata"
          className="audioel"
          onLoadedMetadata={seek}
          onCanPlay={seek}
        />
      )}
    </div>
  );
}
