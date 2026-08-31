"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceConversation, SourceReference } from "./fixture";
import {
  PLAYER_SKIP_SECONDS,
  clampSeekTime,
  cuePlaybackSelection,
  formatPlaybackTime,
  millisecondsToSeconds,
  returnAudioToCitation,
  seekAudioBy,
  seekAudioTo,
} from "./playerEngine";

export type RoundsPlayback = {
  source: SourceConversation;
  reference: SourceReference;
  requestId: number;
};

export default function RoundsPlayer({
  playback,
  onClose,
}: {
  playback: RoundsPlayback;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const loadedSourceIdRef = useRef<string | null>(null);
  const requestedStartRef = useRef(millisecondsToSeconds(playback.reference.startMs));
  const startAppliedRef = useRef(false);
  const userSeekedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(millisecondsToSeconds(playback.reference.startMs));
  const [mediaDuration, setMediaDuration] = useState(0);
  const [error, setError] = useState(false);

  const citedStart = millisecondsToSeconds(playback.reference.startMs);
  const duration = mediaDuration > 0 ? mediaDuration : playback.source.durationSeconds;
  const max = Math.max(1, duration);
  const value = Math.min(currentTime, max);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const [timeLabel, ...contextParts] = playback.reference.relevantAt.split(" · ");
  const context = contextParts.join(" · ");

  const applyRequestedStart = useCallback((finalAttempt = false) => {
    const audio = audioRef.current;
    if (!audio || startAppliedRef.current || userSeekedRef.current) return;

    try {
      const nextTime = seekAudioTo(
        audio,
        requestedStartRef.current,
        playback.source.durationSeconds,
      );
      setCurrentTime(nextTime);
      if (finalAttempt) startAppliedRef.current = true;
    } catch {
      // The media fragment still gives redirected podcast enclosures a native seek path.
    }
  }, [playback.source.durationSeconds]);

  const commitUserSeek = (nextTime: number) => {
    startAppliedRef.current = true;
    userSeekedRef.current = true;
    setCurrentTime(nextTime);
  };

  const seekTo = (nextTime: number) => {
    const audio = audioRef.current;
    const bounded = audio
      ? seekAudioTo(audio, nextTime, max)
      : clampSeekTime(nextTime, max);
    commitUserSeek(bounded);
  };

  const seekRelative = (deltaSeconds: number) => {
    const audio = audioRef.current;
    const bounded = audio
      ? seekAudioBy(audio, currentTime, deltaSeconds, max)
      : clampSeekTime(currentTime + deltaSeconds, max);
    commitUserSeek(bounded);
  };

  const returnToCitedMoment = () => {
    const audio = audioRef.current;
    const bounded = audio
      ? returnAudioToCitation(audio, citedStart, max)
      : clampSeekTime(citedStart, max);
    commitUserSeek(bounded);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const startSeconds = millisecondsToSeconds(playback.reference.startMs);
    const isNewSource = loadedSourceIdRef.current !== playback.source.id;
    requestedStartRef.current = startSeconds;
    startAppliedRef.current = false;
    userSeekedRef.current = false;
    setExpanded(false);
    setCurrentTime(startSeconds);
    setMediaDuration(0);
    setError(false);
    setLoading(isNewSource || audio.paused || audio.readyState < 3);

    const cueResult = cuePlaybackSelection(
      audio,
      {
        sourceId: playback.source.id,
        audioUrl: playback.source.audioUrl,
        startMs: playback.reference.startMs,
        durationSeconds: playback.source.durationSeconds,
      },
      loadedSourceIdRef.current,
    );

    if (cueResult.sourceChanged) loadedSourceIdRef.current = cueResult.sourceId;
    else {
      startAppliedRef.current = true;
      setCurrentTime(cueResult.startSeconds);
    }

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise
        .then(() => {
          setLoading(false);
          setPlaying(true);
        })
        .catch(() => {
          setLoading(false);
          setPlaying(false);
        });
    }
  }, [
    applyRequestedStart,
    playback.reference.startMs,
    playback.requestId,
    playback.source.audioUrl,
    playback.source.durationSeconds,
    playback.source.id,
  ]);

  useEffect(() => {
    playButtonRef.current?.focus({ preventScroll: true });
  }, [playback.requestId]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      audioRef.current?.pause();
      onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      loadedSourceIdRef.current = null;
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      setLoading(true);
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => {
            setLoading(false);
            setPlaying(true);
          })
          .catch(() => {
            setLoading(false);
            setPlaying(false);
          });
      }
    } else {
      audio.pause();
    }
  };

  const closePlayer = () => {
    audioRef.current?.pause();
    onClose();
  };

  return (
    <aside
      id="rounds-full-episode-player"
      className={`rl-player${expanded ? " is-expanded" : ""}`}
      aria-label="Full episode player"
    >
      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setMediaDuration(Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0);
          applyRequestedStart(false);
        }}
        onCanPlay={() => applyRequestedStart(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setLoading(false);
          setPlaying(false);
        }}
        onEnded={() => setPlaying(false)}
        onError={() => {
          loadedSourceIdRef.current = null;
          setError(true);
          setLoading(false);
          setPlaying(false);
        }}
      />

      <div className="rl-player-inner">
        <div className="rl-player-compact">
          <button
            ref={playButtonRef}
            type="button"
            className={`rl-player-play${loading ? " is-loading" : ""}`}
            onClick={togglePlayback}
            aria-label={`${playing ? "Pause" : "Play"} ${playback.source.episode} from ${timeLabel}`}
          >
            {loading ? (
              <span className="rl-player-spinner" aria-hidden="true" />
            ) : playing ? (
              <span aria-hidden="true">Ⅱ</span>
            ) : (
              <span aria-hidden="true">▶</span>
            )}
          </button>

          <div className="rl-player-copy" aria-live="polite">
            <span>Full episode · {playback.source.citationLabel} · {timeLabel}</span>
            <strong>{playback.source.episode}</strong>
          </div>

          <span className="rl-player-current" aria-hidden="true">{formatPlaybackTime(currentTime)}</span>

          <button
            type="button"
            className="rl-player-expand"
            aria-expanded={expanded}
            aria-controls="rounds-player-details"
            onClick={() => setExpanded((open) => !open)}
            aria-label={expanded ? "Collapse full episode controls" : "Expand full episode controls"}
          >
            <span aria-hidden="true">{expanded ? "⌄" : "⌃"}</span>
          </button>

          <button
            type="button"
            className="rl-player-close"
            onClick={closePlayer}
            aria-label="Close full episode player"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="rl-player-details" id="rounds-player-details" hidden={!expanded}>
          <div className="rl-player-moment">
            <span>Cited moment</span>
            <strong>{timeLabel}{context ? ` · ${context}` : ""}</strong>
          </div>

          <div className="rl-player-skip-controls" aria-label="Playback navigation">
            <button type="button" onClick={() => seekRelative(-PLAYER_SKIP_SECONDS)} aria-label="15 seconds backward">
              <span aria-hidden="true">−15</span>
            </button>
            <button type="button" className="rl-player-return" onClick={returnToCitedMoment}>
              Return to cited moment
            </button>
            <button type="button" onClick={() => seekRelative(PLAYER_SKIP_SECONDS)} aria-label="15 seconds forward">
              <span aria-hidden="true">+15</span>
            </button>
          </div>

          <div className="rl-player-timeline">
            <input
              type="range"
              min={0}
              max={max}
              step="any"
              value={value}
              onChange={(event) => seekTo(Number(event.target.value))}
              style={{ ["--rl-player-progress" as string]: `${progress}%` }}
              aria-label={`Seek ${playback.source.episode}`}
              aria-valuetext={`${formatPlaybackTime(currentTime)} of ${formatPlaybackTime(duration)}`}
            />
            <div className="rl-player-times">
              <span>{formatPlaybackTime(currentTime)}</span>
              <span>{formatPlaybackTime(duration)}</span>
            </div>
          </div>

          <a
            className="rl-player-source-link"
            href={playback.source.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open the publisher page for ${playback.source.episode} in a new tab`}
          >
            Episode page <span aria-hidden="true">↗</span>
          </a>

          {error && (
            <p className="rl-player-error" role="status">
              This enclosure could not load. The publisher page remains available.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
