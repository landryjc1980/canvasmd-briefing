import { cleanReadoutExcerpt } from "@/app/briefing-preview/edition";
import { articleTextPreview } from "@/lib/readoutPresentation";

// One complete lead sentence can run long; clipping it mid-sentence reads as broken.
const LEAD_SENTENCE_CHARS = 600;

export function DevelopmentFinding({
  text,
  expandedText,
  expanded = false,
  preservePreview = false,
}: {
  text: string;
  expandedText?: string | null;
  expanded?: boolean;
  preservePreview?: boolean;
}) {
  const finding = expanded
    ? cleanReadoutExcerpt(expandedText || text)
    : preservePreview ? cleanReadoutExcerpt(text) : articleTextPreview(cleanReadoutExcerpt(text), LEAD_SENTENCE_CHARS);

  if (!finding) return null;
  return (
    <div className="er-excerpt">
      <p className="er-finding">
        {finding}
      </p>
    </div>
  );
}

export function Disclose({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="er-disclose" type="button" aria-expanded={open} onClick={onToggle}>
      <span>{open ? "Show less" : label}</span>
    </button>
  );
}
