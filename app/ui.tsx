"use client";

// Shared briefing UI atoms + copy, used by both the Broadsheet (journal) and the
// Brief (poetic/Apple) renderings so the two views stay in lockstep on data.

import { useState } from "react";

export const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn"];

export const AREA_META: Record<string, { title: string; short: string; strap: string }> = {
  GU: { title: "GU Oncology", short: "GU", strap: "What the field is talking about this week — prostate, bladder, kidney." },
  Breast: { title: "Breast Oncology", short: "Breast", strap: "What moved the breast-cancer conversation this week." },
  Lung: { title: "Thoracic Oncology", short: "Lung", strap: "The lung and thoracic drugs the field carried this week." },
  GI: { title: "GI Oncology", short: "GI", strap: "What's moving across colorectal, gastric, pancreatic and hepatobiliary." },
  Heme: { title: "Hematologic Malignancies", short: "Heme", strap: "The myeloma, lymphoma and leukemia drugs of the week." },
  Gyn: { title: "Gynecologic Oncology", short: "Gyn", strap: "What's moving across ovarian, endometrial and cervical." },
};

export const SHAPE: Record<string, { label: string; brief: string; cls: string }> = {
  both: { label: "Podcasts + X", brief: "Discussed & shared", cls: "sh-both" },
  pods: { label: "Deep on the pods", brief: "On the podcasts", cls: "sh-pods" },
  x: { label: "Loud on X", brief: "Loud on X", cls: "sh-x" },
  regulatory: { label: "Regulatory", brief: "Regulatory", cls: "sh-reg" },
};

export function kfmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

export function ago(dateStr: string): string {
  if (!dateStr) return "";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 31) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function clip(t: string | null, n = 160): string {
  if (!t) return "";
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
}

export function weekOf(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function Avatar({ name, src, cls }: { name: string; src: string | null; cls?: string }) {
  const [err, setErr] = useState(false);
  const c = `av${cls ? " " + cls : ""}`;
  if (!src || err) return <div className={c}>{initials(name)}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={c} src={src} alt="" loading="lazy" onError={() => setErr(true)} />;
}

export function Chevron() {
  return (
    <svg className="cv" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
