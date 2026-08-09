import type { BriefingData, HeroCard } from "@/lib/types";

// ---- hero-mode contract (spec: thin weeks are signed-correct output) ------------------------
// The ONE accessor every view must use. In hero mode the server-authored deck is
// AUTHORITATIVE — `cards ?? []` — and an EMPTY deck is a valid quiet edition that must
// render as empty, never resurrect legacy topStories (Codex cutover review). Returns null
// only in legacy mode. Type-only imports keep this module loadable under node:test.
export function heroDeckOf(data: Pick<BriefingData, "mode" | "heroCandidates">): HeroCard[] | null {
  return data.mode === "hero" ? (data.heroCandidates?.cards ?? []) : null;
}
