"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BriefingArticle, BriefingData, BriefingEpisode, BriefingEvidenceOverlayItem, BriefingSharer, HeroSupportLink, ReadoutWindowPayload } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import {
  evidenceTarget,
  readoutWindowDays,
  type ReadoutWindow,
} from "./readoutRequest";
import {
  ALSO_RELEVANT,
  EDITION_AREAS,
  FEATURED_EPISODES,
  NEW_TO_LISTEN,
  SPECIALTY_FALLBACKS,
  WORTH_YOUR_TIME,
  archivedEditorialArticle,
  findArticle,
  findArchivedEditorialSource,
  findEpisode,
  listenForArea,
  regulatoryEditorialArticle,
  relatedCoverageLinks,
  sameEditorialArticle,
  visibleForArea,
  type EditorialArticle,
  type EditorialDevelopment,
  type EditorialEpisodeFeature,
  type EditionArea,
} from "./edition";

const AREA_LABELS: Record<EditionArea, string> = {
  All: "All oncology",
  GU: "Genitourinary",
  Breast: "Breast",
  Lung: "Lung",
  GI: "Gastrointestinal",
  Heme: "Hematologic",
  Skin: "Skin",
  Gyn: "Gynecologic",
};

const SHARER_PREVIEW_LIMIT = 3;
const SHARER_EXPANDED_LIMIT = 12;
const EMPTY_BRIEFS: BriefingData[] = [];

function CanvasMdLogo() {
  return (
    <span className="er-logo" aria-label="CanvasMD">
      <svg className="er-logo-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M40,4 C16,4 4,14 4,24 C4,34 16,44 40,44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <rect x="28" y="12" width="16" height="2.5" rx="1.25" fill="currentColor" />
        <rect x="28" y="18" width="12" height="2.5" rx="1.25" fill="currentColor" opacity=".6" />
        <rect x="28" y="27" width="16" height="2.5" rx="1.25" fill="currentColor" />
        <rect x="28" y="33" width="10" height="2.5" rx="1.25" fill="currentColor" opacity=".6" />
        <rect x="14" y="21" width="8" height="2" rx="1" fill="currentColor" opacity=".5" />
        <rect x="17" y="18" width="2" height="8" rx="1" fill="currentColor" opacity=".5" />
      </svg>
      <span className="er-logo-word"><span>Canvas</span><b>MD</b></span>
    </span>
  );
}

function usefulPosts(article: BriefingArticle | null): BriefingSharer[] {
  if (!article) return [];
  const seen = new Set<string>();
  return (article.posts ?? []).filter((post) => {
    const text = post.text?.trim() ?? "";
    const contentWords = words(text);
    const key = post.handle?.toLowerCase() || post.name.toLowerCase();
    if (!text || contentWords.length < 3 || /^rt\s+@/i.test(text) || isTitleOnlyShare(text, [article.title, article.journal].filter(Boolean).join(" "))) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function xAvatars(article: BriefingArticle | null): string[] {
  const seen = new Set<string>();
  const photos: string[] = [];
  const add = (src: string | null | undefined) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    photos.push(src);
  };
  for (const src of article?.faces ?? []) add(src);
  for (const person of article?.sharerPeople ?? []) add(person.avatar);
  for (const post of article?.posts ?? []) add(post.avatar);
  return photos;
}

function excerptLabel(item: EditorialArticle): string {
  if (articleContentType(item) === "Paper") return "From the paper";
  return /fda|food and drug/i.test(item.journal) ? "From the FDA" : "From the regulator";
}

function articleContentType(item: EditorialArticle): string {
  return "Paper";
}
