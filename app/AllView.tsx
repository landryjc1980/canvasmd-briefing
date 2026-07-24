"use client";

import { useEffect, useState } from "react";
import { BriefingData, BriefingArticle, BriefingStory, BriefingSharer } from "@/lib/types";
// Reuse the exact evidence machinery from the single-area reader so the expand /
// Hide-at-bottom / clips / receipts behave identically everywhere.
import { Row, PodCard, TweetCard, PaperCard, FacePile, evLabel, paperMeta } from "./ReaderView";
import StanceBlock from "./StanceBlock";
import AudioQuote from "@/components/AudioQuote";
import { inkOf, palOf, AREA_FULL, storiesOf, storyKicker, storyMetricLine, pileFaces, cleanArticleTitle, articleSource, isNewsDomain } from "./briefVM";

// "All oncology" — a front page that reads as ONE continuous scroll: every area's full
// story list, grouped by area and shown in its own color, never re-ranked across areas
// (their scores are area-relative — cross-ranking would be dishonest). The one section
// that DOES merge is "what the field is reading": papers ranked by a plain, comparable
// count (verified clinicians who shared it), which means the same thing in any area.

const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn"];
const INK = "#0D1017";
const MUT = "#9aa2b6";
const MUT2 = "#7e8698";
const areaId = (a: string) => "all-" + a;

export default function AllView({ briefsByArea, areas, onArea, compact = false, primary, onSetPrimary }: {
  briefsByArea: Record<string, BriefingData>;
  areas: string[];
  onArea: (a: string) => void;
  compact?: boolean;
  primary?: string | null;
  onSetPrimary?: (a: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [micsMore, setMicsMore] = useState(false);
  const [xMore, setXMore] = useState(false);
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

  // ---- VOICES OF THE WEEK (rail on wide, inline section on narrow) ----
  // Two lists because a microphone and a repost aren't the same axis:
  //   On the mics — ranked by GUEST appearances (invitations are the field's choice, cadence-
  //     proof); working-clinician hosts included at host-credit ≤1/wk; co-hosted shows collapse
  //     every row is a PERSON (a show is a venue, not a voice). Pro-interview CME hosts never
  //     appear at all (excluded edge-side).
  //   Carried on X — ranked by amplification (reposts + quote-posts earned this week).
  // Cross-area merge: same person in two briefs = one row with both area tags; X amp uses the
  // MAX across areas (each area scopes to its own posts — summing would double-count).
  type EpRec = { title: string; audioUrl: string | null; show: string | null; showArt: string | null };
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
    for (const e of g.episodes) eps.set(epKey(e.title), { title: e.title, audioUrl: e.audioUrl, show: e.show, showArt: e.showArt });
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

  type XEntry = { key: string; name: string; handle: string | null; avatar: string | null; institution: string | null; areas: string[]; amp: number; tweets: number; paperShares: number; posts: BriefingSharer[]; articles: { title: string; url: string; journal: string | null; domain: string | null }[] };
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
      if (!v) { v = { key, name: k.name, handle: k.handle, avatar: k.avatar, institution: k.institution, areas: [], amp: 0, tweets: 0, paperShares: 0, posts: [], articles: [] }; xVoices.set(key, v); }
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
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
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

  const wash = "#232a3a"; // a neutral top wash for All (no single area owns the page)
  const ini = (s: string) => s.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const miniTag = (a: string) => (
    <span key={a} style={{ font: "700 7.5px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: INK, background: inkOf(a).accent, borderRadius: 4, padding: "2px 5px", flex: "none" }}>{a}</span>
  );

  // One rail-style voice row — mirrors the tumor pages' "Most active on X" module anatomy
  // (38px avatar, serif name, count chip right, one-line institution, expand-in-place).
  // COLOR DISCIPLINE (John, 2026-07-24: "an awful lot of color"): the tiny area tag is the
  // ONLY color carrier on a closed row — ring, count chip and role chip stay neutral so six
  // areas' rows don't read as rainbow noise. Accent returns inside the open drawer.
  const voiceRow = (opts: { id: string; name: string; avatar?: string | null; areas: string[]; roleChip?: string | null; sub: string | null; count: string; countOpen?: string; children: React.ReactNode | null }) => {
    const acc = inkOf(opts.areas[0] ?? "GU").accent;
    const open = openId === opts.id;
    const canOpen = opts.children !== null;
    return (
      <Row key={opts.id} open={open} onToggle={() => { if (canOpen) toggle(opts.id); }} accent={acc} landOffset={compact ? 108 : 70}
        head={
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 2px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "600 12px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden", marginTop: 2, border: "2px solid rgba(255,255,255,.13)" }}>
              {opts.avatar ? <img src={opts.avatar} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(opts.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.25 'Newsreader',Georgia,serif", color: "#f4f7ff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opts.name}</span>
                <span style={{ display: "inline-flex", alignItems: "center", flex: "none", marginTop: 1, font: "600 11px system-ui", color: open ? "#eef1f8" : "#cdd2de", border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.05)", borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" }}>{open ? (opts.countOpen ?? "Hide ↑") : opts.count}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {opts.areas.map(miniTag)}
                {opts.roleChip && <span style={{ font: "700 7.5px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: "rgba(255,255,255,.6)", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 4, padding: "1.5px 5px", flex: "none" }}>{opts.roleChip}</span>}
                {opts.sub && <span style={{ font: "400 11.5px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{opts.sub}</span>}
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
      <div style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#cdd2de" }}>Voices of the week</div>
      <div style={{ font: "400 11.5px system-ui", color: MUT2, marginTop: 5 }}>who the field heard · who it amplified</div>

      {/* ── On the mics ── */}
      {micsRanked.length > 0 && <div style={{ margin: "18px 0 2px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ font: "500 16px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>On the mics</span>
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
        const sub = m.hostShow ? [m.hostShow, m.aff].filter(Boolean).join(" · ") : m.aff;
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
                <div key={j} style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 12, padding: "11px 13px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: e.audioUrl ? 9 : 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.1)", flex: "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", font: "700 9px system-ui" }}>{e.showArt ? <img src={e.showArt} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(e.show ?? "P")}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {e.show && <div style={{ font: "600 12px system-ui", color: "#eef1f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.show}</div>}
                      <div style={{ font: "400 11px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                    </div>
                  </div>
                  {e.audioUrl && <AudioQuote audioUrl={e.audioUrl} startMs={0} label="Listen" accent={inkOf(m.areas[0] ?? "GU").accent} tone="dark" />}
                </div>
              ))}
            </div>
          ) : null,
        });
      })}
      {moreBtn(micsRanked.length, MICS_CAP, micsMore, () => setMicsMore((v) => !v))}

      {/* ── Carried on X ── */}
      {xRanked.length > 0 && <div style={{ margin: "26px 0 2px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ font: "500 16px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>Carried on X</span>
        <span style={{ font: "400 10.5px system-ui", color: MUT2 }}>by reposts + quotes earned</span>
      </div>}
      {xShown.map((v) => {
        const acc = inkOf(v.areas[0] ?? "GU").accent;
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
          sub: [v.institution, facts].filter(Boolean).join(" · "),
          count: `${v.amp.toLocaleString()} amplified ↓`,
          children: (v.posts.length || v.articles.length) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {v.posts.length > 0 && <div><div style={evLabel(acc)}>Their posts · this week</div>{v.posts.slice(0, 4).map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              {v.articles.length > 0 && <div><div style={evLabel(acc)}>Papers shared</div>{v.articles.slice(0, 3).map((a2, j) => <PaperCard key={j} title={a2.title} journal={a2.journal} domain={a2.domain} url={a2.url} accent={acc} />)}</div>}
            </div>
          ) : null,
        });
      })}
      {moreBtn(xRanked.length, X_CAP, xMore, () => setXMore((v) => !v))}

      <div style={{ font: "400 10.5px/1.6 system-ui", color: MUT2, marginTop: 16, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.05)" }}>
        Episode counts = this week&rsquo;s briefs (host, guest, or show · syndication deduped · interview-network hosts excluded). Ranked by guest appearances — hosting credits one per week; ties by lifetime appearances. Amplified = reposts + quote-posts earned on their own posts this week; cross-area voices show their busiest area&rsquo;s count. Every number shown is a plain count.
      </div>
    </div>
  );

  const evidenceChip = (acc: string) => (
    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", font: "600 12px system-ui", color: acc, border: `1px solid ${acc}59`, background: `${acc}17`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>Evidence ↓</span>
  );

  // One story row — the lead gets the front-page step-up, the rest match the tumor-page
  // rows (number, kicker, 2-line teaser, facts line) so the page is dense but scannable.
  const renderStory = (s: BriefingStory, i: number, a: string, acc: string) => {
    const lead = i === 0;
    const id = `all:${a}:${i}`;
    const open = openId === id;
    const faces = pileFaces(s);
    const headlineFont = lead ? (compact ? "500 20px/1.18" : "500 21px/1.18") : (compact ? "500 17.5px/1.3" : "500 18.5px/1.25");
    return (
      <div key={id} style={{ background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)", ...(lead ? { borderTop: "1px solid rgba(255,255,255,.15)", borderLeft: `3px solid ${acc}` } : {}), borderRadius: 15, padding: "0 20px", marginBottom: 10 }}>
        <Row open={open} onToggle={() => toggle(id)} accent={acc} landOffset={compact ? 108 : 70}
          head={
            <div style={{ display: "flex", alignItems: "flex-start", gap: !lead && !compact ? 16 : 0, padding: lead ? "18px 2px" : "15px 2px" }}>
              {!lead && !compact && <div style={{ font: "500 21px/1.1 'Newsreader',Georgia,serif", color: acc, opacity: 0.45, width: 26, flex: "none" }}>{i + 1}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  {!lead && compact && <span style={{ font: "600 13px 'Newsreader',Georgia,serif", color: acc, lineHeight: 1 }}>{i + 1}</span>}
                  <span style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: acc }}>{storyKicker(s)}</span>
                </div>
                <h3 style={{ font: `${headlineFont} 'Newsreader',Georgia,serif`, color: "#f8f9fc", letterSpacing: lead ? "-.005em" : "0", margin: 0 }}>{s.headline}</h3>
                {s.subtitle && <div style={{ font: "500 11.5px system-ui", color: MUT, marginTop: 6 }}>{s.subtitle}</div>}
                {s.description && <p style={{ margin: "9px 0 0", font: "400 13.5px/1.5 system-ui", color: "#aab0bf", ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{s.description}</p>}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {faces.length > 0 && <FacePile faces={faces} extra={0} ring={INK} />}
                  <span style={{ font: "400 12px system-ui", color: MUT }}>{storyMetricLine(s)}</span>
                  {!open && evidenceChip(acc)}
                </div>
              </div>
            </div>
          }>
          <div style={{ marginLeft: !lead && !compact ? 42 : 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <StanceBlock stance={s.stance} accent={acc} />
            {s.podcast.length > 0 && <div><div style={evLabel(acc)}>On the podcasts</div>{s.podcast.map((p, j) => <PodCard key={j} p={p} accent={acc} />)}</div>}
            {s.posts.length > 0 && <div><div style={evLabel(acc)}>On X · verified clinicians</div>{s.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
            {s.papers.length > 0 && <div><div style={evLabel(acc)}>{s.kind === "paper" ? "The paper" : "Papers"}</div>{s.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} meta={paperMeta(p.sharers.length || p.posts?.length || 0, p.topLikes || 0)} url={p.url} abstract={p.abstract} posts={p.posts?.length ? p.posts : p.sharers} accent={acc} />)}</div>}
          </div>
        </Row>
      </div>
    );
  };

  const editionMenu = (
    <div style={{ position: "relative", flex: "none" }}>
      <div role="button" tabIndex={0} aria-expanded={menuOpen} aria-label="Switch tumor area"
        onClick={() => setMenuOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMenuOpen((o) => !o); } }}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 13px", cursor: "pointer", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 20 }}>
        <span style={{ font: "600 13.5px system-ui", color: "#fff", whiteSpace: "nowrap" }}>All oncology</span>
        <span style={{ font: "700 11px system-ui", color: "#c7cbd6", lineHeight: 1 }}>▾</span>
      </div>
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", top: "calc(100% + 7px)", left: 0, width: 220, background: "rgba(16,18,26,.97)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, boxShadow: "0 20px 44px rgba(0,0,0,.4)", padding: 8, zIndex: 31 }}>
            <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", padding: "6px 11px 8px" }}>Tumor area</div>
            {areas.map((a) => {
              const on = a === "All";
              const label = a === "All" ? "All oncology" : (AREA_FULL[a] ?? a);
              const isHome = a === primary;
              return (
                <button key={a} type="button" role="menuitem" aria-current={on} onClick={() => { setMenuOpen(false); if (!on) onArea(a); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(255,255,255,.1)" : "transparent", border: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: a === "All" ? "conic-gradient(from 0deg, #7AA2FF, #F08AA6, #46C7B8, #E2803B, #9B8CFF, #E070C0, #7AA2FF)" : palOf(a).accent }} />
                  <span style={{ flex: 1, font: "600 13.5px system-ui", color: on ? "#fff" : "rgba(255,255,255,.78)" }}>{label}</span>
                  {isHome && <span title="Your default" style={{ color: "rgba(255,255,255,.5)", font: "700 12px system-ui" }}>⌂</span>}
                  {on && <span style={{ color: "#c7cbd6", font: "700 13px system-ui" }}>✓</span>}
                </button>
              );
            })}
            {onSetPrimary && primary !== "All" && (
              <>
                <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "6px 4px" }} />
                <button type="button" onClick={() => { onSetPrimary("All"); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: "transparent", border: 0, color: "#c7cbd6", font: "600 12.5px system-ui" }}>
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
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${wash}80 0px, ${wash}22 220px, ${wash}00 460px), ${INK}`, color: "#eef1f8", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <style>{`
        .rv-row{transition:background .16s ease}
        @media(hover:hover){.rv-row:hover{background:rgba(255,255,255,.045)}}
        @media(hover:hover){.rv-row[aria-expanded="true"],.rv-row[aria-expanded="true"]:hover{background:transparent}}
        .rv-row:focus-visible{outline:2px solid rgba(255,255,255,.45);outline-offset:-2px}
        .rv-drawer{animation:rvDrawerIn .26s cubic-bezier(.4,0,.2,1)}
        @keyframes rvDrawerIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        .all-pills::-webkit-scrollbar{display:none}.all-pills{scrollbar-width:none}
        @media(prefers-reduced-motion:reduce){.rv-drawer{animation:none}}
      `}</style>

      <div style={{ maxWidth: wide ? 1116 : compact ? 690 : 760, margin: "0 auto", padding: wide ? "34px 30px 120px" : "34px 26px 120px" }}>
        {/* masthead */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ font: `500 ${compact ? 21 : 24}px/1 'Newsreader',Georgia,serif`, color: "#fff", letterSpacing: "-.01em", margin: 0 }}>The Readout</h1>
          {editionMenu}
        </div>
        <div style={{ font: "600 9.5px system-ui", letterSpacing: ".2em", textTransform: "uppercase", color: MUT2, marginTop: 10 }}>By CanvasMD · Every tumor area · Busiest first</div>
        {/* the rainbow rule — the one place that signals "everything" */}
        <div aria-hidden style={{ height: 2, borderRadius: 2, marginTop: 13, background: "linear-gradient(90deg, #7AA2FF, #F08AA6, #46C7B8, #E2803B, #9B8CFF, #E070C0)" }} />

        {/* jump-pills — sticky with scroll-spy, glass chrome once stuck (tumor-page parity).
            COMPACT: two rows — areas scroll horizontally on top, the cross-area sections
            (Voices · Papers) sit on their own always-visible row beneath (John: hidden behind
            the scroll when appended to the area row). Desktop: one wrapping row. */}
        {(() => {
          const pillStyle = (on: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", font: "600 12.5px system-ui", padding: "7px 13px", borderRadius: 9, border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.14)"}`, background: on ? "#fff" : "rgba(255,255,255,.04)", color: on ? INK : "#cdd2de", whiteSpace: "nowrap", flex: "none", transition: "background .15s, color .15s" });
          const areaPills = orderedAreas.map((a) => {
            const on = activeSec === areaId(a);
            return (
              <button key={a} onClick={() => goArea(a)} style={pillStyle(on)}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: palOf(a).accent, flex: "none" }} />{a}
              </button>
            );
          });
          {/* Voices rides the rail on wide (always visible → no pill, same rule as the tumor
              pages' rail sections); on narrow it's an inline section that earns a jump */}
          const voicesPill = !wide && micsRanked.length + xRanked.length > 0 && (
            <button key="voices" onClick={() => goTo("all-voices")} style={pillStyle(activeSec === "all-voices")}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg, #46C7B8, #9B8CFF)", flex: "none" }} />Voices
            </button>
          );
          const papersPill = reading.length > 0 && (
            <button key="papers" onClick={() => goTo("all-reading")} style={pillStyle(activeSec === "all-reading")}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg, #7AA2FF, #E070C0)", flex: "none" }} />Papers
            </button>
          );
          const rowPad = wide ? "0 30px" : "0 26px";
          // Compact section row reads like the tumor pages' tabs: Top Stories lit while you're
          // anywhere in the groups; Voices / Papers take over in their sections.
          const inSection = activeSec === "all-voices" || activeSec === "all-reading";
          const topPill = (
            <button key="top" onClick={() => goArea(orderedAreas[0])} style={pillStyle(!inSection)}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: inSection ? "rgba(255,255,255,.55)" : INK, flex: "none" }} />Top Stories
            </button>
          );
          return (
            <div style={{ position: "sticky", top: 0, zIndex: 15, display: "flex", flexDirection: "column", gap: 8, margin: wide ? "16px -30px 0" : "16px -26px 0", padding: "10px 0", background: stuck ? `${INK}E0` : "transparent", backdropFilter: stuck ? "blur(10px) saturate(1.15)" : "none", WebkitBackdropFilter: stuck ? "blur(10px) saturate(1.15)" : "none", boxShadow: stuck ? "0 14px 28px -18px rgba(0,0,0,.55)" : "none", transition: "background .2s ease, box-shadow .2s ease" }}>
              <div className="all-pills" style={{ display: "flex", gap: 8, flexWrap: compact ? "nowrap" : "wrap", overflowX: compact ? "auto" : "visible", padding: rowPad, WebkitOverflowScrolling: "touch" }}>
                {areaPills}
                {!compact && voicesPill}
                {!compact && papersPill}
              </div>
              {compact && (voicesPill || papersPill) && (
                <div style={{ display: "flex", gap: 8, padding: rowPad }}>
                  {topPill}
                  {voicesPill}
                  {papersPill}
                </div>
              )}
            </div>
          );
        })()}

        {/* six area groups — EVERY story in each (one continuous scroll, no clicks to see more);
            groups ride in activity order, and the source count in each header justifies the slot.
            WIDE: two tracks like the tumor pages — editorial column (groups + reading) + the
            Voices rail. NARROW: everything inline — groups → voices → reading. */}
        {(() => {
          const groupsJsx = (
            <>
              {orderedAreas.map((a) => {
                const brief = briefsByArea[a];
                const acc = inkOf(a).accent;
                const stories = brief ? storiesOf(brief) : [];
                const full = AREA_FULL[a] ?? a;
                return (
                  <div key={a} id={areaId(a)} style={{ marginTop: 34, scrollMarginTop: compact ? 100 : 62 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: acc, flex: "none" }} />
                      <span style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#e7eaf2" }}>{full}</span>
                      {activity[a] > 0 && <span title="Distinct podcast clips, verified-clinician posts, and papers behind this week's stories" style={{ font: "400 11px system-ui", color: MUT2 }}>· {activity[a]} sources</span>}
                      <button onClick={() => onArea(a)} style={{ marginLeft: "auto", background: "none", border: 0, cursor: "pointer", font: "600 12px system-ui", color: acc }}>Full {a} brief →</button>
                    </div>
                    {stories.length > 0 ? (
                      <>
                        {stories.map((s, i) => renderStory(s, i, a, acc))}
                        {/* the tail: what the full brief adds beyond the stories */}
                        <div style={{ font: "400 12px system-ui", color: MUT2, padding: "2px 2px 0" }}>
                          Drugs board, trials &amp; guests in the <button onClick={() => onArea(a)} style={{ background: "none", border: 0, cursor: "pointer", font: "600 12px system-ui", color: acc, padding: 0 }}>full {full} brief →</button>
                        </div>
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
            <div id="all-reading" style={{ marginTop: 40, paddingTop: 26, borderTop: "1px solid rgba(255,255,255,.08)", scrollMarginTop: compact ? 100 : 62 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#cdd2de" }}>What the field is reading</span>
                <span style={{ font: "400 11.5px system-ui", color: MUT2 }}>· across oncology · ranked by clinicians who shared it</span>
              </div>
              {reading.map(({ p, area }, i) => {
                const acc = inkOf(area).accent;
                const id = "r:" + i;
                const open = openId === id;
                return (
                  <div key={id} style={{ borderBottom: i < reading.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                    <Row open={open} onToggle={() => toggle(id)} accent={acc} landOffset={compact ? 108 : 70}
                      head={
                        <div style={{ padding: "16px 2px" }}>
                          <div style={{ font: "500 16px/1.4 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{cleanArticleTitle(p.title)}</div>
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 9 }}>
                            <span style={{ font: "700 8px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: INK, background: acc, borderRadius: 4, padding: "3px 6px", flex: "none" }}>{area}</span>
                            {p.faces.length > 0 && <FacePile faces={p.faces} extra={p.kolSharers - p.faces.length} ring={INK} />}
                            <span style={{ font: "400 12px system-ui", color: MUT }}>{[articleSource(p.journal, p.domain), p.kolSharers ? `shared by ${p.kolSharers} clinician${p.kolSharers === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}</span>
                            {isNewsDomain(p.domain) && !p.journal && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "rgba(255,255,255,.55)", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
                            {!open && evidenceChip(acc)}
                          </div>
                        </div>
                      }>
                      {p.abstract && <p style={{ margin: 0, font: "400 15px/1.6 'Newsreader',Georgia,serif", color: "#b7bac3" }}>{p.abstract}</p>}
                      {p.posts.length > 0 && <div><div style={evLabel(acc)}>What clinicians said · {p.posts.length}</div>{p.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                      {/* link to the source — also guarantees the expand is never empty */}
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", font: "600 13px system-ui", color: acc, textDecoration: "none" }}>Open article ↗</a>}
                    </Row>
                  </div>
                );
              })}
            </div>
          );
          const voicesInline = micsRanked.length + xRanked.length > 0 && (
            <div id="all-voices" style={{ marginTop: 40, paddingTop: 26, borderTop: "1px solid rgba(255,255,255,.08)", scrollMarginTop: compact ? 100 : 62 }}>{voicesModules}</div>
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

        <div style={{ textAlign: "center", marginTop: 44, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ font: "500 15px/1 'Newsreader',Georgia,serif", color: "rgba(255,255,255,.6)" }}>The Readout</div>
          <div style={{ font: "400 12px/1.55 system-ui", color: MUT, marginTop: 12, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>Signal from oncology&rsquo;s verified voices — identified clinicians and expert, physician-led podcasts. Pick an area above to go deep.</div>
        </div>
      </div>
    </div>
  );
}
