import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const webCard = fs.readFileSync(new URL("../app/ReaderView.tsx", import.meta.url), "utf8");
const webVm = fs.readFileSync(new URL("../app/briefVM.ts", import.meta.url), "utf8");
const nativeCard = fs.readFileSync(new URL("../../canvasmd/components/readout/cards.tsx", import.meta.url), "utf8");
const nativeVm = fs.readFileSync(new URL("../../canvasmd/components/readout/vm.ts", import.meta.url), "utf8");
const ingest = fs.readFileSync(new URL("../../canvasmd/supabase/functions/x-official-ingest/index.ts", import.meta.url), "utf8");
const briefing = fs.readFileSync(new URL("../../canvasmd/supabase/functions/briefing/index.ts", import.meta.url), "utf8");

test("X ingestion preserves long posts and bounded same-author threads", () => {
  assert.match(ingest, /note_tweet/);
  assert.match(ingest, /conversation_id:/);
  assert.match(ingest, /thread_parts:/);
  assert.match(briefing, /thread_parts/);
});

test("web and native source receipts expose the same thread disclosure", () => {
  for (const source of [webCard, nativeCard]) {
    assert.match(source, /Show full thread/);
    assert.match(source, /Show full post/);
    assert.match(source, /Show less/);
  }
});

test("web and native remove labels orphaned by t.co cleanup", () => {
  const orphanLabelPattern = /\(\?:Article\|Paper\|Link\)/;
  assert.match(webVm, orphanLabelPattern);
  assert.match(nativeVm, orphanLabelPattern);
});
