"use client";

import { useState } from "react";
import type { DailyConversationStory } from "@/lib/types";
import { partitionDailyReactions } from "./dailyEvidence";
import { cleanTweetText } from "./briefVM";

function ReactionCard({ reaction, lead, accent, ink, muted, line }: {
  reaction: DailyConversationStory["reactions"][number];
  lead: boolean;
  accent: string;
  ink: string;
  muted: string;
  line: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const completeText = cleanTweetText(reaction.fullText?.trim() || reaction.text);
  const knownTruncated = !reaction.fullText?.trim() && (reaction.textTruncated === true || /…\s*$/.test(reaction.text));
  const previewLimit = 360;
  const canExpand = completeText.length > previewLimit;
  const preview = canExpand && !expanded
    ? `${completeText.slice(0, previewLimit).replace(/\s+\S*$/, "").trimEnd()}…`
    : completeText;
  const action = knownTruncated ? "Show longer excerpt" : "Show full post";

  return (
    <blockquote style={{ margin: lead ? "7px 0 0" : 0, padding: lead ? "7px 0 7px 10px" : "9px 0", border: 0, borderLeft: lead ? `2px solid ${accent}` : 0, borderTop: lead ? 0 : `1px solid ${line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <a href={reaction.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-10px 0", color: ink, textDecoration: "none", font: "650 12px system-ui" }}>{reaction.name}</a>
        <span style={{ color: muted, font: "500 10.5px system-ui" }}>@{reaction.handle} · ♥ {reaction.likes}</span>
      </div>
      <div style={{ color: muted, font: "400 12.5px/1.55 'Newsreader',Georgia,serif", marginTop: 4 }}>{preview}</div>
      {reaction.quotedContext && (reaction.quotedContext.title || reaction.quotedContext.description || reaction.quotedContext.text) && (
        <a href={reaction.quotedContext.url ?? undefined} target={reaction.quotedContext.url ? "_blank" : undefined} rel={reaction.quotedContext.url ? "noopener noreferrer" : undefined}
          style={{ display: "block", marginTop: 8, padding: 9, border: `1px solid ${line}`, borderRadius: 7, color: "inherit", textDecoration: "none", pointerEvents: reaction.quotedContext.url ? "auto" : "none" }}>
          {reaction.quotedContext.title && <div style={{ color: ink, font: "600 11.5px/1.4 system-ui" }}>{reaction.quotedContext.title}</div>}
          {(reaction.quotedContext.description || reaction.quotedContext.text) && <div style={{ marginTop: reaction.quotedContext.title ? 4 : 0, color: muted, font: "400 11.5px/1.45 'Newsreader',Georgia,serif", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{cleanTweetText(reaction.quotedContext.description || reaction.quotedContext.text || "")}</div>}
        </a>
      )}
      {canExpand && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}
          style={{ cursor: "pointer", minHeight: 44, marginTop: 3, padding: "0 2px", border: 0, background: "transparent", color: accent, font: "600 11.5px system-ui" }}>
          {expanded ? "Collapse ↑" : `${action} ↓`}
        </button>
      )}
      {knownTruncated && (!canExpand || expanded) && <a href={reaction.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", minHeight: 44, alignItems: "center", marginLeft: canExpand ? 12 : 0, color: accent, textDecoration: "none", font: "600 11.5px system-ui" }}>Read complete post on X ↗</a>}
    </blockquote>
  );
}

export default function DailyConversationEvidence({
  stories,
  storyIds,
  area,
  accent,
  ink,
  muted,
  line,
}: {
  stories?: DailyConversationStory[];
  storyIds?: string[];
  area?: string;
  accent: string;
  ink: string;
  muted: string;
  line: string;
}) {
  const wanted = new Set(storyIds ?? []);
  const matched = (stories ?? []).filter((story) => wanted.has(story.id)).map((story) => {
    const { local: reactions, across } = partitionDailyReactions(story.reactions, story.areas ?? [], area);
    return { story, reactions, across };
  }).filter(({ reactions, across }) => reactions.length || across.length);
  if (!matched.length) return null;

  const reactionCard = (reaction: DailyConversationStory["reactions"][number], lead = false) => (
    <ReactionCard key={reaction.postId} reaction={reaction} lead={lead} accent={accent} ink={ink} muted={muted} line={line} />
  );
  const sourceLinks = (story: DailyConversationStory) => {
    const seen = new Set<string>();
    return [story.anchor, ...(story.sources ?? [])].filter((source) => {
      if (!source.url || seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    });
  };

  return <div style={{ marginTop: 8 }}>
    <div style={{ borderTop: `1px solid ${line}`, padding: "8px 0 2px", color: accent, font: "700 10.5px system-ui", letterSpacing: ".1em", textTransform: "uppercase" }}>Physician conversation</div>
    {matched.map(({ story, reactions, across }) => (
      <div key={story.id}>
        {(() => {
          const shownAcross = reactions.length ? 0 : 1;
          const hiddenCount = Math.max(reactions.length - 1, 0) + Math.max(across.length - shownAcross, 0);
          return <>
        {reactions[0] ? reactionCard(reactions[0], true) : <div style={{ color: muted, font: "700 10px system-ui", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Across oncology</div>}
        {!reactions.length && across[0] ? reactionCard(across[0], true) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", padding: "2px 0 5px 10px" }}>
          {sourceLinks(story).map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", minHeight: 44, alignItems: "center", color: muted, textDecoration: "none", font: "500 10.5px/1.4 system-ui" }}>
              {source.label} ↗
            </a>
          ))}
        </div>
        {hiddenCount > 0 && <details className="daily-conversation-details" style={{ padding: "2px 0" }}>
          <summary style={{ cursor: "pointer", listStyle: "none", minHeight: 44, display: "flex", alignItems: "center", color: accent, font: "600 11.5px system-ui" }}>
            <span className="daily-conversation-more">See {hiddenCount} more physician post{hiddenCount === 1 ? "" : "s"} ↓</span>
            <span className="daily-conversation-less">Hide conversation ↑</span>
          </summary>
          <div style={{ paddingTop: 5 }}>
            {reactions.slice(1).map((reaction) => reactionCard(reaction))}
            {across.length > 0 && <div style={{ color: muted, font: "700 10px system-ui", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Across oncology</div>}
            {across.slice(reactions.length ? 0 : 1).map((reaction) => reactionCard(reaction))}
          </div>
        </details>}
          </>;
        })()}
      </div>
    ))}
  </div>;
}
