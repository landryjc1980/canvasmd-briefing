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

type NamedSharer = {
  name: string;
  handle: string | null;
  tweetUrl: string | null;
  score: number;
  order: number;
};

function sharerKey(sharer: { name: string; handle: string | null }) {
  return sharer.handle?.replace(/^@/, "").toLowerCase() || sharer.name.trim().toLowerCase();
}

function clinicianSharers(article: BriefingArticle | null): NamedSharer[] {
  if (!article) return [];
  if (article.sharerPeople?.length) {
    return article.sharerPeople.map((sharer, order) => ({
      name: sharer.name,
      handle: sharer.handle,
      tweetUrl: sharer.tweetUrl,
      score: 0,
      order,
    }));
  }
  const seen = new Set<string>();
  const names: NamedSharer[] = [];
  let order = 0;
  const add = (sharer: { name: string; handle: string | null; tweetUrl: string | null }, score: number) => {
    const key = sharerKey(sharer);
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push({ name: sharer.name, handle: sharer.handle, tweetUrl: sharer.tweetUrl, score, order: order++ });
  };

  for (const post of article.posts ?? []) {
    const engagementScore = (post.likes ?? 0) + (post.retweets ?? 0) * 2 + (post.quotes ?? 0) * 2 + Math.floor((post.views ?? 0) / 1000);
    if (!post.sourceLane || post.sourceLane === "clinician") add(post, engagementScore);
    for (const reposter of post.repostedBy ?? []) add(reposter, 0);
  }

  return names.sort((left, right) => right.score - left.score || left.order - right.order);
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][\p{L}\p{N}_-]+/gu, " ")
    .replace(/\b(?:new|paper|study|article|published|online)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function isTitleOnlyShare(text: string, title: string): boolean {
  const postWords = words(text);
  const titleWords = new Set(words(title));
  if (postWords.length < 5 || titleWords.size < 5) return false;
  const overlap = postWords.filter((word) => titleWords.has(word)).length;
  return overlap / postWords.length >= 0.6;
}

function clinicianSurname(name: string): string {
  const cleaned = name
    .replace(/,?\s+(?:MD|PhD|DO|MBBS|MBChB|MPH|MSc|MS|RN|FACP|FACS|FRCPC)\b.*$/i, "")
    .replace(/,+$/, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || name;
}

function clinicianInitials(name: string): string {
  const cleaned = name.replace(/,?\s+(?:MD|PhD|DO)\b.*$/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
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

function FacePile({ article, count }: { article: BriefingArticle | null; count: number }) {
  const photos = xAvatars(article);
  const visible = photos.slice(0, Math.min(3, photos.length));
  if (!visible.length) return null;
  const overflow = Math.max(0, count - visible.length);
  return (
    <span className="er-faces" aria-hidden="true">
      {visible.map((src) => <img src={src} alt="" key={src} />)}
      {overflow > 0 && <span className="er-av-more">+{overflow}</span>}
    </span>
  );
}

function articleFromEditorial(item: EditorialArticle): BriefingArticle {
  return {
    title: item.title,
    url: item.url,
    journal: item.journal,
    domain: null,
    abstract: item.finding,
    description: null,
    sharers: item.sharedBy,
    kolSharers: item.sharedBy,
    publishers: [],
    faces: [],
    topLikes: 0,
    posts: [],
  };
}

function applyEvidenceOverlay(article: BriefingArticle | null, overlay: BriefingEvidenceOverlayItem | undefined): BriefingArticle | null {
  if (!article || !overlay) return article;
  return {
    ...article,
    kolSharers: overlay.kolSharers,
    faces: overlay.faces,
    posts: overlay.posts,
    sharerPeople: overlay.sharerPeople,
    authoredClinicianCount: overlay.authoredClinicianCount ?? article.authoredClinicianCount,
  };
}

function articleWithLiveEvidence(
  item: EditorialArticle,
  briefs: BriefingData[],
  overlay: BriefingEvidenceOverlayItem | undefined,
): BriefingArticle {
  const base = overlay ? findArticle(item, briefs) ?? articleFromEditorial(item) : articleFromEditorial(item);
  return applyEvidenceOverlay(base, overlay) ?? articleFromEditorial(item);
}

function PeerRow({ article, sharedBy }: { article: BriefingArticle | null; sharedBy: number }) {
  const sharers = clinicianSharers(article).slice(0, sharedBy);
  if (!sharers.length && sharedBy <= 0) return null;
  const named = sharers.slice(0, SHARER_PREVIEW_LIMIT);
  const others = Math.max(0, sharedBy - named.length);
  const surnames = named.map((sharer) => clinicianSurname(sharer.name));
  return (
    <div className="er-peers">
      <FacePile article={article} count={sharedBy} />
      {named.length > 0 && (
        <p className="er-peers-who">
          <b>{surnames.join(", ")}</b>
          {others > 0 ? ` and ${others} other clinician${others === 1 ? "" : "s"}` : named.length === 1 ? "" : null}
        </p>
      )}
    </div>
  );
}
