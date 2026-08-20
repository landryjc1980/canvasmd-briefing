// The Readout post page — /r/<kebab-headline>-<tok>. One shareable "article" per WEEKLY hero card.
//
// The shareable unit is the reader's source-anchored hero card (that's where the social evidence
// lives). Two states, resolved from the current briefing_snapshots (app/heroPost.ts):
//   • signed-in member          → the FULL expanded card, evidence and all (./PostCard)
//   • crawler / logged-out human → the site's reader chrome + a GLIMPSE of what's behind the gate
//                                  (./PublicCard): sourced counts, a redacted conversation, an
//                                  inventory of what's inside, and the rest of the week's edition.
// The safety boundary is assembled in THIS file: the public branch resolves the evidence, MEASURES
// it, and hands PublicCard whitelisted primitives only — clinician names and post text are counted
// and discarded, never serialized. Gated evidence appears only for a valid session.

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cookies } from "next/headers";
import { idFromSlug, heroSlugFor } from "@/lib/postId";
import { resolveHeroPost, isPublicSafeCard, publicTitleOf, type HeroPost } from "@/app/heroPost";
import { resolveHeroEvidence } from "@/app/heroEvidence";
import { readSession, SESSION_COOKIE } from "@/lib/gate";
import PostCard from "./PostCard";
import PublicCard, { type PublicViewData } from "./PublicCard";
import "@/app/briefing.css";
import "@/app/brief.css";

export const dynamic = "force-dynamic";

// ---- house palette (paper/ink; matches the reader) ------------------------------------------
const ACCENT = "#475569";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f", Skin: "#6d28d9",
};
const AREA_LABELS: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Hematology", Gyn: "Gynecologic", Skin: "Skin cancer",
};
const KICKERS: Record<string, string> = {
  paper: "Paper", episode: "On the mics", event: "Regulatory", thread: "Clinician post", readout: "Trial readout", development: "Breaking development", trial_milestone: "Trial milestone",
};

function siteBase(): string {
  return (process.env.BRIEF_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://briefing.canvasmd.io").replace(/\/$/, "");
}
const accentOf = (area: string) => AREA_ACCENTS[area] ?? ACCENT;

// A public-safe one-liner: never the card excerpt (which can be a verbatim tweet) — just where the
// conversation is and that it's inside the Readout.
const publicTeaser = (p: HeroPost) => `How tracked ${(AREA_LABELS[p.area] ?? "oncology").toLowerCase()} oncology clinicians are engaging — inside The Readout.`;
// ---- metadata (public; identical for everyone so crawlers + caches are happy) --------------
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await resolveHeroPost(idFromSlug(params.slug));
  if (!post) return { title: "The Readout — CanvasMD" };
  const url = `${siteBase()}/r/${heroSlugFor(post.card.kind, post.card.headline, post.card.id)}`;
  const desc = publicTeaser(post);
  const title = publicTitleOf(post.card.kind, post.card.headline, post.area);
  return {
    title: `${title} — The Readout`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, url, siteName: "The Readout · CanvasMD", type: "article" },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

// --------------------------------------------------------------------------------------------
export default async function PostPage({ params }: { params: { slug: string } }) {
  const tok = idFromSlug(params.slug);
  const post = await resolveHeroPost(tok);
  if (!post) notFound(); // token unknown, or the card has rotated out of the current window

  // Retitle-safe: any non-canonical path 301s to the canonical slug (the token is the truth).
  const canonical = heroSlugFor(post.card.kind, post.card.headline, post.card.id);
  if (params.slug !== canonical) permanentRedirect(`/r/${canonical}`);

  // Session decides depth. This page is NOT gated by middleware, so it reads the cookie itself.
  const contactId = await readSession(cookies().get(SESSION_COOKIE)?.value);
  const { card, brief, area } = post;
  const accent = accentOf(area);
  const memberHome = `/?area=${area}`;

  // MEMBER → the full expanded card (the fix: the page BE the reader's card, evidence and all).
  // Pass only the four arrays resolveHeroEvidence reads (not the whole ~0.5MB brief) so the page
  // that gets serialized to the client stays lean on a shared-link cold open.
  if (contactId) {
    const briefForCard = { topStories: brief.topStories, topArticles: brief.topArticles, movers: brief.movers, heroCandidates: brief.heroCandidates };
    return <PostCard card={card} brief={briefForCard} area={area} memberHome={memberHome} />;
  }

  // PUBLIC → the site's own reader chrome + a GLIMPSE of what the gate holds.
  //
  // SAFETY BOUNDARY: everything below is assembled HERE and only whitelisted primitives are handed
  // to <PublicCard>. Counts come from resolving the evidence server-side and measuring it — the
  // clinician names and post text are read, counted, and discarded, never serialized to the page.
  const ev = resolveHeroEvidence(card, brief);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const inside: string[] = [];
  let faceCount = 0;
  if (ev) {
    faceCount = Math.min(4, ev.faces.length);
    if (ev.kind === "paper" || ev.kind === "article" || ev.kind === "event") {
      const clinicians = ev.kind === "paper" ? ((ev.story as { posts?: unknown[] }).posts ?? []).length : ev.posts.length;
      if (clinicians) inside.push(plural(clinicians, "clinician post", "clinician posts"));
      if (ev.publisherPosts.length) inside.push(plural(ev.publisherPosts.length, "publisher post", "publisher posts"));
      if (ev.otherPosts.length) inside.push(plural(ev.otherPosts.length, "further post", "further posts"));
    } else if (ev.kind === "episode") {
      if (ev.pods.length) inside.push(plural(ev.pods.length, "selected moment", "selected moments"));
      if ((card.amplifiers ?? []).length) inside.push(plural((card.amplifiers ?? []).length, "amplifier", "amplifiers"));
    } else if (ev.kind === "thread") {
      inside.push("the full post");
    }
  }
  // Excerpt is public ONLY when it is not a verbatim post — i.e. paper/abstract or episode gloss.
  // A verbatim clinician quote stays behind the gate (safety invariant: teaser ≠ someone's words).
  const safeExcerpt = card.excerpt && !card.excerptVerbatim && card.kind !== "thread" ? card.excerpt : null;

  // Thread headlines are verbatim clinician posts — never list them publicly either.
  const otherCards = (brief.heroCandidates?.cards ?? [])
    .filter((c) => c.id !== card.id && isPublicSafeCard(c.kind))
    .slice(0, 3);
  const safe = isPublicSafeCard(card.kind);
  const v: PublicViewData = {
    headline: publicTitleOf(card.kind, card.headline, area),
    kicker: KICKERS[card.kind] ?? card.kind,
    // For a thread the "source" is the clinician themselves — withhold the name.
    sourceLabel: safe ? (card.sourceLabel ?? null) : null,
    // Episodes get NO source link (card.url is the raw audio enclosure — the reader gives members a
    // seeking player instead of ever linking it, HeroCards `kind !== "episode"`), and neither do
    // threads (the x.com status URL carries the clinician's handle).
    sourceUrl: card.kind === "episode" || !safe ? null : card.url,
    teaser: publicTeaser(post),
    excerpt: safeExcerpt,
    why: card.why ?? null, // counts only ("shared by 16 clinicians · 2 publishers") — audited, no names
    area,
    areaFull: AREA_LABELS[area] ?? area,
    accent,
    inside,
    insideNote: card.kind === "episode" ? "the exact moments, with audio."
      : card.kind === "thread" ? "who wrote it, and what they said."
      : "who they are, and what each of them said.",
    faceCount,
    also: otherCards.map((c) => ({
      headline: c.headline,
      kicker: KICKERS[c.kind] ?? c.kind,
      sourceLabel: c.sourceLabel ?? null,
      href: `/r/${heroSlugFor(c.kind, c.headline, c.id)}`,
    })),
  };
  return <PublicCard v={v} signInHref={`/welcome?area=${area}`} />;
}
