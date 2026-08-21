import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionDailyReactions } from "../app/dailyEvidence.ts";

const reaction = (id, areas, sourceAreas, referenceAreas = []) => ({ id, areas, sourceAreas, referenceAreas });

test("Daily evidence keeps reference experts local and labels nonlocal voices across oncology", () => {
  const local = reaction("local", ["GU"], ["GU"]);
  const reference = reaction("reference", ["GU"], ["Skin"], ["GU"]);
  const across = reaction("across", ["Skin"], ["Skin"]);
  const result = partitionDailyReactions([local, reference, across], ["GU", "Skin"], "GU");
  assert.deepEqual(result.local.map((row) => row.id), ["local", "reference"]);
  assert.deepEqual(result.across, []);
});

test("a specialty-relevant story retains only evidence assigned to that edition", () => {
  const across = reaction("across", ["GU", "Skin"], ["Skin"]);
  const result = partitionDailyReactions([across], ["GU", "Skin"], "GU");
  assert.deepEqual(result.local, []);
  assert.deepEqual(result.across, [across]);
});
