// The Readout must not claim more than it measured.
//
//   npm test
//
// WHY THIS IS A TEST AND NOT A REVIEW. The stance block reports counts derived from an AI
// classifier reading podcast and X excerpts. Only ~4% of those takes are verbatim quotes; the
// rest are the classifier's paraphrase, and some rows are almost entirely X posts. Wording like
// "how the field is reacting" or "8 favorable voices" turns that into a claim we did not earn —
// and the readers we are building for are exactly the ones who will notice. Once they do, they
// discount the whole product, not just the label.
//
// Reviewing six editions by hand catches it once. This catches it every time.
//
// The rule is about the CLAIM, not the vocabulary: "10 favorable · 3 skeptical" is fine (it
// labels classified excerpts), "10 favorable voices" is not (it counts people).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", "tests"]);

const BANNED = [
  // Claims to have measured what the field/oncologists think.
  [/how the field is reacting/i, 'asserts we measured the field — say "Directional takes detected"'],
  [/field sentiment/i, "we classify excerpts, we do not measure sentiment"],
  [/oncologists (believe|think|say|feel)/i, "puts a view in named professionals' mouths"],
  [/\bthe field (believes|thinks|says)\b/i, "same claim, different phrasing"],
  // Counts PEOPLE rather than classified excerpts. Speaker-level ownership is not real yet:
  // podcast stance is episode-level, so N takes is not N clinicians.
  [/\{[^}]*\}\s*(favorable|skeptical|mixed)\s+(voices|clinicians|doctors|physicians|experts)/i,
    "counts people; stance is episode-level, so N takes is not N clinicians"],
  [/\b\d+\s+(favorable|skeptical)\s+(voices|clinicians|doctors|physicians|experts)\b/i,
    "counts people; stance is episode-level"],
  // "consensus" implies agreement was measured across a population.
  [/\b(clinical|field|expert)\s+consensus\b/i, "implies a measured population, not classified excerpts"],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mdx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = SCAN_DIRS
  .map((d) => path.join(ROOT, d))
  .filter((d) => fs.existsSync(d))
  .flatMap((d) => walk(d));

test("the scan actually covers the reader-facing source", () => {
  assert.ok(files.length > 5, `expected to scan the app source, found ${files.length} files`);
  assert.ok(files.some((f) => f.endsWith("StanceBlock.tsx")), "StanceBlock.tsx must be in scope");
});

test("no reader-facing copy claims more than we measured", () => {
  const hits = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // A line that documents the ban is not a violation of it.
      if (/BANNED|banned|do not use|must not|never say/i.test(line)) return;
      for (const [re, why] of BANNED) {
        if (re.test(line)) {
          hits.push(`${path.relative(ROOT, file)}:${i + 1}  ${why}\n    ${line.trim().slice(0, 110)}`);
        }
      }
    });
  }
  assert.deepEqual(hits, [], `overclaiming copy found:\n\n${hits.join("\n\n")}\n`);
});
