"use client";

import { useEffect, useState } from "react";
import { BriefingData, BriefingArticle, BriefingStory, BriefingSharer, BriefingPaper, HeroCard } from "@/lib/types";
// Reuse the exact evidence machinery from the single-area reader so the expand /
// Hide-at-bottom / clips / receipts behave identically everywhere.
import { Row, TweetCard, PaperCard, FacePile, evLabel, StoryEvidence, AmplifierReceipts } from "./ReaderView";
import StanceBlock from "./StanceBlock";
import AudioQuote from "@/components/AudioQuote";
import { AREA_FULL, storiesOf, storyKicker, paperBlockLabel, storyMetricLine, pileFaces, cleanArticleTitle, articleSource, isNewsItem, heroDeckOf } from "./briefVM";
import HeroCards, { HeroEvidence } from "./HeroCards";
import { resolveHeroEvidence } from "./heroEvidence";
import { featuredHeroPaperKeys, visibleAllHeroCards } from "./allHeroContract";

// "All oncology" — a front page that reads as ONE continuous scan: each area's authoritative
// hero order, grouped by area and shown in its own color, never re-ranked across areas (their
// scores are area-relative — cross-ranking would be dishonest). The initial view is capped so
// community oncologists can cross specialties quickly; expansion preserves the signed order.
// The one section that DOES merge is "what the field is reading": papers ranked by the plain,
// comparable count of verified clinicians who shared them.

const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn"];
const INK = "#17181a";
const INK_2 = "#4f5257";
const MUT = "#696c71";
const MUT2 = "#85878c";
const LINE = "#cfd0cb";
const SURFACE = "#ebeae5";
const PAPER = "#f4f4f1";
const ALL_ACCENT = "#475569";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1",
  Breast: "#be185d",
  Lung: "#334155",
  GI: "#a45c0a",
  Heme: "#9b0f18",
  Gyn: "#0d6b5f",
};
const accentOf = (area: string) => AREA_ACCENTS[area] ?? ALL_ACCENT;
const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return mins < 1 ? "just now" : `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};
const areaId = (a: string) => "all-" + a;

export default function AllView({ briefsByArea, areas, onArea, compact = false, primary, onSetPrimary, failed, onRetry }: {
  // Areas may be MISSING: the page renders whatever has landed rather than holding everything
  // hostage to the slowest (or the broken) one. Every read below is optional-chained.
  briefsByArea: Record<string, BriefingData | undefined>;
  areas: string[];
  onArea: (a: string) => void;
  compact?: boolean;
  primary?: string | null;
  onSetPrimary?: (a: string) => void;
  failed?: Record<string, string>;
  onRetry?: (a: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [micsMore, setMicsMore] = useState(false);
  const [xMore, setXMore] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.backgroundColor;
    const previousBody = body.style.backgroundColor;
    root.style.backgroundColor = PAPER;
    body.style.backgroundColor = PAPER;
    return () => {
      root.style.backgroundColor = previousRoot;
      body.style.backgroundColor = previousBody;
    };
  }, []);
  const toggle = (id: string) => setOpenId((c) => (c === id ? null : id));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // ---- activity-ordered groups: busiest area first ----
  // The fixed GU→Gyn order was itself a quiet editorial statement (GU first because it was OUR
  // first area; Gyn permanently last = permanently least-read). Order instead by a plain,
  // comparable count — distinct evidence items (podcast clips + verified-clinician posts +
  // papers) behind the area's stories this week — shown in the header so the order justifies
  // itself. Rankings within each area stay area-relative; only the GROUPS move.
  const evidenceCount = (brief: BriefingData | undefined): number => {
    if (!brief) return 0;
    const hero = heroDeckOf(brief);
    if (hero !== null) {
      const receipts = new Set<string>();
      for (const card of hero) {
        receipts.add(`${card.kind}:${card.anchorId}`);
        const resolved = resolveHeroEvidence(card, brief);
        if (resolved?.kind === "paper") for (const post of [...((resolved.story as BriefingStory).posts ?? []), ...resolved.publisherPosts]) receipts.add(`x:${post.tweetUrl ?? `${post.handle}:${post.text}`}`);
        if (resolved?.kind === "article") for (const post of [...resolved.posts, ...resolved.publisherPosts]) receipts.add(`x:${post.tweetUrl ?? `${post.handle}:${post.text}`}`);
        if (resolved?.kind === "episode") for (const pod of resolved.pods) receipts.add(`clip:${pod.episodeId}:${pod.startMs ?? ""}`);
        for (const amplifier of card.amplifiers ?? []) receipts.add(`amp:${card.anchorId}:${amplifier.handle ?? amplifier.name}:${amplifier.text ?? "repost"}`);
      }
      return receipts.size;
    }
    const pods = new Set<string>(), tweets = new Set<string>(), papers = new Set<string>();
    for (const s of storiesOf(brief)) {
      for (const p of s.podcast) pods.add(p.episodeId + ":" + (p.startMs ?? ""));
      for (const t of s.posts) tweets.add(t.tweetUrl ?? (t.handle ?? t.name) + ":" + (t.text ?? "").slice(0, 40));
      for (const p of s.papers) papers.add(norm(p.title));
    }
    return pods.size + tweets.size + papers.size;
  };
  const activity = Object.fromEntries(AREAS.map((a) => [a, evidenceCount(briefsByArea[a])]));
  const orderedAreas = [...AREAS].sort((x, y) => activity[y] - activity[x] || AREAS.indexOf(x) - AREAS.indexOf(y));

  // ---- VINTAGE ----
  // Six briefs rebuild independently and a failed build falls back to the last good snapshot with
  // no age bound, so this page can merge weeks. The masthead therefore quotes the OLDEST of the
  // six — the only claim that holds for everything below it — and any area lagging the newest by
  // more than a day is called out on its own group header instead of hiding in the merge.
  const stamps = AREAS.map((a) => briefsByArea[a]?.generatedAt).filter(Boolean) as string[];
  const ms = (s: string) => new Date(s).getTime();
  const oldestStamp = stamps.length ? stamps.reduce((x, y) => (ms(x) <= ms(y) ? x : y)) : null;
  const newestStamp = stamps.length ? stamps.reduce((x, y) => (ms(x) >= ms(y) ? x : y)) : null;
  const lagOf = (a: string) => {
    const s = briefsByArea[a]?.generatedAt;
    if (!s || !newestStamp) return null;
    const d = Math.floor((ms(newestStamp) - ms(s)) / 86400_000);
    return d >= 1 ? `${d}d behind` : null;
  };

  // ---- VOICES OF THE WEEK (rail on wide, inline section on narrow) ----
  // Two lists because a microphone and a repost aren't the same axis:
  //   On the mics — ranked by GUEST appearances (invitations are the field's choice, cadence-
  //     proof); working-clinician hosts included at host-credit ≤1/wk; co-hosted shows collapse
  //     every row is a PERSON (a show is a venue, not a voice). Pro-interview CME hosts never
  //     appear at all (excluded edge-side).
  //   Carried on X — ranked by amplification (reposts + quote-posts earned this week).
  // Cross-area merge: same person in two briefs = one row with both area tags; X amp uses the
  // MAX across areas (each area scopes to its own posts — summing would double-count).
  type EpRec = { title: string; audioUrl: string | null; durationSeconds?: number | null; show: string | null; showArt: string | null };
  type MicEntry = { key: string; name: string; aff: string | null; verified: boolean; avatar: string | null; areas: string[]; guestEps: Map<string, EpRec>; hostEps: Map<string, EpRec>; hostShow: string | null; career: number };
  // mirror the server's guestKey: strip numbered-episode prefixes so the same syndicated talk
  // ("Ep. 12: X" on one feed, "X" on another) can't double-count across areas
  const epKey = (t: string | null) => norm((t ?? "").replace(/^\s*(ep\.?\s*\d+|episode\s*\d+|#\s*\d+|part\s*\d+)\s*[:.\-–—]*\s*/i, "")).replace(/\s+/g, "").slice(0, 34);
  // X avatars for mic rows: prefer the payload's avatar (people→x_sources, post-2026-07-24
  // snapshots); fall back to a name-match against the week's X-active KOLs so faces show up
  // against older snapshots too. Initials remain the final fallback.
  const xAvatarByName = new Map<string, string>();
  for (const a of AREAS) for (const k of briefsByArea[a]?.topKols ?? []) if (k.avatar && !xAvatarByName.has(norm(k.name))) xAvatarByName.set(norm(k.name), k.avatar);
  const mics = new Map<string, MicEntry>();
  const addMic = (a: string, g: NonNullable<BriefingData["guests"]>[number], role: "guest" | "host") => {
    const key = norm(g.name); if (!key) return;
    let m = mics.get(key);
    if (!m) { m = { key, name: g.name, aff: g.affiliation, verified: g.verified, avatar: null, areas: [], guestEps: new Map(), hostEps: new Map(), hostShow: null, career: 0 }; mics.set(key, m); }
    m.avatar = m.avatar ?? g.avatar ?? xAvatarByName.get(key) ?? null;
    if (!m.areas.includes(a)) m.areas.push(a);
    m.career = Math.max(m.career, g.career);
    if (role === "host") m.hostShow = m.hostShow ?? g.shows[0] ?? null;
    const eps = role === "host" ? m.hostEps : m.guestEps;
    for (const e of g.episodes) eps.set(epKey(e.title), { title: e.title, audioUrl: e.audioUrl, durationSeconds: e.durationSeconds, show: e.show, showArt: e.showArt });
  };
  for (const a of AREAS) {
    for (const g of briefsByArea[a]?.guests ?? []) addMic(a, g, "guest");
    for (const h of briefsByArea[a]?.hosts ?? []) addMic(a, h, "host");
  }
  // EVERY row here is a PERSON. A show is a venue, not a voice — when the field listens to The
  // Uromigos it hears Powles and Rini, so co-hosts render as themselves (John, 2026-07-24). An
  // earlier build collapsed co-hosted shows into a SHOW row; that put a podcast brand in a list
  // of people AND carried a whole class of bug (the collapse silently failed whenever a co-host
  // also guested). Two co-hosts each showing the same episode is simply true — the same way two
  // guests on one episode both count it.
  for (const m of mics.values()) m.hostShow = m.hostEps.size ? ([...m.hostEps.values()][0].show ?? m.hostShow) : null;
  const micValue = (m: MicEntry) => m.guestEps.size + (m.hostEps.size ? 1 : 0); // host credit capped at 1/wk
  const epCount = (m: MicEntry) => m.guestEps.size + m.hostEps.size; // what the chip displays
  const micsRanked = [...mics.values()]
    .filter((m) => micValue(m) > 0)
    // credit first (hosting counts once/wk), then the DISPLAYED episode count, then career.
    // Without the middle key a 3-episode show sorted under a 1-episode host — both hold one
    // host credit — and the visible numbers read as mis-sorted even though the rule is stated.
    .sort((x, y) => micValue(y) - micValue(x) || epCount(y) - epCount(x) || y.career - x.career || x.name.localeCompare(y.name));

  type XEntry = { key: string; name: string; handle: string | null; avatar: string | null; institution: string | null; areas: string[]; amp: number; tweets: number; paperShares: number; posts: BriefingSharer[]; articles: { title: string; url: string; journal: string | null; domain: string | null; peerReviewed?: boolean }[] };
  const xVoices = new Map<string, XEntry>();
  for (const a of AREAS) {
    for (const k of briefsByArea[a]?.topKols ?? []) {
      // old-snapshot fallback (areas whose payload predates edge-fn amp). Zero engagement on
      // classic retweets ('RT @…') — X API v2 mirrors the ORIGINAL post's metrics onto the RT,
      // so counting them would let a KOL rank by RETWEETING a viral post, not being carried
      // (2026-07-24 review). New snapshots ship k.amp already RT-guarded server-side.
      const amp = k.amp ?? k.posts.reduce((s, p) => s + (/^\s*RT @/.test(p.text ?? "") ? 0 : p.retweets + (p.quotes ?? 0)), 0);
      const key = k.handle ? k.handle.toLowerCase() : norm(k.name); if (!key) continue;
      let v = xVoices.get(key);
      if (!v) { v = { key, name: k.name, handle: k.handle, avatar: k.avatar, institution: k.institution, areas: [] as string[], amp: 0, tweets: 0, paperShares: 0, posts: [] as BriefingSharer[], articles: [] as XEntry["articles"] }; xVoices.set(key, v); }
      if (!v.areas.includes(a)) v.areas.push(a);
      v.amp = Math.max(v.amp, amp);
      v.tweets = Math.max(v.tweets, k.tweets);
      v.paperShares = Math.max(v.paperShares, k.paperShares ?? k.articles.length);
      const seen = new Set(v.posts.map((p) => p.tweetUrl ?? p.text ?? ""));
      for (const p of k.posts) { const pk = p.tweetUrl ?? p.text ?? ""; if (!seen.has(pk)) { v.posts.push(p); seen.add(pk); } }
      const seenA = new Set(v.articles.map((ar) => ar.url));
      for (const ar of k.articles) if (!seenA.has(ar.url)) { v.articles.push(ar); seenA.add(ar.url); }
    }
  }
  const xRanked = [...xVoices.values()].filter((v) => v.amp > 0).sort((x, y) => y.amp - x.amp || y.tweets - x.tweets);
  const micKeys = new Set(micsRanked.map((m) => m.key)); // for the "🎙 on mics" cross-reference

  // Two tracks on desktop ≥1180 — the SAME layout rule as the tumor pages (editorial column +
  // 320px rail). The home page replicates the tumor-page design with all-areas content.
  const [wide, setWide] = useState<boolean>(() => typeof window !== "undefined" && !compact && window.matchMedia("(min-width: 1180px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1180px)");
    const set = () => setWide(!compact && mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, [compact]);

  // The pill bar sticks — glassy chrome only once it actually sticks (same treatment as the
  // tumor pages' section nav), plus scroll-spy so the bar always shows where you are.
  const [stuck, setStuck] = useState(false);
  // Share exists on every tumor page but was missing from the home page — the one a reader is
  // most likely to want to pass to a colleague. Same invite-link flow, minus the area param
  // (the whole point of this edition is that it isn't scoped to one tumor).
  const [shareMsg, setShareMsg] = useState("");
  const doShare = async () => {
    try {
      const r = await fetch("/api/brief-share", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok || !j.url) { setShareMsg("Couldn’t create a link"); setTimeout(() => setShareMsg(""), 3000); return; }
      const url = `${j.url}?area=All`;
      const nav = navigator as any;
      if (nav.share) { try { await nav.share({ url }); return; } catch (e: any) { if (e?.name === "AbortError") return; } }
      let copied = false;
      try { await navigator.clipboard.writeText(url); copied = true; } catch { /* activation lost */ }
      setShareMsg(copied ? "Link copied — send it to a colleague" : url);
      setTimeout(() => setShareMsg(""), copied ? 2800 : 6000);
    } catch { setShareMsg("Couldn’t create a link"); setTimeout(() => setShareMsg(""), 3000); }
  };
  const [activeSec, setActiveSec] = useState<string>(areaId(orderedAreas[0]));
  const orderKey = orderedAreas.join(",");
  useEffect(() => {
    // ids in VISUAL order (groups are activity-ordered) — the spy takes the last one above the fold.
    // Threshold sits BELOW the jump-landing offset (100 compact / 62 desktop) so the pill you just
    // tapped actually lights up; deps include wide/compact because both change the id set + offsets.
    const ids = [...orderKey.split(",").map(areaId), "all-voices", "all-reading"];
    const threshold = compact ? 112 : 90;
    let raf = 0;
    const check = () => {
      setStuck(window.scrollY > 120);
      let cur = "";
      for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= threshold) cur = id; }
      setActiveSec(cur || ids[0]);
    };
    check();
    // `stuck` drives the bar's opaque backing, so it is set SYNCHRONOUSLY — deferring it to rAF
    // meant that whenever rAF was throttled (background tab, low-power mode) the bar kept a
    // transparent background while page text scrolled visibly through it. Only the spy, which
    // measures every section, is worth deferring.
    const onScroll = () => {
      setStuck(window.scrollY > 120);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [orderKey, wide, compact]);
  // rAF glide (ported from ReaderView.goSec): the FacePile avatars above a jump target lazy-load
  // and shift layout mid-flight, so the target is re-measured every frame; wheel/touch cancels.
  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = compact ? 100 : 62; // clear the sticky pill bar (two rows on compact)
    const targetNow = () => el.getBoundingClientRect().top + window.scrollY - offset;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, targetNow()); return; }
    const start = window.scrollY;
    const t0 = performance.now();
    const D = 520;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf = 0;
    const cancel = () => { cancelAnimationFrame(raf); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); };
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      window.scrollTo(0, start + (targetNow() - start) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else cancel();
    };
    raf = requestAnimationFrame(step);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
  };
  const goArea = (a: string) => goTo(areaId(a));

  // ---- cross-area reading list: dedupe by title, keep the max clinician-share, rank by it ----
  const best = new Map<string, { p: BriefingArticle; area: string }>();
  for (const a of AREAS) {
    for (const p of briefsByArea[a]?.topArticles ?? []) {
      const k = norm(p.title); if (!k) continue;
      const cur = best.get(k);
      if (!cur || p.kolSharers > cur.p.kolSharers) best.set(k, { p, area: a });
    }
  }
  const reading = [...best.values()].filter((x) => x.p.kolSharers >= 2).sort((x, y) => y.p.kolSharers - x.p.kolSharers).slice(0, 10);
  // This is a cross-area LEADERBOARD, not a leftovers bin — the one ranking on the page where the
  // number means the same thing in every area, so filtering out the papers that also led a story
  // would break the very ranking it promises. Instead, name the overlap: a paper the reader
  // already passed is badged with the area that told it, and the badge jumps back to that group.
  const featuredIn = new Map<string, string>();
  for (const a of AREAS) {
    const b = briefsByArea[a];
    if (!b) continue;
    const hero = heroDeckOf(b);
    if (hero !== null) {
      const keys = featuredHeroPaperKeys(hero);
      for (const paper of b.topArticles ?? []) {
        if (keys.has(`u:${paper.url}`) || keys.has(`t:${norm(paper.title)}`)) featuredIn.set(norm(paper.title), a);
      }
    } else {
      for (const s of storiesOf(b)) if (s.kind === "paper" && s.headline) featuredIn.set(norm(s.headline), a);
    }
  }

  const ini = (s: string) => s.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  // KOL institutions arrive as raw primary_institution ("Dana-Farber Cancer Institute, Boston,
  // MA") — keep the first segment only, the same rule the edge fn already applies to guest
  // affiliations, so the identity line stays short enough to sit beside the counts.
  const shortInst = (s: string | null) => {
    let t = (s ?? "").split(",")[0].trim();
    // cutting at the comma can orphan an open paren ("Mayo Clinic (Rochester, MN)" →
    // "Mayo Clinic (Rochester") — drop the dangling fragment rather than close it
    const opens = (t.match(/\(/g) ?? []).length, closes = (t.match(/\)/g) ?? []).length;
    if (opens > closes) t = t.slice(0, t.lastIndexOf("(")).trim();
    return t || null;
  };
  const miniTag = (a: string) => (
    <span key={a} style={{ font: "700 7.5px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: accentOf(a), background: `${accentOf(a)}12`, border: `1px solid ${accentOf(a)}40`, borderRadius: 4, padding: "2px 5px", flex: "none" }}>{a}</span>
  );

  // One rail-style voice row — mirrors the tumor pages' "Most active on X" module anatomy
  // (38px avatar, serif name, count chip right, one-line institution, expand-in-place).
  // COLOR DISCIPLINE (John, 2026-07-24: "an awful lot of color"): the tiny area tag is the
  // ONLY color carrier on a closed row — ring, count chip and role chip stay neutral so six
  // areas' rows don't read as rainbow noise. Accent returns inside the open drawer.
  // `sub` is the truncatable identity line (institution / show); `facts` are the COUNTS behind
  // the ranking and never truncate — a long affiliation ("Medstar Medical Group Ii LLC") was
  // eating "· 30 posts · 10 papers" off the end of the line (John, 2026-07-24).
  const voiceRow = (opts: { id: string; name: string; avatar?: string | null; areas: string[]; roleChip?: string | null; sub: string | null; facts?: string | null; count: string; countOpen?: string; children: React.ReactNode | null }) => {
    const acc = accentOf(opts.areas[0] ?? "GU");
    const open = openId === opts.id;
    const canOpen = opts.children !== null;
    return (
      <Row key={opts.id} open={open} onToggle={() => { if (canOpen) toggle(opts.id); }} accent={acc} landOffset={compact ? 108 : 70}
        head={
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 2px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: SURFACE, color: INK_2, font: "600 12px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden", marginTop: 2, border: `2px solid ${PAPER}` }}>
              {opts.avatar ? <img src={opts.avatar} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(opts.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.25 'Newsreader',Georgia,serif", color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opts.name}</span>
                <span data-disclosure style={{ display: "inline-flex", alignItems: "center", minHeight: 44, flex: "none", margin: "-10px 0 -10px", font: "600 11.5px system-ui", color: open ? acc : INK_2, padding: "0 2px", whiteSpace: "nowrap" }}>{open ? (opts.countOpen ?? "Hide ↑") : opts.count}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {opts.areas.map(miniTag)}
                {opts.roleChip && <span style={{ font: "700 7.5px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: MUT, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: "1.5px 5px", flex: "none" }}>{opts.roleChip}</span>}
                {(opts.sub || opts.facts) && (
                  <span style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0, flex: "1 1 auto", font: "400 11.5px system-ui", color: MUT }}>
                    {opts.sub && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{opts.sub}</span>}
                    {opts.sub && opts.facts && <span aria-hidden style={{ flex: "none" }}>·</span>}
                    {opts.facts && <span style={{ flex: "none", whiteSpace: "nowrap" }}>{opts.facts}</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        }>
        {opts.children}
      </Row>
    );
  };

  const MICS_CAP = 6, X_CAP = 6, MORE_CAP = 14; // expanded view still caps — a rail, not a directory
  const micsShown = micsMore ? micsRanked.slice(0, MORE_CAP) : micsRanked.slice(0, MICS_CAP);
  const xShown = xMore ? xRanked.slice(0, MORE_CAP) : xRanked.slice(0, X_CAP);
  const moreBtn = (total: number, cap: number, on: boolean, flip: () => void) => total > cap && (
    <button type="button" onClick={flip} style={{ background: "none", border: 0, cursor: "pointer", font: "600 11.5px system-ui", color: MUT2, padding: "8px 2px 0", textAlign: "left" }}>{on ? "Show fewer ↑" : `Show ${Math.min(total, MORE_CAP) - cap} more ↓`}</button>
  );

  const voicesModules = (
    <div>
      <h2 style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: INK, margin: 0 }}>Voices of the week</h2>
      <div style={{ font: "400 11.5px system-ui", color: MUT2, marginTop: 5 }}>who the field heard · who it amplified</div>

      {/* ── On the mics ── */}
      {micsRanked.length > 0 && <div style={{ margin: "18px 0 2px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ font: "500 16px 'Newsreader',Georgia,serif", color: INK }}>On the mics</span>
        <span style={{ font: "400 10.5px system-ui", color: MUT2 }}>by podcast appearances</span>
      </div>}
      {micsShown.map((m) => {
        const eps = [...m.guestEps.values(), ...m.hostEps.values()];
        // The chip shows the REAL episode count — the host-credit cap is a RANKING rule only
        // (stated in the footnote), never a displayed number (2026-07-24 adversarial review:
        // the capped micValue rendered "1 episode" above a drawer holding three).
        const n = eps.length;
        // a host's SHOW is the identifying fact (Florez → Lung Cancer Considered); a guest's is
        // where they practice. Hosts who also guested keep both, show first.
        const sub = m.hostShow ? [m.hostShow, shortInst(m.aff)].filter(Boolean).join(" · ") : shortInst(m.aff);
        return voiceRow({
          id: "vm:" + m.key,
          name: m.name,
          avatar: m.avatar,
          areas: m.areas,
          roleChip: m.hostShow ? (m.guestEps.size ? "Host + Guest" : "Host") : "Guest",
          sub,
          count: `${n} episode${n === 1 ? "" : "s"} ↓`,
          children: eps.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {eps.slice(0, 3).map((e, j) => (
                <div key={j} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "11px 13px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: e.audioUrl ? 9 : 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: SURFACE, color: INK_2, flex: "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", font: "700 9px system-ui" }}>{e.showArt ? <img src={e.showArt} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(e.show ?? "P")}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "600 12px system-ui", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                      {e.show && <div style={{ font: "400 11px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{e.show}</div>}
                    </div>
                  </div>
                  {e.audioUrl && <AudioQuote audioUrl={e.audioUrl} startMs={0} durationSeconds={e.durationSeconds} label="Listen to the episode" accent={accentOf(m.areas[0] ?? "GU")} />}
                </div>
              ))}
            </div>
          ) : null,
        });
      })}
      {moreBtn(micsRanked.length, MICS_CAP, micsMore, () => setMicsMore((v) => !v))}

      {/* ── Carried on X ── */}
      {xRanked.length > 0 && <div style={{ margin: "26px 0 2px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ font: "500 16px 'Newsreader',Georgia,serif", color: INK }}>Carried on X</span>
        <span style={{ font: "400 10.5px system-ui", color: MUT2 }}>by reposts + quotes earned</span>
      </div>}
      {xShown.map((v) => {
        const acc = accentOf(v.areas[0] ?? "GU");
        const onMics = micKeys.has(norm(v.name));
        // displayed counts must never be smaller than the union the drawer renders beneath
        // them (MAX-across-areas undercounts when a cross-area voice's posts are disjoint)
        const nPosts = Math.max(v.tweets, v.posts.length);
        const nPapers = Math.max(v.paperShares, v.articles.length);
        const facts = [`${nPosts} post${nPosts === 1 ? "" : "s"}`, nPapers ? `${nPapers} paper${nPapers === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");
        return voiceRow({
          id: "vx:" + v.key,
          name: v.name,
          avatar: v.avatar,
          areas: v.areas,
          roleChip: onMics ? "🎙 on mics" : null,
          sub: shortInst(v.institution),
          facts,
          count: `${v.amp.toLocaleString()} amplified ↓`,
          children: (v.posts.length || v.articles.length) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {v.posts.length > 0 && <div><div style={evLabel(acc)}>Their posts · this week</div>{v.posts.slice(0, 4).map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              {v.articles.length > 0 && <div><div style={evLabel(acc)}>Papers shared</div>{v.articles.slice(0, 3).map((a2, j) => <PaperCard key={j} title={a2.title} journal={a2.journal} domain={a2.domain} peerReviewed={a2.peerReviewed} url={a2.url} accent={acc} />)}</div>}
            </div>
          ) : null,
        });
      })}
      {moreBtn(xRanked.length, X_CAP, xMore, () => setXMore((v) => !v))}

      <div style={{ font: "400 10.5px/1.6 system-ui", color: MUT2, marginTop: 16, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
        Episode counts = this week&rsquo;s briefs (host, guest, or show · syndication deduped · interview-network hosts excluded). Ranked by guest appearances — hosting credits one per week; ties by lifetime appearances. Amplified = reposts + quote-posts earned on their own posts this week; cross-area voices show their busiest area&rsquo;s count. Every number shown is a plain count.
      </div>
    </div>
  );

  const evidenceChip = (acc: string) => (
    <span data-disclosure style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", minHeight: 44, font: "600 12.5px system-ui", color: acc, padding: "0 2px", whiteSpace: "nowrap" }}>Sources ↓</span>
  );

  const heroEvidenceFor = (card: HeroCard, brief: BriefingData, accent: string): HeroEvidence => {
    const resolved = resolveHeroEvidence(card, brief);
    if (!resolved) return null;
    if (resolved.kind === "paper") {
      const story = resolved.story as BriefingStory;
      const paper = story.papers?.[0];
      const firstPost = story.posts?.[0] ?? paper?.posts?.[0] ?? paper?.sharers?.[0] ?? resolved.publisherPosts[0];
      return {
        faces: resolved.faces,
        abstract: paper?.abstract?.replace(/\s+/g, " ").trim() || null,
        preview: firstPost ? <TweetCard t={firstPost} compact /> : null,
        drawer: <StoryEvidence story={{ ...story, publisherPosts: resolved.publisherPosts }} accent={accent} paperLabel="The paper" />,
      };
    }
    if (resolved.kind === "article") {
      const paper = resolved.paper as unknown as BriefingPaper;
      const firstPost = resolved.posts[0] ?? paper.posts?.[0] ?? paper.sharers?.[0] ?? resolved.publisherPosts[0];
      return {
        faces: resolved.faces,
        abstract: paper.abstract?.replace(/\s+/g, " ").trim() || null,
        preview: firstPost ? <TweetCard t={firstPost} compact /> : null,
        drawer: <StoryEvidence story={{ podcast: [], posts: resolved.posts, papers: [paper], kind: "paper", publisherPosts: resolved.publisherPosts }} accent={accent} paperLabel="The paper" />,
      };
    }
    if (resolved.kind === "episode") return { faces: resolved.faces, drawer: (
      <>
        <StoryEvidence story={{ podcast: resolved.pods, posts: [], papers: [], kind: "episode" }} accent={accent} paperLabel="Papers" />
        {(card.amplifiers ?? []).length > 0 && <AmplifierReceipts amplifiers={card.amplifiers ?? []} accent={accent} />}
      </>
    ) };
    return { faces: resolved.faces, drawer: <StoryEvidence story={{ podcast: [], posts: [resolved.post], papers: [], kind: "thread" }} accent={accent} paperLabel="Papers" /> };
  };

  // One story row — the lead gets the front-page step-up, while every headline shares
  // one clean left edge with the kicker, teaser, and facts line.
  const renderStory = (s: BriefingStory, i: number, a: string, acc: string) => {
    const lead = i === 0;
    const id = `all:${a}:${i}`;
    const open = openId === id;
    const faces = pileFaces(s);
    const headlineFont = lead ? (compact ? "500 20px/1.18" : "500 21px/1.18") : (compact ? "500 17.5px/1.3" : "500 18.5px/1.25");
    return (
      <div key={id} className="readout-story-card" style={{ background: "transparent", border: 0, borderBottom: `1px solid ${LINE}`, ...(lead ? { borderLeft: `3px solid ${acc}` } : {}), borderRadius: 0, padding: "0 2px", marginBottom: 0 }}>
        <Row open={open} onToggle={() => toggle(id)} accent={acc} landOffset={compact ? 108 : 70}
          head={
            <div style={{ display: "flex", alignItems: "flex-start", padding: lead ? "18px 2px" : "15px 2px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <span style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: acc }}>{storyKicker(s)}</span>
                </div>
                <h3 style={{ font: `${headlineFont} 'Newsreader',Georgia,serif`, color: INK, letterSpacing: 0, margin: 0 }}>{s.headline}</h3>
                {s.subtitle && <div style={{ font: "500 11.5px system-ui", color: MUT, marginTop: 6 }}>{s.subtitle}</div>}
                {s.description && <p style={{ margin: "9px 0 0", font: "400 13.5px/1.5 system-ui", color: "#aab0bf", ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{s.description}</p>}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {faces.length > 0 && <FacePile faces={faces} extra={0} ring={PAPER} />}
                  <span style={{ font: "400 12px system-ui", color: MUT }}>{storyMetricLine(s)}</span>
                  {!open && evidenceChip(acc)}
                </div>
              </div>
            </div>
          }>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <StanceBlock stance={s.stance} accent={acc} />
            <StoryEvidence story={s} accent={acc} paperLabel={paperBlockLabel(s)} />
          </div>
        </Row>
      </div>
    );
  };

  const editionMenu = (
    <div style={{ position: "relative", flex: "none" }}>
      <div role="button" tabIndex={0} aria-expanded={menuOpen} aria-label="Switch tumor area"
        onClick={() => setMenuOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMenuOpen((o) => !o); } }}
        className="rv-edition"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 0", cursor: "pointer", background: "transparent", border: 0, borderRadius: 0 }}>
        <span style={{ font: "700 13px system-ui", color: ALL_ACCENT, whiteSpace: "nowrap" }}>All oncology</span>
        <span aria-hidden style={{ width: 10, height: 10, borderRight: `2px solid ${ALL_ACCENT}`, borderBottom: `2px solid ${ALL_ACCENT}`, transform: menuOpen ? "translateY(3px) rotate(225deg)" : "translateY(-2px) rotate(45deg)", transition: "transform .18s ease", flex: "none", boxSizing: "border-box" }} />
      </div>
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", top: "calc(100% + 7px)", right: compact ? 0 : undefined, left: compact ? undefined : 0, width: 210, background: "rgba(255,255,255,.98)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${LINE}`, borderRadius: 6, boxShadow: "0 16px 36px rgba(31,35,42,.14)", padding: 8, zIndex: 31 }}>
            <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: MUT2, padding: "6px 11px 8px" }}>Tumor area</div>
            {areas.map((a) => {
              const on = a === "All";
              const label = a === "All" ? "All oncology" : (AREA_FULL[a] ?? a);
              const isHome = a === primary;
              return (
                <button key={a} type="button" role="menuitem" aria-current={on} onClick={() => { setMenuOpen(false); if (!on) onArea(a); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: on ? SURFACE : "transparent", border: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: a === "All" ? ALL_ACCENT : accentOf(a) }} />
                  <span style={{ flex: 1, font: "600 13.5px system-ui", color: on ? ALL_ACCENT : INK_2 }}>{label}</span>
                  {isHome && <span title="Your default" style={{ color: MUT2, font: "700 12px system-ui" }}>⌂</span>}
                  {on && <span style={{ color: ALL_ACCENT, font: "700 13px system-ui" }}>✓</span>}
                </button>
              );
            })}
            {onSetPrimary && primary !== "All" && (
              <>
                <div style={{ height: 1, background: LINE, margin: "6px 4px" }} />
                <button type="button" onClick={() => { onSetPrimary("All"); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: "transparent", border: 0, color: ALL_ACCENT, font: "600 12.5px system-ui" }}>
                  <span aria-hidden style={{ font: "700 13px system-ui" }}>⌂</span>Make All oncology my default
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="reader-editorial" style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", ["--rv-accent" as string]: ALL_ACCENT, ["--rv-ink" as string]: INK, ["--rv-ink-2" as string]: INK_2, ["--rv-copy" as string]: INK_2, ["--rv-muted" as string]: MUT, ["--rv-muted-2" as string]: MUT2, ["--rv-line" as string]: LINE, ["--rv-surface" as string]: SURFACE, ["--rv-card" as string]: "#fff", ["--rv-card-line" as string]: "#d8d7d1", ["--rv-card-radius" as string]: "8px", ["--rv-card-shadow" as string]: "0 8px 22px rgba(31,35,42,.07)" }}>
      <style>{`
        .rv-list-row{border-bottom:1px solid ${LINE}}
        .rv-edition{position:relative}
        .rv-edition::after{content:"";position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:44px}
        .rv-row{transition:color .16s ease}
        @media(hover:hover){.rv-row:hover [data-disclosure],.rv-text-action:hover{text-decoration:underline;text-underline-offset:4px}}
        .rv-row:focus-visible{outline:2px solid ${ALL_ACCENT};outline-offset:-2px}
        .rv-text-action:focus-visible{outline:2px solid ${ALL_ACCENT};outline-offset:2px;border-radius:4px}
        .rv-drawer{animation:rvDrawerIn .26s cubic-bezier(.4,0,.2,1)}
        @keyframes rvDrawerIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        .all-pills::-webkit-scrollbar{display:none}.all-pills{scrollbar-width:none}
        .all-fade{-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 36px),transparent);mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 36px),transparent)}
        .reader-editorial .aq-dark{--aq-shell:#fff;--aq-border:#d8d7d1;--aq-track:#d9d8d3;background:var(--aq-shell);border-color:var(--aq-border);color:${INK}}
        .reader-editorial .aq-dark .aq-times,.reader-editorial .aq-dark .aq-label,.reader-editorial .aq-dark .aq-cur{color:#74767a}
        .reader-editorial .readout-hero-card:not(.is-compact){border-top-color:${LINE}}
        .reader-editorial .readout-hero-abstract>p{color:${INK_2}}
        .reader-editorial .readout-hero-preview>div:first-child{color:${MUT}}
        @media(prefers-reduced-motion:reduce){.rv-drawer{animation:none}}
      `}</style>

      <div style={{ maxWidth: wide ? 1116 : 760, margin: "0 auto", padding: compact ? "18px 20px 100px" : wide ? "0 30px 120px" : "0 32px 120px" }}>
        {/* Publication masthead: same hierarchy as every specialty edition. */}
        <div style={{ minHeight: compact ? undefined : 86, display: "flex", alignItems: compact ? "flex-start" : "center", justifyContent: "space-between", gap: compact ? 8 : 18 }}>
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <span style={{ display: "block", color: ALL_ACCENT, font: `750 ${compact ? 9 : 10}px/1 system-ui`, textTransform: "uppercase" }}>CanvasMD</span>
            <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: compact ? 8 : 18, marginTop: 1 }}>
              <h1 style={{ font: `500 ${compact ? 22 : 28}px/1 Georgia,'Newsreader',serif`, color: INK, margin: 0 }}>The Readout</h1>
              {!compact && editionMenu}
            </div>
          </div>
          <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: compact ? 8 : 14, flex: "none", marginTop: compact ? 10 : 0 }}>
            {compact && editionMenu}
            {!compact && oldestStamp && <span style={{ font: "600 12px system-ui", color: MUT, whiteSpace: "nowrap" }}>{ago(oldestStamp)}</span>}
          <button onClick={doShare} aria-label="Share this edition" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: compact ? 44 : undefined, height: 44, margin: compact ? "-11px -13px -11px 0" : 0, padding: compact ? 0 : "0 15px", background: "transparent", border: compact ? 0 : `1px solid ${LINE}`, borderRadius: 6, color: compact ? MUT : INK, font: "600 13px system-ui", cursor: "pointer", flex: "none" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            {!compact && "Share"}
          </button>
          </div>
        </div>
        {shareMsg && <div role="status" style={{ font: "600 12px system-ui", color: INK, marginTop: 8 }}>{shareMsg}</div>}
        <div style={{ font: "600 10px system-ui", color: MUT2, marginTop: compact ? 7 : 0 }}>
          Busiest first{compact && oldestStamp ? <> · Updated {ago(oldestStamp)}</> : null}
        </div>
        <div aria-hidden style={{ height: 1, margin: "13px 0 10px", background: LINE }} />

        {/* Section navigation mirrors the specialty editions; the second row is the All-page
            equivalent of Focus, scoping the cross-oncology scan by tumor area. */}
        {(() => {
          const tabStyle = (on: boolean, activeColor: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 44, cursor: "pointer", font: `${on ? "700" : "600"} 12.5px system-ui`, padding: "8px 2px 10px", borderRadius: 0, border: 0, borderBottom: `2px solid ${on ? activeColor : "transparent"}`, background: "transparent", color: on ? INK : MUT, whiteSpace: "nowrap", flex: "none", transition: "border-color .15s, color .15s" });
          const areaPills = orderedAreas.map((a) => {
            const on = activeSec === areaId(a);
            return (
              <button key={a} onClick={() => goArea(a)} style={tabStyle(on, accentOf(a))}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: accentOf(a), flex: "none" }} />{a}
              </button>
            );
          });
          {/* Voices rides the rail on wide (always visible → no pill, same rule as the tumor
              pages' rail sections); on narrow it's an inline section that earns a jump */}
          const voicesPill = !wide && micsRanked.length + xRanked.length > 0 && (
            <button key="voices" onClick={() => goTo("all-voices")} style={tabStyle(activeSec === "all-voices", ALL_ACCENT)}>
              Voices
            </button>
          );
          const papersPill = reading.length > 0 && (
            <button key="papers" onClick={() => goTo("all-reading")} style={tabStyle(activeSec === "all-reading", ALL_ACCENT)}>
              Papers
            </button>
          );
          const rowPad = compact ? "0 20px" : wide ? "0 30px" : "0 32px";
          // Compact section row reads like the tumor pages' tabs: Top Stories lit while you're
          // anywhere in the groups; Voices / Papers take over in their sections.
          const inSection = activeSec === "all-voices" || activeSec === "all-reading";
          const topPill = (
            <button key="top" onClick={() => goArea(orderedAreas[0])} style={tabStyle(!inSection, ALL_ACCENT)}>
              Stories
            </button>
          );
          return (
            <div style={{ position: "sticky", top: 0, zIndex: 15, display: "flex", flexDirection: "column", margin: compact ? "0 -20px" : wide ? "0 -30px" : "0 -32px", background: stuck ? "rgba(244,244,241,.96)" : PAPER, backdropFilter: "blur(16px) saturate(1.1)", WebkitBackdropFilter: "blur(16px) saturate(1.1)", borderBottom: `1px solid ${LINE}`, boxShadow: stuck ? "0 10px 24px -22px rgba(31,35,42,.4)" : "none", transition: "box-shadow .2s ease" }}>
              <div style={{ display: "flex", gap: 24, padding: rowPad }}>
                {topPill}
                {voicesPill}
                {papersPill}
              </div>
              <div className={`all-pills${compact ? " all-fade" : ""}`} style={{ display: "flex", alignItems: "center", gap: compact ? 18 : 20, flexWrap: "nowrap", overflowX: "auto", padding: rowPad, WebkitOverflowScrolling: "touch" }}>
                <span style={{ font: "600 9.5px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: MUT2, flex: "none" }}>Areas</span>
                {areaPills}
              </div>
            </div>
          );
        })()}

        {/* six area groups — compact first-pass picks with an in-place "show more";
            groups ride in activity order, and the receipt count in each header justifies the slot.
            WIDE: two tracks like the tumor pages — editorial column (groups + reading) + the
            Voices rail. NARROW: everything inline — groups → voices → reading. */}
        {(() => {
          const groupsJsx = (
            <>
              {orderedAreas.map((a) => {
                const brief = briefsByArea[a];
                const acc = accentOf(a);
                // Hero contract (Codex cutover review): in hero mode the deck is authoritative —
                // an empty deck is a quiet week, never a fallback to legacy stories.
                const heroDeck = brief ? heroDeckOf(brief) : null;
                const stories = brief && heroDeck === null ? storiesOf(brief) : [];
                const full = AREA_FULL[a] ?? a;
                return (
                  <div key={a} id={areaId(a)} style={{ marginTop: 34, scrollMarginTop: compact ? 100 : 62 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: acc, flex: "none" }} />
                      {/* a real h2: the story titles below are h3, and without this the page is
                          42 same-level headings under one h1 with no way to skip between areas */}
                      <h2 style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: INK, margin: 0 }}>{full}</h2>
                      {activity[a] > 0 && <span title="Distinct source anchors and published receipts behind this area's featured cards" style={{ font: "400 11px system-ui", color: MUT2, whiteSpace: "nowrap" }}>· {activity[a]}{compact ? "" : " sources"}</span>}
                      {lagOf(a) && <span title="This area's snapshot is older than the rest of the page" style={{ font: "600 9px system-ui", letterSpacing: ".06em", textTransform: "uppercase", color: MUT, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 5, padding: "2px 6px" }}>{lagOf(a)}</span>}
                      <button onClick={() => onArea(a)} style={{ marginLeft: "auto", background: "none", border: 0, cursor: "pointer", font: "600 12px system-ui", color: acc, whiteSpace: "nowrap" }}>{compact ? "Full brief" : `Full ${a} brief`} →</button>
                    </div>
                    {/* A brief that never arrived is NOT a quiet week — say which one it is. */}
                    {!brief ? (
                      <div style={{ font: "400 13.5px/1.5 system-ui", color: MUT, padding: "2px 2px 4px" }}>
                        {failed?.[a]
                          ? <>Couldn’t load {full} this time. <button onClick={() => onRetry?.(a)} style={{ background: "none", border: 0, cursor: "pointer", font: "600 13.5px system-ui", color: acc, padding: 0 }}>Retry →</button></>
                          : <>Loading {full}…</>}
                      </div>
                    ) : (heroDeck !== null || stories.length > 0) ? (
                      <>
                        {heroDeck !== null && heroDeck.length > 0 && <HeroCards
                          cards={visibleAllHeroCards(heroDeck, compact, !!expandedAreas[a])}
                          accent={acc}
                          ink={{ soft: INK_2, softer: MUT, line: LINE, ring: PAPER, surface: SURFACE }}
                          idPrefix={`all-${a}`}
                          evidenceOf={(card) => heroEvidenceFor(card, brief, acc)}
                        />}
                        {heroDeck !== null && heroDeck.length > (compact ? 2 : 3) && (
                          <button type="button" onClick={() => setExpandedAreas((current) => ({ ...current, [a]: !current[a] }))}
                            className="rv-text-action" style={{ minHeight: 44, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12px system-ui", color: acc }}>
                            {expandedAreas[a] ? "Show fewer stories ↑" : `Show ${heroDeck.length - (compact ? 2 : 3)} more stor${heroDeck.length - (compact ? 2 : 3) === 1 ? "y" : "ies"} ↓`}
                          </button>
                        )}
                        {heroDeck !== null && heroDeck.length === 0 && (
                          <div style={{ font: "400 13.5px/1.5 system-ui", color: MUT, padding: "2px 2px 4px" }}>A quiet week — no source-anchored stories qualified.</div>
                        )}
                        {heroDeck === null && stories.map((s, i) => renderStory(s, i, a, acc))}
                      </>
                    ) : (
                      <div style={{ font: "400 13.5px/1.5 system-ui", color: MUT, padding: "2px 2px 4px" }}>Quiet week in {full}. <button onClick={() => onArea(a)} style={{ background: "none", border: 0, cursor: "pointer", font: "600 13.5px system-ui", color: acc, padding: 0 }}>See the full brief →</button></div>
                    )}
                  </div>
                );
              })}
            </>
          );
          {/* the ONE merged section — honest by a comparable count; rows behave exactly like
              the tumor pages' "What's being read" (expand → abstract + what clinicians said) */}
          const readingJsx = reading.length > 0 && (
            <div id="all-reading" style={{ marginTop: 40, paddingTop: 26, borderTop: `1px solid ${LINE}`, scrollMarginTop: compact ? 100 : 62 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                <h2 style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: INK, margin: 0 }}>What the field is reading</h2>
                <span style={{ font: "400 11.5px system-ui", color: MUT2 }}>· the week’s top ten across every area · ranked by clinicians who shared it · includes papers featured above</span>
              </div>
              {reading.map(({ p, area }, i) => {
                const acc = accentOf(area);
                const id = "r:" + i;
                const open = openId === id;
                return (
                  <div key={id} style={{ borderBottom: i < reading.length - 1 ? `1px solid ${LINE}` : "none" }}>
                    <Row open={open} onToggle={() => toggle(id)} accent={acc} landOffset={compact ? 108 : 70}
                      head={
                        <div style={{ padding: "16px 2px" }}>
                          <div style={{ font: "500 16px/1.4 'Newsreader',Georgia,serif", color: INK }}>{cleanArticleTitle(p.title)}</div>
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 9 }}>
                            <span style={{ font: "700 8px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: acc, background: `${acc}12`, border: `1px solid ${acc}40`, borderRadius: 4, padding: "3px 6px", flex: "none" }}>{area}</span>
                            {p.faces.length > 0 && <FacePile faces={p.faces} extra={p.kolSharers - p.faces.length} ring={PAPER} />}
                            <span style={{ font: "400 12px system-ui", color: MUT }}>{[articleSource(p.journal, p.domain), p.kolSharers ? `shared by ${p.kolSharers} clinician${p.kolSharers === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}</span>
                            {featuredIn.has(norm(p.title)) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); goArea(featuredIn.get(norm(p.title))!); }}
                                title="This paper also leads a story earlier on the page"
                                style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 5, padding: "2px 6px", cursor: "pointer", font: "600 9px system-ui", letterSpacing: ".06em", textTransform: "uppercase", color: MUT }}
                              >↑ Above in {featuredIn.get(norm(p.title))}</button>
                            )}
                            {isNewsItem(p) && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: MUT, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
                            {!open && evidenceChip(acc)}
                          </div>
                        </div>
                      }>
                      {p.abstract && <p style={{ margin: 0, font: "400 15px/1.6 'Newsreader',Georgia,serif", color: INK_2 }}>{p.abstract}</p>}
                      {p.posts.length > 0 && <div><div style={evLabel(acc)}>What clinicians said · {p.kolSharers > p.posts.length ? `${p.posts.length} of ${p.kolSharers}` : p.posts.length}</div>{p.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                      {/* link to the source — also guarantees the expand is never empty */}
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", font: "600 13px system-ui", color: acc, textDecoration: "none" }}>Open article ↗</a>}
                    </Row>
                  </div>
                );
              })}
            </div>
          );
          const voicesInline = micsRanked.length + xRanked.length > 0 && (
            <div id="all-voices" style={{ marginTop: 40, paddingTop: 26, borderTop: `1px solid ${LINE}`, scrollMarginTop: compact ? 100 : 62 }}>{voicesModules}</div>
          );
          // old snapshots ship no hosts/amp — collapse the rail rather than render an empty shell
          const hasVoices = micsRanked.length + xRanked.length > 0;
          return wide ? (
            <div style={{ display: "grid", gridTemplateColumns: hasVoices ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)", columnGap: 46, alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>{groupsJsx}{readingJsx}</div>
              {hasVoices && <aside style={{ minWidth: 0, marginTop: 34 }}>{voicesModules}</aside>}
            </div>
          ) : (
            <>{groupsJsx}{voicesInline}{readingJsx}</>
          );
        })()}

        <div style={{ textAlign: "center", marginTop: 44, paddingTop: 22, borderTop: `1px solid ${LINE}` }}>
          <div style={{ font: "500 15px/1 'Newsreader',Georgia,serif", color: MUT }}>The Readout</div>
          <div style={{ font: "400 12px/1.55 system-ui", color: MUT, marginTop: 12, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>Signal from tracked oncology clinicians and selected oncology podcasts. Pick an area above to go deep.</div>
        </div>
      </div>
    </div>
  );
}
