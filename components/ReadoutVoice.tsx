"use client";

import { useState } from "react";
import { articleTextPreview } from "@/lib/readoutPresentation";
import { availableThreadParts, type ThreadPart } from "@/app/briefing-preview/threadParts";

export type ReadoutVoicePost = {
  name: string;
  avatar: string | null;
  tweetUrl: string | null;
  text: string | null;
  thread?: ThreadPart[];
  // A reply under a post about the paper: whom it answered (a journal account or a clinician).
  replyTo?: { handle: string | null; name: string | null } | null;
};

function replyTargetLabel(replyTo: ReadoutVoicePost["replyTo"]): string | null {
  if (!replyTo) return null;
  const name = replyTo.name?.trim();
  const handle = replyTo.handle?.replace(/^@/, "").trim();
  return name || (handle ? `@${handle}` : null);
}

function initials(name: string): string {
  const cleaned = name.replace(/,?\s+(?:MD|PhD|DO)\b.*$/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/** The shared Readout authored-comment receipt, including evidence-provided threads. */
export default function ReadoutVoice({
  post,
  extra = false,
  expanded = false,
  cleanText,
}: {
  post: ReadoutVoicePost;
  extra?: boolean;
  expanded?: boolean;
  cleanText: (value: string | null | undefined) => string;
}) {
  const [threadOpen, setThreadOpen] = useState(false);
  const thread = availableThreadParts(post.thread, post.tweetUrl, cleanText);
  const availableThreadCount = thread.length + 1;
  return (
    <div className={`er-voice ${extra ? "er-voice-more" : ""}`}>
      <div className="er-who" aria-hidden="true">
        {post.avatar
          ? <img src={post.avatar} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          : <span className="er-av">{initials(post.name)}</span>}
      </div>
      <div className="er-voice-body">
        {replyTargetLabel(post.replyTo) && <p className="er-reply-to">Replying to {replyTargetLabel(post.replyTo)}</p>}
        <p className="er-quote"><b className="er-quote-name">{post.name}</b> · {expanded || threadOpen ? post.text : articleTextPreview(post.text ?? "", 220)}</p>
      {threadOpen && thread.map((part, index) => (
        <div className="er-thread-part" key={part.id || `thread:${index}`}>
          <p>{part.text}</p>
          {part.tweetUrl && <a className="er-thread-source" href={part.tweetUrl} target="_blank" rel="noreferrer">View on X</a>}
        </div>
      ))}
      {thread.length > 0 && (
        <button type="button" className="er-thread-toggle" aria-expanded={threadOpen} onClick={() => setThreadOpen((open) => !open)}>
          {threadOpen ? "Show less" : `Expand thread · ${availableThreadCount} posts`}
        </button>
      )}
      {post.tweetUrl && <a className="er-xlink" href={post.tweetUrl} target="_blank" rel="noreferrer">View on X</a>}
      </div>
    </div>
  );
}
