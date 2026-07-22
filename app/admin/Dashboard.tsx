"use client";

// Database-stats dashboard (admin "Dashboard" tab). Renders /api/admin/stats:
// people coverage (guests/hosts + X users, broken down by identity tier) and
// corpus counts, each with a day-over-day delta from admin_stats_daily.
// Deliberately generic (StatCard / BreakdownCard) so new stats slot in cheaply.

import { useEffect, useState } from "react";

type Tier = { total: number; npi: number; international: number; md_no_npi: number; other: number };
type Stats = {
  captured_at: string;
  people: { total: number; hosts: number; guests: number; guests_hosts: Tier; x_users: Tier };
  corpus: {
    shows: number; episodes: number; episodes_transcribed: number; transcript_chunks: number;
    chunks_unembedded: number; appearances: number; x_sources_active: number; x_posts: number;
  };
  readout: { contacts_total: number; contacts_active: number };
};
type Payload = { ok: boolean; stats?: Stats; prev?: Stats | null; prevDay?: string | null; error?: string };

const box: React.CSSProperties = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: 18, marginBottom: 18 };
const muted = "#8b93a4";
const nf = (n: number) => n.toLocaleString();

function Delta({ now, prev }: { now: number; prev: number | undefined }) {
  if (prev === undefined) return <span style={{ color: "#5b6372", fontSize: 12 }}>—</span>;
  const d = now - prev;
  const color = d > 0 ? "#5ac88c" : d < 0 ? "#ff8a8a" : "#5b6372";
  return <span style={{ color, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{d > 0 ? `+${nf(d)}` : d < 0 ? nf(d) : "±0"}</span>;
}

function StatCard({ label, value, prev, sub }: { label: string; value: number; prev?: number; sub?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: "14px 16px", minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{nf(value)}</span>
        <Delta now={value} prev={prev} />
      </div>
      {sub && <div style={{ fontSize: 11, color: "#5b6372", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const TIER_ROWS: { key: keyof Tier; label: string; color: string }[] = [
  { key: "npi", label: "With NPI", color: "#5ac88c" },
  { key: "international", label: "International", color: "#7aa2ff" },
  { key: "md_no_npi", label: "MD/DO w/o NPI", color: "#e8c268" },
  { key: "other", label: "Other", color: "#8b93a4" },
];

function BreakdownCard({ title, now, prev, note }: { title: string; now: Tier; prev?: Tier | null; note?: string }) {
  return (
    <div style={{ ...box, flex: "1 1 320px", marginBottom: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
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

      {/* People coverage — the graph's identity spine */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <BreakdownCard title="Guests & Hosts" now={s.people.guests_hosts} prev={p?.people.guests_hosts}
          note={`${nf(s.people.guests)} guests · ${nf(s.people.hosts)} hosts (people with ≥1 podcast appearance)`} />
        <BreakdownCard title="X Users" now={s.people.x_users} prev={p?.people.x_users}
          note={`People with a linked X account · ${nf(s.corpus.x_sources_active)} active X sources`} />
      </div>

      {/* Corpus + readout counters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="People (all)" value={s.people.total} prev={p?.people.total} />
        <StatCard label="Podcasts" value={s.corpus.shows} prev={p?.corpus.shows} />
        <StatCard label="Episodes" value={s.corpus.episodes} prev={p?.corpus.episodes} />
        <StatCard label="Transcribed" value={s.corpus.episodes_transcribed} prev={p?.corpus.episodes_transcribed} sub={`${txPct}% of episodes`} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Transcript chunks" value={s.corpus.transcript_chunks} prev={p?.corpus.transcript_chunks}
          sub={s.corpus.chunks_unembedded ? `⚠ ${nf(s.corpus.chunks_unembedded)} unembedded` : "all embedded"} />
        <StatCard label="Appearances" value={s.corpus.appearances} prev={p?.corpus.appearances} />
        <StatCard label="X posts" value={s.corpus.x_posts} prev={p?.corpus.x_posts} />
        <StatCard label="Brief contacts" value={s.readout.contacts_active} prev={p?.readout.contacts_active} sub={`${nf(s.readout.contacts_total)} total`} />
      </div>

      <div style={{ fontSize: 11, color: "#5b6372" }}>
        Tiers: <b>With NPI</b> = verified/inferred NPI on file · <b>International</b> = likely non-US, no NPI ·
        {" "}<b>MD/DO w/o NPI</b> = MD/DO/MBBS credential, no NPI, not international · <b>Other</b> = everyone else (PhD-only, no credential, …).
      </div>
    </div>
  );
}
