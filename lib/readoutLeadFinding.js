// ⚠️ MIRROR of the engine's abstract lead-sentence picker: canvasmd
// `supabase/functions/_shared/briefingCore.ts` (`abstractFindings` → `sourceFindingSentence`).
// The engine computes a card's `excerpt` with this exact logic when it builds a window; archived
// editions do not carry that field, so the web recomputes it here so one paper opens with the
// same sentence on Today and on 7 days. Keep the regexes byte-identical to the engine's; the
// drift pin in tests/briefing-preview.test.mjs fails if the two diverge on a real abstract.
// Plain JS on purpose: edition.ts must stay loadable by `node --test` without a TS loader,
// the same convention as app/briefing-preview/storyMembership.js.
// This mirror deliberately omits the engine's coverage gate (`paperRecapCoversSourceContext`):
// the web always keeps the full verbatim abstract one tap away, so a lead sentence here is a
// preview of source text, never the whole claim.

const SENTENCE_DOT = "\uE000";
const ABBREVIATION_RE = /\b(?:vs|dr|mr|mrs|ms|prof|sr|jr|fig|eq|no|et\s+al)\./gi;
const HTML_ENTITIES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…",
};

const METHOD_LEAD_RE = /^(?:background|purpose|objective|methods?|design|setting|participants?|patients? were|the number of patients\b|between\b|from\s+\w+\s+\d|we (?:also )?(?:enrolled|randomly assigned|conducted|evaluated|assessed|examined|analy[sz]ed|studied)|a total of\b|eligible patients?\b|the (?:study|trial) enrolled\b|this (?:cohort )?study (?:evaluates|examines|describes)\b|this guideline has been updated\b|(?:this )?(?:asco )?living guidelines?\b|please see (?:the )?online dynamic version\b|updates are published regularly\b|see (?:the )?(?:(?:related )?article|appendix)\b|clinicaltrials?\s*[:.]?\s*gov\s+(?:identifier|number)\b|view all available purchase options\b|the following represents disclosure information\b|all relationships are considered compensated\b|for more information about asco(?:'s)? conflict of interest policy\b|featuring\b|hosted by\b|editor'?s choice\b|check out\b)/i;
const FINDING_SIGNAL_RE = /\b(?:associated with|improved|reduced|increased|decreased?|higher|lower|favou?red|benefit|survival|response|risk|hazard|superior|noninferior|non-inferior|did not|was not|showed|demonstrated|resulted|supports?|suggests?|effective|efficacy|safe|safety|outcomes?|achieved|met (?:the|its) endpoint)\b/i;
const INTERPRETIVE_FINDING_RE = /\b(?:(?:is|are|was|were) associated with|induced|demonstrated|showed|resulted in|improved|reduced|decreased?|suggests?|supports?|achieved|met (?:the|its) endpoint)\b/i;
const IMPACT_SIGNAL_RE = /\b(?:mortality|death|died|futility|concerning|concern|harm|toxicity|adverse|danger|hype|no evidence|unregulated|approval|practice[- ]changing|standard of care)\b/i;
const SPECIFICITY_SIGNAL_RE = /(?:\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\b|\b(?:NCT\d+|KEYNOTE-\w+|CheckMate-\w+)\b)/i;
const PROSE_PREDICATE_RE = /\b(?:is|are|was|were|be|been|being|has|have|had|can|could|may|might|will|would|should|did|does|do|occurred|received|treated|enrolled|reported|observed|found|met|led|induced|demonstrated|showed|resulted|improved|reduced|increased|decreased|suggests?|supports?|achieved|investigates?|reveals?)\b/i;
const DISCLOSURE_SENTENCE_RE = /^[\s("“]*(?:funded|funding|supported|sponsored|financial support|grant support)\b/i;
const BOILERPLATE_RE = /(?:\b(?:conflicts? of interest|disclosure information|relationships are (?:considered|self-held)|relationships may not relate|immediate family member|view all available purchase options|all rights reserved|subscribe to (?:read|access)|get full access to this article)\b|^\s*(?:funded by|funding:|author disclosures?|references\s*:)|\b(?:consulting|consultancy|honoraria|speakers.? bureau)\b|\bUroToday\s*[-–—]\s*GU OncToday brings coverage\b)/i;

function decodeText(raw) {
  const codePoint = (whole, value) => Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : whole;
  return String(raw ?? "")
    .replace(/&#(\d+);/g, (m, n) => codePoint(m, Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => codePoint(m, parseInt(n, 16)))
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39|rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip);/gi, (_m, e) => HTML_ENTITIES[String(e).toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function completeSentences(raw) {
  const protectedText = String(raw ?? "").replace(ABBREVIATION_RE, (m) => `${m.slice(0, -1)}${SENTENCE_DOT}`);
  return protectedText
    .split(/(?<=[.!?])(?:[\"”')\]])?\s+/)
    .map((s) => s.replaceAll(SENTENCE_DOT, ".").trim())
    .filter(Boolean);
}

function displaySentence(raw, max) {
  const sentence = decodeText(raw)
    .replace(/^\s*(?:BACKGROUND|PURPOSE|OBJECTIVE|METHODS?|RESULTS?|FINDINGS?|CONCLUSIONS?)\s*[:.]\s*/i, "")
    .replace(/^["“]+\s*|\s*["”]+$/g, "")
    .trim();
  if (!sentence || sentence.length < 20 || sentence.length > max) return null;
  if (!/[.!?][\"”')\]]*$/.test(sentence)) return null;
  if (!/^[\"“(]?[A-Z0-9]/.test(sentence)) return null;
  if ((sentence.match(/,/g)?.length ?? 0) >= 2 && !PROSE_PREDICATE_RE.test(sentence)) return null;
  return sentence;
}

function sourceFindingSentence(raw, max) {
  const candidates = completeSentences(decodeText(raw));
  const valid = candidates.map((s) => displaySentence(s, max)).filter((s) => !!s);
  const substantive = valid.filter((s) => !METHOD_LEAD_RE.test(s) && !DISCLOSURE_SENTENCE_RE.test(s) && !BOILERPLATE_RE.test(s));
  if (!substantive.length) return null;
  return substantive
    .map((sentence, index) => ({
      sentence,
      index,
      score: (FINDING_SIGNAL_RE.test(sentence) ? 20 : 0) +
        (INTERPRETIVE_FINDING_RE.test(sentence) ? 18 : 0) +
        (IMPACT_SIGNAL_RE.test(sentence) ? 18 : 0) +
        (SPECIFICITY_SIGNAL_RE.test(sentence) ? 12 : 0) +
        Math.min(sentence.length, max) / max,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.sentence ?? null;
}

/** The one sentence a paper card leads with, chosen exactly as the engine chooses it. */
/** @param {string | null | undefined} abstract @param {number} [max] @returns {string | null} */
export function readoutLeadFinding(abstract, max = 320) {
  const a = (abstract ?? "").trim();
  if (!a) return null;
  for (const section of ["CONCLUSIONS", "CONCLUSION", "RESULTS", "FINDINGS"]) {
    const re = new RegExp(`(?:^|\\b)${section}\\s*[:.]\\s*`, "i");
    const m = re.exec(a);
    if (m) {
      const rest = a.slice(m.index + m[0].length);
      const cut = rest.search(/\b(?:BACKGROUND|PURPOSE|METHODS|INTRODUCTION|OBJECTIVE|TRIAL REGISTRATION|FUNDING)\s*[:.]/i);
      const picked = sourceFindingSentence(cut > 0 ? rest.slice(0, cut) : rest, max);
      if (picked && /^["“(]?[A-Z0-9]/.test(picked)) return picked;
    }
  }
  const currentStudy = /(?:^|[.!?]\s+)(?=(?:We (?:developed|report|describe|present)|Here,? we|In this study\b|This study\b))/i.exec(a);
  if (currentStudy?.index != null) {
    const focused = sourceFindingSentence(a.slice(currentStudy.index).replace(/^[.!?]\s+/, ""), max);
    if (focused) return focused;
  }
  return sourceFindingSentence(a, max);
}
