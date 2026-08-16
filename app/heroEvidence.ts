import type { BriefingData, BriefingPod, BriefingSharer, HeroCard, HeroSupportLink } from "@/lib/types";

// Pure hero-card → receipts resolution (Codex: extracted and tested — exact paper, episode,
// thread, missing-evidence, and publisher cases). Type-only imports keep this loadable under
// node:test. Views map the resolved DATA to JSX; nothing here re-ranks or re-selects.
export type ResolvedEvidence =
  | { kind: "paper"; story: unknown; faces: string[]; publisherPosts: BriefingSharer[]; otherPosts: BriefingSharer[]; supportLinks: HeroSupportLink[] }
  | { kind: "article"; posts: BriefingSharer[]; faces: string[]; publishers: string[]; publisherPosts: BriefingSharer[]; otherPosts: BriefingSharer[]; paper: Record<string, unknown>; supportLinks: HeroSupportLink[] }
  | { kind: "episode"; pods: BriefingPod[]; faces: string[] }
  | { kind: "thread"; post: BriefingSharer; faces: string[] }
  | { kind: "event"; posts: BriefingSharer[]; publisherPosts: BriefingSharer[]; otherPosts: BriefingSharer[]; supportLinks: HeroSupportLink[]; faces: string[] }
  | null;

export function resolveHeroEvidence(
  c: Pick<HeroCard, "kind" | "anchorId" | "url" | "headline" | "momentStartMs" | "amplifiers" | "support">,
  data: Pick<BriefingData, "topStories" | "topArticles" | "movers" | "heroCandidates">,
): ResolvedEvidence {
  if (c.kind === "paper") {
    // Publisher POSTS are receipts too (John: the drawer named publishers but never showed
    // their tweet) — they live on the reading-list row, so look them up for BOTH join paths.
    const reading = (data.topArticles ?? []).find((x) => x.url === c.url);
    const publisherPosts = reading?.publisherPosts ?? [];
    const otherPosts = reading?.otherPosts ?? [];
    const st = (data.topStories ?? []).find((t) => t.kind === "paper" && (t.papers?.[0]?.url === c.url || t.headline === c.headline));
    if (st) return { kind: "paper", story: st, faces: (st.posts ?? []).map((p) => p.avatar).filter((a): a is string => !!a).slice(0, 4), publisherPosts: st.publisherPosts ?? st.papers?.[0]?.publisherPosts ?? publisherPosts, otherPosts: st.otherPosts ?? st.papers?.[0]?.otherPosts ?? otherPosts, supportLinks: c.support?.links ?? [] };
    const a = reading;
    if (a) return { kind: "article", posts: a.posts ?? [], faces: a.faces ?? [], publishers: a.publishers ?? [], publisherPosts, otherPosts, paper: { title: a.title, url: a.url, journal: a.journal, domain: a.domain, abstract: a.abstract, sharers: [], topLikes: a.topLikes, publishers: a.publishers, peerReviewed: a.peerReviewed }, supportLinks: c.support?.links ?? [] };
    return null;
  }
  if (c.kind === "episode") {
    // EXACT moment references from the card — resolve, never re-select (Codex High #2).
    // Search the dedicated receipts channel FIRST (movers' pod arrays cap at 2 clips/episode,
    // so a selected moment may exist only there), then the movers pods.
    const all = [...(data.heroCandidates?.receipts ?? []), ...(data.movers ?? []).flatMap((m) => m.podcast ?? [])]
      .filter((p) => p.episodeId === c.anchorId);
    const refs = c.momentStartMs ?? [];
    // ALL-OR-NOTHING (Codex invariant): the card says "N selected moments" — the drawer must
    // show exactly those N or nothing at all. A partial resolve would silently contradict the
    // count; no refs (pre-cutover snapshot) likewise means no drawer, never a re-selected guess.
    const maybe = refs.map((ms) => all.find((p) => p.startMs === ms));
    if (!refs.length || maybe.some((p) => !p)) return null;
    const pods = maybe as BriefingPod[];
    const ampFaces = (c.amplifiers ?? []).map((a) => a.avatar).filter((a): a is string => !!a);
    return { kind: "episode", pods, faces: [...ampFaces, ...pods.map((p) => p.showArt).filter((a): a is string => !!a)].slice(0, 4) };
  }
  if (c.kind === "thread") {
    const post = (data.movers ?? []).flatMap((m) => m.posts ?? []).find((p) => p.tweetUrl === c.url);
    if (!post) return null;
    return { kind: "thread", post, faces: post.avatar ? [post.avatar] : [] };
  }
  if (c.kind === "event" && c.support) {
    const posts = c.support.clinicianPosts;
    const publisherPosts = c.support.publisherPosts;
    const otherPosts = c.support.otherPosts ?? [];
    const supportLinks = c.support.links;
    if (!posts.length && !publisherPosts.length && !otherPosts.length && !supportLinks.length) return null;
    const faces = [...posts, ...publisherPosts, ...otherPosts].map((post) => post.avatar)
      .filter((avatar): avatar is string => !!avatar).filter((avatar, i, all) => all.indexOf(avatar) === i).slice(0, 4);
    return { kind: "event", posts, publisherPosts, otherPosts, supportLinks, faces };
  }
  return null;
}
