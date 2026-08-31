export const PLAYER_SKIP_SECONDS = 15;

export type SeekableAudio = {
  currentTime: number;
};

export type CueableAudio = SeekableAudio & {
  src: string;
  pause: () => void;
  load: () => void;
};

export type PlaybackCue = {
  sourceId: string;
  audioUrl: string;
  startMs: number;
  durationSeconds: number;
};

export type PlaybackCueResult = {
  sourceChanged: boolean;
  sourceId: string;
  startSeconds: number;
};

export function millisecondsToSeconds(milliseconds: number) {
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? milliseconds / 1_000
    : 0;
}

export function formatPlaybackTime(value: number) {
  const seconds = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = String(seconds % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

export function mediaFragmentUrl(audioUrl: string, startSeconds: number) {
  const fragmentStart = Number.isFinite(startSeconds) && startSeconds > 0
    ? startSeconds
    : 0;
  return `${audioUrl.split("#", 1)[0]}#t=${fragmentStart}`;
}

export function clampSeekTime(nextTime: number, durationSeconds: number) {
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : 0;
  const requested = Number.isFinite(nextTime) ? nextTime : 0;
  return Math.max(0, Math.min(requested, duration));
}

export function seekAudioTo(
  audio: SeekableAudio,
  nextTime: number,
  durationSeconds: number,
) {
  const bounded = clampSeekTime(nextTime, durationSeconds);
  audio.currentTime = bounded;
  return bounded;
}

export function seekAudioBy(
  audio: SeekableAudio,
  currentTime: number,
  deltaSeconds: number,
  durationSeconds: number,
) {
  return seekAudioTo(audio, currentTime + deltaSeconds, durationSeconds);
}

export function returnAudioToCitation(
  audio: SeekableAudio,
  citedStartSeconds: number,
  durationSeconds: number,
) {
  return seekAudioTo(audio, citedStartSeconds, durationSeconds);
}

export function cuePlaybackSelection(
  audio: CueableAudio,
  cue: PlaybackCue,
  loadedSourceId: string | null,
): PlaybackCueResult {
  const startSeconds = clampSeekTime(
    millisecondsToSeconds(cue.startMs),
    cue.durationSeconds,
  );
  const sourceChanged = loadedSourceId !== cue.sourceId;

  if (sourceChanged) {
    audio.pause();
    audio.src = mediaFragmentUrl(cue.audioUrl, startSeconds);
    audio.load();
  } else {
    seekAudioTo(audio, startSeconds, cue.durationSeconds);
  }

  return { sourceChanged, sourceId: cue.sourceId, startSeconds };
}
