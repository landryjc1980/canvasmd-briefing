import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_SKIP_SECONDS,
  clampSeekTime,
  cuePlaybackSelection,
  formatPlaybackTime,
  mediaFragmentUrl,
  millisecondsToSeconds,
  returnAudioToCitation,
  seekAudioBy,
  seekAudioTo,
} from "../app/rounds-lab/playerEngine.ts";

class FakeAudio {
  #currentTime = 0;

  constructor() {
    this.src = "";
    this.pauseCalls = 0;
    this.loadCalls = 0;
    this.seeks = [];
  }

  get currentTime() {
    return this.#currentTime;
  }

  set currentTime(value) {
    this.#currentTime = value;
    this.seeks.push(value);
  }

  pause() {
    this.pauseCalls += 1;
  }

  load() {
    this.loadCalls += 1;
  }
}

test("player timestamps and media fragments remain deterministic", () => {
  assert.equal(millisecondsToSeconds(490_000), 490);
  assert.equal(millisecondsToSeconds(-1), 0);
  assert.equal(millisecondsToSeconds(Number.NaN), 0);
  assert.equal(formatPlaybackTime(0), "0:00");
  assert.equal(formatPlaybackTime(490.9), "8:10");
  assert.equal(formatPlaybackTime(3_661), "1:01:01");
  assert.equal(
    mediaFragmentUrl("https://audio.example/episode.mp3?source=rss", 490),
    "https://audio.example/episode.mp3?source=rss#t=490",
  );
  assert.equal(
    mediaFragmentUrl("https://audio.example/episode.mp3#old", -10),
    "https://audio.example/episode.mp3#t=0",
  );
});

test("seeking mutates an audio-like object and clamps both boundaries", () => {
  const audio = new FakeAudio();

  assert.equal(seekAudioTo(audio, 45.5, 120), 45.5);
  assert.equal(audio.currentTime, 45.5);
  assert.equal(seekAudioTo(audio, -20, 120), 0);
  assert.equal(audio.currentTime, 0);
  assert.equal(seekAudioTo(audio, 180, 120), 120);
  assert.equal(audio.currentTime, 120);
  assert.deepEqual(audio.seeks, [45.5, 0, 120]);

  assert.equal(clampSeekTime(Number.NaN, 120), 0);
  assert.equal(clampSeekTime(20, Number.NaN), 0);
});

test("15-second navigation and return-to-citation use the same bounded seek path", () => {
  const audio = new FakeAudio();

  assert.equal(seekAudioBy(audio, 8, -PLAYER_SKIP_SECONDS, 100), 0);
  assert.equal(seekAudioBy(audio, 93, PLAYER_SKIP_SECONDS, 100), 100);
  assert.equal(returnAudioToCitation(audio, 42, 100), 42);
  assert.equal(returnAudioToCitation(audio, 142, 100), 100);
  assert.deepEqual(audio.seeks, [0, 100, 42, 100]);
});

test("a new source loads a media fragment while same-source requests reseek in place", () => {
  const audio = new FakeAudio();
  const baseCue = {
    sourceId: "uromigos-508",
    audioUrl: "https://audio.example/uromigos-508.mp3",
    startMs: 490_000,
    durationSeconds: 2_380,
  };

  const firstCue = cuePlaybackSelection(audio, baseCue, null);
  assert.deepEqual(firstCue, {
    sourceChanged: true,
    sourceId: "uromigos-508",
    startSeconds: 490,
  });
  assert.equal(audio.src, "https://audio.example/uromigos-508.mp3#t=490");
  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.loadCalls, 1);
  assert.deepEqual(audio.seeks, []);

  const secondCue = cuePlaybackSelection(
    audio,
    { ...baseCue, startMs: 767_000 },
    firstCue.sourceId,
  );
  assert.equal(secondCue.sourceChanged, false);
  assert.equal(secondCue.startSeconds, 767);
  assert.equal(audio.currentTime, 767);
  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.loadCalls, 1);

  const boundedReseek = cuePlaybackSelection(
    audio,
    { ...baseCue, startMs: 3_000_000 },
    secondCue.sourceId,
  );
  assert.equal(boundedReseek.sourceChanged, false);
  assert.equal(boundedReseek.startSeconds, 2_380);
  assert.equal(audio.currentTime, 2_380);
  assert.deepEqual(audio.seeks, [767, 2_380]);
});

test("changing episodes reloads instead of carrying over a same-source seek", () => {
  const audio = new FakeAudio();
  audio.currentTime = 767;
  audio.seeks.length = 0;

  const result = cuePlaybackSelection(
    audio,
    {
      sourceId: "uromigos-515",
      audioUrl: "https://audio.example/uromigos-515.mp3",
      startMs: 1_721_000,
      durationSeconds: 2_586,
    },
    "uromigos-508",
  );

  assert.equal(result.sourceChanged, true);
  assert.equal(audio.src, "https://audio.example/uromigos-515.mp3#t=1721");
  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.loadCalls, 1);
  assert.deepEqual(audio.seeks, []);
});
