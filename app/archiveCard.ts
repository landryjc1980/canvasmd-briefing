import type { BriefingArticle, BriefingSharer, HeroCard, HeroSupportPost } from "../lib/types.ts";

type RankedHeroCard = HeroCard & {
  rankTotal: number;
  rankTrace: { input: string; value: number; weight: number; contribution: number }[];
};

function supportPost(post: BriefingSharer, sourceLane: "clinician" | "publisher" | "other"): HeroSupportPost {
  return {
    name: post.name,
    handle: post.handle,
    avatar: post.avatar,
    tweetUrl: post.tweetUrl,
    text: post.text,
    likes: post.likes,
    retweets: post.retweets,
    quotes: post.quotes ?? 0,
    views: post.views,
    repostedBy: post.repostedBy,
    sourceLane,
  };
}

/** Turn independently identified journal evidence into the same durable card shape as a hero. */
export function archiveCardForArticle(article: BriefingArticle): RankedHeroCard | null {
  if (!/^https?:\/\//i.test(article.url) || !article.title.trim() || article.kolSharers < 1) return null;
  if (article.peerReviewed !== true && !article.doi && !article.pmid) return null;
  const anchor = article.doi || article.pmid || article.url;
  const sourceLabel = article.journal || article.domain || "Primary source";
  const excerpt = article.abstract || article.description || null;
  const clinicianPosts = (article.posts ?? []).map((post) => supportPost(post, "clinician"));
  const publisherPosts = (article.publisherPosts ?? []).map((post) => supportPost(post, "publisher"));
  const otherPosts = (article.otherPosts ?? []).map((post) => supportPost(post, "other"));
  return {
    id: `paper:${anchor}`,
    kind: "paper",
    anchorId: anchor,
    headline: article.title,
    why: `Shared by ${article.kolSharers} clinicians`,
    sourceLabel,
    url: article.url,
    excerpt,
    excerptVerbatim: !!article.abstract,
    doi: article.doi ?? null,
    subAreas: article.subAreas ?? [],
    support: {
      clinicianPosts,
      publisherPosts,
      otherPosts,
      links: [{
        kind: "paper",
        id: `paper:${anchor}`,
        title: article.title,
        url: article.url,
        sourceLabel,
        description: excerpt,
        relationshipType: "primary_source",
        occurredAt: article.publishedAt ?? null,
      }],
    },
    conversation: {
      authoredClinicians: article.authoredClinicianCount ?? clinicianPosts.length,
      spanDays: 0,
      firstTouchAt: null,
      lastTouchAt: null,
    },
    // Mirror the signed RANK_WEIGHTS.clinicianSharers = 10 used by engine hero cards. Only this
    // ranking channel is copied so independently archived paper rows can never gain extra credit.
    rankTotal: article.kolSharers * 10,
    rankTrace: [{ input: "clinicianSharers", value: article.kolSharers, weight: 10, contribution: article.kolSharers * 10 }],
  };
}
