import type { BriefingData, BriefingPod, BriefingSharer, HeroCard } from "@/lib/types";

// Pure hero-card → receipts resolution (Codex: extracted and tested — exact paper, episode,
// thread, missing-evidence, and publisher cases). Type-only imports keep this loadable under
// node:test. Views map the resolved DATA to JSX; nothing here re-ranks or re-selects.
export type ResolvedEvidence =
  | { kind: "paper"; story: unknown; faces: string[] }
  | { kind: "article"; posts: BriefingSharer[]; faces: string[]; publishers: string[]; paper: Record<string, unknown> }
  | { kind: "episode"; pods: BriefingPod[]; faces: string[] }
  | { kind: "thread"; post: BriefingSharer; faces: string[] }
  | null;

export function resolveHeroEvidence(
  c: Pick<HeroCard, "kind" | "anchorId" | "url" | "headline" | "momentStartMs">,
  data: Pick<BriefingData, "topStories" | "topArticles" | "movers">,
): ResolvedEvidence {
  if (c.kind === "paper") {
    const st = (data.topStories ?? []).find((t) => t.kind === "paper" && (t.papers?.[0]?.url === c.url || t.headline === c.headline));
    if (st) return { kind: "paper", story: st, faces: (st.posts ?? []).map((p) => p.avatar).filter((a): a is string => !!a).slice(0, 4) };
    const a = (data.topArticles ?? []).find((x) => x.url === c.url);
    if (a) return { kind: "article", posts: a.posts ?? [], faces: a.faces ?? [], publishers: a.publishers ?? [], paper: { title: a.title, url: a.url, journal: a.journal, domain: a.domain, abstract: a.abstract, sharers: [], topLikes: a.topLikes, publishers: a.publishers, peerReviewed: a.peerReviewed } };
    return null;
  }
  if (c.kind === "episode") {
    // EXACT moment references from the card — resolve, never re-select (Codex High #2).
    const all = (data.movers ?? []).flatMap((m) => m.podcast ?? []).filter((p) => p.episodeId === c.anchorId);
    const refs = c.momentStartMs ?? [];
    const pods = refs.length
      ? refs.map((ms) => all.find((p) => p.startMs === ms)).filter((p): p is BriefingPod => !!p)
      : []; // no refs (pre-cutover snapshot) → no drawer rather than a re-selected guess
    if (!pods.length) return null;
    return { kind: "episode", pods, faces: pods.map((p) => p.showArt).filter((a): a is string => !!a).slice(0, 4) };
  }
  if (c.kind === "thread") {
    const post = (data.movers ?? []).flatMap((m) => m.posts ?? []).find((p) => p.tweetUrl === c.url);
    if (!post) return null;
    return { kind: "thread", post, faces: post.avatar ? [post.avatar] : [] };
  }
  return null; // events: the primary-source link IS the receipt
}
