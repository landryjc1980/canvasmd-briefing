"use client";

import { useCallback, useRef, useState } from "react";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Inline podcast player, seeked to the quoted moment. A custom UI (not the raw
// <audio controls>, which renders inconsistent browser chrome): round play/pause,
// a filled scrubber in the area accent, and current/duration times.
//
// Seeking podcast enclosures reliably needs both a #t= MEDIA FRAGMENT on the src
// (the browser's own machinery survives the CDN redirects podcast URLs use) AND a
// JS re-seek on loadedmetadata/canplay (autoplay often starts at 0 before the
// fragment lands). preload="none" so N clips on a page don't each fetch metadata.
export default function AudioQuote({
  audioUrl,
  startMs,
  label,
  accent,
  tone = "light",
}: {
  audioUrl: string;
  startMs: number | null;
  label?: string | null;
  accent?: string; // override the accent (button / scrubber / clip label) — e.g. the tumor color
  tone?: "light" | "dark"; // "dark" = translucent chrome for use on a dark card
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const atSec = startMs != null ? Math.max(0, Math.floor(startMs / 1000)) : 0;
  const hasSeek = startMs != null && atSec > 0;
  const src = hasSeek ? `${audioUrl}#t=${atSec}` : audioUrl;

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const seekedRef = useRef(false);

  // Jump to the quoted moment once, unless the listener has already scrubbed.
  const applyStart = useCallback(() => {
    const el = ref.current;
    if (!el || !hasSeek || seekedRef.current) return;
    if (Math.abs(el.currentTime - atSec) > 1.5) {
      try {
        el.currentTime = atSec;
      } catch {
        /* source doesn't support range requests — plays from the top */
      }
    }
    seekedRef.current = true;
  }, [hasSeek, atSec]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      // one clip at a time — pause any other player on the page
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== el) a.pause();
      });
      applyStart();
      const p = el.play();
      if (p && typeof p.then === "function") p.catch(() => {});
    } else {
      el.pause();
    }
  }, [applyStart]);

  const scrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = ref.current;
    if (!el) return;
    const v = Number(e.target.value);
    seekedRef.current = true; // listener picked their own spot
    el.currentTime = v;
    setCur(v);
  };

  const max = dur > 0 ? dur : 1;
  const val = Math.min(cur, max);
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div className={`aq${tone === "dark" ? " aq-dark" : ""}`} style={accent ? ({ ["--aq-accent" as string]: accent }) : undefined}>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onLoadedMetadata={(e) => {
          setDur(e.currentTarget.duration || 0);
          applyStart();
        }}
        onCanPlay={applyStart}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className={`aq-btn${loading ? " is-loading" : ""}`}
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {loading ? (
          <span className="aq-spin" aria-hidden />
        ) : playing ? (
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
            <path d="M8 5.2v13.6l11-6.8z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="aq-body">
        <input
          className="aq-range"
          type="range"
          min={0}
          max={max}
          step="any"
          value={val}
          onChange={scrub}
          style={{ ["--pct" as string]: `${pct}%` }}
          aria-label="Seek"
        />
        <div className="aq-times">
          <span className="aq-cur">{fmt(cur)}</span>
          {label && <span className="aq-label">{label}</span>}
          {hasSeek && <span className="aq-moment">clip @ {fmt(atSec)}</span>}
          <span className="aq-dur">{dur > 0 ? fmt(dur) : "–:––"}</span>
        </div>
      </div>
    </div>
  );
}
