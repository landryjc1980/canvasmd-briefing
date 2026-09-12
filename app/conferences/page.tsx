import type { Metadata } from "next";
import Link from "next/link";
import { conferenceDateRange, conferenceDirectorySections, conferenceHref, conferenceStatusLabel, type ConferenceMeeting } from "@/lib/conference";
import { getCachedConferenceList } from "@/lib/conferenceServer";
import "../briefing-preview/preview.css";
import "./conferences.css";

export const metadata: Metadata = {
  title: "Conference coverage · The Readout",
  description: "Current and past oncology meeting coverage from The Readout.",
};

export const dynamic = "force-dynamic";

function MeetingRow({ meeting }: { meeting: ConferenceMeeting }) {
  const specialties = (Array.isArray(meeting.tumorFocus) ? meeting.tumorFocus : meeting.tumorFocus ? [meeting.tumorFocus] : []).filter(Boolean);
  return <Link className="conference-directory-row" href={conferenceHref(meeting)}>
    <span className="conference-directory-row-copy">
      <span className="conference-directory-row-title">{meeting.shortName}</span>
      <span className="conference-directory-row-name">{meeting.name}</span>
      {specialties.length > 0 && <span className="conference-directory-row-specialty">{specialties.join(" · ")}</span>}
      <span className="conference-directory-row-meta">{conferenceStatusLabel(meeting)} · {conferenceDateRange(meeting)}{meeting.location ? ` · ${meeting.location}` : ""}</span>
    </span>
    <span aria-hidden="true">→</span>
  </Link>;
}

function MeetingSection({ title, meetings, empty }: { title: string; meetings: ConferenceMeeting[]; empty: string }) {
  return <section className="conference-directory-section" aria-labelledby={`conference-${title.toLowerCase().replace(/\s+/g, "-")}`}>
    <h2 id={`conference-${title.toLowerCase().replace(/\s+/g, "-")}`}>{title}</h2>
    {meetings.length > 0 ? <div className="conference-directory-list">{meetings.map((meeting) => <MeetingRow meeting={meeting} key={`${meeting.key}-${meeting.year ?? "latest"}`} />)}</div> : <p className="conference-directory-empty">{empty}</p>}
  </section>;
}

export default async function ConferencesPage() {
  let meetings: ConferenceMeeting[];
  try {
    meetings = await getCachedConferenceList();
  } catch {
    return <main className="conference-directory-page">
      <header className="conference-directory-masthead">
        <Link href="/" className="conference-directory-brand">Canvas<span>MD</span></Link>
        <Link href="/" className="conference-directory-back">The Readout</Link>
      </header>
      <section className="conference-directory-hero">
        <p className="conference-directory-eyebrow">Conference coverage</p>
        <h1>Couldn’t load the conference calendar.</h1>
        <p>Try again to load current and past meeting coverage.</p>
        <Link className="conference-directory-retry" href="/conferences">Try again</Link>
      </section>
    </main>;
  }
  const sections = conferenceDirectorySections(meetings);
  return <main className="conference-directory-page">
    <header className="conference-directory-masthead">
      <Link href="/" className="conference-directory-brand">Canvas<span>MD</span></Link>
      <Link href="/" className="conference-directory-back">The Readout</Link>
    </header>
    <section className="conference-directory-hero">
      <p className="conference-directory-eyebrow">Conference coverage</p>
      <h1>Meetings, all in one place.</h1>
      <p>Follow live oncology meetings and return to recent coverage when the meeting ends.</p>
    </section>
    <MeetingSection title="Live now" meetings={sections.live} empty="No meetings are live right now." />
    <MeetingSection title="Upcoming" meetings={sections.upcoming} empty="No upcoming meetings are listed yet." />
    <MeetingSection title="Past coverage" meetings={sections.past} empty="Past meeting coverage will appear here." />
  </main>;
}
