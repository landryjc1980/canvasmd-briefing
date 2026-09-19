"use client";

import Link from "next/link";
import type { ConferenceMeeting } from "@/lib/conference";
import { conferenceDateRange, conferenceHref, conferenceStatusLabel, selectConferenceTeasers } from "@/lib/conference";
import type { EditionArea } from "./edition";

export default function ConferenceTeaser({ meetings, area }: { meetings: ConferenceMeeting[]; area: EditionArea }) {
  const promotedMeetings = selectConferenceTeasers(meetings, area);
  if (promotedMeetings.length === 0) return null;

  return (
    <aside className="er-conference-teaser" aria-label="Conference coverage">
      <div className="er-conference-teaser-heading">
        <h3>Conferences</h3>
        <Link className="er-conference-directory-link" href="/conferences">All conferences <span aria-hidden="true">→</span></Link>
      </div>
      <div className="er-conference-rows">
        {promotedMeetings.map((meeting) => <Link className="er-conference-link" href={conferenceHref(meeting)} key={`${meeting.key}-${meeting.year ?? "latest"}`}>
          <span className="er-conference-row-copy">
            <span className="er-conference-row-title"><span className={conferenceStatusLabel(meeting) === "Live coverage" ? "er-conference-live-dot" : undefined} aria-hidden="true" />{meeting.shortName}<span className="er-conference-row-status">{conferenceStatusLabel(meeting) === "Live coverage" ? "Live" : conferenceStatusLabel(meeting)}</span></span>
            <span className="er-conference-row-meta">{conferenceDateRange(meeting)}{meeting.location ? ` · ${meeting.location}` : ""}</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>)}
      </div>
    </aside>
  );
}
