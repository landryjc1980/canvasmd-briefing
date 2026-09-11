"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ConferenceClinicianShare, ConferenceWindowPayload } from "@/lib/conference";
import { conferenceDateRange, conferenceStatusLabel, publicationDateLabel, reportLabel } from "@/lib/conference";

type CoverageItem = { id: string; episodeId: string | null; label: string; title: string; url: string | null; source: string | null; excerpt: string | null; publishedAt: string | null; clinicianShares: ConferenceClinicianShare[] };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function externalUrl(value: unknown): string | null {
  const url = text(value);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function canonicalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || ["fbclid", "gclid", "ref", "source"].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}

function clinicianShares(value: unknown): ConferenceClinicianShare[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const share = item as Record<string, unknown>;
    const personId = text(share.personId);
    const name = text(share.name);
    const handle = text(share.handle) ?? "";
    const postUrl = externalUrl(share.postUrl);
    const kind = share.kind;
    if (!personId || !name || !postUrl || (kind !== "share" && kind !== "repost" && kind !== "quote")) return [];
    return [{
      personId,
      name,
      handle,
      avatarUrl: externalUrl(share.avatarUrl),
      kind,
      postUrl,
      postedAt: text(share.postedAt) ?? "",
    }];
  });
}

function coverageItem(value: unknown, section: "cards" | "articles" | "episodes" | "reports", index: number): CoverageItem | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const title = text(source.headline) ?? text(source.title) ?? text(source.episodeTitle);
  if (!title) return null;
  const label = section === "reports"
    ? reportLabel({ title, sourceName: text(source.sourceName) ?? "" })
    : section === "episodes" || source.kind === "episode" ? "Podcast episode"
      : section === "articles" ? "Source article"
        : source.kind === "event" ? "Meeting update" : "Source update";
  return {
    id: text(source.id) ?? `${section}-${index}-${title}`,
    episodeId: text(source.episodeId) ?? (source.kind === "episode" ? text(source.anchorId) : null),
    label,
    title,
    url: externalUrl(source.url) ?? externalUrl(source.sourceUrl),
    source: text(source.sourceName) ?? text(source.sourceLabel) ?? text(source.show) ?? text(source.journal) ?? text(source.domain),
    // The compact page links to primary papers rather than reproducing full abstracts.
    excerpt: text(source.excerpt) ?? text(source.description),
    publishedAt: text(source.pubDate) ?? text(source.published) ?? text(source.publishedAt) ?? text(source.occurredOn),
    clinicianShares: section === "reports" ? clinicianShares(source.clinicianShares) : [],
  };
}

function dedupeCoverage(items: CoverageItem[], existingUrls = new Set<string>(), existingEpisodes = new Set<string>()): CoverageItem[] {
  const seenUrls = new Set(existingUrls);
  const seenEpisodes = new Set(existingEpisodes);
  const seenIds = new Set<string>();
  return items.filter((item) => {
    const url = canonicalUrl(item.url);
    if (url && seenUrls.has(url)) return false;
    if (item.episodeId && seenEpisodes.has(item.episodeId)) return false;
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    if (url) seenUrls.add(url);
    if (item.episodeId) seenEpisodes.add(item.episodeId);
    return true;
  });
}

function clinicianAction(kind: ConferenceClinicianShare["kind"]): string {
  if (kind === "repost") return "Reposted by";
  if (kind === "quote") return "Quote-posted by";
  return "Shared by";
}

function ClinicianReceipt({ share }: { share: ConferenceClinicianShare }) {
  const handle = share.handle.replace(/^@/, "");
  return <a className="conference-clinician-receipt" href={share.postUrl} target="_blank" rel="noreferrer" aria-label={`Open X receipt: ${clinicianAction(share.kind)} ${share.name}`}>
    {share.avatarUrl ? <img className="conference-clinician-avatar" src={share.avatarUrl} alt="" loading="lazy" decoding="async" /> : <span className="conference-clinician-avatar conference-clinician-avatar-fallback" aria-hidden="true">{share.name.slice(0, 1).toUpperCase()}</span>}
    <span className="conference-clinician-copy"><span className="conference-clinician-action">{clinicianAction(share.kind)}</span><span className="conference-clinician-name">{share.name}{handle ? ` · @${handle}` : ""}</span></span>
    <span className="conference-clinician-external" aria-hidden="true">↗</span>
  </a>;
}

function ClinicianReceipts({ shares }: { shares: ConferenceClinicianShare[] }) {
  if (!shares.length) return null;
  const firstShares = shares.slice(0, 3);
  const remainingShares = shares.slice(3);
  return <div className="conference-clinician-receipts" aria-label="Clinician X receipts">
    {firstShares.map((share) => <ClinicianReceipt key={`${share.personId}:${share.postUrl}`} share={share} />)}
    {remainingShares.length > 0 && <details className="conference-clinician-more">
      <summary>Show {remainingShares.length} more clinicians</summary>
      <div>{remainingShares.map((share) => <ClinicianReceipt key={`${share.personId}:${share.postUrl}`} share={share} />)}</div>
    </details>}
  </div>;
}

function CoverageCard({ item }: { item: CoverageItem }) {
  const published = publicationDateLabel(item.publishedAt);
  return (
    <article className="conference-report-card">
      <p className="conference-report-type">{item.label}</p>
      <h2>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title}<span aria-hidden="true"> ↗</span></a> : item.title}</h2>
      {(item.source || published) && <p className="conference-report-source">{item.source}{item.source && published ? <> <span aria-hidden="true">·</span> </> : null}{published ? <time dateTime={item.publishedAt ?? undefined}>{published}</time> : null}</p>}
      {item.excerpt && <p className="conference-report-excerpt">{item.excerpt}</p>}
      <ClinicianReceipts shares={item.clinicianShares} />
      {item.url && <a className="conference-source-link" href={item.url} target="_blank" rel="noreferrer">Read source</a>}
    </article>
  );
}

function CoverageSection({ title, eyebrow, items }: { title: string; eyebrow: string; items: CoverageItem[] }) {
  if (!items.length) return null;
  return <section className="conference-reports" aria-label={title}>
    <div className="conference-section-heading"><div><p className="conference-eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{items.length} {items.length === 1 ? "item" : "items"}</span></div>
    <div className="conference-report-list">{items.map((item) => <CoverageCard item={item} key={item.id} />)}</div>
  </section>;
}

export default function ConferenceCoverage({ payload, requestedKey }: { payload: ConferenceWindowPayload | null; requestedKey: string }) {
  const router = useRouter();
  const retry = () => router.refresh();
  const meeting = payload?.meeting;
  const cards = dedupeCoverage((payload?.coverage.cards ?? []).map((item, index) => coverageItem(item, "cards", index)).filter((item): item is CoverageItem => !!item));
  const cardUrls = new Set(cards.map((item) => canonicalUrl(item.url)).filter((url): url is string => !!url));
  const cardEpisodeIds = new Set(cards.map((item) => item.episodeId).filter((id): id is string => !!id));
  const articles = dedupeCoverage((payload?.coverage.articles ?? []).map((item, index) => coverageItem(item, "articles", index)).filter((item): item is CoverageItem => !!item), cardUrls);
  const articleUrls = new Set([...cardUrls, ...articles.map((item) => canonicalUrl(item.url)).filter((url): url is string => !!url)]);
  const reports = dedupeCoverage((payload?.coverage.reports ?? []).map((item, index) => coverageItem(item, "reports", index)).filter((item): item is CoverageItem => !!item), articleUrls);
  const episodes = dedupeCoverage((payload?.coverage.episodes ?? []).map((item, index) => coverageItem(item, "episodes", index)).filter((item): item is CoverageItem => !!item), new Set(), cardEpisodeIds);
  const hasCoverage = reports.length + cards.length + articles.length + episodes.length > 0;

  if (!meeting) {
    return (
      <main className="conference-page">
        <header className="conference-masthead"><Link href="/" className="conference-brand">Canvas<span>MD</span></Link></header>
        <section className="conference-empty" aria-live="polite">
          <p className="conference-eyebrow">Conference coverage</p>
          <h1>That conference is not available.</h1>
          <p>Coverage may still be preparing, or this link may refer to an older edition.</p>
          <div className="conference-actions"><Link href="/">Back to The Readout</Link><button type="button" onClick={retry}>Try again</button></div>
        </section>
      </main>
    );
  }

  return (
    <main className="conference-page">
      <header className="conference-masthead">
        <Link href="/" className="conference-brand">Canvas<span>MD</span></Link>
        <Link href="/" className="conference-back">← The Readout</Link>
      </header>
      <section className="conference-hero">
        <p className="conference-eyebrow">{conferenceStatusLabel(meeting)}</p>
        <h1>{meeting.shortName}</h1>
        <p className="conference-name">{meeting.name}</p>
        <p className="conference-meta">{conferenceDateRange(meeting)}{meeting.location ? ` · ${meeting.location}` : ""}</p>
        {meeting.sourceUrl && <a className="conference-official-link" href={meeting.sourceUrl} target="_blank" rel="noreferrer">Official meeting site <span aria-hidden="true">↗</span></a>}
      </section>
      {(reports.length > 0 || !hasCoverage) && <section className="conference-reports" aria-labelledby="conference-reports-title">
        <div className="conference-section-heading">
          <div><p className="conference-eyebrow">From the meeting</p><h2 id="conference-reports-title">Source coverage</h2></div>
          {reports.length > 0 && <span>{reports.length} {reports.length === 1 ? "report" : "reports"}</span>}
        </div>
        {reports.length > 0 ? <div className="conference-report-list">{reports.map((item) => <CoverageCard item={item} key={item.id} />)}</div> : !hasCoverage && (
          <div className="conference-empty conference-empty-inline">
            <p>No source reports have been published here yet. Please check back as coverage is added.</p>
            <button type="button" onClick={retry}>Refresh coverage</button>
          </div>
        )}
      </section>}
      <CoverageSection eyebrow="Meeting updates" title="Coverage" items={cards} />
      <CoverageSection eyebrow="Source reading" title="Articles" items={articles} />
      <CoverageSection eyebrow="From the meeting" title="Episodes" items={episodes} />
      <footer className="conference-footer"><Link href="/">Back to The Readout</Link>{requestedKey !== meeting.key && <span>Showing {meeting.shortName} coverage.</span>}</footer>
    </main>
  );
}
