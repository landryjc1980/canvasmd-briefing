"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BriefingData, BriefingArticle, BriefingStory, BriefingSharer, BriefingPaper, BriefingEpisode, HeroCard } from "@/lib/types";
import { heroSlugFor } from "@/lib/postId";
// Reuse the exact evidence machinery from the single-area reader so the expand /
// Hide-at-bottom / clips / receipts behave identically everywhere.
import { Row, TweetCard, PaperCard, PaperShareRow, FacePile, Coin, evLabel, StoryEvidence, EpisodeXReceipts, SectionHead, statTile, statTileLabel, EDITORIAL_MEASURE } from "./ReaderView";
import StanceBlock from "./StanceBlock";
import AudioQuote from "@/components/AudioQuote";
import { AREA_FULL, storiesOf, storyKicker, paperBlockLabel, storyMetricLine, pileFacesL, heroDeckOf, clipTs } from "./briefVM";
import HeroCards, { HeroEvidence, KIND_KICKER, heroEvidenceLabel, SEEN_DIM } from "./HeroCards";
import { pickConversationPreview, resolveHeroEvidence } from "./heroEvidence";
import { featuredHeroPaperKeys, visibleAllHeroCards } from "./allHeroContract";
import { distinctSourceAnchorCount } from "./clientEvidence";
import { logSignal, logStorySeen, logStoryImpression } from "./gateClient";
import { artifactSig, storySig, rankAcrossSpecialties, computeBand, approvalsRail, approvalChipLabel, type AreaEntries } from "./allFrontPage";
import { cardMetrics } from "./allCardMetrics";
import { readSeenLog, recordSeen, beginVisit, readFirstObserved, recordFirstObserved } from "./readerMemory";

// "All oncology" — a front page that reads as ONE continuous scan: each area's authoritative
// hero order, grouped by area and shown in its own color, never re-ranked across areas (their
// scores are area-relative — cross-ranking would be dishonest). The initial view is capped so
// community oncologists can cross specialties quickly; expansion preserves the signed order.
// The one section that DOES merge is "what the field is reading": papers ranked by the plain,
// comparable count of verified clinicians who shared them.

const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"];
const INK = "#17181a";
const INK_2 = "#4f5257";
const MUT = "#696c71";
const MUT2 = "#6d7074";
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
  Skin: "#6d28d9",
};
const accentOf = (area: string) => AREA_ACCENTS[area] ?? ALL_ACCENT;
// How far an already-read story fades — ONE value shared with the hero cards, so the deck, the
// rails and the band can't drift apart. NOT the mock's .55: INK at 55% over PAPER lands around
// #7a7b7d, which is ~3.9:1 — under the 4.5:1 the kicker and receipts line need, so a read row
// became genuinely hard to read rather than merely quiet (John, 2026-08-24). At .72 it resolves
// near #555557 (~6.8:1) and still reads as clearly de-emphasised beside a full-ink row, with the
// missing accent dot carrying the rest of the signal.
const DIM = SEEN_DIM;
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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [micsMore, setMicsMore] = useState(false);
  const [xMore, setXMore] = useState(false);
  const [episodesMore, setEpisodesMore] = useState(false);
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
  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
      (selected ?? menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]'))?.focus();
    });
  }, [menuOpen]);
  const closeMenu = (restoreFocus = true) => {
    setMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuTriggerRef.current?.focus());
  };
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); closeMenu(); return; }
    if (event.key === "Tab") { requestAnimationFrame(() => closeMenu(false)); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (!items.length) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    const next = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? (current + 1) % items.length
      : (current - 1 + items.length) % items.length;
    items[next].focus();
  };
  const toggle = (id: string) => setOpenId((c) => (c === id ? null : id));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // ---- READER MEMORY (seen log · visit clock · first-observed clock) -----------------------
  // Captured ONCE at mount so the Since-your-last-read band and NEW/UPDATED chips stay stable
  // for the whole sitting — this visit's reading only affects the NEXT visit. localStorage is
  // per-device and versioned (readout.*.v1); AllView never server-renders (the page shows its
  // loading state until the client fetches land), so reading storage in the initializer is safe.
  const [memory] = useState(() => {
    const visit = beginVisit();
    return { seenLog: readSeenLog(), lastVisit: visit.lastVisit, visitStart: visit.visitStart, firstObserved: readFirstObserved() };
  });
  // TWO sets, and the distinction is the whole point (John, 2026-08-24: "I hate how it whites
  // things out in real time when I scroll"):
  //   seenAtLoad — FROZEN at mount. The only thing that may dim a story or drop its unseen dot.
  //     A story you read during THIS sitting stays full ink until your next visit; the page must
  //     never fade out from under someone who is still reading it. Signalling what's new is the
  //     Since-your-last-read band's job, so live graying is both redundant and hostile.
  //   seenIds — live. Drives storage and the caught-up line ONLY. That line is the reward for
  //     finishing and SHOULD appear the moment the last item is read.
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set(Object.keys(memory.seenLog)));
  const [seenAtLoad] = useState<ReadonlySet<string>>(() => new Set(Object.keys(memory.seenLog)));
  // One open hero card across every specialty rail (controlled mode) — lets a band row or
  // approvals row auto-open the card it points at.
  const [heroOpen, setHeroOpen] = useState<string | null>(null);

  // ---- FRONT-DOOR COMPOSITION over the per-area hero payloads --------------------------------
  // Client-side promotion only: each area's deck order is the engine's authoritative signal; we
  // never re-score it (see allFrontPage.ts for the locked order of operations).
  const landedKey = AREAS.map((a) => briefsByArea[a]?.generatedAt ?? "-").join("|");
  const heroPerArea = useMemo<(AreaEntries & { brief: BriefingData | undefined })[]>(() =>
    AREAS.map((area) => {
      const brief = briefsByArea[area];
      const cards = brief ? heroDeckOf(brief) : null;
      if (!brief || cards === null) return { area, brief, entries: [] };
      return { area, brief, entries: cards.map((card) => ({ card, metrics: cardMetrics(card, brief) })) };
    }),
  // briefsByArea is rebuilt by the parent every render — generatedAt stamps are the true identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [landedKey]);
  const deck = useMemo(() => rankAcrossSpecialties(heroPerArea, AREAS), [heroPerArea]);
  const bandRows = useMemo(
    () => computeBand({ perArea: heroPerArea, areaOrder: AREAS, seen: memory.seenLog, firstObserved: memory.firstObserved, lastVisit: memory.lastVisit }),
    [heroPerArea, memory]);
  const approvals = useMemo(() => approvalsRail(heroPerArea), [heroPerArea]);

  // Everything on the page a seen-mark can attach to: hero cards (all areas) + legacy stories.
  // Keys are the DURABLE anchor-derived ids (never the per-build index ids like `all:GU:0`).
  const idMap = useMemo(() => {
    const map = new Map<string, { area: string; label: string; kind: string; sig: string[] }>();
    for (const { area, brief, entries } of heroPerArea) {
      for (const { card } of entries) if (!map.has(card.id)) map.set(card.id, { area, label: card.headline, kind: card.kind, sig: artifactSig(card) });
      if (brief && heroDeckOf(brief) === null) for (const s of storiesOf(brief)) if (!map.has(s.id)) map.set(s.id, { area, label: s.headline, kind: s.kind, sig: storySig(s) });
    }
    return map;
  }, [heroPerArea]);
  const idMapRef = useRef(idMap);
  idMapRef.current = idMap;

  // Mark a development seen. ALWAYS refreshes the stored artifact signature (re-reading an
  // UPDATED story clears its UPDATED state next visit); logs story_view once per page load.
  const markSeen = (sid: string, trigger: "expand" | "dwell" | "click" | "point") => {
    const info = idMapRef.current.get(sid);
    recordSeen(sid, info?.sig ?? []);
    setSeenIds((prev) => (prev.has(sid) ? prev : new Set(prev).add(sid)));
    if (info) logStorySeen(info.area, sid, undefined, { label: info.label, kind: info.kind, trigger, surface: "all" });
  };
  const markSeenRef = useRef(markSeen);
  markSeenRef.current = markSeen;

  // Stamp first-observed for every card currently in a payload (feeds NEW next visit). Runs
  // again as late areas land so their cards are stamped too; never re-stamps an existing id.
  const idMapKey = [...idMap.keys()].join("|");
  const visitStart = memory.visitStart;
  useEffect(() => {
    recordFirstObserved([...idMapRef.current.keys()], visitStart);
  }, [idMapKey, visitStart]);

  // ---- impressions + dwell-seen -------------------------------------------------------------
  // Impression: the card crossed half-visible (logged once per page load). Seen-by-dwell: the
  // WHOLE card — or a viewport-filling slice of one taller than the screen — held CONTINUOUSLY
  // for DWELL_MS. The clock resets the moment a card stops qualifying, so scrolling past never
  // banks partial time and never counts as read.
  //
  // Rect polling, NOT IntersectionObserver — the same call the story-impression code in
  // ReaderView made, for the same reason: IO callbacks are suppressed in embedded/backgrounded
  // webviews (re-verified 2026-08-24 in the preview pane, where a fresh observer on a fully
  // visible element never fired once). A poll over ~20 cards is free and actually runs. It also
  // covers the no-scroll case a scroll listener alone would miss: the cards already on screen at
  // load are exactly the ones a reader dwells on first.
  const DWELL_MS = 2000;
  const POLL_MS = 250;
  const expandedKey = Object.keys(expandedAreas).filter((k) => expandedAreas[k]).join(",");
  useEffect(() => {
    const since = new Map<string, number>();
    const check = () => {
      const vh = window.innerHeight;
      // Zero-rect guard: a hidden or mid-transition layout reports all-zero rects, and every
      // `0 >= 0` comparison below would pass — mass-marking the page seen with nothing on screen.
      if (vh <= 0 || document.hidden) { since.clear(); return; }
      const now = Date.now();
      const live = new Set<string>();
      document.querySelectorAll<HTMLElement>("[data-sid]").forEach((el) => {
        const sid = el.dataset.sid;
        if (!sid) return;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) return;
        const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (visible <= 0) return;
        const info = idMapRef.current.get(sid);
        if (visible >= r.height * 0.5 && info) {
          logStoryImpression(info.area, sid, { label: info.label, kind: info.kind, surface: el.closest<HTMLElement>("[data-ssurface]")?.dataset.ssurface ?? el.dataset.ssurface });
        }
        // "Fully dwelled": the whole card is on screen, or — for a card taller than the
        // viewport, which can never be whole — it is filling most of the screen.
        const whole = visible >= r.height * 0.95;
        const fillsScreen = r.height > vh * 0.9 && visible >= vh * 0.7;
        if (!whole && !fillsScreen) return;
        live.add(sid);
        const start = since.get(sid);
        if (start === undefined) since.set(sid, now);
        else if (now - start >= DWELL_MS) { since.delete(sid); markSeenRef.current(sid, "dwell"); }
      });
      for (const sid of since.keys()) if (!live.has(sid)) since.delete(sid); // left the screen → clock resets
    };
    const id = setInterval(check, POLL_MS);
    check();
    return () => clearInterval(id);
  }, [idMapKey, expandedKey]);

  // ---- activity-ordered groups: busiest area first ----
  // The fixed GU→Gyn order was itself a quiet editorial statement (GU first because it was OUR
  // first area; Gyn permanently last = permanently least-read). Order instead by a plain,
  // comparable count — distinct evidence items (podcast clips + verified-clinician posts +
  // papers) behind the area's stories this week — shown in the header so the order justifies
  // itself. Rankings within each area stay area-relative; only the GROUPS move.
  const evidenceCount = (brief: BriefingData | undefined): number => {
    if (!brief) return 0;
    const hero = heroDeckOf(brief);
    return hero !== null ? distinctSourceAnchorCount(hero) : distinctSourceAnchorCount(storiesOf(brief));
  };
  const activity = Object.fromEntries(AREAS.map((a) => [a, evidenceCount(briefsByArea[a])]));
  const orderedAreas = [...AREAS].sort((x, y) => activity[y] - activity[x] || AREAS.indexOf(x) - AREAS.indexOf(y));

  // Cross-specialty listening uses a round-robin over each area's existing ranked episode list.
  // That preserves every producer-authored within-area order while stopping the busiest area from
  // occupying the entire All Oncology shelf. Syndicated/cross-area duplicates collapse to one row
  // and retain every area label where they appeared.
  type AllEpisode = { key: string; episode: BriefingEpisode; areas: string[]; featured: boolean };
  const episodePools = orderedAreas.map((area) => ({ area, items: (briefsByArea[area]?.episodes ?? []).filter((ep) => !!ep.audioUrl) }));
  const episodeByKey = new Map<string, AllEpisode>();
  const allEpisodes: AllEpisode[] = [];
  const maxEpisodeDepth = Math.max(0, ...episodePools.map((pool) => pool.items.length));
  for (let depth = 0; depth < maxEpisodeDepth; depth++) {
    for (const pool of episodePools) {
      const episode = pool.items[depth];
      if (!episode) continue;
      const key = episode.episodeId || episode.audioUrl || `${norm(episode.show ?? "podcast")}:${norm(episode.title)}`;
      const hero = heroDeckOf(briefsByArea[pool.area]!);
      const featured = !!hero?.some((card) => card.kind === "episode" && card.anchorId === episode.episodeId);
      const existing = episodeByKey.get(key);
      if (existing) {
        if (!existing.areas.includes(pool.area)) existing.areas.push(pool.area);
        existing.featured ||= featured;
        continue;
      }
      const entry = { key, episode, areas: [pool.area], featured };
      episodeByKey.set(key, entry);
      allEpisodes.push(entry);
    }
  }

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
  type EpRec = { title: string; audioUrl: string | null; durationSeconds?: number | null; show: string | null; showArt: string | null; episodeId?: string | null; recordingKey?: string | null };
  type MicEntry = { key: string; name: string; aff: string | null; verified: boolean; avatar: string | null; areas: string[]; guestEps: Map<string, EpRec>; hostEps: Map<string, EpRec>; hostShow: string | null; career: number };
  // Episode UUID is authoritative. The normalized-title fallback exists only for older payloads
  // without an ID, so two recordings with the same program title keep their distinct faculty.
  const epKey = (t: string | null) => norm((t ?? "").replace(/^\s*(ep\.?\s*\d+|episode\s*\d+|#\s*\d+|part\s*\d+)\s*[:.\-–—]*\s*/i, "")).replace(/\s+/g, "");
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
    for (const e of g.episodes) eps.set(e.episodeId || e.recordingKey || epKey(e.title), { title: e.title, audioUrl: e.audioUrl, durationSeconds: e.durationSeconds, show: e.show, showArt: e.showArt, episodeId: e.episodeId, recordingKey: e.recordingKey });
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
  const micEpisodes = (m: MicEntry) => [...new Map([
    ...m.guestEps.entries(),
    ...m.hostEps.entries(),
  ]).values()];
  const micValue = (m: MicEntry) => m.guestEps.size +
    ([...m.hostEps.keys()].some((key) => !m.guestEps.has(key)) ? 1 : 0); // host credit capped at 1/wk, never twice for one episode
  const epCount = (m: MicEntry) => micEpisodes(m).length; // one episode stays one even if role extraction disagrees
  const micsRanked = [...mics.values()]
    .filter((m) => micValue(m) > 0)
    // credit first (hosting counts once/wk), then the DISPLAYED episode count, then career.
    // Without the middle key a 3-episode show sorted under a 1-episode host — both hold one
    // host credit — and the visible numbers read as mis-sorted even though the rule is stated.
    .sort((x, y) => micValue(y) - micValue(x) || epCount(y) - epCount(x) || y.career - x.career || x.name.localeCompare(y.name));

  type XEntry = { key: string; name: string; handle: string | null; avatar: string | null; institution: string | null; areas: string[]; amp: number; tweets: number; paperShares: number; posts: BriefingSharer[]; articles: { title: string; url: string; journal: string | null; domain: string | null; abstract?: string | null; description?: string | null; peerReviewed?: boolean }[] };
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
  const xRanked = [...xVoices.values()].filter((v) => v.amp > 0)
    .sort((x, y) => y.amp - x.amp || y.tweets - x.tweets);
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
  // "" = above the first area group, i.e. the whole-page view. NOT the first area: the row
  // reads as a scope selector, so defaulting it to GU claimed a filter that isn't applied.
  const [activeSec, setActiveSec] = useState<string>("");
  const orderKey = orderedAreas.join(",");
  // What a jump has to clear. Each layout stickies a DIFFERENT element: wide pins the full
  // masthead (the Areas band below it scrolls away), while medium and compact pin only the
  // section-pill row — same values the specialty editions use.
  const jumpOffset = wide ? 96 : compact ? 74 : 62;
  useEffect(() => {
    // ids in VISUAL order (groups are activity-ordered) — the spy takes the last one above the fold.
    // Deps include wide/compact because both change the id set and the offsets.
    const ids = [...orderKey.split(",").map(areaId), "all-listen", "all-reading", ...(wide ? [] : ["all-voices"])];
    // Must sit BELOW where a jump lands (jumpOffset) or the pill you just tapped never lights.
    const threshold = jumpOffset + 16;
    let raf = 0;
    const check = () => {
      setStuck(window.scrollY > 120);
      let cur = "";
      for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= threshold) cur = id; }
      setActiveSec(cur);
    };
    check();
    // `stuck` drives the bar's opaque backing, so it is set SYNCHRONOUSLY — deferring it to rAF
    // meant that whenever rAF was throttled (background tab, low-power mode) the bar kept a
    // transparent background while page text scrolled visibly through it. Only the spy, which
    // measures every section, is worth deferring.
    // Throttled on a TIMER, not rAF. The Areas row's selection is now a real claim — "All" until
    // you are actually inside an area's group — so a spy that never runs would pin it to All
    // forever. rAF is suspended outright in the embedded webviews this app is read in (the same
    // place IntersectionObserver is dead), while timers keep firing; the comment below on `stuck`
    // records the earlier half of exactly this lesson.
    let queued = false;
    const onScroll = () => {
      setStuck(window.scrollY > 120);
      if (queued) return;
      queued = true;
      raf = window.setTimeout(() => { queued = false; check(); }, 100) as unknown as number;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) clearTimeout(raf); };
  }, [orderKey, wide, compact, jumpOffset]);
  // rAF glide (ported from ReaderView.goSec): the FacePile avatars above a jump target lazy-load
  // and shift layout mid-flight, so the target is re-measured every frame; wheel/touch cancels.
  const scrollToEl = (el: HTMLElement) => {
    const targetNow = () => el.getBoundingClientRect().top + window.scrollY - jumpOffset;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, targetNow()); return; }
    const start = window.scrollY;
    const t0 = performance.now();
    const D = 520;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf = 0;
    let started = false;
    // rAF is SUSPENDED outright in embedded webviews (the same environments where the repo
    // already found IntersectionObserver dead — re-confirmed 2026-08-24). There the glide would
    // never run a single frame and the reader would simply stay where they were, which for a
    // Since-your-last-read row reads as a dead click. Timers still fire in those webviews, so
    // this guard jumps straight to the target if no frame has landed shortly after the request.
    const guard = setTimeout(() => { if (!started) { cancel(); window.scrollTo(0, targetNow()); } }, 120);
    const cancel = () => { clearTimeout(guard); cancelAnimationFrame(raf); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); };
    const step = (now: number) => {
      started = true;
      clearTimeout(guard);
      const t = Math.min(1, (now - t0) / D);
      window.scrollTo(0, start + (targetNow() - start) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else cancel();
    };
    raf = requestAnimationFrame(step);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
  };
  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) scrollToEl(el);
  };
  const goArea = (a: string) => goTo(areaId(a));

  // ---- band/rail rows POINT, never contain --------------------------------------------------
  // A pointer row scrolls to the story's one canonical card (the deck copy when it was promoted,
  // else its specialty-rail card), auto-opens the evidence drawer, and marks it seen. The target
  // may only enter the DOM after a state change (area expansion, drawer open), so we poll a few
  // frames; a story that truly isn't on the page falls through to its /r/ permalink — a pointer
  // row must never be a dead click.
  const cssEscape = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"));
  // Polls with setTimeout, not rAF: the permalink fallback is the whole point of this function,
  // and in a webview with rAF suspended an rAF-driven retry would never fire — so the row would
  // neither scroll NOR fall through to /r/, which is exactly the dead click this must prevent.
  const scrollToSid = (card: HeroCard) => {
    let tries = 0;
    const attempt = () => {
      const el = document.querySelector<HTMLElement>(`[data-sid="${cssEscape(card.id)}"]`);
      if (el) { scrollToEl(el); return; }
      if (++tries < 40) setTimeout(attempt, 16);
      else window.location.assign(`/r/${heroSlugFor(card.kind, card.headline, card.id)}`);
    };
    setTimeout(attempt, 0);
  };
  const pointTo = (card: HeroCard, area: string, surface: string) => {
    logSignal("section_jump", area, card.id, { surface });
    if (deck.some((d) => d.card.id === card.id)) {
      setOpenId(`deck:${card.id}`); // the deck copy is the first canonical card in document order
    } else {
      const per = heroPerArea.find((p) => p.area === area);
      const idx = per?.entries.findIndex((e) => e.card.id === card.id) ?? -1;
      if (idx < 0) { window.location.assign(`/r/${heroSlugFor(card.kind, card.headline, card.id)}`); return; }
      if (idx >= (compact ? 2 : 3)) setExpandedAreas((cur) => ({ ...cur, [area]: true }));
      setHeroOpen(card.id);
    }
    markSeen(card.id, "point");
    scrollToSid(card);
  };

  // ---- cross-area reading list: use bibliographic identity before title fallback ----
  const paperIdentity = (paper: BriefingArticle): string => {
    if (paper.doi) return `doi:${paper.doi.toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")}`;
    if (paper.pmid) return `pmid:${paper.pmid}`;
    try {
      const url = new URL(paper.url);
      url.hash = "";
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) => url.searchParams.delete(key));
      return `url:${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`;
    } catch {
      return `title:${norm(paper.title)}`;
    }
  };
  const best = new Map<string, { p: BriefingArticle; area: string }>();
  for (const a of AREAS) {
    for (const p of briefsByArea[a]?.topArticles ?? []) {
      const k = paperIdentity(p); if (!k) continue;
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
  // `stats` switches the row to the tumor pages' Recent-guests anatomy: serif name, identity
  // chips, a "▸ Listen · N episodes" line, and the two box-score tiles pinned right. Without it
  // the row keeps the compact form "Carried on X" shares with the specialty kols rail.
  const voiceRow = (opts: { id: string; name: string; avatar?: string | null; areas: string[]; areasLabel?: string | null; roleChip?: string | null; sub: string | null; facts?: string | null; count: string; countOpen?: string; stats?: { value: number; label: string }[]; children: React.ReactNode | null }) => {
    const acc = accentOf(opts.areas[0] ?? "GU");
    const open = openId === opts.id;
    const canOpen = opts.children !== null;
    return (
      <Row key={opts.id} open={open} onToggle={() => { if (canOpen) toggle(opts.id); }} accent={acc} landOffset={compact ? 108 : 70} disabled={!canOpen}
        head={
          <div style={{ display: "flex", alignItems: opts.stats ? "center" : "flex-start", gap: opts.stats ? 12 : 11, padding: opts.stats ? "16px 2px" : "13px 2px" }}>
            {!opts.stats && <Coin src={opts.avatar} label={opts.name} size={34} ring={PAPER} style={{ marginTop: 2 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, font: `500 ${opts.stats ? "17px" : "15px"}/1.25 'Newsreader',Georgia,serif`, color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opts.name}</span>
                {!opts.stats && <span data-disclosure style={{ display: "inline-flex", alignItems: "center", minHeight: 44, flex: "none", margin: "-10px 0 -10px", font: "600 11.5px system-ui", color: open ? acc : INK_2, padding: "0 2px", whiteSpace: "nowrap" }}>{open ? (opts.countOpen ?? "Hide ↑") : opts.count}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                {/* Box-score rows carry NO chips at all — matching the tumor pages, and carrying no
                    "NPI on file" badge either (see ReaderView: the registry flag is provenance for
                    us, not a label to pin on a named physician). The area and the show ride the
                    muted identity line as text, since a cross-specialty page still has to say
                    WHERE someone was heard. Chip clusters and face coins belong to the other form. */}
                {!opts.stats && <>
                  {opts.areasLabel && <span style={{ font: "500 10px system-ui", color: MUT2 }}>{opts.areasLabel}</span>}
                  {opts.areas.map(miniTag)}
                  {opts.roleChip && <span style={{ font: "700 7.5px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: MUT, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: "1.5px 5px", flex: "none" }}>{opts.roleChip}</span>}
                </>}
                {(opts.sub || opts.facts) && (
                  <span style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0, flex: "1 1 auto", font: "400 11.5px system-ui", color: MUT }}>
                    {opts.sub && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{opts.sub}</span>}
                    {opts.sub && opts.facts && <span aria-hidden style={{ flex: "none" }}>·</span>}
                    {opts.facts && <span style={{ flex: "none", whiteSpace: "nowrap" }}>{opts.facts}</span>}
                  </span>
                )}
              </div>
              {opts.stats && <div data-disclosure style={{ font: "600 11.5px system-ui", color: acc, marginTop: 7 }}>{open ? (opts.countOpen ?? "Hide ↑") : opts.count}</div>}
            </div>
            {opts.stats && (
              <div style={{ flex: "none", display: "flex", gap: 8, textAlign: "center" }}>
                {opts.stats.map((t, i) => (
                  <div key={t.label} style={{ ...statTile }}>
                    <div style={{ font: "600 21px 'Newsreader',Georgia,serif", color: i === 0 ? acc : INK }}>{t.value}</div>
                    <div style={statTileLabel}>{t.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        }>
        {opts.children}
      </Row>
    );
  };

  // The window the "N-day" tile quotes. Every area rebuilds on one cadence, so these agree in
  // practice; take the max so the label can never claim a SHORTER window than some area actually
  // used. Falls back to the specialty default when no brief has landed yet.
  const railWindowDays = Math.max(14, ...AREAS.map((a) => briefsByArea[a]?.windowDays ?? 0));

  const MICS_CAP = 6, X_CAP = 6, MORE_CAP = 14; // expanded view still caps — a rail, not a directory
  const micsShown = micsMore ? micsRanked.slice(0, MORE_CAP) : micsRanked.slice(0, MICS_CAP);
  const xShown = xMore ? xRanked.slice(0, MORE_CAP) : xRanked.slice(0, X_CAP);
  const moreBtn = (total: number, cap: number, on: boolean, flip: () => void) => total > cap && (
    <button type="button" onClick={flip} style={{ background: "none", border: 0, cursor: "pointer", font: "600 11.5px system-ui", color: MUT2, padding: "8px 2px 0", textAlign: "left" }}>{on ? "Show fewer ↑" : `Show ${Math.min(total, MORE_CAP) - cap} more ↓`}</button>
  );

  // The rail uses the SPECIALTY editions' section furniture, not its own. It previously stacked
  // three headers of its own invention — a "Voices of the week" h2, a descriptive line, then a
  // serif module title — where a tumor page shows one SectionHead rule and goes straight to rows
  // (John, 2026-08-25: "a totally different header and layout as the specialty pages").
  const voicesModules = (
    <div>
      {micsRanked.length > 0 && <>
        <SectionHead accent={ALL_ACCENT} rail={wide} left>On the mics</SectionHead>
        <div style={{ font: "400 11px system-ui", color: MUT2, margin: "-4px 0 2px" }}>by podcast appearances</div>
      </>}
      {micsShown.map((m) => {
        const eps = micEpisodes(m);
        // The chip shows the REAL episode count — the host-credit cap is a RANKING rule only
        // (stated in the footnote), never a displayed number (2026-07-24 adversarial review:
        // the capped micValue rendered "1 episode" above a drawer holding three).
        const n = eps.length;
        // a host's SHOW is the identifying fact (Florez → Lung Cancer Considered); a guest's is
        // where they practice. Hosts who also guested keep both, show first.
        // The identity line carries what the tumor pages put beside a guest — affiliation, or the
        // SHOW when they host it — prefixed with the areas they were heard in, which a
        // cross-specialty rail has to state and a single-area one never does.
        const sub = [m.areas.join(" · "), m.hostShow || null, shortInst(m.aff)].filter(Boolean).join(" · ");
        return voiceRow({
          id: "vm:" + m.key,
          name: m.name,
          areas: m.areas,
          sub,
          count: `▸ Listen · ${n} episode${n === 1 ? "" : "s"}`,
          stats: [{ value: n, label: `${railWindowDays}-day` }, { value: m.career, label: "Career" }],
          children: eps.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {eps.map((e, j) => (
                <div key={j} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "11px 13px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: e.audioUrl ? 9 : 0 }}>
                    <Coin src={e.showArt} label={e.show ?? "P"} size={30} radius={8} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "600 12px system-ui", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                      {e.show && <div style={{ font: "400 11px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{e.show}</div>}
                    </div>
                  </div>
                  {e.audioUrl && <AudioQuote audioUrl={e.audioUrl} startMs={0} durationSeconds={e.durationSeconds} label="Listen to the episode" eventId={e.episodeId ?? null} eventLabel={e.title} accent={accentOf(m.areas[0] ?? "GU")} />}
                </div>
              ))}
            </div>
          ) : null,
        });
      })}
      {moreBtn(micsRanked.length, MICS_CAP, micsMore, () => setMicsMore((v) => !v))}

      {/* ── Carried on X ── */}
      {xRanked.length > 0 && <>
        <SectionHead accent={ALL_ACCENT} rail={wide} left>Carried on X</SectionHead>
        <div style={{ font: "400 11px system-ui", color: MUT2, margin: "-4px 0 2px" }}>by reposts + quotes earned</div>
      </>}
      {xShown.map((v) => {
        const acc = accentOf(v.areas[0] ?? "GU");
        const onMics = micKeys.has(norm(v.name));
        const visibleActivity = [
          v.posts.length ? `${v.posts.length} post${v.posts.length === 1 ? "" : "s"}` : null,
          v.articles.length ? `${v.articles.length} paper${v.articles.length === 1 ? "" : "s"}` : null,
        ].filter(Boolean).join(" · ");
        const facts = v.amp ? `${v.amp.toLocaleString()} repost${v.amp === 1 ? "" : "s"}/quote${v.amp === 1 ? "" : "s"} earned` : "Recent activity";
        return voiceRow({
          id: "vx:" + v.key,
          name: v.name,
          avatar: v.avatar,
          areas: v.areas,
          areasLabel: "Recent activity",
          roleChip: onMics ? "🎙 on mics" : null,
          sub: shortInst(v.institution),
          facts,
          count: `${visibleActivity || "View activity"} ↓`,
          children: (v.posts.length || v.articles.length) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {v.posts.length > 0 && <div><div style={evLabel(acc)}>Their recent posts</div>{v.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              {v.articles.length > 0 && <div><div style={evLabel(acc)}>Papers shared</div>{v.articles.map((a2, j) => <PaperCard key={j} title={a2.title} journal={a2.journal} domain={a2.domain} peerReviewed={a2.peerReviewed} url={a2.url} abstract={a2.abstract} description={a2.description} accent={acc} />)}</div>}
            </div>
          ) : null,
        });
      })}
      {moreBtn(xRanked.length, X_CAP, xMore, () => setXMore((v) => !v))}

      <div style={{ font: "400 10.5px/1.6 system-ui", color: MUT2, marginTop: 16, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
        Episode counts come from each specialty&rsquo;s current rolling brief (host, guest, or show · syndication deduped · interview-network hosts excluded). Ranked by guest appearances; ties by lifetime appearances. Amplified = reposts + quote-posts earned on their own posts in the same rolling source window. Every number shown is a plain count.
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
      const firstPost = pickConversationPreview(story.posts, paper?.posts, paper?.sharers);
      const context = paper?.abstract?.replace(/\s+/g, " ").trim() || paper?.description?.replace(/\s+/g, " ").trim() || null;
      return {
        faces: resolved.faces,
        context,
        contextLabel: paper?.abstract ? "Abstract" : "Source context",
        preview: firstPost ? <TweetCard t={firstPost} compact /> : null,
        drawer: <StoryEvidence story={{ ...story, publisherPosts: resolved.publisherPosts, otherPosts: resolved.otherPosts, supportLinks: resolved.supportLinks }} accent={accent} paperLabel="The paper" />,
      };
    }
    if (resolved.kind === "article") {
      const paper = resolved.paper as unknown as BriefingPaper;
      const firstPost = pickConversationPreview(resolved.posts, paper.posts, paper.sharers);
      const context = paper.abstract?.replace(/\s+/g, " ").trim() || paper.description?.replace(/\s+/g, " ").trim() || null;
      return {
        faces: resolved.faces,
        context,
        contextLabel: paper.abstract ? "Abstract" : "Source context",
        preview: firstPost ? <TweetCard t={firstPost} compact /> : null,
        drawer: <StoryEvidence story={{ podcast: [], posts: resolved.posts, papers: [paper], kind: "paper", publisherPosts: resolved.publisherPosts, otherPosts: resolved.otherPosts, supportLinks: resolved.supportLinks }} accent={accent} paperLabel="The paper" />,
      };
    }
    if (resolved.kind === "episode") return { faces: resolved.faces, playback: resolved.playback, drawer: (
      <>
        <StoryEvidence story={{ podcast: resolved.pods, posts: [], papers: [], kind: "episode" }} accent={accent} paperLabel="Papers" />
        {((card.announcements ?? []).length > 0 || (card.amplifiers ?? []).length > 0) && <EpisodeXReceipts announcements={card.announcements ?? []} amplifiers={card.amplifiers ?? []} accent={accent} />}
      </>
    ) };
    if (resolved.kind === "event") return { faces: resolved.faces, drawer: <StoryEvidence story={{ podcast: [], posts: resolved.posts, papers: [], kind: "event", publisherPosts: resolved.publisherPosts, otherPosts: resolved.otherPosts, supportLinks: resolved.supportLinks }} accent={accent} paperLabel="Papers" /> };
    return { faces: resolved.faces, drawer: <StoryEvidence story={{ podcast: [], posts: [resolved.post], papers: [], kind: "thread" }} accent={accent} paperLabel="Papers" /> };
  };

  // One story row — the lead gets the front-page step-up, while every headline shares
  // one clean left edge with the kicker, teaser, and facts line.
  const renderStory = (s: BriefingStory, i: number, a: string, acc: string) => {
    const lead = i === 0;
    const id = `all:${a}:${i}`;
    const open = openId === id;
    const faces = pileFacesL(s);
    // Seen-state keys on the story's DURABLE id (drugId / paper key), never the per-build index id,
    // and reads the FROZEN set so a row never fades while it is being read.
    const isSeen = seenAtLoad.has(s.id);
    const headlineFont = lead ? (compact ? "500 20px/1.18" : "500 21px/1.18") : (compact ? "500 17.5px/1.3" : "500 18.5px/1.25");
    return (
      <div key={id} className="readout-story-card" data-sid={s.id} data-ssurface="all_rail" style={{ background: "transparent", border: 0, borderBottom: `1px solid ${LINE}`, ...(lead ? { borderLeft: `3px solid ${acc}` } : {}), borderRadius: 0, padding: "0 2px", marginBottom: 0, opacity: isSeen && !open ? DIM : 1, transition: "opacity .35s ease" }}>
        <Row open={open} onToggle={() => { if (!open) markSeen(s.id, "expand"); toggle(id); }} accent={acc} landOffset={compact ? 108 : 70}
          head={
            <div style={{ display: "flex", alignItems: "flex-start", padding: lead ? "18px 2px" : "15px 2px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  {!isSeen && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: acc, flex: "none" }} />}
                  <span style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: acc }}>{storyKicker(s)}</span>
                </div>
                <h3 style={{ font: `${headlineFont} 'Newsreader',Georgia,serif`, color: INK, letterSpacing: 0, margin: 0 }}>{s.headline}</h3>
                {s.subtitle && <div style={{ font: "500 11.5px system-ui", color: MUT, marginTop: 6 }}>{s.subtitle}</div>}
                {s.description && <p style={{ margin: "9px 0 0", font: "400 13.5px/1.5 system-ui", color: MUT, ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{s.description}</p>}
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

  // ---- FRONT-DOOR SECTIONS (Since your last read · ranked deck · approvals · caught-up) -----
  const relativeDay = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(now) - startOf(d)) / 86400_000);
    return diff <= 0 ? "earlier today" : diff === 1 ? "yesterday" : d.toLocaleDateString("en-US", { weekday: "long" });
  };
  const fmtLastVisit = (iso: string) => {
    const day = relativeDay(iso);
    const time = new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${time}`;
  };
  // Editions rebuild twice daily at 03:15 / 15:15 UTC — quote the next one in local time.
  const nextEditionLabel = () => {
    const now = Date.now();
    const at = (dayOffset: number, hourUtc: number) => {
      const d = new Date();
      d.setUTCHours(hourUtc, 15, 0, 0);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      return d.getTime();
    };
    const next = Math.min(...[at(0, 3), at(0, 15), at(1, 3), at(1, 15)].filter((t) => t > now));
    return new Date(next).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  // Date-only strings anchor at noon so the label never slips a calendar day in western zones.
  const fmtDay = (iso: string) => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  };
  const deckRange = (() => {
    if (!newestStamp) return null;
    const days = Math.max(0, ...heroPerArea.filter((p) => p.entries.length).map((p) => p.brief?.windowDays ?? 0));
    if (!days) return null;
    const end = new Date(newestStamp);
    const start = new Date(end.getTime() - (days - 1) * 86400_000);
    const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    return sameMonth ? `${f(start)}–${end.getDate()}` : `${f(start)} – ${f(end)}`;
  })();

  // Routine new episodes never become band rows — one collapsed line points at Listen instead.
  const sinceEpisodes = memory.lastVisit && bandRows.length
    ? allEpisodes.filter((e) => e.episode.publishedAt && new Date(e.episode.publishedAt).getTime() > new Date(memory.lastVisit!).getTime())
    : [];
  const sinceShowCount = new Set(sinceEpisodes.map((e) => e.episode.show ?? e.episode.title)).size;

  const bandJsx = bandRows.length > 0 && (
    <section aria-label="Since your last read" style={{ margin: "26px 0 0", padding: compact ? "16px 16px 4px" : "18px 22px 8px", background: "#fff", border: "1px solid #d8d7d1", borderRadius: 10, boxShadow: "0 8px 22px rgba(31,35,42,.06)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: ALL_ACCENT }}>Since your last read</span>
        <span style={{ font: "400 11.5px system-ui", color: MUT2 }}>{memory.lastVisit ? fmtLastVisit(memory.lastVisit) : ""} · {bandRows.length} development{bandRows.length === 1 ? "" : "s"}</span>
      </div>
      {bandRows.map((row, i) => {
        const acc = accentOf(row.area);
        const kicker = row.status === "updated" && row.reason ? row.reason : (KIND_KICKER[row.card.kind] ?? row.card.kind);
        const activate = () => pointTo(row.card, row.area, "since_band");
        return (
          <div key={row.card.id} role="button" tabIndex={0} onClick={activate}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
            style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: i < bandRows.length - 1 || sinceEpisodes.length > 0 ? "1px solid #eceae5" : "none", cursor: "pointer" }}>
            {row.status === "new"
              ? <span style={{ flex: "none", marginTop: 2, font: "700 9px system-ui", letterSpacing: ".08em", color: "#fff", background: ALL_ACCENT, borderRadius: 5, padding: "3px 7px" }}>NEW</span>
              : <span style={{ flex: "none", marginTop: 2, font: "700 9px system-ui", letterSpacing: ".08em", color: ALL_ACCENT, background: "#fff", border: `1px solid ${ALL_ACCENT}`, borderRadius: 5, padding: "2px 6px" }}>UPDATED</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: acc, marginBottom: 5 }}>{kicker} · {row.area}</div>
              {row.card.sourceLabel && <div style={{ font: "500 12px system-ui", color: MUT, margin: "0 0 3px" }}>{row.card.sourceLabel}</div>}
              <h3 style={{ font: "500 16.5px/1.28 'Newsreader',Georgia,serif", color: INK, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{row.card.headline}</h3>
            </div>
          </div>
        );
      })}
      {sinceEpisodes.length > 0 && (
        <button type="button" onClick={() => { logSignal("section_jump", "All", null, { surface: "since_band_episodes" }); goTo("all-listen"); }}
          style={{ width: "100%", textAlign: "left", background: "none", border: 0, padding: "10px 0 12px", cursor: "pointer", font: "400 12.5px system-ui", color: MUT2, minHeight: 44 }}>
          Also since {memory.lastVisit ? relativeDay(memory.lastVisit) : "your last read"}: {sinceEpisodes.length} new episode{sinceEpisodes.length === 1 ? "" : "s"} across {sinceShowCount} show{sinceShowCount === 1 ? "" : "s"} →
        </button>
      )}
    </section>
  );

  const deckReceipts = (entry: (typeof deck)[number]): string => {
    const { card, metrics } = entry;
    const bits: string[] = [];
    if (card.kind === "episode") {
      bits.push(`Listen @ ${clipTs(card.startMs ?? 0)}`);
      if (metrics.clinicians) bits.push(`${metrics.clinicians} clinician${metrics.clinicians === 1 ? "" : "s"} carried it`);
    } else {
      if (metrics.clinicians) bits.push(`${metrics.clinicians} clinician${metrics.clinicians === 1 ? "" : "s"}${metrics.spanDays ? ` over ${metrics.spanDays} days` : ""}`);
      if (metrics.podcasts) bits.push(`${metrics.podcasts} podcast${metrics.podcasts === 1 ? "" : "s"}`);
    }
    return bits.join(" · ");
  };

  const deckJsx = deck.length > 0 && (
    <section id="all-most-discussed" aria-label="Most discussed across oncology" style={{ marginTop: 34, scrollMarginTop: 100 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 0 2px", flexWrap: "wrap" }}>
        <h2 style={{ font: "700 12px system-ui", letterSpacing: ".1em", textTransform: "uppercase", color: INK, margin: 0 }}>Most discussed across oncology</h2>
        <span style={{ font: "400 11.5px system-ui", color: MUT2 }}>{deckRange ? `${deckRange} · ` : ""}ranked by independent clinician attention</span>
      </div>
      {deck.map((entry, i) => {
        const { card: c, area, metrics } = entry;
        const acc = accentOf(area);
        const lead = i === 0;
        const rowId = `deck:${c.id}`;
        const open = openId === rowId;
        const brief = briefsByArea[area];
        const ev = brief ? heroEvidenceFor(c, brief, acc) : null;
        const isSeen = seenAtLoad.has(c.id); // frozen at load — never fades mid-read
        const receipts = deckReceipts(entry);
        const drawerId = `all-deck-ev-${c.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        // The deck keeps its OWN anatomy (rank numeral, KIND · AREA kicker, lead step-up) but
        // opens evidence exactly the way the hero cards in the rails below do: the same control
        // wording, the same inline drawer, the same collapse. It deliberately does NOT use the
        // Row accordion any more — that gave this page two different evidence experiences
        // depending on which section a story happened to sit in.
        const openEvidence = () => { if (!open) markSeen(c.id, "expand"); toggle(rowId); };
        const discloseBtn = ev && (
          <button type="button" onClick={openEvidence} aria-expanded={open} aria-controls={drawerId}
            aria-label={`${open ? "Hide" : "Show"} conversation and evidence for ${c.headline}`}
            data-brief-event="source_open" data-brief-open={open} data-brief-story={c.id} data-brief-target={`deck_${c.kind}`} data-brief-label={c.headline}
            style={{ background: "none", border: 0, padding: "12px 4px", cursor: "pointer", font: "600 12.5px system-ui", color: acc, minHeight: 44 }}>
            {/* `false`, not this page's `compact`: the rails below mount HeroCards at the default
                variant="full", so their label never takes the compact branch even on a phone.
                Passing the viewport flag here made the deck read "Evidence ↓" while the rails read
                "Conversation & evidence ↓" on mobile — the same split this change exists to close. */}
            {heroEvidenceLabel(open, false, ev.faces.length > 0)}
          </button>
        );
        return (
          // Border set in LONGHAND: the deck reorders as late areas land, so a card can move out
          // of the lead slot on a rerender — mixing the `border` shorthand with a conditional
          // borderLeft makes React drop the whole shorthand when it diffs that change.
          <div key={c.id} className="readout-story-card" data-sid={c.id} data-ssurface="all_deck" style={{ background: "transparent", borderStyle: "solid", borderColor: `${LINE}`, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 1, borderLeftWidth: lead ? 3 : 0, borderLeftColor: acc, borderRadius: 0, padding: 0, marginBottom: 0,
            // `&& !open`: the drawer renders INSIDE this box, so a dimmed card would hand back
            // faded evidence — abstracts, posts and receipts — to someone who just asked to read
            // it. Opening a story always restores full ink.
            opacity: isSeen && !open ? DIM : 1 }}>
            <div style={{ display: "flex", gap: compact ? 12 : 16, padding: lead ? "18px 2px 18px 14px" : "15px 2px 15px 17px" }}>
              {/* longhand, not the `font` shorthand — it sits beside fontVariantNumeric, and
                  React warns (and drops one) when both describe the same element */}
              <span aria-hidden style={{ flex: "none", fontWeight: 500, fontSize: lead ? 26 : 22, lineHeight: 1, fontFamily: "'Newsreader',Georgia,serif", fontVariantNumeric: "tabular-nums", color: MUT2, marginTop: 2 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  {!isSeen && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: acc, flex: "none" }} />}
                  <span style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: acc }}>{KIND_KICKER[c.kind] ?? c.kind} · {area}</span>
                </div>
                {c.sourceLabel && <div style={{ font: `500 ${lead ? 13.5 : 12.5}px system-ui`, color: MUT, margin: "0 0 5px" }}>{c.sourceLabel}</div>}
                <h3 style={{ font: `500 ${lead ? "21px/1.18" : "18.5px/1.25"} 'Newsreader',Georgia,serif`, color: INK, margin: 0, maxWidth: 760 }}>{c.headline}</h3>
                {lead && c.excerpt && (
                  <p style={{ margin: "9px 0 0", font: "400 13.5px/1.5 system-ui", color: MUT, maxWidth: 740, ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
                    {c.excerptVerbatim ? <>&ldquo;{c.excerpt}&rdquo;</> : c.excerpt}
                  </p>
                )}
                <div style={{ marginTop: lead ? 12 : 11, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {ev && ev.faces.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {ev.faces.slice(0, 3).map((f, j) => (
                        <div key={j} style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: `2px solid ${PAPER}`, background: `${acc}24`, marginLeft: j ? -7 : 0 }}>
                          <img src={f} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {receipts && <span style={{ font: "400 12px system-ui", color: MUT }}>{receipts}</span>}
                  {c.kind !== "episode" && discloseBtn}
                </div>
                {/* episodes get the seeking player inline above the control, same as a hero card */}
                {c.kind === "episode" && ev?.playback?.audioUrl && (
                  <div style={{ marginTop: 10, width: "100%" }}>
                    <AudioQuote audioUrl={ev.playback.audioUrl} startMs={ev.playback.startMs ?? 0} durationSeconds={ev.playback.durationSeconds ?? c.durationSeconds} label="Listen to the clip" eventId={c.id} eventLabel={c.headline} accent={acc} />
                  </div>
                )}
                {c.kind === "episode" && discloseBtn}
                {/* No .rv-drawer fade here: the hero cards in the rails open their drawer with no
                    animation, so adding one would be a fresh difference between the two expanders.
                    It is also a real hazard — that class starts at opacity 0 and animates up, so
                    anywhere CSS animations don't run (the same embedded webviews where rAF and
                    IntersectionObserver are suspended) the evidence would render invisible. */}
                {ev && open && <div id={drawerId} style={{ marginTop: 12 }}>{ev.drawer}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );

  const approvalsJsx = approvals.length > 0 && (
    <section aria-label="Recent approvals and readouts" style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 0 12px" }}>
        {/* "this week" was a false claim: event cards stay hero-eligible for a rolling
            EVENT_HERO_WINDOW_DAYS (14) after the regulator acts, so an Aug-13 approval sits here
            on Aug 24. "Recent" is the honest scope, and every row now carries its own exact
            action date — so the range is legible from the rows without duplicating a server
            constant here (which would silently drift the day someone tunes the window). */}
        <h2 style={{ font: "700 12px system-ui", letterSpacing: ".1em", textTransform: "uppercase", color: INK, margin: 0 }}>Recent approvals &amp; readouts</h2>
        <span style={{ font: "400 11.5px system-ui", color: MUT2 }}>all specialties</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {approvals.map(({ card, area, date }) => {
          const acc = accentOf(area);
          const day = date ? fmtDay(date) : null;
          const activate = () => pointTo(card, area, "approvals_rail");
          return (
            <div key={card.id} role="button" tabIndex={0} onClick={activate}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
              style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #d8d7d1", borderRadius: 8, padding: "11px 14px", cursor: "pointer" }}>
              <span style={{ flex: "none", font: "700 10px system-ui", letterSpacing: ".06em", color: "#fff", background: acc, borderRadius: 6, padding: "4px 8px" }}>{approvalChipLabel(card)}</span>
              <span style={{ flex: 1, minWidth: 0, font: "500 13.5px system-ui", color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.headline}</span>
              {day && <span style={{ flex: "none", fontWeight: 400, fontSize: 12, fontFamily: "system-ui", fontVariantNumeric: "tabular-nums", color: MUT2 }}>{day}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );

  // "You're caught up" appears only once every ranked-deck item is actually seen; the count is
  // the distinct developments (deck + approvals) the reader reviewed, never a padded number.
  const deckAllSeen = deck.length > 0 && deck.every((d) => seenIds.has(d.card.id));
  const reviewedCount = new Set([...deck.map((d) => d.card.id), ...approvals.map((a) => a.card.id)].filter((id) => seenIds.has(id))).size;
  const caughtUpJsx = deckAllSeen && (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 16, margin: "38px 0 4px" }}>
      <span aria-hidden style={{ flex: 1, height: 1, background: LINE }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, font: "600 13px system-ui", color: INK_2 }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden><circle cx="8" cy="8" r="7" stroke={ALL_ACCENT} strokeWidth="1.5" /><path d="M5 8.2L7.1 10.3L11 6.2" stroke={ALL_ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        You&rsquo;re caught up — {reviewedCount} development{reviewedCount === 1 ? "" : "s"} reviewed · next edition {nextEditionLabel()}
      </span>
      <span aria-hidden style={{ flex: 1, height: 1, background: LINE }} />
    </div>
  );

  const browseHeaderJsx = (deck.length > 0 || approvals.length > 0) && (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "34px 0 -14px" }}>
      <h2 style={{ font: "700 12px system-ui", letterSpacing: ".1em", textTransform: "uppercase", color: MUT2, margin: 0 }}>Browse by specialty</h2>
    </div>
  );

  const editionMenu = (
    <div style={{ position: "relative", flex: "none" }}>
      <button ref={menuTriggerRef} type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Switch tumor area"
        onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}
        className="rv-edition"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 0", cursor: "pointer", background: "transparent", border: 0, borderRadius: 0 }}>
        <span style={{ font: "700 13px system-ui", color: ALL_ACCENT, whiteSpace: "nowrap" }}>All oncology</span>
        <span aria-hidden style={{ width: 10, height: 10, borderRight: `2px solid ${ALL_ACCENT}`, borderBottom: `2px solid ${ALL_ACCENT}`, transform: menuOpen ? "translateY(3px) rotate(225deg)" : "translateY(-2px) rotate(45deg)", transition: "transform .18s ease", flex: "none", boxSizing: "border-box" }} />
      </button>
      {menuOpen && (
        <>
          <div onClick={() => closeMenu()} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
            <div ref={menuRef} role="menu" aria-label="Tumor area" onKeyDown={handleMenuKeyDown}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeMenu(false); }}
            style={{ position: "absolute", top: "calc(100% + 7px)", right: compact ? 0 : undefined, left: compact ? undefined : 0, width: 210, background: "rgba(255,255,255,.98)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${LINE}`, borderRadius: 6, boxShadow: "0 16px 36px rgba(31,35,42,.14)", padding: 8, zIndex: 31 }}>
            <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: MUT2, padding: "6px 11px 8px" }}>Tumor area</div>
            {areas.map((a) => {
              const on = a === "All";
              const label = a === "All" ? "All oncology" : (AREA_FULL[a] ?? a);
              const isHome = a === primary;
              return (
                <button key={a} type="button" role="menuitem" tabIndex={on ? 0 : -1} aria-current={on} onClick={() => { closeMenu(); if (!on) onArea(a); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: on ? SURFACE : "transparent", border: 0 }}>
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
                <button type="button" role="menuitem" tabIndex={-1} onClick={() => { onSetPrimary("All"); closeMenu(); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: "transparent", border: 0, color: ALL_ACCENT, font: "600 12.5px system-ui" }}>
                  <span aria-hidden style={{ font: "700 13px system-ui" }}>⌂</span>Make All oncology my default
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Section jump pills — same jump-link pattern as the specialty editions (Stories/Listen/Papers,
  // plus Voices only when it isn't already pinned to the always-visible wide rail).
  const tabStyle = (on: boolean, activeColor: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 44, cursor: "pointer", font: `${on ? "700" : "600"} 12.5px system-ui`, padding: "8px 2px 10px", borderRadius: 0, border: 0, borderBottom: `2px solid ${on ? activeColor : "transparent"}`, background: "transparent", color: on ? INK : MUT, whiteSpace: "nowrap", flex: "none", transition: "border-color .15s, color .15s" });
  const inSection = activeSec === "all-listen" || activeSec === "all-reading" || activeSec === "all-voices";
  const navPills = [
    <button key="top" onClick={() => goArea(orderedAreas[0])} style={tabStyle(!inSection, ALL_ACCENT)}>Stories</button>,
    allEpisodes.length > 0 && <button key="listen" onClick={() => goTo("all-listen")} style={tabStyle(activeSec === "all-listen", ALL_ACCENT)}>Listen</button>,
    reading.length > 0 && <button key="papers" onClick={() => goTo("all-reading")} style={tabStyle(activeSec === "all-reading", ALL_ACCENT)}>Papers</button>,
    // Voices rides the rail on wide (always visible → no jump pill needed there); on narrow it's an
    // inline section that earns one, same rule as the tumor pages' rail sections.
    !wide && micsRanked.length + xRanked.length > 0 && <button key="voices" onClick={() => goTo("all-voices")} style={tabStyle(activeSec === "all-voices", ALL_ACCENT)}>People</button>,
  ].filter(Boolean);

  // Area scope row — the All page's equivalent of the specialty editions' Focus row: same position
  // (shares the masthead line on wide, its own row on medium, below the sticky pills on mobile) and
  // the same non-sticky treatment; styled with each area's own accent dot.
  // Whether the reader has actually scrolled into one area's group. Until they have, "All" holds.
  const inArea = orderedAreas.some((a) => activeSec === areaId(a));
  const goTop = () => {
    logSignal("section_jump", "All", null, { surface: "areas_all" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, 0); return; }
    // native smooth scroll, not the rAF glide — this one has no element to re-measure, and rAF is
    // suspended outright in the embedded webviews this app is read in.
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const areasRow = (mobile: boolean) => (
    <div className={`all-pills${mobile ? " all-fade" : ""}`} style={{ display: "flex", alignItems: "center", gap: mobile ? 18 : 20, flexWrap: mobile ? "nowrap" : "wrap", overflowX: mobile ? "auto" : "visible", margin: mobile ? "10px -20px 0" : 0, padding: mobile ? "0 20px" : 0, minWidth: 0 }}>
      <span style={{ font: "600 9.5px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: MUT2, flex: "none" }}>Areas</span>
      <button key="all" onClick={goTop} style={tabStyle(!inArea, ALL_ACCENT)}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: ALL_ACCENT, flex: "none" }} />All
      </button>
      {orderedAreas.map((a) => {
        const on = activeSec === areaId(a);
        return (
          <button key={a} onClick={() => goArea(a)} style={tabStyle(on, accentOf(a))}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: accentOf(a), flex: "none" }} />{a}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="reader-editorial"
      // One delegated capture doing two jobs, mirroring ReaderView.captureInteraction:
      //  1. SEEN — any real interaction (link, button, disclosure) inside a story card marks that
      //     story seen. Idle clicks on whitespace never count, nor does anything outside a card.
      //  2. SIGNALS — the declarative data-brief-event controls (source_open, story_share,
      //     show_more…) reach the analytics pipeline. Those attributes have been on the All page's
      //     hero cards all along but nothing listened for them here, so the funnel had a hole
      //     between impression and read. data-brief-open="true" means the control is CLOSING
      //     something, which is not an open.
      onClickCapture={(e) => {
        const t = e.target as HTMLElement | null;
        if (!t) return;
        if (t.closest("a,button,[role=button],summary")) {
          const host = t.closest<HTMLElement>("[data-sid],[data-seen-key]");
          const sid = host?.dataset.sid ?? host?.dataset.seenKey;
          if (sid) markSeen(sid, "click");
        }
        const el = t.closest<HTMLElement>("[data-brief-event]");
        if (!el || el.dataset.briefOpen === "true") return;
        const kind = el.dataset.briefEvent as Parameters<typeof logSignal>[0] | undefined;
        if (!kind) return;
        // The shared Row wrapper carries no story of its own, so fall back to the card it sits in
        // — otherwise half this page's source_opens arrive story-less and can't be joined to
        // anything downstream.
        const storyId = el.dataset.briefStory ?? el.closest<HTMLElement>("[data-sid]")?.dataset.sid ?? null;
        const meta = {
          ...(el.dataset.briefTarget ? { target: el.dataset.briefTarget } : {}),
          ...(el.dataset.briefLabel ? { label: el.dataset.briefLabel } : {}),
        };
        logSignal(kind, (storyId && idMapRef.current.get(storyId)?.area) ?? "All", storyId, Object.keys(meta).length ? meta : undefined);
      }}
      style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", ["--rv-accent" as string]: ALL_ACCENT, ["--rv-ink" as string]: INK, ["--rv-ink-2" as string]: INK_2, ["--rv-copy" as string]: INK_2, ["--rv-muted" as string]: MUT, ["--rv-muted-2" as string]: MUT2, ["--rv-line" as string]: LINE, ["--rv-surface" as string]: SURFACE, ["--rv-card" as string]: "#fff", ["--rv-card-line" as string]: "#d8d7d1", ["--rv-card-radius" as string]: "8px", ["--rv-card-shadow" as string]: "0 8px 22px rgba(31,35,42,.07)" }}>
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
        .reader-editorial .rv-episode-row{min-width:0;padding:16px 2px 18px;border-bottom:1px solid ${LINE}}
        .reader-editorial .rv-paper-share{min-width:0}
        @media(max-width:600px){
          .reader-editorial .rv-paper-share{padding:16px 0!important}
          .reader-editorial .rv-paper-meta{align-items:flex-start!important}
          .reader-editorial .rv-paper-actions{justify-content:space-between}
          .reader-editorial .rv-paper-actions>span:last-child{margin-left:auto!important}
        }
        .reader-editorial .readout-hero-card:not(.is-compact){border-top-color:${LINE}}
        .reader-editorial .readout-hero-abstract>p{color:${INK_2}}
        .reader-editorial .readout-hero-preview>div:first-child{color:${MUT}}
        @media(prefers-reduced-motion:reduce){.rv-drawer{animation:none}}
      `}</style>

      <div style={{ maxWidth: wide ? 1280 : 690, margin: "0 auto", padding: compact ? "18px 20px 100px" : "0 32px 120px" }}>
        {/* WIDE — the specialty editions' masthead, structure for structure: brand on the left,
            section jumps centered, edition picker + freshness + Share on the right. The Areas
            scope row then rides its own quiet band beneath, exactly where Focus sits on a tumor
            page, because it scopes the whole page rather than navigating within it. */}
        {wide && !compact && <>
          <div style={{ position: "sticky", top: 0, zIndex: 15, minHeight: 86, margin: "0 -32px", padding: "0 32px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center", columnGap: 42, background: stuck ? "rgba(244,244,241,.94)" : PAPER, backdropFilter: "blur(16px) saturate(1.1)", WebkitBackdropFilter: "blur(16px) saturate(1.1)", borderBottom: `1px solid ${LINE}`, boxShadow: stuck ? "0 12px 28px -22px rgba(31,35,42,.35)" : "none", transition: "box-shadow .2s ease" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: ALL_ACCENT, font: "750 10px/1 system-ui", textTransform: "uppercase" }}>CanvasMD</span>
              <h1 style={{ font: "500 28px/1 Georgia,'Newsreader',serif", color: INK, margin: "5px 0 0", whiteSpace: "nowrap" }}>The Readout</h1>
            </div>
            <nav aria-label="Readout sections" className="all-pills" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, minWidth: 0, overflow: "hidden" }}>
              {navPills}
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
              {editionMenu}
              {oldestStamp && <span style={{ font: "600 12px system-ui", color: MUT, whiteSpace: "nowrap" }}>{ago(oldestStamp)}</span>}
              {shareMsg && <span role="status" style={{ font: "600 12px system-ui", color: "#fff", background: INK, borderRadius: 6, padding: "6px 10px", whiteSpace: "nowrap" }}>{shareMsg}</span>}
              <button onClick={doShare} aria-label="Share this edition" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: 0, color: MUT, width: 44, height: 44, padding: 0, cursor: "pointer" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              </button>
            </div>
          </div>
          <div style={{ minHeight: 58, margin: "0 -32px 18px", padding: "0 32px", display: "flex", alignItems: "center", gap: 20, borderBottom: `1px solid ${LINE}` }}>
            {areasRow(false)}
            <span style={{ marginLeft: "auto", flex: "none", font: "600 10px system-ui", letterSpacing: ".08em", textTransform: "uppercase", color: MUT2, whiteSpace: "nowrap" }}>Busiest first</span>
          </div>
        </>}

        {/* Mobile and medium-width layouts use the same Editorial hierarchy in a compact stack. */}
        {(!wide || compact) && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: compact ? 8 : 18, paddingBottom: 0 }}>
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <span style={{ display: "block", color: ALL_ACCENT, font: "750 9px/1 system-ui", textTransform: "uppercase" }}>CanvasMD</span>
            <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: compact ? 8 : 18, marginTop: 1 }}>
              <h1 style={{ font: `500 ${compact ? 22 : 26}px/1 Georgia,'Newsreader',serif`, color: INK, margin: 0 }}>The Readout</h1>
              {!compact && editionMenu}
            </div>
            {!compact && <div style={{ font: "600 10px system-ui", color: MUT2, marginTop: 9 }}>{oldestStamp ? `Updated ${ago(oldestStamp)} · ` : ""}rolling view · Busiest first</div>}
            {/* On medium-width single-column desktop the Areas row still needs its own line; the
                wide two-column layout moves it into the shared navigation band above. */}
            {!compact && <div style={{ marginTop: 13 }}>{areasRow(false)}</div>}
          </div>
          <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: compact ? 8 : 14, flex: "none", marginTop: compact ? 10 : 2 }}>
          {!compact && <>
            {shareMsg && <span role="status" style={{ font: "600 12.5px system-ui", color: "#fff", background: INK, borderRadius: 6, padding: "6px 11px" }}>{shareMsg}</span>}
            <button onClick={doShare} aria-label="Share this edition" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: `1px solid ${LINE}`, color: INK, font: "600 13px system-ui", borderRadius: 6, padding: "8px 15px", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              Share
            </button>
          </>}
          {compact && editionMenu}
          {/* 44px box around a 17px glyph keeps the tap target at the platform norm; the negative
              margin stops the larger hit area from disturbing the header's optical alignment. */}
          {compact && <button onClick={doShare} aria-label="Share" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, width: 44, height: 44, margin: "-11px -13px -11px 0", padding: 0, cursor: "pointer", flex: "none", order: 1 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={MUT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          </button>}
          {compact && shareMsg && <span role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 40, font: "600 12.5px system-ui", color: "#fff", background: INK, borderRadius: 6, padding: "8px 13px", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>{shareMsg}</span>}
          </div>
        </div>
        {!compact && <div aria-hidden style={{ height: 1, margin: "14px 0 12px", background: LINE }} />}
        {compact && <>
          <div style={{ font: "600 10px system-ui", color: MUT2, margin: "7px 0 0" }}>{oldestStamp ? `Updated ${ago(oldestStamp)} · ` : ""}rolling view · Busiest first</div>
          <div aria-hidden style={{ height: 1, margin: "13px 0 10px", background: LINE }} />
        </>}
        {/* Section jumps stay sticky on compact and medium-width layouts. */}
        <div className={`all-pills${compact ? " all-fade" : ""}`} style={{ position: "sticky", top: 0, zIndex: 15, margin: compact ? "0 -20px" : "0 -32px", padding: compact ? "4px 20px 2px" : "5px 32px 2px", background: stuck ? "rgba(244,244,241,.96)" : PAPER, backdropFilter: "blur(16px) saturate(1.1)", WebkitBackdropFilter: "blur(16px) saturate(1.1)", borderBottom: `1px solid ${LINE}`, boxShadow: stuck ? "0 10px 24px -22px rgba(31,35,42,.4)" : "none", transition: "box-shadow .2s ease", display: "flex", justifyContent: "flex-start", flexWrap: compact ? "nowrap" : "wrap", gap: compact ? 24 : 28, overflowX: compact ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
          {navPills}
        </div>

        {/* Phones keep the horizontally scrollable Areas strip here, where every option holds a
            44px target — the same slot Focus occupies on a tumor page. */}
        {compact && areasRow(true)}
        </>}

        {(() => {

        // Everything above the specialty rails, in one block so BOTH layouts place it identically.
        // On wide it rides the editorial column of the two-track grid rather than running
        // full-bleed above it (John, 2026-08-24: "the side bar can be up top, no reason to drop it
        // down and make the top part full screen on desktop").
        //   SINCE YOUR LAST READ — the personal delta; rows point at canonical cards below and
        //     never contain the story themselves.
        //   MOST DISCUSSED — the concentration surface: cross-specialty promotion over each area's
        //     own authoritative order (never a re-score), then the Approvals & readouts rail and,
        //     once the deck is actually reviewed, the caught-up line. The rails keep everything;
        //     the deck only promotes.
        //
        // NO DAILY HERE (John, 2026-08-24: "it's just a repost of the since you left … especially
        // on the All page it's a mess of content"). On-site the band strictly dominates it: the
        // band knows what this reader has actually seen, the Daily only knows what happened in
        // 24h — so a daily visitor gets the same ground twice and a weekly visitor gets a subset
        // of their own delta. Scoped to ALL of oncology it was also seven unrelated storylines in
        // one prose block sitting directly above a ranked deck that does cross-specialty triage
        // more legibly. The SPECIALTY editions keep theirs (a coherent single-area narrative), and
        // the Daily EMAIL is untouched — that is where it earns its keep, as re-entry for someone
        // who isn't on the site.
        const topJsx = (
          <>
            {bandJsx}
            {deckJsx}
            {approvalsJsx}
            {caughtUpJsx}
            {browseHeaderJsx}
          </>
        );

        {/* six area groups — compact first-pass picks with an in-place "show more";
            groups ride in activity order, and the receipt count in each header justifies the slot.
            WIDE: two tracks like the tumor pages — editorial column (top sections + groups +
            podcasts + papers) and the People rail. NARROW: everything follows the nav order. */}
          const groupsJsx = (
            <>
              {orderedAreas.map((a, areaIndex) => {
                const brief = briefsByArea[a];
                const acc = accentOf(a);
                // Hero contract (Codex cutover review): in hero mode the deck is authoritative —
                // an empty deck is a quiet week, never a fallback to legacy stories.
                const heroDeck = brief ? heroDeckOf(brief) : null;
                const stories = brief && heroDeck === null ? storiesOf(brief) : [];
                const full = AREA_FULL[a] ?? a;
                return (
                  <div key={a} id={areaId(a)} data-ssurface="all_rail" style={{ marginTop: areaIndex === 0 ? 34 : compact ? 46 : 54, scrollMarginTop: 100 }}>
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
                          shareUrlOf={(card) => `/r/${heroSlugFor(card.kind, card.headline, card.id)}`}
                          // Seen-state + one open drawer across every rail, so a Since-your-last-read
                          // row can open the card it points at wherever that card lives.
                          seenIds={seenAtLoad}
                          unseenDot={acc}
                          openId={heroOpen}
                          onOpenChange={(id) => { setHeroOpen(id); if (id) markSeen(id, "expand"); }}
                        />}
                        {heroDeck !== null && heroDeck.length > (compact ? 2 : 3) && (
                          <button type="button" onClick={() => setExpandedAreas((current) => ({ ...current, [a]: !current[a] }))}
                            className="rv-text-action" style={{ minHeight: 44, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12px system-ui", color: acc }}>
                            {expandedAreas[a] ? "Show fewer stories ↑" : `Show ${heroDeck.length - (compact ? 2 : 3)} more stor${heroDeck.length - (compact ? 2 : 3) === 1 ? "y" : "ies"} ↓`}
                          </button>
                        )}
                        {heroDeck !== null && heroDeck.length === 0 && (
                          <div style={{ font: "400 13.5px/1.5 system-ui", color: MUT, padding: "2px 2px 4px" }}>A quiet rolling view — no source-anchored stories qualified.</div>
                        )}
                        {heroDeck === null && stories.map((s, i) => renderStory(s, i, a, acc))}
                      </>
                    ) : (
                      <div style={{ font: "400 13.5px/1.5 system-ui", color: MUT, padding: "2px 2px 4px" }}>Quiet in this rolling {full} view. <button onClick={() => onArea(a)} style={{ background: "none", border: 0, cursor: "pointer", font: "600 13.5px system-ui", color: acc, padding: 0 }}>See the full brief →</button></div>
                    )}
                  </div>
                );
              })}
            </>
          );
          const EPISODE_CAP = compact ? 4 : 6;
          const EPISODE_MORE_CAP = 18;
          const episodesShown = allEpisodes.slice(0, episodesMore ? EPISODE_MORE_CAP : EPISODE_CAP);
          const podcastsJsx = allEpisodes.length > 0 && (
            <section id="all-listen" style={{ marginTop: compact ? 46 : 54, scrollMarginTop: 100 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                <h2 style={{ flex: "0 1 auto", minWidth: 0, font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: INK, margin: 0 }}>Podcasts from current specialty briefs</h2>
                <span aria-hidden style={{ height: 1, flex: 1, background: LINE }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
                {episodesShown.map((entry) => {
                  const ep = entry.episode;
                  const acc = accentOf(entry.areas[0] ?? "GU");
                  const amplifiers = ep.amplifiers ?? [];
                  const announcements = ep.announcements ?? [];
                  const hasXReceipts = amplifiers.length > 0 || announcements.length > 0;
                  const ampId = `all-epamp:${entry.key}`;
                  const ampOpen = openId === ampId;
                  const drawerId = `all-epamp-drawer-${entry.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
                  return (
                    <article key={entry.key} className="rv-episode-row">
                      <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 11 }}>
                        <Coin src={ep.showArt} label={ep.show || "Podcast"} size={34} radius={8} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: "600 15px/1.35 system-ui", color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.title}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                            {entry.areas.map(miniTag)}
                            <span style={{ minWidth: 0, font: "400 11.5px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.show || "Podcast"}</span>
                            {entry.featured && <span style={{ flex: "none", font: "700 8.5px system-ui", letterSpacing: ".07em", textTransform: "uppercase", color: acc, background: `${acc}17`, border: `1px solid ${acc}59`, borderRadius: 5, padding: "1.5px 6px" }}>Also in Top Stories</span>}
                          </div>
                        </div>
                      </div>
                      {ep.description && <p style={{ margin: "0 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: INK_2, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.description}</p>}
                      <AudioQuote audioUrl={ep.audioUrl!} startMs={0} durationSeconds={ep.durationSeconds} label="Listen to the episode" eventId={ep.episodeId ?? null} eventLabel={ep.title} accent={acc} tone="dark" />
                      {hasXReceipts && (
                        <div style={{ marginTop: 8 }}>
                          <button type="button" onClick={() => toggle(ampId)} aria-expanded={ampOpen} aria-controls={drawerId} aria-label={`${ampOpen ? "Hide" : "Show"} amplification sources for ${ep.title}`} className="rv-text-action"
                            style={{ width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 8, background: "none", border: 0, padding: "4px 0", cursor: "pointer", textAlign: "left" }}>
                            <span style={{ display: "flex", alignItems: "center", flex: "none" }}>
                              {amplifiers.slice(0, 4).map((a, j) => <Coin key={j} src={a.avatar} label={a.name} size={18} ring={PAPER} style={{ marginLeft: j ? -7 : 0 }} />)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, font: "500 12.5px system-ui", color: MUT }}>{amplifiers.length === 1 ? `Amplified by ${amplifiers[0].name}` : amplifiers.length > 1 ? `Amplified by ${amplifiers.length} clinicians` : `From ${announcements[0]?.name ?? "the show"} on X`}</span>
                            <span data-disclosure style={{ color: acc, font: "600 12.5px system-ui", whiteSpace: "nowrap" }}>{ampOpen ? "Hide sources ↑" : "Sources ↓"}</span>
                          </button>
                          {ampOpen && <div id={drawerId} className="rv-drawer" style={{ marginTop: 6, paddingTop: 10, borderTop: `1px solid ${LINE}`, minWidth: 0, overflow: "hidden" }}><EpisodeXReceipts announcements={announcements} amplifiers={amplifiers} accent={acc} /></div>}
                        </div>
                      )}
                    </article>
                  );
                })}
                {allEpisodes.length > EPISODE_CAP && (
                  <button type="button" onClick={() => setEpisodesMore((current) => !current)} className="rv-text-action" style={{ alignSelf: "flex-start", minHeight: 44, background: "none", border: 0, padding: "8px 2px 0", cursor: "pointer", font: "600 12.5px system-ui", color: ALL_ACCENT }}>
                    {episodesMore ? "Show fewer episodes ↑" : `Show ${Math.min(allEpisodes.length, EPISODE_MORE_CAP) - EPISODE_CAP} more episodes ↓`}
                  </button>
                )}
              </div>
            </section>
          );

          {/* The one merged ranking uses a comparable count: verified clinicians sharing each
              paper. The row itself is shared with specialty pages, including independent
              Abstract and Sources controls. */}
          const readingJsx = reading.length > 0 && (
            <section id="all-reading" style={{ marginTop: compact ? 46 : 54, scrollMarginTop: 100 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
                <h2 style={{ flex: "none", font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: INK, margin: 0 }}>Papers being shared</h2>
                <span aria-hidden style={{ height: 1, flex: 1, background: LINE }} />
              </div>
              <p style={{ margin: "0 0 6px", font: "400 11.5px/1.5 system-ui", color: MUT2 }}>Up to ten papers across every area, ranked by clinicians who shared each paper.</p>
              {reading.map(({ p, area }, i) => {
                const acc = accentOf(area);
                const id = "r:" + i;
                return <PaperShareRow key={id} paper={p} id={`all-${id}`} open={openId === id} onToggle={() => toggle(id)} accent={acc} ring={PAPER} featured={featuredIn.has(norm(p.title))} contextLabel={area} />;
              })}
            </section>
          );
          const voicesInline = micsRanked.length + xRanked.length > 0 && (
            <div id="all-voices" style={{ marginTop: 40, paddingTop: 26, borderTop: `1px solid ${LINE}`, scrollMarginTop: 100 }}>{voicesModules}</div>
          );
          // old snapshots ship no hosts/amp — collapse the rail rather than render an empty shell
          const hasVoices = micsRanked.length + xRanked.length > 0;
          // The two-track grid starts at the TOP of the page, so the People rail sits alongside
          // Since-your-last-read and the ranked deck instead of the page running full-bleed up
          // top and only turning columnar further down.
          return wide ? (
            <div style={{ display: "grid", gridTemplateColumns: hasVoices ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)", columnGap: 46, alignItems: "start" }}>
              <div className="rv-editorial-column" style={{ minWidth: 0, width: "100%", maxWidth: EDITORIAL_MEASURE }}>{topJsx}{groupsJsx}{podcastsJsx}{readingJsx}</div>
              {hasVoices && <aside style={{ minWidth: 0, marginTop: 26 }}>{voicesModules}</aside>}
            </div>
          ) : (
            <>{topJsx}{groupsJsx}{podcastsJsx}{readingJsx}{voicesInline}</>
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
