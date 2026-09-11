export type ConferenceMeeting = {
  key: string;
  name: string;
  shortName: string;
  society: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  tumorFocus: string | string[] | null;
  sourceUrl: string | null;
  year?: number;
};

export type ConferenceReport = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  excerpt: string | null;
  publishedAt: string | null;
  sharedAt: string;
  clinicianShares?: ConferenceClinicianShare[];
  publisherComments?: ConferencePublisherComment[];
};

export type ConferenceClinicianShare = {
  personId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  kind: "share" | "repost" | "quote";
  postUrl: string;
  postedAt: string;
};

/** An original publisher, newsroom, or organization X post tied to this exact report. */
export type ConferencePublisherComment = {
  sourceId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  text: string;
  postUrl: string;
  postedAt: string;
};

function publisherCommentText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function publisherCommentExternalUrl(value: unknown): string | null {
  const url = publisherCommentText(value);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function publisherCommentReceipt(value: unknown, handle: string): string | null {
  const raw = publisherCommentText(value);
  if (!raw || !handle) return null;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.split("/").filter(Boolean);
    const expectedHandle = handle.replace(/^@/, "").toLowerCase();
    if (url.protocol !== "https:" || !["x.com", "twitter.com"].includes(hostname) || path.length !== 3 || path[1] !== "status" || !/^\d+$/.test(path[2]) || path[0].toLowerCase() !== expectedHandle) return null;
    return url.toString();
  } catch { return null; }
}

/** Fails closed: a publisher caption must retain its source receipt and authored text. */
export function parseConferencePublisherComments(value: unknown): ConferencePublisherComment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const comment = item as Record<string, unknown>;
    const sourceId = publisherCommentText(comment.sourceId);
    const name = publisherCommentText(comment.name);
    const handle = publisherCommentText(comment.handle);
    const text = publisherCommentText(comment.text);
    const postUrl = publisherCommentReceipt(comment.postUrl, handle ?? "");
    const postedAt = publisherCommentText(comment.postedAt);
    if (!sourceId || !name || !handle || !text || !postUrl || !postedAt || !Number.isFinite(Date.parse(postedAt)) || seen.has(postUrl)) return [];
    seen.add(postUrl);
    return [{
      sourceId,
      name,
      handle,
      avatarUrl: publisherCommentExternalUrl(comment.avatarUrl),
      text,
      postUrl,
      postedAt,
    }];
  });
}

export type ConferenceWindowPayload = {
  meeting: ConferenceMeeting | null;
  generatedAt: string;
  coverage: {
    cards: unknown[];
    articles: unknown[];
    episodes: unknown[];
    reports?: ConferenceReport[];
  };
};

export type ConferencePhase = "upcoming" | "live" | "recent" | "past";

const DAY_MS = 86_400_000;

function dateAtNoon(value: string): number | null {
  const parsed = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function easternDayAtNoon(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), 12);
}

/** Date-only conference windows are intentionally evaluated at whole-day precision. */
export function conferencePhase(meeting: ConferenceMeeting, now = new Date()): ConferencePhase {
  const today = easternDayAtNoon(now);
  const start = dateAtNoon(meeting.startDate);
  const end = dateAtNoon(meeting.endDate);
  if (start === null || end === null) return "past";
  if (today < start - 2 * DAY_MS) return "upcoming";
  if (today <= end) return today < start ? "upcoming" : "live";
  if (today <= end + 7 * DAY_MS) return "recent";
  return "past";
}

/** Home promotion begins two calendar days before opening and ends seven after close. */
export function conferenceIsEligible(meeting: ConferenceMeeting, now = new Date()): boolean {
  const start = dateAtNoon(meeting.startDate);
  const end = dateAtNoon(meeting.endDate);
  const today = easternDayAtNoon(now);
  return start !== null && end !== null && today >= start - 2 * DAY_MS && today <= end + 7 * DAY_MS;
}

export function conferenceHref(meeting: Pick<ConferenceMeeting, "key" | "year">): string {
  const year = Number.isInteger(meeting.year) && meeting.year! >= 2000 && meeting.year! <= 2100 ? `?year=${meeting.year}` : "";
  return `/conference/${encodeURIComponent(meeting.key)}${year}`;
}

function appliesToArea(meeting: ConferenceMeeting, area: string): boolean {
  if (area === "All") return true;
  const focus = Array.isArray(meeting.tumorFocus) ? meeting.tumorFocus : meeting.tumorFocus ? [meeting.tumorFocus] : [];
  return focus.some((value) => /^(general|all oncology)$/i.test(value) || value.localeCompare(area, undefined, { sensitivity: "accent" }) === 0);
}

/** A live meeting outranks a near-term meeting; past-recent coverage remains useful after close. */
export function selectConference(meetings: ConferenceMeeting[], area: string, now = new Date()): ConferenceMeeting | null {
  const ranked = meetings
    .filter((meeting) => appliesToArea(meeting, area))
    .filter((meeting) => conferenceIsEligible(meeting, now))
    .map((meeting) => ({ meeting, phase: conferencePhase(meeting, now) }))
    .filter(({ phase }) => phase !== "past")
    .sort((left, right) => {
      const rank: Record<ConferencePhase, number> = { live: 0, upcoming: 1, recent: 2, past: 3 };
      const phaseOrder = rank[left.phase] - rank[right.phase];
      if (phaseOrder) return phaseOrder;
      if (left.phase === "recent") return right.meeting.endDate.localeCompare(left.meeting.endDate);
      return left.meeting.startDate.localeCompare(right.meeting.startDate);
    });
  return ranked[0]?.meeting ?? null;
}

export function conferenceDateRange(meeting: Pick<ConferenceMeeting, "startDate" | "endDate">): string {
  const start = new Date(`${meeting.startDate}T12:00:00Z`);
  const end = new Date(`${meeting.endDate}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "Dates to be announced";
  const startMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(start);
  const endMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(end);
  const year = end.getUTCFullYear();
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${startMonth} ${start.getUTCDate()}–${end.getUTCDate()}, ${year}`
    : `${startMonth} ${start.getUTCDate()}–${endMonth} ${end.getUTCDate()}, ${year}`;
}

export function conferenceStatusLabel(meeting: ConferenceMeeting, now = new Date()): string {
  const phase = conferencePhase(meeting, now);
  if (phase === "live") return "Live coverage";
  if (phase === "upcoming") return "Starts soon";
  if (phase === "recent") return "Recent coverage";
  return "Conference coverage";
}

export function publicationDateLabel(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function reportLabel(report: Pick<ConferenceReport, "title" | "sourceName">): "Interview" | "Source report" {
  return /\binterview\b/i.test(`${report.title} ${report.sourceName}`) ? "Interview" : "Source report";
}
