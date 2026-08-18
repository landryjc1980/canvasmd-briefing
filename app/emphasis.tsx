import React from "react";

// The Daily's narrative carries MINIMAL markdown from the generator — **bold** for trial and
// people names, *italic* for journals/shows/titles (John: "our font treatment is very flat").
// This renders exactly those two forms and nothing else; stray asterisks pass through as text.
export function emph(text: string): React.ReactNode[] {
  // Curly-quoted spans (clinicians' verbatim X posts) render italic — the field's voice
  // reads visually distinct from our reporting voice (John 2026-08-18).
  return text.split(/(“[^”]+”|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((seg, i) => {
    if (seg.startsWith("“") && seg.endsWith("”")) return <em key={i}>{stripEmph(seg)}</em>;
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) return <strong key={i} style={{ fontWeight: 700 }}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) return <em key={i}>{seg.slice(1, -1)}</em>;
    return <React.Fragment key={i}>{seg}</React.Fragment>;
  });
}

// For clamped teasers and plain-text contexts.
export const stripEmph = (t: string) => t.replace(/\*\*?/g, "");
