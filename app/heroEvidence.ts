import type { BriefingData, BriefingPod, BriefingSharer, HeroCard, HeroSupportLink } from "@/lib/types";

const hasReaderText = (value: string | null | undefined): boolean => (value ?? "")
  .replace(/^\s*RT @[A-Za-z0-9_]+:\s*/, "")
  .replace(/https?:\/\/t\.co\/\S+/g, "")
  .replace(/^[ \t]*(?:Article|Paper|Link):[ \t]*$/gim, "")
  .trim().length > 0;

export function pickConversationPreview(...groups: (BriefingSharer[] | null | undefined)[]): BriefingSharer | null {
  for (const post of groups.flatMap((group) => group ?? [])) {
    const isClassicRepost = /^\s*RT @[A-Za-z0-9_]+:\s*/.test(post.text ?? "");
    const main = !isClassicRepost && hasReaderText(post.textEn?.trim() ? post.textEn : post.text);
    const threadHasWords = (post.thread ?? []).some((part) => hasReaderText(part.text));
    if (main || threadHasWords) return post;
  }
  return null;
}

const receiptKey = (post: BriefingSharer): string => {
  const url = post.tweetUrl?.trim().toLowerCase();
  if (url) return `url:${url}`;
  const handle = post.handle?.replace(/^@/, "").trim().toLowerCase() ?? "";
  const text = (post.textEn?.trim() || post.text || "").replace(/\s+/g, " ").trim().toLowerCase();
  return `post:${handle}:${text}`;
};

export function mergeReceiptPosts(...groups: (BriefingSharer[] | null | undefined)[]): BriefingSharer[] {
  const seen = new Set<string>();
  return groups.flatMap((group) => group ?? []).filter((post) => {
    const key = receiptKey(post);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function representedClinicianCount(posts: BriefingSharer[] | null | undefined): number {
  const identities = new Set<string>();
  let count = 0;
  const add = (person: { name?: string | null; handle?: string | null; tweetUrl?: string | null }) => {
    const handle = person.handle?.replace(/^@/, "").trim().toLowerCase();
    const name = person.name?.replace(/\s+/g, " ").trim().toLowerCase();
    const url = person.tweetUrl?.trim().toLowerCase();
    const aliases = [handle && `handle:${handle}`, name && `name:${name}`, url && `url:${url}`].filter((x): x is string => !!x);
    if (!aliases.length) return;
    if (!aliases.some((alias) => identities.has(alias))) count += 1;
    aliases.forEach((alias) => identities.add(alias));
  };
  for (const post of posts ?? []) {
    add(post);
    for (const reposter of post.repostedBy ?? []) add(reposter);
  }
  return count;
}

export function representedClinicianCountAcrossLanes(
  clinicianPosts: BriefingSharer[] | null | undefined,
  publisherPosts: BriefingSharer[] | null | undefined,
  otherPosts: BriefingSharer[] | null | undefined,
): number {
  const identities = new Set<string>();
  let count = 0;
  const add = (person: { name?: string | null; handle?: string | null; tweetUrl?: string | null }) => {
    const handle = person.handle?.replace(/^@/, "").trim().toLowerCase();
    const name = person.name?.replace(/\s+/g, " ").trim().toLowerCase();
    const url = person.tweetUrl?.trim().toLowerCase();
    const aliases = [handle && `handle:${handle}`, name && `name:${name}`, url && `url:${url}`].filter((x): x is string => !!x);
    if (!aliases.length) return;
    if (!aliases.some((alias) => identities.has(alias))) count += 1;
    aliases.forEach((alias) => identities.add(alias));
  };
  for (const post of clinicianPosts ?? []) {
    add(post);
    for (const reposter of post.repostedBy ?? []) add(reposter);
  }
  for (const post of [...(publisherPosts ?? []), ...(otherPosts ?? [])]) {
    for (const reposter of post.repostedBy ?? []) add(reposter);
  }
  return count;
}

// The backend clinician census is authoritative. `shown` only discloses how many
// clinician receipts the payload can reveal; it must never increase that census.
export function paperClinicianMeta(shown: number, total?: number | null): string | undefined {
  if (total == null) return undefined;
  const n = Math.max(0, total);
  if (!n) return undefined;
  const visible = Math.min(n, Math.max(0, shown));
  if (!visible) return `shared by ${n} clinician${n === 1 ? "" : "s"} · posts unavailable`;
  return `shared by ${n} clinician${n === 1 ? "" : "s"}${n > visible ? ` · ${visible} shown in sources` : ""}`;
}

export function supportLinkGroups(links: HeroSupportLink[] | null | undefined): {
  primarySources: HeroSupportLink[];
  relatedCoverage: HeroSupportLink[];
} {
  const seen = new Set<string>();
  const unique = (links ?? []).filter((link) => {
    const key = link.url?.trim().toLowerCase() || `${link.kind}:${link.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    primarySources: unique.filter((link) => link.relationshipType === "primary_source"),
    relatedCoverage: unique.filter((link) => link.relationshipType !== "primary_source"),
  };
}

const evidenceFaces = (...groups: (BriefingSharer[] | null | undefined)[]): string[] =>
  mergeReceiptPosts(...groups).map((post) => post.avatar)
    .filter((avatar): avatar is string => !!avatar)
    .filter((avatar, index, all) => all.indexOf(avatar) === index)
    .slice(0, 4);

// Pure hero-card → receipts resolution (Codex: extracted and tested — exact paper, episode,
// thread, missing-evidence, and publisher cases). Type-only imports keep this loadable under
// node:test. Views map the resolved DATA to JSX; nothing here re-ranks or re-selects.
export type ResolvedEvidence =
  | { kind: "paper"; story: unknown; faces: string[]; publisherPosts: BriefingSharer[]; otherPosts: BriefingSharer[]; supportLinks: HeroSupportLink[] }
  | { kind: "article"; posts: BriefingSharer[]; faces: string[]; publishers: string[]; publisherPosts: BriefingSharer[]; otherPosts: BriefingSharer[]; paper: Record<string, unknown>; supportLinks: HeroSupportLink[] }
  | { kind: "episode"; pods: BriefingPod[]; playback: BriefingPod; faces: string[] }
  | { kind: "thread"; post: BriefingSharer; faces: string[] }
  | { kind: "event"; posts: BriefingSharer[]; publisherPosts: BriefingSharer[]; otherPosts: BriefingSharer[]; supportLinks: HeroSupportLink[]; faces: string[] }
  | null;

// The four arrays resolveHeroEvidence reads. Views pass this; the /r archive stores it.
export type CardBrief = Pick<BriefingData, "topStories" | "topArticles" | "movers" | "heroCandidates">;

// The SMALLEST brief slice that still resolves this card's evidence identically.
//
// Lives here, immediately above resolveHeroEvidence, because it mirrors that function's lookups
// one-for-one — change a lookup key there and you must change it here. The /r/<slug> post-page
// archive (readout_posts) stores this slice per card so a shared link survives the card rotating
// out of the live snapshot: a few KB instead of the ~330KB full brief.
//
// Guarded by a test that asserts resolveHeroEvidence(card, slice) matches
// resolveHeroEvidence(card, fullBrief) for every live card.
export function sliceBriefForCard(c: HeroCard, data: CardBrief): CardBrief {
  const empty: CardBrief = { topStories: [], topArticles: [], movers: [], heroCandidates: { cards: [c], tieCount: 0 } };
  if (c.kind === "development" && c.support) return empty;
  if (c.kind === "paper" || c.kind === "readout") {
    const reading = (data.topArticles ?? []).find((x) => x.url === c.url);
    const st = (data.topStories ?? []).find((t) => t.kind === "paper" && (t.papers?.[0]?.url === c.url || t.headline === c.headline));
    return { ...empty, topStories: st ? [st] : [], topArticles: reading ? [reading] : [] };
  }
  if (c.kind === "episode") {
    // resolveHeroEvidence concatenates heroCandidates.receipts THEN movers' pods and matches by
    // startMs, so collapsing both into receipts (deduped, episode-scoped) resolves identically.
    const all = [...(data.heroCandidates?.receipts ?? []), ...(data.movers ?? []).flatMap((m) => m.podcast ?? [])]
      .filter((p) => p.episodeId === c.anchorId);
    const seen = new Set<number>();
    const receipts = all.filter((p) => (p.startMs == null || seen.has(p.startMs) ? false : (seen.add(p.startMs), true)));
    return { ...empty, heroCandidates: { cards: [c], tieCount: 0, receipts } };
  }
  if (c.kind === "thread") {
    const post = (data.movers ?? []).flatMap((m) => m.posts ?? []).find((p) => p.tweetUrl === c.url);
    return { ...empty, movers: post ? [{ posts: [post] } as BriefingData["movers"][number]] : [] };
  }
  // `event` resolves purely from c.support, which travels on the card itself.
  return empty;
}

export function resolveHeroEvidence(
  c: Pick<HeroCard, "kind" | "anchorId" | "url" | "headline" | "startMs" | "momentStartMs" | "amplifiers" | "support">,
  data: Pick<BriefingData, "topStories" | "topArticles" | "movers" | "heroCandidates">,
): ResolvedEvidence {
  if (c.kind === "development" && c.support) {
    const posts = mergeReceiptPosts(c.support.clinicianPosts);
    const publisherPosts = mergeReceiptPosts(c.support.publisherPosts);
    const otherPosts = mergeReceiptPosts(c.support.otherPosts);
    const { primarySources, relatedCoverage } = supportLinkGroups(c.support.links);
    const supportLinks = [...primarySources, ...relatedCoverage];
    if (!posts.length && !publisherPosts.length && !otherPosts.length && !supportLinks.length) return null;
    const faces = evidenceFaces(posts, publisherPosts, otherPosts);
    return { kind: "event", posts, publisherPosts, otherPosts, supportLinks, faces };
  }
  if (c.kind === "paper" || c.kind === "readout") {
    const reading = (data.topArticles ?? []).find((x) => x.url === c.url);
    const st = (data.topStories ?? []).find((t) => t.kind === "paper" && (t.papers?.[0]?.url === c.url || t.headline === c.headline));
    const posts = mergeReceiptPosts(st?.posts, reading?.posts, c.support?.clinicianPosts);
    const publisherPosts = mergeReceiptPosts(st?.publisherPosts, st?.papers?.[0]?.publisherPosts, reading?.publisherPosts, c.support?.publisherPosts);
    const otherPosts = mergeReceiptPosts(st?.otherPosts, st?.papers?.[0]?.otherPosts, reading?.otherPosts, c.support?.otherPosts);
    const { primarySources, relatedCoverage } = supportLinkGroups(c.support?.links);
    const supportLinks = [...primarySources, ...relatedCoverage];
    const faces = evidenceFaces(posts, publisherPosts, otherPosts);
    if (st) return { kind: "paper", story: { ...st, posts }, faces, publisherPosts, otherPosts, supportLinks };
    const a = reading;
    if (a) return { kind: "article", posts, faces, publishers: a.publishers ?? [], publisherPosts, otherPosts, paper: { title: a.title, url: a.url, journal: a.journal, domain: a.domain, abstract: a.abstract, description: a.description, sharers: [], topLikes: a.topLikes, publishers: a.publishers, peerReviewed: a.peerReviewed }, supportLinks };
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
    const playback = all.find((p) => p.startMs === c.startMs) ?? pods[0];
    const ampFaces = (c.amplifiers ?? []).map((a) => a.avatar).filter((a): a is string => !!a);
    return { kind: "episode", pods, playback, faces: [...ampFaces, ...pods.map((p) => p.showArt).filter((a): a is string => !!a)].slice(0, 4) };
  }
  if (c.kind === "thread") {
    const post = (data.movers ?? []).flatMap((m) => m.posts ?? []).find((p) => p.tweetUrl === c.url);
    if (!post) return null;
    return { kind: "thread", post, faces: post.avatar ? [post.avatar] : [] };
  }
  if (c.kind === "event" && c.support) {
    const posts = mergeReceiptPosts(c.support.clinicianPosts);
    const publisherPosts = mergeReceiptPosts(c.support.publisherPosts);
    const otherPosts = mergeReceiptPosts(c.support.otherPosts);
    const { primarySources, relatedCoverage } = supportLinkGroups(c.support.links);
    const supportLinks = [...primarySources, ...relatedCoverage];
    if (!posts.length && !publisherPosts.length && !otherPosts.length && !supportLinks.length) return null;
    const faces = evidenceFaces(posts, publisherPosts, otherPosts);
    return { kind: "event", posts, publisherPosts, otherPosts, supportLinks, faces };
  }
  return null;
}
