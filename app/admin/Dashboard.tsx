"use client";

// Database-stats dashboard (admin "Dashboard" tab). Renders /api/admin/stats:
// people coverage (guests/hosts + X users, broken down by identity tier) and
// corpus counts, each with a day-over-day delta from admin_stats_daily.
// Deliberately generic (StatCard / BreakdownCard) so new stats slot in cheaply.

import { useEffect, useState } from "react";

type Tier = {
  total: number; npi: number; international: number; md_no_npi: number; other: number;
  intl_identified?: number; intl_md_credential?: number; intl_x_linked?: number;
};
type Stats = {
  captured_at: string;
  people: {
    total: number; hosts: number; guests: number; guests_hosts: Tier; x_users: Tier;
    both?: number; guests_hosts_only?: number; x_only?: number; neither?: number;
    voice_id?: { total: number; guests_hosts: number; gold: number; silver: number; provisional: number };
    npi_verified?: number; npi_inferred?: number;
  };
  corpus: {
    shows: number; episodes: number; episodes_transcribed: number; transcript_chunks: number;
    chunks_unembedded: number; appearances: number; x_sources_active: number; x_posts: number;
    audio_hours_total?: number; audio_hours_transcribed?: number;
  };
  areas?: { area: string; episodes: number; transcribed: number; shows: number; x_sources: number }[];
  velocity?: { new_people_7d: number; new_episodes_7d: number; new_posts_7d: number; new_appearances_7d: number };
  readout: { contacts_total: number; contacts_active: number };
};
type HistoryPoint = {
  day: string; guests_hosts: number; x_users: number; npi: number;
  episodes_transcribed: number; x_posts: number; people_total: number;
};
type TrendingX = {
  name: string; handle: string; followers: number | null; delta_7d: number | null;
  delta_30d: number | null; pct_growth_7d: number | null; avatar_url: string | null;
  source_type: string | null; person_has_npi: boolean | null;
};
type ActiveX = { name: string; handle: string; posts_7d: number; follower_count: number | null; avatar_url: string | null; source_type: string | null };
type AmplifiedX = {
  handle: string; name: string; amplifications: number; rts: number; quotes: number;
  amplifiers: number; in_panel: boolean; avatar_url: string | null; followers: number | null;
};
type Payload = {
  ok: boolean; stats?: Stats; prev?: Stats | null; prevDay?: string | null; error?: string;
  trending?: TrendingX[]; activity?: ActiveX[]; topRetweeted?: AmplifiedX[]; topQuoted?: AmplifiedX[]; history?: HistoryPoint[];
};

const box: React.CSSProperties = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: 18, marginBottom: 18 };
const muted = "#8b93a4";
const nf = (n: number) => n.toLocaleString();

function Delta({ now, prev }: { now: number; prev: number | undefined }) {
  if (prev === undefined) return <span style={{ color: "#5b6372", fontSize: 12 }}>—</span>;
  const d = now - prev;
  const color = d > 0 ? "#5ac88c" : d < 0 ? "#ff8a8a" : "#5b6372";
  return <span style={{ color, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{d > 0 ? `+${nf(d)}` : d < 0 ? nf(d) : "±0"}</span>;
}

// Tiny inline trend line from the daily snapshots. Y is normalized to the series'
// own min/max (shape, not scale); flat/short series render as a subtle baseline.
// It grows a point a day — with 2 snapshots it's a segment, in a month it's a curve.
function Sparkline({ points, width = 88, height = 26 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", opacity: 0.9 }} aria-hidden>
      <path d={d} fill="none" stroke="#7aa2ff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(points.length - 1) * step} cy={height - 2 - ((points[points.length - 1] - min) / span) * (height - 4)} r={2} fill="#7aa2ff" />
    </svg>
  );
}

function StatCard({ label, value, prev, sub, spark }: { label: string; value: number; prev?: number; sub?: string; spark?: number[] }) {
  return (
    <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: "14px 16px", minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: muted }}>{label}</span>
        {spark && spark.length >= 2 && <Sparkline points={spark} width={64} height={20} />}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{nf(value)}</span>
        <Delta now={value} prev={prev} />
      </div>
      {sub && <div style={{ fontSize: 11, color: "#5b6372", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const TIER_ROWS: { key: "npi" | "international" | "md_no_npi" | "other"; label: string; color: string }[] = [
  { key: "npi", label: "With NPI", color: "#5ac88c" },
  { key: "international", label: "International", color: "#7aa2ff" },
  { key: "md_no_npi", label: "MD/DO w/o NPI", color: "#e8c268" },
  { key: "other", label: "Other", color: "#8b93a4" },
];

// People composition: guests/hosts and X users are overlapping sets, not a sum.
// One segmented bar shows the union: podcast-only | both | X-only.
function CompositionStrip({ s, p }: { s: Stats; p: Stats | null }) {
  if (s.people.both === undefined) return null;
  const gh = s.people.guests_hosts_only ?? 0, both = s.people.both ?? 0, xo = s.people.x_only ?? 0;
  const total = gh + both + xo || 1;
  const segs = [
    { label: "Podcast only", v: gh, pv: p?.people.guests_hosts_only, color: "#7aa2ff" },
    { label: "Both (podcast + X)", v: both, pv: p?.people.both, color: "#5ac88c" },
    { label: "X only", v: xo, pv: p?.people.x_only, color: "#e8c268" },
  ];
  return (
    <div style={{ ...box }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 600 }}>Who our people are <span style={{ color: muted, fontWeight: 400, fontSize: 12 }}>— one pool, two ways in</span></div>
        <div style={{ fontSize: 12, color: muted }}>{nf(s.people.total)} people{s.people.neither ? ` · ${nf(s.people.neither)} unlinked` : ""}</div>
      </div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
        {segs.map((g) => <div key={g.label} style={{ width: `${(g.v / total) * 100}%`, background: g.color }} />)}
      </div>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        {segs.map((g) => (
          <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: g.color, display: "inline-block" }} />
            <span style={{ color: muted }}>{g.label}</span>
            <span style={{ color: "#fff", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{nf(g.v)}</span>
            <Delta now={g.v} prev={g.pv} />
          </div>
        ))}
      </div>
    </div>
  );
}

const AREA_LABEL: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Heme", Gyn: "Gynecologic",
};
const AREA_COLOR: Record<string, string> = {
  GU: "#7aa2ff", Breast: "#e88fc0", Lung: "#5ac8c8", GI: "#e8c268", Heme: "#c08fe8", Gyn: "#5ac88c",
};

// Per-Readout-area coverage. Bars share ONE scale (max episodes across areas) so
// relative depth is honest; areas overlap (multi-tagged episodes) so no total row.
function AreaPanel({ areas, prev }: { areas: NonNullable<Stats["areas"]>; prev?: Stats["areas"] }) {
  const maxEp = Math.max(...areas.map((a) => a.episodes), 1);
  return (
    <div style={{ ...box }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>Coverage by area <span style={{ color: muted, fontWeight: 400, fontSize: 12 }}>— episodes tagged to each Readout edition</span></div>
        <div style={{ fontSize: 11, color: "#5b6372" }}>areas overlap — rows don&rsquo;t sum</div>
      </div>
      <div style={{ display: "grid", gap: 9 }}>
        {areas.map((a) => {
          const pv = prev?.find((x) => x.area === a.area);
          const txPct = a.episodes ? Math.round((a.transcribed / a.episodes) * 100) : 0;
          return (
            <div key={a.area} style={{ display: "grid", gridTemplateColumns: "110px 1fr", columnGap: 12, rowGap: 3, alignItems: "center", fontSize: 13 }}>
              <div style={{ color: "#e9edf6" }}>{AREA_LABEL[a.area] ?? a.area}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "#e9edf6", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{nf(a.episodes)}</span>
                <span style={{ color: muted, fontSize: 11 }}>episodes</span>
                <Delta now={a.episodes} prev={pv?.episodes} />
                <span style={{ color: "#5b6372", fontSize: 11 }}>
                  · {nf(a.transcribed)} transcribed ({txPct}%) · {a.shows} shows · {a.x_sources} X sources
                </span>
              </div>
              <div style={{ gridColumn: "1 / -1", height: 5, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${(a.episodes / maxEp) * 100}%`, height: "100%", background: AREA_COLOR[a.area] ?? "#7aa2ff", opacity: 0.85 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One ranked amplification list (RT or QT flavor). Not-followed rows are
// follow-gaps — the discovery cron seeds them, the badge makes them visible.
function AmplifiedPanel({ title, sub, rows, count }: { title: string; sub: string; rows?: AmplifiedX[]; count: (r: AmplifiedX) => string }) {
  if (!rows || rows.length === 0) return null;
  return (
    <XPanel title={title} sub={sub}>
      {rows.map((r, i) => (
        <div key={r.handle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <XRow i={i} avatar={r.avatar_url} name={r.name} handle={r.handle}
              right={`${nf(r.amplifiers)} experts`}
              rightSub={`${count(r)}${r.followers ? ` · ${nf(r.followers)} fol.` : ""}`} />
          </div>
          {!r.in_panel && (
            <span style={{ background: "rgba(232,194,104,.15)", color: "#e8c268", border: "0.5px solid rgba(232,194,104,.4)", fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" }}>
              not followed
            </span>
          )}
        </div>
      ))}
    </XPanel>
  );
}

function XPanel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ ...box, flex: "1 1 380px", marginBottom: 0 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#5b6372", marginBottom: 10 }}>{sub}</div>}
      <div style={{ display: "grid", gap: 7 }}>{children}</div>
    </div>
  );
}

function XRow({ i, avatar, name, handle, right, rightSub }: { i: number; avatar: string | null; name: string; handle: string; right: string; rightSub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span style={{ width: 16, color: "#5b6372", fontSize: 11, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {avatar ? <img src={avatar} alt="" width={22} height={22} style={{ borderRadius: 11, flexShrink: 0 }} />
        : <span style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(255,255,255,.1)", flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: "#f4f7ff" }}>{name}</span>
        <span style={{ color: "#5b6372", fontSize: 11, marginLeft: 6 }}>@{handle}</span>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: "#f4f7ff", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{right}</div>
        {rightSub && <div style={{ color: "#5b6372", fontSize: 10.5 }}>{rightSub}</div>}
      </div>
    </div>
  );
}

function BreakdownCard({ title, now, prev, note, spark }: { title: string; now: Tier; prev?: Tier | null; note?: string; spark?: number[] }) {
  return (
    <div style={{ ...box, flex: "1 1 320px", marginBottom: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {spark && spark.length >= 2 && <Sparkline points={spark} />}
          <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{nf(now.total)}</span>
          <Delta now={now.total} prev={prev?.total} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {TIER_ROWS.map(({ key, label, color }) => {
          const v = now[key];
          const pct = now.total ? v / now.total : 0;
          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "104px 1fr", columnGap: 10, rowGap: 3, alignItems: "center", fontSize: 13 }}>
              <div style={{ color: "#e9edf6" }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#e9edf6", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{nf(v)}</span>
                <span style={{ color: muted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct * 100)}%</span>
                <span style={{ marginLeft: "auto" }}><Delta now={v} prev={prev?.[key]} /></span>
              </div>
              <div style={{ gridColumn: "1 / -1", height: 5, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct * 100}%`, height: "100%", background: color }} />
              </div>
              {key === "international" && now.intl_identified !== undefined && (
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: muted, paddingLeft: 12, whiteSpace: "nowrap", overflowX: "auto" }}>
                  <span>↳ identified</span>
                  <span style={{ color: "#e9edf6", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{nf(now.intl_identified)}</span>
                  <Delta now={now.intl_identified} prev={prev?.intl_identified} />
                  <span style={{ color: "#5b6372" }}>· MD cred {nf(now.intl_md_credential ?? 0)} · on X {nf(now.intl_x_linked ?? 0)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {note && <div style={{ fontSize: 11, color: "#5b6372", marginTop: 10 }}>{note}</div>}
    </div>
  );
}

export default function Dashboard({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/stats", { headers: adminKey ? { "x-admin-token": adminKey } : {} });
      setData(await r.json());
    } catch (e) {
      setData({ ok: false, error: String(e) });
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (!data) return <div style={{ color: muted, fontSize: 13 }}>Loading stats…</div>;
  if (!data.ok || !data.stats) return <div style={{ color: "#ff8a8a", fontSize: 13 }}>Failed to load stats: {data.error || "unknown error"}</div>;

  const s = data.stats;
  const p = data.prev ?? null;
  const txPct = s.corpus.episodes ? Math.round((s.corpus.episodes_transcribed / s.corpus.episodes) * 100) : 0;
  const h = data.history ?? [];
  const series = (pick: (pt: HistoryPoint) => number) => (h.length >= 2 ? h.map(pick) : undefined);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: muted }}>
          {data.prevDay
            ? <>Change vs <b style={{ color: "#e9edf6" }}>{data.prevDay}</b> (daily snapshot, 07:50 UTC)</>
            : "First snapshot captured today — day-over-day change appears tomorrow."}
        </div>
        <button
          style={{ background: "rgba(255,255,255,.14)", color: "#f4f7ff", fontWeight: 700, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14 }}
          onClick={load} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Composition: the two populations below OVERLAP — this is the union */}
      <CompositionStrip s={s} p={p} />

      {/* People coverage — the graph's identity spine */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <BreakdownCard title="Guests & Hosts" now={s.people.guests_hosts} prev={p?.people.guests_hosts} spark={series((pt) => pt.guests_hosts)}
          note={`${nf(s.people.guests)} guests · ${nf(s.people.hosts)} hosts (people with ≥1 podcast appearance)${s.people.both !== undefined ? ` · ${nf(s.people.both)} also on X` : ""}`} />
        <BreakdownCard title="X Users" now={s.people.x_users} prev={p?.people.x_users} spark={series((pt) => pt.x_users)}
          note={`People with a linked X account · ${nf(s.corpus.x_sources_active)} active X sources`} />
      </div>

      {/* Corpus + readout counters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="People (all)" value={s.people.total} prev={p?.people.total}
          sub={s.people.npi_verified !== undefined ? `NPI: ${nf(s.people.npi_verified)} verified · ${nf(s.people.npi_inferred ?? 0)} inferred` : undefined} />
        {s.people.voice_id && (
          <StatCard label="Voice ID'd" value={s.people.voice_id.total} prev={p?.people.voice_id?.total}
            sub={`${Math.round((s.people.voice_id.guests_hosts / (s.people.guests_hosts.total || 1)) * 100)}% of guests/hosts · ${s.people.voice_id.gold} gold · ${nf(s.people.voice_id.silver)} silver · ${nf(s.people.voice_id.provisional)} prov.`} />
        )}
        <StatCard label="Podcasts" value={s.corpus.shows} prev={p?.corpus.shows} />
        <StatCard label="Episodes" value={s.corpus.episodes} prev={p?.corpus.episodes} />
        <StatCard label="Transcribed" value={s.corpus.episodes_transcribed} prev={p?.corpus.episodes_transcribed}
          spark={series((pt) => pt.episodes_transcribed)}
          sub={s.corpus.audio_hours_transcribed !== undefined
            ? `${txPct}% of episodes · ${nf(s.corpus.audio_hours_transcribed)} of ${nf(s.corpus.audio_hours_total ?? 0)} hrs of audio`
            : `${txPct}% of episodes`} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Transcript chunks" value={s.corpus.transcript_chunks} prev={p?.corpus.transcript_chunks}
          sub={s.corpus.chunks_unembedded ? `⚠ ${nf(s.corpus.chunks_unembedded)} unembedded` : "all embedded"} />
        <StatCard label="Appearances" value={s.corpus.appearances} prev={p?.corpus.appearances} />
        <StatCard label="X posts" value={s.corpus.x_posts} prev={p?.corpus.x_posts} spark={series((pt) => pt.x_posts)} />
        <StatCard label="Brief contacts" value={s.readout.contacts_active} prev={p?.readout.contacts_active} sub={`${nf(s.readout.contacts_total)} total`} />
      </div>

      {/* Per-area coverage — mirrors the Readout's own tumor_categories bucketing */}
      {s.areas && s.areas.length > 0 && <AreaPanel areas={s.areas} prev={p?.areas} />}

      {/* Rolling 7-day intake — rendered without delta chips (a day-over-day delta
          on a rolling window reads as noise, not signal) */}
      {s.velocity && (
        <>
          <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: muted, margin: "4px 0 8px" }}>
            Intake · last 7 days <span style={{ textTransform: "none", letterSpacing: 0 }}>— rows added to the graph (includes backfills)</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <StatCard label="New episodes" value={s.velocity.new_episodes_7d} />
            <StatCard label="New X posts" value={s.velocity.new_posts_7d} />
            <StatCard label="New people" value={s.velocity.new_people_7d} />
            <StatCard label="New appearances" value={s.velocity.new_appearances_7d} />
          </div>
        </>
      )}

      {/* X panels: who's rising (followers) + who's talking (post volume) */}
      {(data.trending?.length || data.activity?.length || data.topRetweeted?.length || data.topQuoted?.length) ? (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          {data.trending && data.trending.length > 0 && (
            <XPanel title="Rising on X"
              sub={data.trending.some((r) => r.delta_7d !== null)
                ? "Ranked by 7-day follower growth (weekly snapshots)"
                : "Ranked by followers — growth deltas start once two weekly snapshots exist (first: Jul 26)"}>
              {data.trending.map((r, i) => (
                <XRow key={r.handle} i={i} avatar={r.avatar_url} name={r.name} handle={r.handle}
                  right={r.delta_7d !== null ? `+${nf(r.delta_7d)} wk` : nf(r.followers ?? 0)}
                  rightSub={r.delta_7d !== null ? `${nf(r.followers ?? 0)} followers` : "followers"} />
              ))}
            </XPanel>
          )}
          {data.activity && data.activity.length > 0 && (
            <XPanel title="Most active on X" sub="Posts published in the last 7 days">
              {data.activity.map((r, i) => (
                <XRow key={r.handle} i={i} avatar={r.avatar_url} name={r.name} handle={r.handle}
                  right={`${nf(r.posts_7d)} posts`}
                  rightSub={r.follower_count ? `${nf(r.follower_count)} followers` : r.source_type ?? undefined} />
              ))}
            </XPanel>
          )}
          <AmplifiedPanel title="Top retweeted by the panel" rows={data.topRetweeted}
            sub="Accounts our panel RETWEETED most, last 30 days — ranked by distinct retweeters. Pure amplification."
            count={(r) => `${nf(r.rts)} RTs`} />
          <AmplifiedPanel title="Top quote-tweeted by the panel" rows={data.topQuoted}
            sub="Accounts our panel QUOTED most, last 30 days — ranked by distinct quoters. Commentary engagement."
            count={(r) => `${nf(r.quotes)} QTs`} />
        </div>
      ) : null}

      <div style={{ fontSize: 11, color: "#5b6372" }}>
        Tiers: <b>With NPI</b> = verified/inferred NPI on file · <b>International</b> = likely non-US, no NPI ·
        {" "}<b>MD/DO w/o NPI</b> = MD/DO/MBBS credential, no NPI, not international · <b>Other</b> = everyone else (PhD-only, no credential, …).
        {" "}International <b>identified</b> = clinician with a known affiliation (no NPI registry exists for non-US physicians).
      </div>
    </div>
  );
}
