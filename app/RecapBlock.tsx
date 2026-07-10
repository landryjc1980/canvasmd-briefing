"use client";

import { useEffect, useRef, useState } from "react";

// The hero recap, shared by the story + reader designs. Our pipeline produces a
// full editorial paragraph (not the mock's short 3-word headline), so instead of
// blowing it up as a giant serif headline we render it as a moderate serif block,
// line-clamped with a "Show more" toggle. Desktop passes a larger size than mobile.
export default function RecapBlock({
  text, accent, size, lines, centered,
}: {
  text: string | null; accent: string; size: number; lines: number; centered?: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [truncatable, setTruncatable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // measure in the clamped state: is there more than fits?
    setTruncatable(el.scrollHeight > el.clientHeight + 2);
  }, [text, lines, size]);

  if (!text) return null;
  const clamp: React.CSSProperties = open
    ? {}
    : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" };

  return (
    <div style={{ maxWidth: centered ? 620 : undefined, margin: centered ? "16px auto 0" : "16px 0 0" }}>
      <p ref={ref} style={{ margin: 0, font: `400 ${size}px/1.42 'Newsreader',Georgia,serif`, color: "#e7eaf2", letterSpacing: "-.005em", ...clamp }}>
        {text}
      </p>
      {(truncatable || open) && (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          style={{ marginTop: 9, background: "none", border: 0, padding: 0, cursor: "pointer", font: "600 12.5px system-ui", color: accent }}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
