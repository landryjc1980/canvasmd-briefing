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

import type { DailyReadout } from "@/lib/types";

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";
const FROM_NAME = process.env.BRIEF_FROM_NAME ?? "The Readout";
const PHYSICAL = process.env.MAIL_PHYSICAL_ADDRESS ?? "CanvasMD";

const INK = "#17181a", INK2 = "#4f5257", MUT = "#696c71", MUT2 = "#85878c";
const LINE = "#cfd0cb", PAPER = "#f4f4f1", ACCENT = "#475569";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f",
};
const AREA_LABELS: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Hematology", Gyn: "Gynecologic",
};
const SANS = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
const KICKERS: Record<string, string> = { readout: "TRIAL READOUT", paper: "PAPER", event: "FDA", episode: "ON THE MICS", thread: "CONVERSATION" };

export type TopStory = { area: string; kind: string; title: string; why: string | null; url: string | null };

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---- top stories (seated hero deck, same briefing_snapshots the site renders) --------------
export async function fetchTopStories(): Promise<Record<string, TopStory[]>> {
  const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) return {};
  const res = await fetch(
    `${URL_}/rest/v1/briefing_snapshots?select=area,generated_at,cards:data->heroCandidates->cards&order=generated_at.desc&limit=12`,
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
  linkForArea: (area: string) => string; // magic link scoped to a specific area edition
  unsubUrl: string;
}): { html: string; subject: string } | null {
  const { daily, tops, area } = opts;
  const isAll = !area;
  const accent = isAll ? AREA_ACCENTS.GU : (AREA_ACCENTS[area!] ?? ACCENT);
  const editionLabel = isAll ? "All oncology" : (AREA_LABELS[area!] ?? area!);

  const narrative = daily.payload?.narrative ?? [];
  const paras = isAll ? narrative : narrative.filter((p) => (p.areas ?? []).includes(area!));
  // The area edition only exists on days the area earned narrative coverage.
  if (!isAll && paras.length === 0) return null;
  if (isAll && paras.length === 0 && !daily.lead) return null;

  const chip = (a: string) => {
    const c = AREA_ACCENTS[a] ?? ACCENT;
    return `<a href="${esc(opts.linkForArea(a))}" style="display:inline-block;font-size:8.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${c};background:${c}12;border:1px solid ${c}40;border-radius:4px;padding:2px 5px;margin-right:7px;vertical-align:2px;text-decoration:none;font-family:${SANS}">${esc(a)}</a>`;
  };
  const secHdr = (label: string) =>
    `<div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${MUT2};font-family:${SANS}">${label}</div>`;

  const parasHtml = paras.map((p) =>
    `<p style="font-size:15.5px;line-height:1.68;color:${INK2};margin:0 0 15px;font-family:Georgia,serif">${isAll ? (p.areas ?? []).slice(0, 2).map(chip).join("") : ""}${esc(p.text)}</p>`,
  ).join("");

  const ORDER = ["GU", "Lung", "GI", "Breast", "Heme", "Gyn"];
  const topList: TopStory[] = isAll
    ? ORDER.flatMap((a) => (tops[a] ?? []).slice(0, 1))
    : (tops[area!] ?? []).slice(0, 3);
  const topsHtml = topList.map((t) => `<div style="margin:13px 0 0">
    <div>${isAll ? chip(t.area) : ""}<span style="font-size:8.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${MUT2};font-family:${SANS}">${esc(KICKERS[t.kind] ?? t.kind.toUpperCase())}</span></div>
    <a href="${esc(t.url ?? opts.linkForArea(t.area))}" style="display:block;font-family:Georgia,serif;font-size:15px;font-weight:600;line-height:1.4;color:${INK};text-decoration:none;margin-top:3px">${esc(t.title)}</a>
    ${t.why ? `<div style="font-size:11px;color:${MUT2};margin-top:2px;font-family:${SANS}">${esc(t.why)}</div>` : ""}
  </div>`).join("");

  const sectionsHtml = (daily.payload?.sections ?? [])
    .filter((s) => ["readouts", "mics", "papers"].includes(s.key))
    .map((s) => {
      const items = s.items.filter((it) => (isAll ? true : (it.areas ?? []).includes(area!))).slice(0, 3);
      if (!items.length) return "";
      const rows = items.map((it) => {
        const chips = isAll ? (it.areas ?? []).slice(0, 2).map(chip).join("") : "";
        const title = it.url
          ? `<a href="${esc(it.url)}" style="font-size:13px;font-weight:600;line-height:1.45;color:${INK};text-decoration:none;font-family:${SANS}">${esc(it.title)}</a>`
          : `<span style="font-size:13px;font-weight:600;line-height:1.45;color:${INK};font-family:${SANS}">${esc(it.title)}</span>`;
        return `<div style="margin:10px 0 0">${chips}${title}${it.sub ? `<div style="font-size:11px;color:${MUT2};margin-top:1px;font-family:${SANS}">${esc(it.sub)}</div>` : ""}</div>`;
      }).join("");
      return `<div style="margin:18px 0 0;padding-top:14px;border-top:1px solid ${LINE}">${secHdr(esc(s.title))}${rows}</div>`;
    }).join("");

  const crossLink = isAll ? "" :
    `<p style="font-size:12px;color:${MUT};margin:16px 0 0;font-family:${SANS}">Also today across oncology: <a href="${esc(opts.siteLink)}" style="color:${accent};font-weight:600">read the full edition →</a></p>`;

  const topsBlock = topList.length
    ? `<div style="margin:20px 0 0;padding-top:14px;border-top:1px solid ${LINE}">${secHdr("Top Stories" + (isAll ? "" : " · " + esc(editionLabel)))}${topsHtml}</div>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:${PAPER};font-family:${SANS};color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 0"><tr><td align="center">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
<tr><td style="padding:0 24px 14px">
<a href="${esc(opts.siteLink)}" style="text-decoration:none"><div style="font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${accent}">CanvasMD</div>
<div style="font-family:Georgia,serif;font-weight:400;font-size:30px;color:${INK};letter-spacing:-.01em;margin-top:2px">The Readout</div></a>
<div style="font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${ACCENT};margin-top:8px">The Daily · ${esc(editionLabel)} <span style="color:${MUT2};font-weight:500;letter-spacing:0;text-transform:none">· ${esc(daily.date)}</span></div>
</td></tr>
<tr><td style="padding:0 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8d7d1;border-radius:10px"><tr><td style="padding:22px 24px">
${parasHtml}
<a href="${esc(opts.siteLink)}" style="display:inline-block;background:${INK};color:#ffffff;font-weight:700;font-size:13.5px;text-decoration:none;padding:11px 22px;border-radius:8px;margin-top:2px">Open the ${isAll ? "full" : esc(area!)} Readout →</a>
${topsBlock}
${sectionsHtml}
${crossLink}
</td></tr></table>
<p style="font-size:11px;line-height:1.6;color:${MUT};margin:18px 0 0;text-align:center">Signal from tracked oncology clinicians and selected oncology podcasts. No anonymous accounts.<br>${esc(PHYSICAL)} · <a href="${esc(opts.unsubUrl)}" style="color:${MUT}">Unsubscribe</a></p>
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
