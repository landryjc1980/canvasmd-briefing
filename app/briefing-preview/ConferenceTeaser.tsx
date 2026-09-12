"use client";

import Link from "next/link";
import type { ConferenceMeeting } from "@/lib/conference";
import { conferenceDateRange, conferenceHref, conferenceStatusLabel, selectConferenceTeasers } from "@/lib/conference";
import type { EditionArea } from "./edition";

export default function ConferenceTeaser({ meetings, area }: { meetings: ConferenceMeeting[]; area: EditionArea }) {
  const promotedMeetings = selectConferenceTeasers(meetings, area);
  return (
    <aside className="er-conference-teaser" aria-label="Conference coverage">
      <div className="er-conference-teaser-heading">
        <h3>Conference coverage</h3>
        <Link className="er-conference-directory-link" href="/conferences">All conferences <span aria-hidden="true">→</span></Link>
      </div>
      {promotedMeetings.length > 0 ? <div className="er-conference-rows">
        {promotedMeetings.map((meeting) => <Link className="er-conference-link" href={conferenceHref(meeting)} key={`${meeting.key}-${meeting.year ?? "latest"}`}>
          <span className="er-conference-row-copy">
            <span className="er-conference-row-title"><span className={conferenceStatusLabel(meeting) === "Live coverage" ? "er-conference-live-dot" : undefined} aria-hidden="true" />{meeting.shortName}</span>
            <span className="er-conference-row-meta">{conferenceStatusLabel(meeting)} · {conferenceDateRange(meeting)}{meeting.location ? ` · ${meeting.location}` : ""}</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>)}
      </div> : <p className="er-conference-empty-note">Browse current and past meeting coverage.</p>}
    </aside>
  );
}
