// The Daily by email — renders the daily_readout edition (all-oncology or one specialty)
// in the Readout's paper/ink house style and sends via Resend REST (same dependency-light
// pattern as lib/mail.ts). Server-only.
//
// Edition rules (John, 2026-08-18):
// - area edition: ONLY paragraphs tagged to that area (no cross-cutting spillover), that
//   area's top 3 deck stories, coverage items filtered to the area. One "Also today across
//   oncology" escape link. If the area earned no paragraphs, the edition DOES NOT EXIST —
//   callers skip the contact that day rather than send filler.
// - all-oncology edition: every paragraph with its area chips, the #1 seated story from
//   each area, unfiltered coverage items with chips.
// - Buttons/masthead/chips go through the recipient's magic link so one click signs them in.

import type { DailyParagraph, DailyReadout } from "@/lib/types";
import { partitionDailyReactions } from "@/app/dailyEvidence";

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";
const FROM_NAME = process.env.BRIEF_FROM_NAME ?? "The Readout";
const PHYSICAL = process.env.MAIL_PHYSICAL_ADDRESS ?? "CanvasMD";

const INK = "#17181a", INK2 = "#4f5257", MUT = "#696c71", MUT2 = "#85878c";
const LINE = "#cfd0cb", PAPER = "#f4f4f1", ACCENT = "#475569";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f", Skin: "#6d28d9",
};
const AREA_LABELS: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Hematology", Gyn: "Gynecologic", Skin: "Skin cancer",
};
const SANS = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
const KICKERS: Record<string, string> = { readout: "TRIAL READOUT", development: "BREAKING DEVELOPMENT", paper: "PAPER", event: "FDA", episode: "ON THE MICS", thread: "CONVERSATION" };

const easternDate = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

export type TopStory = { area: string; kind: string; title: string; why: string | null; url: string | null };

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// Minimal markdown from the generator: **bold** for trial/people names, *italic* for
// journals/shows/titles. Escape first, then swap the two known forms.
function emphHtml(s: string): string {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/“([^”]*?)”/g, "<em>“$1”</em>").replace(/&quot;([\s\S]*?)&quot;/g, "<em>&quot;$1&quot;</em>");
}
const stripEmph = (t: string) => t.replace(/\*\*?/g, "");

// ---- top stories (seated hero deck from the same activated build the site renders) ----------
export async function fetchTopStories(): Promise<Record<string, TopStory[]>> {
  const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) return {};
  const res = await fetch(
    `${URL_}/rest/v1/briefing_active?select=area,generated_at,cards:data->heroCandidates->cards`,
    { headers: { apikey: KEY, authorization: `Bearer ${KEY}` }, cache: "no-store" },
  );
  if (!res.ok) return {};
  const rows = (await res.json()) as { area: string; cards: any[] | null }[];
  const out: Record<string, TopStory[]> = {};
  for (const r of rows) {
    if (out[r.area]) continue; // newest snapshot per area wins
    out[r.area] = (r.cards ?? []).slice(0, 3).map((c) => ({
      area: r.area,
      kind: String(c.kind ?? "readout"),
      title: String(c.headline ?? c.title ?? ""),
      why: c.why ? String(c.why) : null,
      url: c.url ? String(c.url) : null,
    })).filter((t) => t.title);
  }
  return out;
}

// ---- render --------------------------------------------------------------------------------
export function renderDailyEmail(opts: {
  daily: DailyReadout;
  tops: Record<string, TopStory[]>;
  area: string | null;          // null = all-oncology edition
  siteLink: string;             // magic link into the site (already area-scoped by caller)
  allLink?: string;             // magic link to the ALL-oncology edition (cross-link target)
  linkForArea: (area: string) => string; // magic link scoped to a specific area edition
  unsubUrl: string;
}): { html: string; subject: string } | null {
  const { daily, tops, area } = opts;
  const isAll = !area;
  const accent = isAll ? AREA_ACCENTS.GU : (AREA_ACCENTS[area!] ?? ACCENT);
  const editionLabel = isAll ? "All oncology" : (AREA_LABELS[area!] ?? area!);

  // v4 per-area editions: the area's own mini-brief + the shared Frontier under it (or as
  // the top on a quiet day). Legacy narrative-slicing is the fallback for old payloads.
  const editions = daily.payload?.editions ?? null;
  const legacy = daily.payload?.narrative ?? [];
  const ed = !isAll && editions ? (editions[area!] ?? null) : null;
  const gen = editions?.general ?? null;
  type Para = DailyParagraph & { areas?: string[] };
  const areaParas: Para[] = isAll
    ? legacy
    : (ed ? ed.paragraphs.map((p) => ({ ...p, areas: [area!] })) : legacy.filter((p) => (p.areas ?? []).includes(area!)));
  const generalParas: Para[] = isAll
    ? [] // the composed All narrative already ends with the Frontier paragraphs
    : (gen ? gen.paragraphs.filter((p) => !((p as { dupFor?: string[] }).dupFor ?? []).includes(area!)).map((p) => ({ ...p, areas: [] as string[] })) : legacy.filter((p) => (p.areas ?? []).length === 0));
  const quiet = !isAll && areaParas.length === 0;
  // A specialty edition with nothing of its own is SKIPPED (Codex review 2026-08-19).
  if (quiet) return null;
  if (areaParas.length === 0 && generalParas.length === 0) return null;
  const editionLead = isAll ? daily.lead : (ed?.lead ?? null);

  const chip = (a: string) => {
    const c = AREA_ACCENTS[a] ?? ACCENT;
    return `<a href="${esc(opts.linkForArea(a))}" style="display:inline-block;font-size:8.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${c};background:${c}12;border:1px solid ${c}40;border-radius:4px;padding:2px 5px;margin-right:7px;vertical-align:2px;text-decoration:none;font-family:${SANS}">${esc(a)}</a>`;
  };
  const secHdr = (label: string) =>
    `<div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${MUT2};font-family:${SANS}">${label}</div>`;

  const quietNote = quiet
    ? `<p style="font-style:italic;font-size:13px;line-height:1.5;color:${MUT};margin:0 0 12px;font-family:Georgia,serif">Quiet in ${esc(editionLabel)} for this edition — from the frontier:</p>`
    : "";
  const refsHtml = (p: Para) => {
    const refs = (p as { refs?: { label: string; url: string }[] | null }).refs ?? [];
    if (!refs.length) return "";
    return ` <span style="font-size:11.5px;font-family:${SANS}">` + refs.map((r, i) => `${i > 0 ? " · " : ""}<a href="${esc(r.url)}" style="color:${ACCENT};text-decoration:none">${esc(r.label)} ↗</a>`).join("") + `</span>`;
  };
  const conversationHtml = (p: Para) => {
    const wanted = new Set(p.storyIds ?? []);
    if (!wanted.size) return "";
    const stories = (daily.payload.conversationStories ?? []).filter((story) => wanted.has(story.id));
    const allReactions = stories.flatMap((story) => story.reactions);
    const partitioned = isAll
      ? { local: allReactions, across: [] as typeof allReactions }
      : partitionDailyReactions(allReactions, stories.flatMap((story) => story.areas), area!);
    const local = [...partitioned.local].sort((a, b) => b.likes - a.likes);
    const across = [...partitioned.across].sort((a, b) => b.likes - a.likes);
    const reactions = [...local, ...across];
    const acrossPostIds = new Set(across.map((reaction) => reaction.postId));
    const seenPosts = new Set<string>();
    const allReceipts = reactions.filter((reaction) => {
      if (seenPosts.has(reaction.postId)) return false;
      seenPosts.add(reaction.postId);
      return true;
    });
    const receipts = allReceipts.slice(0, 3);
    const seenUrls = new Set<string>();
    const sources = stories.flatMap((story) => [story.anchor, ...(story.sources ?? [])]).filter((source) => {
      if (!source.url || seenUrls.has(source.url)) return false;
      seenUrls.add(source.url);
      return true;
    });
    if (!receipts.length && !sources.length) return "";
    const receiptHtml = receipts.map((reaction) => {
      const text = reaction.fullText?.trim() || reaction.text;
      const isExcerpt = !reaction.fullText?.trim() && (reaction.textTruncated === true || /…\s*$/.test(reaction.text));
      return `<div style="margin:8px 0 0;padding:8px 0 0 10px;border-left:2px solid ${accent};font-family:${SANS}">
        <a href="${esc(reaction.url)}" style="font-size:11.5px;font-weight:700;color:${INK};text-decoration:none">${esc(reaction.name)} <span style="font-weight:500;color:${MUT}">@${esc(reaction.handle)}</span></a>${acrossPostIds.has(reaction.postId) ? ` <span style="font-size:9px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:.06em">Across oncology</span>` : ""}
        <div style="font-family:Georgia,serif;font-size:13px;line-height:1.55;color:${INK2};margin-top:3px">${isExcerpt ? `<strong style="font-family:${SANS};font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${MUT}">Excerpt</strong><br>` : ""}${esc(text)}</div>
        ${isExcerpt ? `<a href="${esc(reaction.url)}" style="display:inline-block;font-size:10.5px;font-weight:700;color:${accent};text-decoration:none;margin-top:4px">Read complete post on X ↗</a>` : ""}
      </div>`;
    }).join("");
    const sourceHtml = sources.length
      ? `<div style="font-size:10.5px;line-height:1.6;color:${MUT};margin-top:7px;font-family:${SANS}">Sources: ${sources.map((source) => `<a href="${esc(source.url)}" style="color:${accent};text-decoration:none">${esc(source.label)} ↗</a>`).join(" · ")}</div>`
      : "";
    const moreReceipts = allReceipts.length - receipts.length;
    return `<div style="margin:-7px 0 16px">${receipts.length ? `<div style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-family:${SANS}">Physician conversation</div>${receiptHtml}${moreReceipts > 0 ? `<div style="font-size:10.5px;color:${MUT};margin-top:6px;font-family:${SANS}">+${moreReceipts} more physician post${moreReceipts === 1 ? "" : "s"} in the Readout</div>` : ""}` : ""}${sourceHtml}</div>`;
  };
  const paraHtml = (p: Para, chips: boolean, n?: number) =>
    `<p style="font-size:15.5px;line-height:1.68;color:${INK2};margin:0 0 15px;font-family:Georgia,serif">${chips ? (p.areas ?? []).slice(0, 2).map(chip).join("") : ""}${n !== undefined ? `<strong style="color:${accent}">${n}.</strong> ` : ""}${p.head ? `<strong style="color:${INK}">${esc(stripEmph(p.head))}.</strong> ` : ""}${emphHtml(p.text)}${refsHtml(p)}</p>${conversationHtml(p)}`;
  const frontierHtml = generalParas.length
    ? `${quiet ? "" : `<div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${MUT2};margin:4px 0 10px;font-family:${SANS}">Frontiers</div>`}${generalParas.map((p, i) => paraHtml(p, false, areaParas.length + i + 1)).join("")}`
    : "";
  const parasHtml = quietNote
    + (editionLead ? `<p style="font-size:16px;line-height:1.6;color:${INK};margin:0 0 16px;font-family:Georgia,serif;font-weight:500">${esc(stripEmph(editionLead))}</p>` : "")
    + areaParas.map((p, i) => paraHtml(p, isAll, i + 1)).join("")
    + frontierHtml;

  const ORDER = ["GU", "Lung", "GI", "Breast", "Heme", "Gyn", "Skin"];
  const topList: TopStory[] = isAll
    ? ORDER.flatMap((a) => (tops[a] ?? []).slice(0, 1))
    : (tops[area!] ?? []).slice(0, 3);
  const topsHtml = topList.map((t) => `<div style="margin:13px 0 0">
    <div>${isAll ? chip(t.area) : ""}<span style="font-size:8.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${MUT2};font-family:${SANS}">${esc(KICKERS[t.kind] ?? t.kind.toUpperCase())}</span></div>
    <a href="${esc(t.url ?? opts.linkForArea(t.area))}" style="display:block;font-family:Georgia,serif;font-size:15px;font-weight:600;line-height:1.4;color:${INK};text-decoration:none;margin-top:3px">${esc(t.title)}</a>
    ${t.why ? `<div style="font-size:11px;color:${MUT2};margin-top:2px;font-family:${SANS}">${esc(t.why)}</div>` : ""}
  </div>`).join("");

  const sectionsHtml = (daily.payload?.sections ?? [])
    .filter((s) => ["readouts", "mics", "papers", "frontier"].includes(s.key))
    .map((s) => {
      const items = s.items.filter((it) => (isAll ? true : (it.areas ?? []).includes(area!))).slice(0, 3);
      if (!items.length) return "";
      const rows = items.map((it) => {
        const chips = isAll ? (it.areas ?? []).slice(0, 2).map(chip).join("") : "";
        // A daily item's home is its SOURCE (the paper / news / FDA notice / podcast) — link
        // straight there. The CanvasMD /r/<slug> post pages are for the WEEKLY hero cards (where
        // the social evidence lives); daily items almost never coincide with one, so we don't
        // round-trip them through a page that wouldn't exist. Url-less items fall back to the
        // area edition (magic-link) so the row still opens the Readout.
        const href = it.url ?? opts.linkForArea(isAll ? ((it.areas ?? [])[0] ?? "GU") : area!);
        const title = href
          ? `<a href="${esc(href)}" style="font-size:13px;font-weight:600;line-height:1.45;color:${INK};text-decoration:none;font-family:${SANS}">${esc(it.title)}</a>`
          : `<span style="font-size:13px;font-weight:600;line-height:1.45;color:${INK};font-family:${SANS}">${esc(it.title)}</span>`;
        return `<div style="margin:10px 0 0">${chips}${title}${it.sub ? `<div style="font-size:11px;color:${MUT2};margin-top:1px;font-family:${SANS}">${esc(it.sub)}</div>` : ""}</div>`;
      }).join("");
      return `<div style="margin:18px 0 0;padding-top:14px;border-top:1px solid ${LINE}">${secHdr(esc(s.title))}${rows}</div>`;
    }).join("");

  const crossLink = isAll ? "" :
    `<p style="font-size:12px;color:${MUT};margin:16px 0 0;font-family:${SANS}">Also in this edition across oncology: <a href="${esc(opts.allLink ?? opts.siteLink)}" style="color:${accent};font-weight:600">read the full edition →</a></p>`;

  const topsBlock = topList.length
    ? `<div style="margin:20px 0 0;padding-top:14px;border-top:1px solid ${LINE}">${secHdr("Top Stories" + (isAll ? "" : " · " + esc(editionLabel)))}${topsHtml}</div>`
    : "";

  // Flat single-white-canvas layout (John, 2026-08-18): no paper-behind-card nesting — on
  // phones the stacked backgrounds ate horizontal space and squished the serif copy. The
  // masthead and body sit on one white ground separated by hairline rules.
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:${SANS};color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:28px 0"><tr><td align="center">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
<tr><td style="padding:0 24px">
<a href="${esc(opts.siteLink)}" style="text-decoration:none"><div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${accent}">CanvasMD</div>
<div style="font-family:Georgia,serif;font-weight:400;font-size:30px;color:${INK};letter-spacing:-.01em;margin-top:2px">The Readout</div></a>
<div style="font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${ACCENT};margin-top:8px">The Daily · ${esc(editionLabel)} <span style="color:${MUT2};font-weight:500;letter-spacing:0;text-transform:none">· ${esc(daily.date)}${daily.date === easternDate() ? " · updated today" : ""}${daily.payload.coverage?.scope ? ` · ${esc(daily.payload.coverage.scope.toLowerCase())}` : ""}</span></div>
<div style="height:1px;background:${LINE};margin:18px 0 20px"></div>
${parasHtml}
<a href="${esc(opts.siteLink)}" style="display:inline-block;background:${INK};color:#ffffff;font-weight:700;font-size:13.5px;text-decoration:none;padding:11px 22px;border-radius:8px;margin-top:2px">Open the ${isAll ? "full" : esc(area!)} Readout →</a>
${topsBlock}
${sectionsHtml}
${crossLink}
<div style="height:1px;background:${LINE};margin:24px 0 14px"></div>
<p style="font-size:11px;line-height:1.6;color:${MUT};margin:0;text-align:center">Signal from tracked oncology clinicians and selected oncology podcasts. No anonymous accounts.<br>${esc(PHYSICAL)} · <a href="${esc(opts.unsubUrl)}" style="color:${MUT}">Unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;

  return { html, subject: `The Daily · ${editionLabel} — ${daily.date}` };
}

// ---- send ----------------------------------------------------------------------------------
export async function sendDailyEmail(opts: {
  email: string; subject: string; html: string; unsubUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_KEY || !FROM_EMAIL) return { ok: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [opts.email],
      subject: opts.subject,
      html: opts.html,
      headers: {
        "List-Unsubscribe": `<${opts.unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
  return { ok: true };
}
