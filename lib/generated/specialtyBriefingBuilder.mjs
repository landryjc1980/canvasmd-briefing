// GENERATED from the authoritative CanvasMD shared builder. Run scripts/sync-specialty-builder.mjs; do not edit.

// supabase/functions/_shared/readoutAudioAdmission.ts
var whitespace = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
var ALTERNATIVE_MODALITY = /\b(?:alternative|natural agents?|naturopath\w*|detox(?:ification)?|food as medicine|healing trauma|toxic burden|curcumin|mistletoe|vitamin c|supplement(?:s|ation)?)\b/i;
var CANCER_SCOPE = /\b(?:cancer|carcinoma|tumou?r|oncolog\w*|leuk?emia|lymphoma|myeloma)\b/i;
var CANCER_CURE_OR_REVERSAL_CLAIM = /\b(?:(?:cure|reverse|eradicate|heal|eliminate)\w*\s+(?:the\s+)?(?:\w+\s+){0,2}(?:cancer|carcinoma|tumou?r|oncolog\w*|leuk?emia|lymphoma|myeloma)|(?:cancer|carcinoma|tumou?r|oncolog\w*|leuk?emia|lymphoma|myeloma)\s+(?:can\s+be\s+)?(?:cured|reversed|eradicated|healed|eliminated)\b|(?:cancer|carcinoma|tumou?r|oncolog\w*|leuk?emia|lymphoma|myeloma)\s+(?:cure|reversal|eradication|healing|elimination)\b|(?:cure|reversal|eradication|healing|elimination)\s+of\s+(?:cancer|carcinoma|tumou?r|oncolog\w*|leuk?emia|lymphoma|myeloma))\b/i;
var STANDARD_CARE = /\b(?:chemotherapy|radiation|surgery|systemic therapy|standard (?:oncology )?care|conventional (?:cancer )?treatment)\b/i;
var REPLACEMENT = /\b(?:replace|instead of|avoid|skip|stop|forego)\b/i;
var EXPLICIT_NON_REPLACEMENT = /\b(?:do(?:es)? not|don(?:'|’)t|never|without|alongside|complement(?:ary)? to)\b[^.]{0,48}\b(?:replace|avoid|skip|stop|forego)\b/i;
var EXPLICIT_DEBUNK = /\b(?:do(?:es)? not|don(?:'|’)t|cannot|can(?:'|’)t|no evidence(?: that)?|lack(?:s|ing)? evidence|myths?|debunk(?:ed|ing)?|not proven|unproven)\b[^.]{0,64}\b(?:cure|reverse|eradicate|heal|eliminate)\w*\b/i;
var PRONOUN_THERAPY = /\b(?:this|that)\s+(?:therapy|treatment|approach|protocol|remedy|method|intervention)\b/i;
var PRONOUN_CURE_OR_REVERSAL = /\b(?:cure|reverse|eradicate|heal|eliminate)\w*\s+(?:it|this|that)\b/i;
function sentences(value) {
  return value.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(whitespace).filter(Boolean) ?? [];
}
function hasUnsafeAlternativeCancerClaim(sentence) {
  if (!ALTERNATIVE_MODALITY.test(sentence) || !CANCER_SCOPE.test(sentence)) return false;
  const claimsCureOrReversal = CANCER_CURE_OR_REVERSAL_CLAIM.test(sentence) && !EXPLICIT_DEBUNK.test(sentence);
  const claimsReplacement = REPLACEMENT.test(sentence) && STANDARD_CARE.test(sentence) && !EXPLICIT_NON_REPLACEMENT.test(sentence);
  return claimsCureOrReversal || claimsReplacement;
}
function hasUnsafePronounTherapyPromotion(sentence) {
  if (!PRONOUN_THERAPY.test(sentence)) return false;
  const claimsCureOrReversal = PRONOUN_CURE_OR_REVERSAL.test(sentence) && !EXPLICIT_DEBUNK.test(sentence);
  const claimsReplacement = REPLACEMENT.test(sentence) && STANDARD_CARE.test(sentence) && !EXPLICIT_NON_REPLACEMENT.test(sentence);
  return claimsCureOrReversal || claimsReplacement;
}
function isReadoutListenEpisodeEligible(input) {
  const title = whitespace(input?.title);
  const descriptionSentences = sentences(whitespace(input?.description));
  const unsafeClaim = [
    ...sentences(title),
    ...descriptionSentences
  ].some(hasUnsafeAlternativeCancerClaim) || ALTERNATIVE_MODALITY.test(title) && CANCER_SCOPE.test(title) && hasUnsafePronounTherapyPromotion(descriptionSentences[0] ?? "");
  if (unsafeClaim) {
    return { eligible: false, reason: "unsafe_alternative_cancer_replacement" };
  }
  return { eligible: true, reason: "eligible" };
}

// supabase/functions/_shared/articleExcerptQuality.ts
function articleExcerptIsBoilerplate(value) {
  return /(?:\b(?:conflicts? of interest|disclosure information|relationships are (?:considered|self-held)|relationships may not relate|immediate family member|view all available purchase options|all rights reserved|subscribe to (?:read|access)|get full access to this article)\b|^\s*(?:funded by|funding:|author disclosures?|references\s*:)|\b(?:consulting|consultancy|honoraria|speakers.? bureau)\b|\bUroToday\s*[-–—]\s*GU OncToday brings coverage\b)/i.test(value);
}

// supabase/functions/_shared/briefingCore.ts
var RECENT_DAYS = 14;
var PRIOR_DAYS = 28;
function trialGlossHasContradictoryRegimen(gloss, interventions, drugGroups) {
  const text = normTitle(gloss ?? null);
  const matches = [...text.matchAll(/\b(?:vs|versus|compared with|comparison with)\b/g)];
  if (!matches.length) return false;
  const interventionText = ` ${normTitle(interventions.join(" "))} `;
  for (const match of matches) {
    const at = match.index ?? 0;
    const window = ` ${text.slice(Math.max(0, at - 90), Math.min(text.length, at + match[0].length + 90))} `;
    for (const group of drugGroups) {
      const mentioned = group.surfaces.some((surface) => {
        const normalized = normTitle(surface).trim();
        return normalized.length >= 4 && window.includes(` ${normalized} `);
      });
      if (!mentioned) continue;
      const interventionMatch = [group.canonical, ...group.surfaces].some((surface) => {
        const normalized = normTitle(surface).trim();
        return normalized.length >= 4 && interventionText.includes(` ${normalized} `);
      });
      if (!interventionMatch) return true;
    }
  }
  return false;
}
function windowCutoffs(nowMs, days) {
  const recentMs = days * 864e5;
  const priorMs = Math.round(days * (PRIOR_DAYS / RECENT_DAYS)) * 864e5;
  return {
    recentCutoff: new Date(nowMs - recentMs).toISOString(),
    priorCutoff: new Date(nowMs - priorMs).toISOString(),
    today: new Date(nowMs).toISOString().slice(0, 10),
    ahead30: new Date(nowMs + 30 * 864e5).toISOString().slice(0, 10)
  };
}
var PROBE_EVERY_MS = 7 * 864e5;
var normTitle = (t) => ` ${(t ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
var episodeSyndicationKey = (title) => (title ?? "").replace(/^\s*(ep\.?\s*\d+|episode\s*\d+|#\s*\d+|part\s*\d+)\s*[:.\-–—]*\s*/i, "").toLowerCase().replace(/[^a-z0-9]/g, "");
var episodeRecordingKey = (episodeId, title) => String(episodeId ?? "").trim() || episodeSyndicationKey(title);
var episodeGuestAppearanceKey = (episodeId, title) => {
  const raw = String(title ?? "").trim();
  const isMicrolearningCut = /\bmicrolearning activity\s*\d+\b/i.test(raw);
  const isRecordedSession = /\bproceedings from a session held adjunct to\b/i.test(raw);
  if (!isMicrolearningCut && !isRecordedSession) return episodeRecordingKey(episodeId, title);
  const sessionTitle = raw.replace(/\s*(?:[-–—:]\s*)?microlearning activity\s*\d+\s*:?\s*/gi, " ").replace(/\basco\s+gu\s+cancers?\s+symposium\b/gi, "ASCO Genitourinary Cancers Symposium");
  const key = episodeSyndicationKey(sessionTitle);
  return key ? `session:${key}` : episodeRecordingKey(episodeId, title);
};
function normalizePodcastStartMs(value, durationSeconds) {
  const start = Number(value);
  if (!Number.isFinite(start) || start < 0) return null;
  const duration = Number(durationSeconds);
  if (start > 0 && start < 1e3 && Number.isFinite(duration) && duration >= start) {
    return Math.round(start * 1e3);
  }
  return Math.round(start);
}
var countOcc = (h, f) => {
  let n = 0, i = 0;
  while ((i = h.indexOf(f, i)) >= 0) {
    n++;
    i += 1;
  }
  return n;
};
var TRIAL_RE = /\b([A-Za-z]{2,}(?:-[A-Za-z]{1,})?)[\s-]?(\d{1,4}[A-Za-z]{0,2})\b/g;
var ENGOT_TRIAL_RE = /\bENGOT-([A-Za-z]{2})(\d{1,4})\b/gi;
var TRIAL_SUFFIX_ORDINAL = /^(st|nd|rd|th)$/i;
var TRIAL_STOP = /* @__PURE__ */ new Set([
  "phase",
  "part",
  "parts",
  "table",
  "tables",
  "figure",
  "figures",
  "fig",
  "day",
  "days",
  "week",
  "weeks",
  "month",
  "months",
  "year",
  "years",
  "grade",
  "grades",
  "arm",
  "arms",
  "cohort",
  "cohorts",
  "line",
  "lines",
  "dose",
  "doses",
  "group",
  "groups",
  "cycle",
  "cycles",
  "version",
  "section",
  "page",
  "pages",
  "level",
  "levels",
  "stage",
  "stages",
  "type",
  "types",
  "class",
  "chapter",
  "item",
  "items",
  "tier",
  "round",
  "wave",
  "panel",
  "subset",
  "subgroup",
  "question",
  "aim",
  "top",
  "row",
  "point",
  "week",
  "age",
  "score",
  "endpoint",
  "hr",
  "os",
  "pfs",
  "orr",
  "dfs",
  "ci",
  "sd",
  "ae",
  "il",
  "cd",
  "pd",
  "pdl",
  "her",
  "kras",
  "egfr",
  "alk",
  "ros",
  "braf",
  "cea",
  "tps",
  "cps",
  "ecog",
  "hif",
  "cdk",
  "idh",
  "fgfr",
  "vegf",
  "tgf",
  "pik",
  "akt",
  "mtor",
  "psa",
  "psma",
  "brca",
  "msi",
  "tmb",
  "hla",
  "ctla",
  "lag",
  "trop",
  "ret",
  "met",
  "ntrk",
  "bcl",
  "myc",
  "esr",
  "ar",
  "arv",
  "pdl1",
  "erbb",
  "igf",
  "tp",
  "rb",
  "atm",
  "cdh",
  "folh",
  "gprc",
  "glp",
  "txnrd",
  "krasg",
  "svr",
  "ppv",
  "icdr",
  "ace",
  "igimrt",
  "cldn",
  "dll",
  "muc",
  "ceacam",
  "gd",
  "b7h",
  "tigit",
  "nrg",
  "pge",
  "cxcr",
  "ccr",
  "tnf",
  "ifn",
  "tgfb",
  "wnt",
  "jak",
  "stat",
  "iqr",
  "tss",
  "aft",
  "asco",
  "esmo",
  "ascogi",
  "esmogi",
  "ascomos",
  "ascogu",
  "wclc",
  "sabcs",
  "ash",
  "aacr",
  "nct",
  "covid",
  "sars",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
  // registries / guidelines / cooperative-group + agency tokens that read as "TRIAL-####"
  "eudract",
  "isrctn",
  "iwg",
  "ctiu",
  "ypt",
  "jcog",
  "gbg",
  "who",
  "nccn",
  "nice",
  "fda",
  "ema",
  "nih",
  "ich",
  "gcp",
  // single-drug abbreviation + dose (AZA-25, RUX-5) — not trial acronyms
  "aza",
  "rux",
  "ven",
  "dara",
  "len",
  "pom",
  // genes / biomarkers that read as "GENE-####" (MYD88, TET2, WNK2, CAL1, TP53…) — not trials.
  // Many single-gene tokens (cd, tp, bcl, kras…) are already above; these fill the gaps.
  "myd",
  "tet",
  "wnk",
  "cal",
  "ccnd",
  "ccne",
  "cdkn",
  "palb",
  "chek",
  "nras",
  "hras",
  "pten",
  "smad",
  "stk",
  "keap",
  "arid",
  "setd",
  "bap",
  "vhl",
  "flt",
  "npm",
  "dnmt",
  "asxl",
  "runx",
  "srsf",
  "ezh",
  "cbl",
  "kit",
  "csf",
  "mpl",
  "calr",
  "notch",
  "fbxw",
  "cic",
  "atrx",
  "mdm",
  "bcma",
  "slamf",
  "fcrh",
  "nfe",
  "rad",
  "brip",
  "bard",
  "fanc",
  "nbn",
  "pms",
  "msh",
  "mlh",
  "epcam",
  // TF / inflammasome / cytokine-receptor gene families that read as SYMBOL-#### in onc text.
  // NOT "card" (real GU CARD trial → "CARD 1L" collides) and NOT "aim" (already above).
  // "sox" kept: target is the SOX2/9 gene; the GI SOX regimen (S-1+oxaliplatin) is bare-token
  // (no digit) so TRIAL_RE ignores it — first suspect if a numbered gastric SOX-n trial surfaces.
  "irf",
  "nlrc",
  "nlrp",
  "ikzf",
  "gata",
  "foxp",
  "foxa",
  "sox",
  "hox",
  "cxcl",
  "ccl",
  "tnfrsf",
  "tnfsf",
  "irak",
  "traf",
  "casp",
  "gsdmd",
  "naip",
  "ripk",
  "pcsk",
  "lkb"
  // PCSK9 (lipid gene), LKB1/STK11 — leaked as titleless chips via the X/paper floor
]);
var TRIAL_ALLOW_SHORT = /* @__PURE__ */ new Set(["EV"]);
var URL_SPAN_RE = /https?:\/\/\S+/g;
var WWW_SPAN_RE = /\bwww\.\S+/gi;
var HANDLE_RE = /@\w+/g;
var YEAR_TAG_RE = /#\w*?(?:20[0-9]{2}|['’]?[2-3][0-9])\b/g;
var scrubNonProse = (t) => t.replace(URL_SPAN_RE, " ").replace(WWW_SPAN_RE, " ").replace(HANDLE_RE, " ").replace(YEAR_TAG_RE, " ");
function extractTrials(text) {
  const out = /* @__PURE__ */ new Set();
  if (!text) return out;
  const prose = scrubNonProse(text);
  for (const m of prose.matchAll(ENGOT_TRIAL_RE)) {
    const nnum = m[2].replace(/^0+(\d)/, "$1");
    out.add(`ENGOT-${m[1].toUpperCase()}-${nnum}`);
  }
  for (const m of prose.matchAll(TRIAL_RE)) {
    const word = m[1], num = m[2];
    const letters = word.replace(/[^A-Za-z]/g, "");
    const wl = word.toLowerCase().replace(/-/g, "");
    if (TRIAL_STOP.has(wl)) continue;
    if (letters.length < 3 && !TRIAL_ALLOW_SHORT.has(word.toUpperCase())) continue;
    const numSuffix = num.replace(/^\d+/, "");
    if (numSuffix && TRIAL_SUFFIX_ORDINAL.test(numSuffix)) continue;
    const allCaps = letters === letters.toUpperCase();
    const camel = /[A-Z][a-z].*[A-Z]/.test(word) || /[a-z][A-Z]/.test(word) || /^[A-Z]{2,}[a-z]/.test(word) || /^[A-Z]{2,}-[A-Z][a-z]/.test(word);
    if (!allCaps && !camel) continue;
    const nnum = num.toUpperCase().replace(/^0+(\d)/, "$1");
    out.add(`${word.toUpperCase().replace(/\s+/g, "")}-${nnum}`);
  }
  return out;
}
var EPISODE_ONCOLOGY_RE = /cancer|carcinoma|tumou?r|neoplas|malignan|oncolog|leukemi|lymphoma|myelom|melanoma|sarcoma|blastoma|metasta|mesotheli|adenocarc|\bmds\b|myelodyspl|myelofibros/i;
function episodeOncologyEligible(text, clinicianConversationCount = 0) {
  return clinicianConversationCount > 0 || EPISODE_ONCOLOGY_RE.test(text ?? "");
}
var stripKey = (s) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/([A-Z])0+(\d)/g, "$1$2");
var AREA_KEYS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"];
var AREA_CUES = {
  GU: ["prostate", "prostatic", "bladder", "urothelial", "renal", "kidney", "rcc", "ccrcc", "mcrpc", "mcspc", "crpc", "nmibc", "mibc", "nephrectomy", "cystectomy", "psma", "genitourinary", "testicular", "seminoma"],
  Breast: ["breast", "tnbc", "triple negative", "hr positive", "hormone receptor", "brca", "dcis", "mammary", "her2 positive"],
  Lung: ["lung", "nsclc", "sclc", "thoracic", "egfr", "alk", "ros1", "kras g12c", "mesothelioma", "pleural"],
  GI: ["colorectal", "colon", "rectal", "crc", "gastric", "stomach", "pancreatic", "pancreas", "hepatocellular", "hcc", "esophageal", "gastroesophageal", "biliary", "cholangiocarcinoma", "gej", "gist", "anal"],
  Heme: ["myeloma", "lymphoma", "leukemia", "aml", "cll", "cml", "mds", "dlbcl", "hodgkin", "mantle cell", "myelofibrosis", "waldenstrom", "follicular", "bpdcn", "blastic plasmacytoid"],
  Gyn: ["ovarian", "endometrial", "cervical", "gynecologic", "uterine", "fallopian", "peritoneal"],
  // ⚠️ SUBJECT-NOT-SURFACE-TOKEN. "Squamous cell carcinoma" is a HISTOLOGY that also
  // lives in lung, head & neck, esophagus, anus and cervix — a bare "squamous" cue
  // would flood Skin with other organs' cancers (measured on the live corpus: of the
  // articles naming "squamous cell", 18 are GI, 13 Lung, 3 GU, 1 Gyn). Every cSCC
  // form below therefore carries its own cutaneous context. For the same reason bare
  // "basal cell" (vs basal-LIKE breast, basal-subtype bladder), bare "cutaneous"
  // ("cutaneous toxicity" happens in every area) and bare "skin" are NOT cues.
  // Ambiguous → don't tag.
  Skin: ["melanoma", "melanocytic", "merkel", "cutaneous squamous", "cscc", "basal cell carcinoma", "skin cancer", "skin cancers", "keratinocyte carcinoma", "cutaneous oncology", "dermatologic oncology", "actinic keratosis"]
};
var AREA_CUE_FORMS = Object.fromEntries(
  Object.entries(AREA_CUES).map(([a, terms]) => [a, terms.map((t) => ` ${t.replace(/[^a-z0-9]+/g, " ").trim()} `)])
);
var reOf = (forms) => forms.length ? new RegExp(forms.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")) : null;
var _areaCueRe = /* @__PURE__ */ new Map();
var areaCueHay = (area, hay) => area === "Heme" && hay.includes(" angiomyolipoma ") ? hay.replace(/\saml\s/g, " ") : hay;
var areaCueMatches = (area, hay) => {
  if (!_areaCueRe.has(area)) _areaCueRe.set(area, reOf(AREA_CUE_FORMS[area] ?? []));
  const re = _areaCueRe.get(area);
  return !!re && re.test(areaCueHay(area, hay));
};
var AREA_DISEASE_CUES = {
  GU: ["prostate", "prostatic", "bladder", "urothelial", "renal", "kidney", "rcc", "ccrcc", "mcrpc", "mcspc", "crpc", "nmibc", "mibc", "nephrectomy", "cystectomy", "genitourinary", "testicular", "seminoma"],
  Breast: ["breast", "tnbc", "triple negative", "dcis", "mammary"],
  Lung: ["lung", "nsclc", "sclc", "thoracic", "mesothelioma", "pleural"],
  GI: ["colorectal", "colon", "rectal", "crc", "gastric", "stomach", "pancreatic", "pancreas", "hepatocellular", "hcc", "esophageal", "gastroesophageal", "biliary", "cholangiocarcinoma", "gej", "gist", "anal"],
  Heme: ["myeloma", "lymphoma", "leukemia", "aml", "cll", "cml", "mds", "dlbcl", "hodgkin", "mantle cell", "myelofibrosis", "waldenstrom", "follicular", "bpdcn", "blastic plasmacytoid"],
  // "peritoneal" intentionally omitted — it collides with GI peritoneal metastases (a gastric
  // PERISCOPE-II paper was bleeding into the ovarian topic); the general AREA_CUES keeps it.
  Gyn: ["ovarian", "endometrial", "cervical", "gynecologic", "uterine", "fallopian"],
  // Tighter than AREA_CUES on purpose: this list BLOCKS a paper from every other
  // edition, so it holds only terms that cannot mean anything but skin. "cscc" and
  // the dermatologic-oncology phrasings are admission cues but not blocking ones.
  Skin: ["melanoma", "melanocytic", "merkel", "cutaneous squamous", "basal cell carcinoma", "skin cancer", "skin cancers"]
};
var AREA_DISEASE_CUE_FORMS = Object.fromEntries(
  Object.entries(AREA_DISEASE_CUES).map(([a, terms]) => [a, terms.map((t) => ` ${t.replace(/[^a-z0-9]+/g, " ").trim()} `)])
);
var _areaDiseaseCueRe = /* @__PURE__ */ new Map();
var areaDiseaseCueMatches = (area, hay) => {
  if (!_areaDiseaseCueRe.has(area)) _areaDiseaseCueRe.set(area, reOf(AREA_DISEASE_CUE_FORMS[area] ?? []));
  const re = _areaDiseaseCueRe.get(area);
  return !!re && re.test(areaCueHay(area, hay));
};
var FOREIGN_TUMOR_FORMS = [
  // other (non-tracked) tumors
  "head and neck",
  "hnscc",
  "oropharyngeal",
  "oropharynx",
  "nasopharyngeal",
  "laryngeal",
  "hypopharyngeal",
  "salivary",
  // "melanoma"/"uveal"/"merkel"/"cutaneous squamous" LEFT this list when Skin became a
  // tracked edition (2026-08-19). They must not sit here as well: hasForeignTumorCue is
  // unconditional at several call sites (index.ts titleOffArea/contentOffArea), so a term
  // listed here is off-area for EVERY edition including its own — Skin would have been
  // structurally suppressed from its own rail. Cross-area blocking is preserved by
  // AREA_DISEASE_CUES.Skin, which blocks the other six exactly as before.
  "glioblastoma",
  "glioma",
  "astrocytoma",
  "sarcoma",
  "osteosarcoma",
  "thyroid cancer",
  "thyroid carcinoma",
  "myofibroblastic",
  "soft tissue",
  "desmoid",
  // NON-oncology diseases — a shared drug (rituximab, ocrelizumab…) drags autoimmune/neuro
  // papers into an ONCOLOGY brief; block them the same way. Conservative list (won't be the
  // primary subject of a real onc paper): kept off obesity/diabetes (entangled with cancer-risk papers).
  "multiple sclerosis",
  "sclerosis",
  "rheumatoid",
  "lupus",
  "psoriasis",
  "crohn",
  "ulcerative colitis",
  "alzheimer",
  "parkinson",
  "epilepsy",
  "neuromyelitis",
  "myasthenia"
].map((t) => ` ${t.replace(/[^a-z0-9]+/g, " ").trim()} `);
var FOREIGN_TUMOR_RE = new RegExp(FOREIGN_TUMOR_FORMS.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
var hasForeignTumorCue = (hay) => FOREIGN_TUMOR_RE.test(hay);
var DISEASE_WORDS = new Set([
  ...Object.values(AREA_CUES).flat(),
  ...Object.values(AREA_DISEASE_CUES).flat(),
  // Generic tumor-SCOPE descriptors — never a trial name on their own. These
  // arrive as degraded partials: "DESTINY-PAN-TUMOR-02" (an extra hyphen in the
  // source) splits so extractTrials keeps only "PAN-TUMOR-2", which then renders
  // as a chip literally named "PAN-TUMOR-2". Same failure class as the disease
  // partials — a scope word plus a number is not a trial.
  "pan tumor",
  "pantumor",
  "solid tumor",
  "solid tumour",
  "advanced solid tumor"
].map((s) => s.replace(/[^a-z0-9]/gi, "").toLowerCase()).filter(Boolean));
var NON_TRIAL_TOKENS = /* @__PURE__ */ new Set(["cox", "kmta", "sglt", "midh", "ihc", "mel", "bcantt"]);
var NON_TRIAL_EXACT = /* @__PURE__ */ new Set(["ABL1", "GSK3", "XPO1", "GPC3"]);
var isKnownNonTrialIdentity = (acronym) => {
  const letters = (acronym ?? "").replace(/[^A-Za-z]/g, "").toLowerCase();
  return NON_TRIAL_TOKENS.has(letters) || NON_TRIAL_EXACT.has(stripKey(acronym ?? ""));
};
var isNonTrialChip = (acronym) => {
  const letters = (acronym ?? "").replace(/[^A-Za-z]/g, "").toLowerCase();
  if (!letters) return false;
  return DISEASE_WORDS.has(letters) || isKnownNonTrialIdentity(acronym);
};
var NO_TUMOR_CLAIM = "General";
function articleBelongsHere(area, title, _abstract, areas) {
  const titleHay = normTitle(title);
  if (area === "Gyn" && /\bovarian\b/i.test(title) && !/\b(?:cancer|carcinoma|tumou?r|oncolog|neoplasm|malignan|metasta|recurr|survival|response|progression|chemotherap|immunotherap|radiotherap|adjuvant|neoadjuvant|maintenance|phase\s*[1-4iIvV]+|randomi[sz]ed|trial)\b/i.test(title)) {
    return false;
  }
  const claimed = (areas ?? []).filter((x) => x && x !== NO_TUMOR_CLAIM);
  if (claimed.length && !claimed.includes(area)) return false;
  if (claimed.includes(area)) {
    const namesThisDisease2 = areaDiseaseCueMatches(area, titleHay);
    const namesOtherDisease2 = AREA_KEYS.some((other) => other !== area && areaDiseaseCueMatches(other, titleHay));
    if (!namesThisDisease2 && (namesOtherDisease2 || hasForeignTumorCue(titleHay))) return false;
    return true;
  }
  const namesThisDisease = areaDiseaseCueMatches(area, titleHay);
  const namesOtherDisease = AREA_KEYS.some((other) => other !== area && areaDiseaseCueMatches(other, titleHay));
  if (!namesThisDisease && (namesOtherDisease || hasForeignTumorCue(titleHay))) return false;
  return areaCueMatches(area, titleHay);
}
var PROMO_RE = /\b(newsletter|round[-\s]?up|weekly (?:recap|digest)|digest is out|is out\b|out now\b|available now|sign and share|please sign|petition|register (?:to|now|here|for|and)|subscribe|sign up|link in bio|save the date|webinar|use code|giveaway|follow us|join us (?:for|at|on))\b|📬/i;
var PROMO_HARD_RE = /\bphase\b|\bph\s?[123]|\bOS\b|\bPFS\b|\bORR\b|\bDFS\b|did not|failed to|improv|approv|randomi[sz]ed|adjuvant|neoadjuvant|read[-\s]?out|results?\s+(?:are|were|out|from|of)|met (?:its|the)|endpoint|overall survival|progression[-\s]?free|response rate|superior|noninferior|non-inferior|negative|positive/i;
var ROUNDUP_RE = /\bnewsletter\b|weekly round[-\s]?up|weekly digest|📬/i;
var LISTICLE_RE = /\b(beat|beats|beating|outperform\w*|versus|vs\.?)\b/gi;
var isMultiCompareListicle = (t) => (t.match(LISTICLE_RE)?.length ?? 0) >= 3;
var ADVOCACY_RE = /\b(please sign|sign (?:the|our|this) petition|campaign(?:ing)? (?:for|to)|in memory of|heartbroken|we(?:'ve| have) lost|rest in peace)\b/i;
var isLowValuePost = (t) => {
  const s = t ?? "";
  return ROUNDUP_RE.test(s) || ADVOCACY_RE.test(s) || isMultiCompareListicle(s) || PROMO_RE.test(s) && !PROMO_HARD_RE.test(s);
};
var ADC_MODIFIERS = /* @__PURE__ */ new Set([
  "deruxtecan",
  "rezetecan",
  "govitecan",
  "vedotin",
  "emtansine",
  "tirumotecan",
  "duocarmazine",
  "mafodotin",
  "botansine",
  "ejfv",
  "nxt",
  "tesirine",
  "ozogamicin",
  "monomethyl",
  "vedotinbased"
]);
var bareNamed = (hay, form) => {
  let i = 0;
  while ((i = hay.indexOf(form, i)) >= 0) {
    const nextWord = hay.slice(i + form.length).match(/^([a-z0-9]+)/)?.[1] ?? "";
    if (!ADC_MODIFIERS.has(nextWord)) return true;
    i += 1;
  }
  return false;
};
var FEAT_VERSION = 6;
function eventChipLabel(eventType, title) {
  const t = (title ?? "").trim();
  if (/^FDA grants accelerated approval\b/i.test(t)) return "FDA accelerated approval";
  if (/^FDA (?:grants? )?approval\b/i.test(t)) return "FDA approval";
  if (/^FDA approval:/i.test(t)) return "FDA approval";
  if (/^FDA label expansion:/i.test(t)) return "FDA label expansion";
  if (/^Label updated:/i.test(t)) return "FDA label update";
  if (/^Results available:/i.test(t)) return "Trial results posted";
  if (/^New trial tracked:/i.test(t)) return "New trial registered";
  if (/primary completion/i.test(t)) return "Trial completion date moved";
  switch (eventType) {
    case "trial_results_posted":
      return "Trial results posted";
    case "trial_terminated":
      return "Trial terminated";
    case "trial_status_change":
      return "Trial status change";
    case "drug_label_change":
      return "FDA label update";
    // drug_approval WITHOUT a recognised title prefix is exactly the ambiguous case that started
    // this: it may be an approval, a label expansion, or a safety change. Omit rather than guess.
    default:
      return null;
  }
}
var CONSENSUS_DOC_RE = /(?:delphi|multidisciplinary)\s+consensus|consensus[-\s]+(?:statement|guideline|guidelines|recommendation|recommendations|document|process|panel|criteria|definition|definitions)/i;
var CONSENSUS_RE = /\b(?:consensus|unanimous(?:ly)?|(?:broad|wide|widespread|general|universal|strong)(?:ly)?\s+(?:agreement|agree|agreed)|(?:widely|broadly|generally|universally)\s+agreed?)\b/gi;
function neutralizeConsensusText(t, sourceLicensesConsensus = false) {
  return t.replace(CONSENSUS_RE, (match, offset, whole) => {
    if (!/consensus/i.test(match)) return "active debate";
    const ctx = whole.slice(Math.max(0, offset - 24), offset + match.length + 24);
    if (CONSENSUS_DOC_RE.test(ctx)) return match;
    if (sourceLicensesConsensus) return match;
    return "active debate";
  });
}
var ENDPOINT_NUM_RE = /\d+(?:\.\d+)?\s?%|\bHR[\s=:]*\d|hazard ratio|\b\d+(?:\.\d+)?\s*(?:months?|weeks?|years?)\b|\bp\s?[<=]\s?0?\.\d|\b\d+\.\d+\b/i;
function truncateSentence(raw, max = 220) {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const window = t.slice(0, max);
  const lastEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (lastEnd > Math.min(80, max * 0.4)) return window.slice(0, lastEnd + 1);
  const lastSpace = window.lastIndexOf(" ");
  return (lastSpace > Math.min(80, max * 0.4) ? window.slice(0, lastSpace) : window.slice(0, max - 1)) + "\u2026";
}
var SENTENCE_DOT = "\uE000";
var ABBREVIATION_RE = /\b(?:vs|dr|mr|mrs|ms|prof|sr|jr|fig|eq|no|et\s+al)\./gi;
function completeSentences(raw) {
  const protectedText = String(raw ?? "").replace(ABBREVIATION_RE, (m) => `${m.slice(0, -1)}${SENTENCE_DOT}`);
  return protectedText.split(/(?<=[.!?])(?:[\"\u201D')\]])?\s+/).map((s) => s.replaceAll(SENTENCE_DOT, ".").trim()).filter(Boolean);
}
var HTML_ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  rsquo: "\u2019",
  lsquo: "\u2018",
  ldquo: "\u201C",
  rdquo: "\u201D",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026"
};
function decodeBriefingText(raw) {
  const codePoint = (whole, value) => Number.isInteger(value) && value >= 0 && value <= 1114111 ? String.fromCodePoint(value) : whole;
  return String(raw ?? "").replace(/&#(\d+);/g, (m, n) => codePoint(m, Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => codePoint(m, parseInt(n, 16))).replace(/&(nbsp|amp|lt|gt|quot|apos|#39|rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip);/gi, (_m, e) => HTML_ENTITIES[String(e).toLowerCase()] ?? " ").replace(/\s+/g, " ").trim();
}
function cleanSourceTitle(raw) {
  return decodeBriefingText(raw).replace(/<[^>]+>/g, " ").replace(/\s*[\u2605\u2606]\s*$/u, "").replace(/\s+([,;:.])/g, "$1").replace(/([,;:])(?=\S)/g, "$1 ").replace(/\s+/g, " ").trim();
}
function cleanArticleContext(raw) {
  const text = decodeBriefingText(raw).replace(/<[^>]+>/g, " ").replace(/^Abstract\s*(Background|Purpose|Objective|Methods?|Results?|Findings?|Conclusions?)\s*[.:]?\s*/i, (_match, section) => `${String(section).toUpperCase()}: `).replace(/\s+([,;:.])/g, "$1").replace(/([,;:])(?=\S)/g, "$1 ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/^read this journal watch article and more clinical summaries\b/i.test(text)) return null;
  return text;
}
function stripTranscriptCorrectionAside(raw) {
  return String(raw ?? "").replace(/\s*\((?:referred to|rendered|transcribed) as [^)]{1,100} in the transcript\)/gi, "").trim();
}
function areaContextAllowsDrugMention(input) {
  if (input.thisCue) return true;
  if (input.otherCue) return false;
  const sourceAreas = input.sourceAreas ?? [];
  const sourceLocal = sourceAreas.includes(input.area);
  if (sourceAreas.length > 0 && !sourceLocal) return false;
  return input.authored || sourceLocal;
}
function isReaderReadySourceTitle(raw) {
  const title = cleanSourceTitle(raw);
  if (title.length < 20) return false;
  if (/^error:\s*doi not found\b/i.test(title)) return false;
  if (/(?:\.\.\.|…)/.test(title)) return false;
  if (/\|\s*(?:$|[.\u2026])/u.test(title)) return false;
  if (/:\s*(?:hepatology|oncology|cancer|journal|pubmed)\s*$/i.test(title)) return false;
  return true;
}
function sourceTitleQuality(raw, abstract = null, journal = null) {
  const title = cleanSourceTitle(raw);
  return (isReaderReadySourceTitle(title) ? 1e3 : 0) + (abstract?.trim() ? 100 : 0) + (journal?.trim() ? 25 : 0) + Math.min(title.length, 300) / 300;
}
var OFF_CONTEXT_PRIMARY_BRANDS = /* @__PURE__ */ new Set(["fluorouracil:tolak"]);
function displayPrimaryBrand(canonical, primary) {
  const brand = String(primary ?? "").trim();
  if (!brand) return null;
  const key = `${String(canonical ?? "").trim().toLowerCase()}:${brand.toLowerCase()}`;
  return OFF_CONTEXT_PRIMARY_BRANDS.has(key) ? null : brand;
}
var PODCAST_BOILERPLATE_RE = /\b(?:learning objectives?|cme (?:information|credit)|disclosures?|this (?:episode|podcast) is (?:supported|sponsored)|supported by an educational grant|for more information|chapters?|timecodes?|timestamps?)\s*[:.\-]/i;
function dropRepeatedLead(text) {
  const words = text.split(" ");
  for (let size = Math.min(10, Math.floor(words.length / 2)); size >= 3; size--) {
    const a = words.slice(0, size).join(" ").toLowerCase();
    const b = words.slice(size, size * 2).join(" ").toLowerCase();
    if (a === b) return words.slice(size).join(" ");
  }
  return text;
}
function cleanPodcastDescription(raw) {
  let text = decodeBriefingText(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  text = dropRepeatedLead(text);
  const boilerplateAt = text.search(PODCAST_BOILERPLATE_RE);
  const creditsAt = text.search(/\b(?:hosted by|featuring)\s*:/i);
  const cuts = [boilerplateAt, creditsAt].filter((n) => n >= 0);
  if (cuts.length) text = text.slice(0, Math.min(...cuts)).trim();
  text = text.replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const kept = [];
  for (const sentence of completeSentences(text)) {
    if (!/[.!?]["\u201D')\]]*$/.test(sentence)) continue;
    if (sentence.length > 420) continue;
    if (kept.join(" ").length + sentence.length + 1 > 420) break;
    kept.push(sentence);
    if (kept.length === 2) break;
  }
  return kept.join(" ") || null;
}
var METHOD_LEAD_RE = /^(?:background|purpose|objective|methods?|design|setting|participants?|patients? were|the number of patients\b|between\b|from\s+\w+\s+\d|we (?:also )?(?:enrolled|randomly assigned|conducted|evaluated|assessed|examined|analy[sz]ed|studied)|a total of\b|eligible patients?\b|the (?:study|trial) enrolled\b|this (?:cohort )?study (?:evaluates|examines|describes)\b|this guideline has been updated\b|(?:this )?(?:asco )?living guidelines?\b|please see (?:the )?online dynamic version\b|updates are published regularly\b|see (?:the )?(?:(?:related )?article|appendix)\b|clinicaltrials?\s*[:.]?\s*gov\s+(?:identifier|number)\b|view all available purchase options\b|the following represents disclosure information\b|all relationships are considered compensated\b|for more information about asco(?:'s)? conflict of interest policy\b|featuring\b|hosted by\b|editor'?s choice\b|check out\b)/i;
var FINDING_SIGNAL_RE = /\b(?:associated with|improved|reduced|increased|decreased?|higher|lower|favou?red|benefit|survival|response|risk|hazard|superior|noninferior|non-inferior|did not|was not|showed|demonstrated|resulted|supports?|suggests?|effective|efficacy|safe|safety|outcomes?|achieved|met (?:the|its) endpoint)\b/i;
var INTERPRETIVE_FINDING_RE = /\b(?:(?:is|are|was|were) associated with|induced|demonstrated|showed|resulted in|improved|reduced|decreased?|suggests?|supports?|achieved|met (?:the|its) endpoint)\b/i;
var IMPACT_SIGNAL_RE = /\b(?:mortality|death|died|futility|concerning|concern|harm|toxicity|adverse|danger|hype|no evidence|unregulated|approval|practice[- ]changing|standard of care)\b/i;
var SPECIFICITY_SIGNAL_RE = /(?:\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\b|\b(?:NCT\d+|KEYNOTE-\w+|CheckMate-\w+)\b)/i;
var PROSE_PREDICATE_RE = /\b(?:is|are|was|were|be|been|being|has|have|had|can|could|may|might|will|would|should|did|does|do|occurred|received|treated|enrolled|reported|observed|found|met|led|induced|demonstrated|showed|resulted|improved|reduced|increased|decreased|suggests?|supports?|achieved|investigates?|reveals?)\b/i;
var DISCLOSURE_SENTENCE_RE = /^[\s("“]*(?:funded|funding|supported|sponsored|financial support|grant support)\b/i;
var displaySentence = (raw, max) => {
  const sentence = decodeBriefingText(raw).replace(/^\s*(?:BACKGROUND|PURPOSE|OBJECTIVE|METHODS?|RESULTS?|FINDINGS?|CONCLUSIONS?)\s*[:.]\s*/i, "").replace(/^["\u201C]+\s*|\s*["\u201D]+$/g, "").trim();
  if (!sentence || sentence.length < 20 || sentence.length > max) return null;
  if (!/[.!?][\"\u201D')\]]*$/.test(sentence)) return null;
  if (!/^[\"\u201C(]?[A-Z0-9]/.test(sentence)) return null;
  if ((sentence.match(/,/g)?.length ?? 0) >= 2 && !PROSE_PREDICATE_RE.test(sentence)) return null;
  return sentence;
};
function sourceFindingSentence(raw, max = 260) {
  const candidates = completeSentences(decodeBriefingText(raw));
  const valid = candidates.map((s) => displaySentence(s, max)).filter((s) => !!s);
  const substantive = valid.filter(
    (s) => !METHOD_LEAD_RE.test(s) && !DISCLOSURE_SENTENCE_RE.test(s) && !articleExcerptIsBoilerplate(s)
  );
  if (!substantive.length) return null;
  return substantive.map((sentence, index) => ({
    sentence,
    index,
    score: (FINDING_SIGNAL_RE.test(sentence) ? 20 : 0) + (INTERPRETIVE_FINDING_RE.test(sentence) ? 18 : 0) + (IMPACT_SIGNAL_RE.test(sentence) ? 18 : 0) + (SPECIFICITY_SIGNAL_RE.test(sentence) ? 12 : 0) + Math.min(sentence.length, max) / max
  })).sort((a, b) => b.score - a.score || a.index - b.index)[0]?.sentence ?? null;
}
function labelChangeIsReaderReady(eventType, diseaseAreas, sourceUrl) {
  if (eventType !== "drug_label_change") return true;
  return (diseaseAreas?.length ?? 0) > 0 && /^https?:\/\//i.test(String(sourceUrl ?? ""));
}
var FUTURE_APPROVAL_RE = /(?:\b(?:anticipated|expected|projected|likely)\b.{0,90}\bapproval\b|\b(?:support|lead to|result in|secure)\b.{0,70}\bapproval\b)/i;
function suppressOutdatedApprovalForecast(text, hasVerifiedApproval) {
  if (!text) return null;
  return hasVerifiedApproval && FUTURE_APPROVAL_RE.test(text) ? null : text;
}
function cleanVerbatimExcerpt(raw) {
  const text = decodeBriefingText(raw).replace(/^["\u201C]+\s*|\s*["\u201D]+$/g, "").trim();
  return text || null;
}
function abstractFindings(abstract, max = 260) {
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
var STANDALONE_NUM_RE = /(?<![A-Za-z0-9-])\d/;
function pickCleanSentence(texts, max = 216, opts) {
  for (let i = 0; i < texts.length; i++) {
    for (const raw of completeSentences(texts[i])) {
      const sent = raw.trim();
      if (!sent || !/[.!?]["\u201D')\]]*$/.test(sent)) continue;
      if (sent.length < 40) continue;
      const hasNum = STANDALONE_NUM_RE.test(sent);
      if (!hasNum) {
        if (sent.length > max) continue;
      } else {
        if (!opts?.verifyNumbers) continue;
        if (sent.length > (opts.maxVerified ?? max)) continue;
        if (!opts.verifyNumbers(sent, i)) continue;
      }
      if (!/^["\u201C(]?[A-Z]/.test(sent)) continue;
      return { sentence: sent, sourceIndex: i };
    }
  }
  return null;
}
var NUM_CORE = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;
var NUM_TOKEN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9.\-])(${NUM_CORE})(?:\s?[-–—]\s?(${NUM_CORE}))?(%?)` + String.raw`(?![A-Za-z0-9]|[-–—](?!(?:year|month|week|day|fold)s?\b))`,
  "g"
);
var toToken = (num, percent) => {
  const dot = num.indexOf(".");
  return { value: Number(num), precision: dot === -1 ? 0 : num.length - dot - 1, percent };
};
function extractStandaloneNumbers(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(NUM_TOKEN_RE)) {
    const percent = m[3] === "%";
    out.push(toToken(m[1], percent));
    if (m[2]) out.push(toToken(m[2], percent));
  }
  return out;
}
function numberVerifiesAgainstSource(gloss, sourceNums) {
  return sourceNums.some((s) => s.percent === gloss.percent && s.value === gloss.value);
}
function verifySentenceNumbers(sentence, transcriptText, sourceTexts) {
  const nums = extractStandaloneNumbers(sentence);
  if (!nums.length) return !STANDALONE_NUM_RE.test(sentence);
  const tNums = extractStandaloneNumbers(transcriptText);
  const sNums = sourceTexts.flatMap((t) => extractStandaloneNumbers(t));
  if (!tNums.length || !sNums.length) return false;
  return nums.every(
    (g) => tNums.some((t) => t.percent === g.percent && t.value === g.value) && numberVerifiesAgainstSource(g, sNums)
  );
}
function compareKolSignal(a, b) {
  return b.amp - a.amp || b.tweets - a.tweets || b.peakLikes - a.peakLikes;
}
function comparePaperSignal(a, b) {
  return b.kolSharers - a.kolSharers || b.publishers.length - a.publishers.length || b.topLikes - a.topLikes;
}
function compareEpisodeSignal(a, b) {
  return b.amplifierCount - a.amplifierCount || Math.min(b.convCount, 3) - Math.min(a.convCount, 3) || a.tier - b.tier || b.publishedAt.localeCompare(a.publishedAt);
}
var ONGOING_TRIAL_STATUSES = /* @__PURE__ */ new Set([
  "RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "ENROLLING_BY_INVITATION",
  "NOT_YET_RECRUITING"
]);
function cleanTrialAcronym(raw) {
  if (!raw) return null;
  const out = raw.replace(/[™®℠]/g, "").replace(/\s{2,}/g, " ").trim();
  return out || null;
}
function trialRecencyMs(pcd) {
  if (!pcd) return 0;
  const t = Date.parse(pcd);
  return Number.isNaN(t) ? 0 : t;
}
function compareTrialSignal(a, b) {
  const aScore = a.totalMentions + Number(a.resultsFresh);
  const bScore = b.totalMentions + Number(b.resultsFresh);
  return bScore - aScore || Number(b.resultsFresh) - Number(a.resultsFresh) || b.totalMentions - a.totalMentions || trialRecencyMs(b.primaryCompletionDate) - trialRecencyMs(a.primaryCompletionDate) || Number(ONGOING_TRIAL_STATUSES.has(b.status ?? "")) - Number(ONGOING_TRIAL_STATUSES.has(a.status ?? ""));
}

// supabase/functions/_shared/readoutAudioNarration.ts
var PAPER_SECTION_RE = /(?:^|\s)(BACKGROUND|IMPORTANCE|OBJECTIVE|OBJECTIVES|PURPOSE|METHOD|METHODS|DESIGN|FINDING|FINDINGS|OBSERVATIONS|RESULT|RESULTS|RESULTS AND LIMITATIONS|INTERPRETATION|CONCLUSION|CONCLUSIONS|CONCLUSIONS AND RELEVANCE|FUNDING|TRIAL REGISTRATION)\s*:\s*/gi;
var PAPER_SECTION_PREFIX_RE = /^(?:BACKGROUND|IMPORTANCE|OBJECTIVE|OBJECTIVES|PURPOSE|METHOD|METHODS|DESIGN|FINDING|FINDINGS|OBSERVATIONS|RESULT|RESULTS|RESULTS AND LIMITATIONS|INTERPRETATION|CONCLUSION|CONCLUSIONS|CONCLUSIONS AND RELEVANCE|FUNDING|TRIAL REGISTRATION)\s*:\s*/i;
var PAPER_OUTCOME_RE = /\b(?:adverse events?|confidence interval|disease control|DOR|event-free|hazard ratio|interstitial lung disease|ILD|mortality|objective response|odds ratio|ORR|OS|overall survival|PFS|pneumonitis|primary endpoint|progression-free|quality of life|relative risk|response rate|serious adverse|statistically significant|survival|toxicity|treatment-related)\b/i;
var PAPER_EFFICACY_OUTCOME_RE = /\b(?:best overall response|complete response|disease control|duration of response|DOR|event-free survival|EFS|FACIT-F|FACT-P|fatigue|objective response|ORR|overall response|overall survival|OS|patient-reported|progression-free survival|PFS|quality of life|response rate|survival|tumou?r shrinkage)\b/i;
var PAPER_RESULT_RE = /\b(?:achieved|associated|compared|decreased|demonstrated|did not|favou?red|found|higher|improved|increased|lower|met|not significant|reduced|resulted|showed|similar|superior|versus)\b/i;
var PAPER_INTERPRETATION_RE = /\b(?:findings|indicate|potential|provide|should|suggest|support|therefore|warrant)\b/i;
var PAPER_METHOD_RE = /\b(?:assigned|conducted|eligible|enrolled|full analysis set|methods?|participants were|patients received|randomly allocated|risk stratified|screened|study was|trial (?:used|was))\b/i;
var PAPER_OUTCOME_DEFINITION_RE = /\b(?:endpoint was|endpoints? included|exploratory endpoint|primary outcomes? (?:were|was)|(?:we|this (?:analysis|study|trial))\s+(?:report|assess|evaluate))\b/i;
var OUTCOME_EVENT_COUNT_RE = /\b(?:progression-free|overall|event-free|PFS|OS)\b[^.!?]{0,80}\bevents?\b[^.!?]{0,80}\bdeaths?\b/i;
var POPULATION_BURDEN_MORTALITY_RE = /\b(?:globally|in the (?:US|USA)|new cases|incident cases|incidence)\b/i;
function clean(value) {
  return String(value ?? "").replace(/<\/?[a-z][^>]*>/gi, " ").replace(/&amp;/gi, "and").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}
function sourceSentences(value) {
  return clean(value).split(/(?<!\bU\.S\.)(?<!\bDr\.)(?<!\bvs\.)(?<=[.!?])\s+(?=[A-Z0-9(\[])/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length >= 24 && /[.!?]$/.test(sentence));
}
function paperSourceSentences(value) {
  return sourceSentences(value).map(
    (sentence) => sentence.replace(PAPER_SECTION_PREFIX_RE, "").trim()
  ).filter(Boolean);
}
var DESIGN_LIMITATIONS = [
  /\bsingle[- ]arm\b/i,
  /\bphase\s*(?:1|I)(?![\dI])/i,
  /\bhistorical[- ]control/i,
  /\b(?:externally controlled|external control(?: cohort)?)\b/i,
  /\bpreclinical\b/i
];
var EXTERNALLY_CONTROLLED_PHASE_2 = /\bexternally controlled,?\s+phase\s*2\b/i;
function relevantDesignLimitations(source) {
  const limitations = /\bsingle[- ]arm\b|\brandomi[sz]ed\b|\bphase\s*(?:[1-4]|I{1,3})(?![\dI])/i.test(source) ? DESIGN_LIMITATIONS.slice(0, 4) : DESIGN_LIMITATIONS;
  return EXTERNALLY_CONTROLLED_PHASE_2.test(source) ? [...limitations, EXTERNALLY_CONTROLLED_PHASE_2] : limitations;
}
var RANDOMIZED_STUDY = /\b(?:randomi[sz]ed(?: controlled)? (?:trial|study)|(?:trial|study) was randomi[sz]ed|randomly assigned)\b/i;
var OBSERVATIONAL_STUDY = /\b(?:real[- ]world|observational|retrospective|prospective)\b[^.]{0,50}\b(?:cohort|registry|database)\b(?: study| analysis)?/i;
var OBSERVATIONAL_RECAP_DESIGN = /\b(?:real[- ]world|observational|retrospective|prospective cohort|non[- ]?randomi[sz]ed)\b/i;
var OBSERVATIONAL_LIMITATION = /\b(?:non[- ]?randomi[sz]ed|confound\w*|cannot (?:establish|prove)|does not (?:establish|prove)|cannot infer causality|causality cannot be inferred)\b/i;
var OBSERVATIONAL_CAUSAL_CLAIM = /\b(?:improv(?:e[sd]?|ing)|influenc(?:e[sd]?|ing)|lead(?:s|ing)? to|led to|result(?:s|ed|ing)? in|driv(?:e[sn]?|ing)|boost(?:s|ed|ing)?)\b/i;
var SOURCE_METADATA_ABSENCE_CLAIM = /\b(?:details?|information|data)\b[^.!?]{0,140}\b(?:were|was|are|is)\s+not\s+(?:reported|provided|available|described)\b[^.!?]{0,80}\b(?:abstract|source(?: text)?)\b/i;
var UNSUPPORTED_ABSENCE_CLAIM = /\b(?:do(?:es)? not|did not)\s+(?:provide|report|include|describe)\b[^.!?]{0,140}\b(?:outcomes?|outcome data|safety profiles?|safety data|specific data)\b/i;
var GENERIC_LIMITATION_CLAIM = /\b(?:not without limitations?|(?:study|trial|design|analysis)\s+(?:has|had|was)\s+(?:not without |limited by |subject to )?limitations?)\b/i;
var STATED_LIMITATION = /(?:\blimitations?\s*:|\blimitations? (?:include|included|were|are)\b|\blimited by\b|\bsubject to limitations?\b|\bshould be interpreted (?:with )?caution\b|\bmust be interpreted (?:with )?caution\b)/i;
function recapAvoidsUnsupportedBoilerplate(source, recap) {
  if (SOURCE_METADATA_ABSENCE_CLAIM.test(recap) || UNSUPPORTED_ABSENCE_CLAIM.test(recap)) return false;
  return !GENERIC_LIMITATION_CLAIM.test(recap) || STATED_LIMITATION.test(source);
}
function sourceIsObservationalStudy(source) {
  const sentences2 = sourceSentences(source);
  if (sentences2.some((sentence) => RANDOMIZED_STUDY.test(sentence))) {
    return false;
  }
  return sentences2.some(
    (sentence) => OBSERVATIONAL_STUDY.test(sentence) && !/^\s*(?:earlier|prior|previous|background)\b/i.test(sentence)
  );
}
function observationalRecapIsQualified(source, recap) {
  if (!sourceIsObservationalStudy(source)) return true;
  if (!OBSERVATIONAL_RECAP_DESIGN.test(recap) || !OBSERVATIONAL_LIMITATION.test(recap)) {
    return false;
  }
  return !OBSERVATIONAL_CAUSAL_CLAIM.test(recap);
}
var SAFETY = /\b(?:adverse events?|cytokine release syndrome|CRS|immune effector cell-associated neurotoxicity syndrome|ICANS|interstitial lung disease|ILD|pneumonitis|toxicit\w*|infections?|deaths?|fatal\w*)\b/i;
var HIGH_GRADE_SAFETY = /\bgrade\s*(?:≥|>=?)?\s*(?:[3-5]|III|IV|V)(?:\s*(?:\/|or|-|–)\s*(?:[3-5]|III|IV|V))?\b/i;
function importantSafety(sentence) {
  if (PAPER_OUTCOME_DEFINITION_RE.test(sentence) || OUTCOME_EVENT_COUNT_RE.test(sentence) || POPULATION_BURDEN_MORTALITY_RE.test(sentence) && /\b(?:deaths?|died)\b/i.test(sentence)) return false;
  const severe = /\bserious\b/i.test(sentence) || HIGH_GRADE_SAFETY.test(sentence) || /\b(?:deaths?|died|fatal\w*)\b/i.test(sentence);
  const quantified = /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(
    sentence
  );
  return (SAFETY.test(sentence) || HIGH_GRADE_SAFETY.test(sentence)) && severe && (quantified || /\b(?:deaths?|died|fatal\w*)\b/i.test(sentence));
}
var SAMPLE_NOUN = "(?:patients?|participants?|subjects?)(?!-)";
var SMALL_ONES = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
};
var SMALL_TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};
function reportedSampleSize(value) {
  const text = clean(value);
  const randomizedTotal = /\b(\d[\d,]*)\s+(?:men|women|patients?|participants?|subjects?)\s+were\s+(?:(?:enrolled|included|then|and)\s+){0,3}randomly assigned\b/i.exec(text)?.[1];
  if (randomizedTotal) return Number(randomizedTotal.replace(/,/g, ""));
  for (const match of text.matchAll(/\bn\s*=\s*(\d[\d,]*)\b/gi)) {
    const start = Math.max(0, (match.index ?? 0) - 96);
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 16);
    if (new RegExp(`\\b${SAMPLE_NOUN}\\b`, "i").test(text.slice(start, end))) {
      return Number(match[1].replace(/,/g, ""));
    }
  }
  const digits = new RegExp(`\\b(\\d[\\d,]*)\\s+${SAMPLE_NOUN}\\b`, "i").exec(
    text
  )?.[1];
  if (digits) return Number(digits.replace(/,/g, ""));
  const words = new RegExp(
    `\\b(${[...Object.keys(SMALL_ONES), ...Object.keys(SMALL_TENS)].join("|")})(?:[- ](${Object.keys(SMALL_ONES).slice(0, 9).join("|")}))?\\s+${SAMPLE_NOUN}\\b`,
    "i"
  ).exec(text);
  if (!words) return null;
  const first = words[1].toLowerCase();
  const second = words[2]?.toLowerCase();
  return (SMALL_ONES[first] ?? SMALL_TENS[first] ?? 0) + (second ? SMALL_ONES[second] ?? 0 : 0);
}
function reportedDeathCount(value) {
  const text = clean(value);
  const modifiers = "(?:(?:patients?|participants?|subjects?|treatment-emergent)\\s+){0,2}";
  const digits = new RegExp(`\\b(\\d+)\\s+${modifiers}(?:died|deaths?)\\b`, "i").exec(text)?.[1];
  if (digits) return Number(digits);
  const words = new RegExp(
    `\\b(${[...Object.keys(SMALL_ONES), ...Object.keys(SMALL_TENS)].join("|")})(?:[- ](${Object.keys(SMALL_ONES).slice(0, 9).join("|")}))?\\s+${modifiers}(?:died|deaths?)\\b`,
    "i"
  ).exec(text);
  if (!words) return null;
  const first = words[1].toLowerCase();
  const second = words[2]?.toLowerCase();
  return (SMALL_ONES[first] ?? SMALL_TENS[first] ?? 0) + (second ? SMALL_ONES[second] ?? 0 : 0);
}
function sameReportedSample(value, expected) {
  return reportedSampleSize(value) === expected;
}
function comparableNumber(value) {
  return value.replace(/%$/, "");
}
function numericEfficacySentences(value) {
  return paperSourceSentences(value).filter(
    (sentence) => PAPER_EFFICACY_OUTCOME_RE.test(sentence) && /\d|%/.test(sentence) && !PAPER_OUTCOME_DEFINITION_RE.test(sentence) && !OUTCOME_EVENT_COUNT_RE.test(sentence)
  );
}
function explicitPopulationContextSentences(value) {
  return paperSourceSentences(value).filter(
    (sentence) => /\b(?:treated|received|enrolled|included|assessed|analys[ez]d|adjudicated)\b/i.test(sentence) && /\b(?:patients?|participants?|subjects?|cases?|cohorts?|analysis sets?)\b/i.test(sentence) && /\b\d[\d,]*(?:\.\d+)?\b/.test(sentence)
  );
}
function recapCoversHarmPopulation(source, recap) {
  if (!materialSafetySentences(source).length) return true;
  const singleArm = /\bsingle[- ]arm\b/i.test(source);
  const contexts = explicitPopulationContextSentences(source).filter(
    (context) => !singleArm || !historicalComparatorSuperiority(context)
  );
  if (!contexts.length) return true;
  const recapNumbers = new Set(normalizedNumbers(recap).map(comparableNumber));
  return contexts.some((context) => {
    const numbers = normalizedNumbers(context).map(comparableNumber);
    const denominator = reportedSampleSize(context) != null ? String(reportedSampleSize(context)) : numbers[0];
    const adjudicated = /\b(\d[\d,]*)\s+(?:were\s+)?adjudicated\b/i.exec(context)?.[1]?.replace(/,/g, "");
    const required = [denominator, adjudicated].filter(Boolean);
    return required.every((number) => recapNumbers.has(number));
  });
}
function recapCoversNumericEfficacy(source, recap) {
  const efficacy = numericEfficacySentences(source);
  if (!efficacy.length) return true;
  if (!PAPER_EFFICACY_OUTCOME_RE.test(recap)) return false;
  const sourceNumbers = new Set(
    efficacy.flatMap(normalizedNumbers).map(comparableNumber)
  );
  return normalizedNumbers(recap).map(comparableNumber).some(
    (number) => sourceNumbers.has(number)
  );
}
function materialSafetySentences(value) {
  return paperSourceSentences(value).filter(importantSafety).slice(0, 2);
}
function recapCoversMaterialSafety(source, recap) {
  const safety = materialSafetySentences(source);
  if (!safety.length) return true;
  if (!SAFETY.test(recap)) return false;
  for (const sentence of safety) {
    if (HIGH_GRADE_SAFETY.test(sentence)) {
      if (!HIGH_GRADE_SAFETY.test(recap)) return false;
      const rate = normalizedNumbers(sentence).find(
        (number) => number.endsWith("%")
      );
      if (rate && !normalizedNumbers(recap).map(comparableNumber).includes(
        comparableNumber(rate)
      )) return false;
    }
    if (/\b(?:deaths?|died)\b/i.test(sentence) && !/\b(?:deaths?|died)\b/i.test(recap)) return false;
    const deathCount = reportedDeathCount(sentence);
    if (deathCount != null && reportedDeathCount(recap) !== deathCount) {
      return false;
    }
    if (/\bfatal\w*\b/i.test(sentence) && !/\bfatal\w*\b/i.test(recap)) {
      return false;
    }
    if (/\bfatal\w*\b/i.test(sentence) && /\binfections?\b/i.test(sentence) && !/\binfections?\b/i.test(recap)) return false;
  }
  return true;
}
function paperRecapCoversSourceContext(source, recap) {
  if (!recapAvoidsUnsupportedBoilerplate(source, recap)) return false;
  if (relevantDesignLimitations(source).some(
    (pattern) => pattern.test(source) && !pattern.test(recap)
  )) return false;
  if (!observationalRecapIsQualified(source, recap)) return false;
  const sample = reportedSampleSize(source);
  if (sample != null && !sameReportedSample(recap, sample)) return false;
  if (!recapCoversHarmPopulation(source, recap)) return false;
  return recapCoversNumericEfficacy(source, recap) && recapCoversMaterialSafety(source, recap);
}
function paperSections(value) {
  const text = clean(value);
  const matches = [...text.matchAll(PAPER_SECTION_RE)];
  const sections = /* @__PURE__ */ new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const name = String(match[1] ?? "").toUpperCase();
    const start = Number(match.index ?? 0) + match[0].length;
    const end = Number(matches[index + 1]?.index ?? text.length);
    const body = text.slice(start, end).trim();
    if (body) sections.set(name, body);
  }
  return sections;
}
function paperSentenceScore(sentence) {
  let score = 0;
  if (PAPER_OUTCOME_RE.test(sentence)) score += 8;
  if (PAPER_RESULT_RE.test(sentence)) score += 6;
  if (PAPER_INTERPRETATION_RE.test(sentence)) score += 4;
  if (/\d|%|\bp\s*[<=>]|\bHR\b|\bCI\b/i.test(sentence) && (PAPER_OUTCOME_RE.test(sentence) || PAPER_RESULT_RE.test(sentence) || PAPER_INTERPRETATION_RE.test(sentence))) score += 5;
  if (/\b(?:versus|vs\.?|compared with|compared to)\b/i.test(sentence)) {
    score += 3;
  }
  if (PAPER_METHOD_RE.test(sentence) && !PAPER_OUTCOME_RE.test(sentence)) {
    score -= 12;
  }
  if (PAPER_OUTCOME_DEFINITION_RE.test(sentence)) {
    score -= 15;
  }
  if (/\b(?:median follow-up|funded by|registered with)\b/i.test(sentence)) {
    score -= 8;
  }
  if (/\b(?:hazard ratio|\bHR\b|estimated \d)/i.test(sentence)) score += 5;
  if (/\b(?:events?|follow-up)\b/i.test(sentence) && !/\b(?:hazard ratio|\bHR\b|estimated \d)/i.test(sentence)) score -= 6;
  return score;
}
function historicalComparatorSuperiority(sentence) {
  return /\b(?:historical|external)\b/i.test(sentence) && /\b(?:benefit|better|doubled|higher|improv(?:e[sd]?|ing)|lower|superior|tripled|versus|compared)\b/i.test(sentence);
}
function operationalSentence(sentence) {
  return /\b(?:appointments?|billing|care delivery|communication|digital|electronic health record|in-?basket|workflow)\b/i.test(sentence);
}
function paperContextSentences(value) {
  const sentences2 = paperSourceSentences(value);
  const limitations = relevantDesignLimitations(value).filter(
    (pattern) => pattern.test(value)
  );
  const sample = reportedSampleSize(value);
  const selected = [];
  const uncovered = new Set(limitations);
  const externalControlResult = sentences2.find(
    (sentence) => /\bexternal control(?: cohort)?\b/i.test(sentence) && !PAPER_METHOD_RE.test(sentence)
  );
  if (externalControlResult) {
    selected.push(externalControlResult);
    for (const pattern of [...uncovered]) {
      if (pattern.test(externalControlResult)) uncovered.delete(pattern);
    }
  }
  while (uncovered.size) {
    const candidates = sentences2.map((sentence, index) => ({
      sentence,
      index,
      coverage: [...uncovered].filter(
        (pattern) => pattern.test(sentence)
      ).length,
      hasSample: sample != null && sameReportedSample(sentence, sample),
      isMethod: PAPER_METHOD_RE.test(sentence)
    })).filter(
      ({ sentence, coverage }) => coverage > 0 && !selected.includes(sentence)
    );
    const candidate = (candidates.some(({ isMethod }) => !isMethod) ? candidates.filter(({ isMethod }) => !isMethod) : candidates).sort(
      (left, right) => right.coverage - left.coverage || Number(right.hasSample) - Number(left.hasSample) || Number(left.isMethod) - Number(right.isMethod) || left.index - right.index
    )[0];
    if (!candidate) break;
    selected.push(candidate.sentence);
    for (const pattern of [...uncovered]) if (pattern.test(candidate.sentence)) uncovered.delete(pattern);
  }
  if (sample != null && !selected.some((sentence) => sameReportedSample(sentence, sample))) {
    const sampleSentence = sentences2.find(
      (sentence) => sameReportedSample(sentence, sample)
    );
    if (sampleSentence) selected.push(sampleSentence);
  }
  return selected;
}
function paperAbstractRecap(value, maxWords = 120) {
  const text = clean(value);
  if (!text) return null;
  const singleArm = /\bsingle[- ]arm\b/i.test(text);
  const sections = paperSections(text);
  const resultText = ["FINDINGS", "FINDING", "OBSERVATIONS", "RESULTS AND LIMITATIONS", "RESULTS", "RESULT"].map((name) => sections.get(name)).find(Boolean) ?? (sections.size ? "" : text);
  const interpretationText = ["INTERPRETATION", "CONCLUSIONS AND RELEVANCE", "CONCLUSIONS", "CONCLUSION"].map((name) => sections.get(name)).find(Boolean) ?? "";
  const resultCandidates = paperSourceSentences(resultText).map((sentence, index) => ({
    sentence,
    index,
    score: paperSentenceScore(sentence)
  })).filter(
    ({ sentence, score }) => score >= 5 && (!singleArm || !historicalComparatorSuperiority(sentence))
  ).sort((left, right) => right.score - left.score || left.index - right.index).slice(0, 2).sort((left, right) => left.index - right.index).map(({ sentence }) => sentence);
  const conclusionSentences = paperSourceSentences(interpretationText).filter((sentence) => !singleArm || !historicalComparatorSuperiority(sentence));
  const conclusion = conclusionSentences[0];
  const interpretation = paperSourceSentences(interpretationText).map((sentence, index) => ({
    sentence,
    index,
    score: paperSentenceScore(sentence)
  })).filter(
    ({ sentence, score }) => score >= 4 && (!singleArm || !historicalComparatorSuperiority(sentence))
  ).sort(
    (left, right) => right.score - left.score || left.index - right.index
  )[0]?.sentence;
  const efficacy = numericEfficacySentences(text).find(
    (sentence) => !singleArm || !historicalComparatorSuperiority(sentence)
  );
  if (!resultCandidates.length && !efficacy && !interpretation) return null;
  const baseContext = paperContextSentences(text);
  const safety = materialSafetySentences(text);
  const sample = reportedSampleSize(text);
  const harmPopulation = safety.length ? explicitPopulationContextSentences(text).filter(
    (sentence) => !singleArm || !historicalComparatorSuperiority(sentence)
  ).sort(
    (left, right) => Number(sample != null && sameReportedSample(right, sample)) - Number(sample != null && sameReportedSample(left, sample))
  ).slice(0, 1) : [];
  const substantiveResults = resultCandidates.filter(
    (sentence) => !operationalSentence(sentence)
  );
  const preferredInterpretation = interpretation ?? (resultCandidates.length && !substantiveResults.length ? conclusion : void 0);
  const principalResult = efficacy ?? substantiveResults[0] ?? preferredInterpretation ?? resultCandidates[0];
  const context = baseContext.filter(
    (sentence) => (!singleArm || !historicalComparatorSuperiority(sentence)) && (Boolean(efficacy || substantiveResults.length) || !operationalSentence(sentence))
  );
  const mandatory = [
    ...new Set([
      ...context,
      ...harmPopulation,
      principalResult,
      ...safety,
      // When a workflow paper has no clinical endpoint candidate, retain the
      // complete source-stated conclusion rather than a generic first clause.
      ...!efficacy && !substantiveResults.length ? conclusionSentences : []
    ].filter(Boolean))
  ];
  const supplementalResults = efficacy || substantiveResults.length ? resultCandidates : [];
  const sourceOrder = new Map(paperSourceSentences(text).map((sentence, index) => [
    sentence,
    index
  ]));
  const selected = [.../* @__PURE__ */ new Set([
    ...mandatory,
    ...supplementalResults,
    ...preferredInterpretation ? [preferredInterpretation] : []
  ])].sort(
    (left, right) => (sourceOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (sourceOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
  if (!selected.length) return null;
  const bounded = [];
  let words = 0;
  for (const sentence of selected) {
    const count = sentence.split(/\s+/).filter(Boolean).length;
    if (!mandatory.includes(sentence) && bounded.length && words + count > maxWords) continue;
    bounded.push(sentence);
    words += count;
  }
  return bounded.join(" ") || null;
}
function normalizedNumbers(value) {
  const text = clean(value).replace(/[−–—]/g, "-");
  const numbers = text.match(/\b\d+(?:\.\d+)?%?/g) ?? [];
  const sample = reportedSampleSize(text);
  if (sample != null && !numbers.includes(String(sample))) {
    numbers.push(String(sample));
  }
  const deaths = reportedDeathCount(text);
  if (deaths != null && !numbers.includes(String(deaths))) {
    numbers.push(String(deaths));
  }
  return numbers;
}

// supabase/functions/_shared/urlIdentity.ts
var REMOVABLE_QUERY_PARAM = /^(?:utm_.+|fbclid|gclid|dclid|msclkid|mc_.+|guestaccesskey|login|redirectedfrom|st)$/i;
function normalizedUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    for (const key of [...url.searchParams.keys()]) {
      if (REMOVABLE_QUERY_PARAM.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url;
  } catch {
    return null;
  }
}
function canonicalUrlIdentity(value) {
  const url = normalizedUrl(value);
  if (!url) return "";
  return `${url.hostname}${url.pathname}${url.search}`;
}
function externalUrlQueryVariants(values) {
  const variants = /* @__PURE__ */ new Set();
  for (const value of values) {
    if (!value) continue;
    variants.add(value);
    let original;
    try {
      original = new URL(value);
    } catch {
      continue;
    }
    original.hash = "";
    const cleaned = normalizedUrl(value);
    if (!cleaned) continue;
    const protocols = /^https?:$/.test(original.protocol) ? ["https:", "http:"] : [original.protocol];
    const hosts = [.../* @__PURE__ */ new Set([cleaned.hostname, `www.${cleaned.hostname}`])];
    const paths = cleaned.pathname === "/" ? ["/"] : [cleaned.pathname, `${cleaned.pathname}/`];
    const searches = [.../* @__PURE__ */ new Set([original.search, cleaned.search])];
    for (const protocol of protocols) for (const host of hosts) for (const path of paths) for (const search of searches) {
      variants.add(`${protocol}//${host}${path}${search}`);
    }
  }
  return [...variants];
}

// supabase/functions/_shared/readoutTruth.ts
var cleanDoi = (value) => {
  let doi = String(value ?? "").trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
  if (/^10\.(?:1101|64898)\/\d{4}\.\d{2}\.\d{2}\.\d+v\d+$/i.test(doi)) {
    doi = doi.replace(/v\d+$/i, "");
  }
  return doi || null;
};
var cleanUrl = (value) => {
  return canonicalUrlIdentity(value) || null;
};
function bibliographicIdentity(input) {
  const pmid = String(input.pmid ?? "").trim() || null;
  const doi = cleanDoi(input.article_doi ?? input.doi);
  const aliases = [
    ...pmid ? [`pmid:${pmid}`] : [],
    ...doi ? [`doi:${doi}`] : []
  ];
  return { pmid, doi, aliases, key: aliases[0] ?? null };
}
function readerArticleUrl(input) {
  const identity = bibliographicIdentity(input);
  const validated = String(input.validated_publisher_url ?? "").trim();
  if (input.publisher_url_status === "valid" && /^https?:\/\//i.test(validated)) return validated;
  if (identity.pmid && /^\d+$/.test(identity.pmid)) {
    return `https://pubmed.ncbi.nlm.nih.gov/${identity.pmid}/`;
  }
  return null;
}
var NON_PRIMARY_PUBLICATION_TYPES = /* @__PURE__ */ new Set([
  "comment",
  "commentary",
  "personal narrative",
  "editorial",
  "editorial material",
  "guideline",
  "letter",
  "meta analysis",
  "news",
  "news and views",
  "newspaper article",
  "practice guideline",
  "review",
  "systematic review"
]);
var normalizedPublicationTypes = (values) => (Array.isArray(values) ? values : []).map((value) => String(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()).filter(Boolean);
var publisherSectionSignalsCommentary = (values) => normalizedPublicationTypes(values).some(
  (value) => /^publisher section /.test(value) && /\b(?:comments?|commentary|editorials?|opinions?|perspectives?|viewpoints?|correspondence|letters?|news|clinical implications of basic (?:research|science))\b/.test(value)
);
function publicationTypesExcludePrimaryResearch(values) {
  return normalizedPublicationTypes(values).some((value) => NON_PRIMARY_PUBLICATION_TYPES.has(value)) || publisherSectionSignalsCommentary(values);
}
function abstractOpensAsIssueCommentary(value) {
  const abstract = String(value ?? "").trim();
  return /^in this issue of\s+[^.!?]{1,100},\s+[A-Z][A-Za-z-]+\s+et al\.?,?\s+(?:investigate|report|describe|show|demonstrate|present)\b/i.test(abstract);
}
function publicationClass(input) {
  if (publicationIsPreprint(input)) return "preprint";
  if (publisherSectionSignalsCommentary(input.pub_types)) return "commentary";
  const types = normalizedPublicationTypes(input.pub_types);
  if (types.some((type) => /review|meta analysis/.test(type))) return "review";
  if (types.some((type) => /guideline/.test(type))) return "guideline";
  if (publicationTypesExcludePrimaryResearch(input.pub_types) || /voices\.nejm\.org/i.test(input.canonical_url ?? input.url ?? "")) return "commentary";
  if (abstractOpensAsIssueCommentary(input.abstract)) return "commentary";
  if (types.some((type) => /^publisher section original ?paper$/.test(type))) return "research";
  if (types.some((type) => /^(?:journal article|clinical trial.*|randomized controlled trial|controlled clinical trial|observational study|comparative study|evaluation study|case reports|clinical study)$/.test(type))) return "research";
  const abstract = String(input.abstract ?? "").trim();
  const structuredResults = /\b(?:results?|findings|conclusions?|interpretation)\s*:/i.test(abstract);
  const explicitStudy = /\bwe (?:conducted|enrolled|randomi[sz]ed|evaluated)\b/i.test(abstract) && /\b(?:single.arm|randomi[sz]ed|phase [123]|prospective|retrospective)\b/i.test(abstract) && /\b(?:patients?|participants?|subjects?)\b/i.test(abstract) && /\d/.test(abstract);
  if ((input.pmid || cleanDoi(input.article_doi ?? input.doi)) && abstract.length >= 200 && (structuredResults || explicitStudy)) return "research";
  return "unknown";
}
function publicationIsResearchSource(input) {
  return ["research", "preprint"].includes(publicationClass(input));
}
function publicationIsPreprint(input) {
  const doi = cleanDoi(input.article_doi ?? input.doi) ?? "";
  const source = [input.journal, input.domain, input.canonical_url, input.url, input.validated_publisher_url].filter(Boolean).join(" ").toLowerCase();
  return /\b(?:biorxiv|medrxiv)\b/.test(source) || /(?:researchsquare\.com|ssrn\.com)/.test(source) || /^10\.(?:1101|64898)\//.test(doi);
}
function bibliographicIdentifiersConflict(a, b) {
  const left = bibliographicIdentity(a);
  const right = bibliographicIdentity(b);
  return !!(left.pmid && right.pmid && left.pmid !== right.pmid || left.doi && right.doi && left.doi !== right.doi);
}
function bibliographicIdentitiesMatch(a, b) {
  if (bibliographicIdentifiersConflict(a, b)) return false;
  const left = bibliographicIdentity(a);
  const right = bibliographicIdentity(b);
  return !!(left.pmid && left.pmid === right.pmid || left.doi && left.doi === right.doi);
}
function paperIdentifiersCompatible(a, b) {
  return !bibliographicIdentifiersConflict(a, b);
}
function paperIdentityAliases(input) {
  const bibliographic = bibliographicIdentity(input);
  const title = normTitle(input.title ?? "").trim();
  const url = cleanUrl(input.canonical_url ?? input.url);
  const venue = [input.journal, input.domain].map((value) => normTitle(String(value ?? "")).trim()).find(Boolean) ?? "";
  return [
    ...bibliographic.aliases,
    ...title && venue ? [`title:${title}:venue:${venue}`] : [],
    ...url ? [`url:${url}`] : []
  ];
}
var PaperIdentityIndex = class {
  aliasToKey = /* @__PURE__ */ new Map();
  ambiguousAliases = /* @__PURE__ */ new Set();
  strongByKey = /* @__PURE__ */ new Map();
  strongAliases(input) {
    const identity = bibliographicIdentity(input);
    return {
      pmid: new Set(identity.pmid ? [`pmid:${identity.pmid}`] : []),
      doi: new Set(identity.doi ? [`doi:${identity.doi}`] : [])
    };
  }
  conflicts(key, incoming) {
    const held = this.strongByKey.get(key);
    if (!held) return false;
    const differs = (left, right) => left.size > 0 && right.size > 0 && ![...left].some((value) => right.has(value));
    return differs(held.pmid, incoming.pmid) || differs(held.doi, incoming.doi);
  }
  resolve(input) {
    const aliases = paperIdentityAliases(input);
    if (!aliases.length) return { key: null, absorbedKeys: [] };
    const incoming = this.strongAliases(input);
    const existing = [...new Set(aliases.filter((alias) => !this.ambiguousAliases.has(alias)).map((alias) => this.canonicalKey(this.aliasToKey.get(alias) ?? null)).filter((key2) => !!key2))];
    const compatible = existing.filter((key2) => !this.conflicts(key2, incoming));
    const incompatible = new Set(existing.filter((key2) => !compatible.includes(key2)));
    for (const alias of aliases) {
      const current = this.canonicalKey(this.aliasToKey.get(alias) ?? null);
      if (current && incompatible.has(current)) {
        this.ambiguousAliases.add(alias);
        this.aliasToKey.delete(alias);
      }
    }
    const availableAliases = aliases.filter((alias) => !this.ambiguousAliases.has(alias));
    const preferredAlias = availableAliases.find((alias) => alias.startsWith("pmid:")) ?? availableAliases.find((alias) => alias.startsWith("doi:")) ?? availableAliases[0];
    const key = compatible[0] ?? preferredAlias ?? null;
    if (!key) return { key: null, absorbedKeys: [] };
    const absorbedKeys = compatible.slice(1).filter((value) => value !== key);
    if (absorbedKeys.length) {
      const absorbed = new Set(absorbedKeys);
      for (const [alias, value] of this.aliasToKey) {
        if (absorbed.has(this.canonicalKey(value) ?? value)) this.aliasToKey.set(alias, key);
      }
    }
    const merged = this.strongByKey.get(key) ?? { pmid: /* @__PURE__ */ new Set(), doi: /* @__PURE__ */ new Set() };
    for (const absorbed of absorbedKeys) {
      const values = this.strongByKey.get(absorbed);
      values?.pmid.forEach((value) => merged.pmid.add(value));
      values?.doi.forEach((value) => merged.doi.add(value));
      this.strongByKey.delete(absorbed);
    }
    incoming.pmid.forEach((value) => merged.pmid.add(value));
    incoming.doi.forEach((value) => merged.doi.add(value));
    this.strongByKey.set(key, merged);
    for (const alias of aliases) if (!this.ambiguousAliases.has(alias)) this.aliasToKey.set(alias, key);
    for (const absorbed of absorbedKeys) this.aliasToKey.set(absorbed, key);
    return { key, absorbedKeys };
  }
  canonicalKey(value) {
    if (!value) return null;
    let current = value;
    const seen = /* @__PURE__ */ new Set();
    while (this.aliasToKey.has(current) && !seen.has(current)) {
      seen.add(current);
      const next = this.aliasToKey.get(current);
      if (next === current) break;
      current = next;
    }
    return current;
  }
};
var parsedDate = (value) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
};
function preferPaperRecord(current, candidate, nowMs = Date.now()) {
  const validDate = (value) => {
    const date = parsedDate(value);
    return date != null && date >= Date.UTC(1900, 0, 1) && date <= nowMs + 45 * 864e5;
  };
  const score = (value) => (value.publisher_url_status === "valid" && value.validated_publisher_url ? 2e3 : 0) + (value.pmid ? 1e3 : 0) + (cleanDoi(value.article_doi ?? value.doi) ? 800 : 0) + (value.journal ? 200 : 0) + Math.min(150, String(value.abstract ?? "").length / 10) + Math.min(50, String(value.description ?? "").length / 20) + (validDate(value.pub_date) ? 10 : 0);
  return score(candidate) > score(current) ? candidate : current;
}
function paperCirculationState(paper, nowMs, recentDays = 14) {
  const published = parsedDate(paper.pub_date);
  if (published == null) return "publication_date_unknown";
  if (published > nowMs + 45 * 864e5) return "publication_date_unknown";
  return published >= nowMs - recentDays * 864e5 ? "newly_published" : "resurfaced";
}
function authoritativePaperExcerpt(paper, max = 320) {
  const source = paper.abstract || paper.description;
  const finding = abstractFindings(paper.abstract, max) ?? abstractFindings(paper.description, max);
  if (source && finding && !paperRecapCoversSourceContext(source, finding)) {
    const balanced = paperAbstractRecap(source, 95);
    if (balanced && paperRecapCoversSourceContext(source, balanced)) return balanced;
    return null;
  }
  return finding;
}
function readerPaperContext(paper) {
  const abstract = String(paper.abstract ?? "").trim();
  const description = String(paper.description ?? "").trim();
  const disclosureOnly = /(?:view all available purchase options|disclosure information provided by authors|relationships? (?:are considered|are self-held|may not relate)|asco(?:'s)? conflict of interest policy)/i.test(description);
  return {
    // Compact copy may fail closed when it cannot retain design, outcome, and
    // safety context. The complete, verbatim abstract remains reader-visible.
    abstract: abstract && abstractFindings(abstract, 900) ? abstract : null,
    description: disclosureOnly ? null : authoritativePaperExcerpt({ abstract: null, description })
  };
}
var REPRODUCTIVE_BIOLOGY_RE = /\b(?:ovarian\s+(?:ag(?:e|ing|eing)|reserve)|reproductive\s+(?:ag(?:e|ing|eing)|lifespan)|fertility|infertility|menopaus(?:e|al)|oocytes?|follicles?)\b/i;
var ONCOLOGY_CONTEXT_RE = /\b(?:cancer|carcinoma|tumou?r|oncolog|neoplasm|malignan|metasta|recurr|survival|response|progression|chemotherap|immunotherap|radiotherap|adjuvant|neoadjuvant|maintenance|phase\s*[1-4iIvV]+|randomi[sz]ed|trial)\b/i;
function articleIsOncologyEligible(article) {
  if (article.onc_relevant !== true || article.promotional === true) return false;
  const title = String(article.title ?? "");
  return !REPRODUCTIVE_BIOLOGY_RE.test(title) || ONCOLOGY_CONTEXT_RE.test(title);
}
var LEGAL_ENTITY_RE = /(?:^|[\s,])(?:l\.?l\.?c\.?|p\.?l\.?l\.?c\.?|l\.?l\.?p\.?|p\.?c\.?|incorporated|inc\.?|corp(?:oration)?\.?|limited liability company)(?:$|[\s,])/i;
function isBillingOrLegalEntityAffiliation(value) {
  return LEGAL_ENTITY_RE.test(String(value ?? "").trim());
}
function publicProfessionalAffiliation(input) {
  const reviewed = String(input.reviewed ?? "").trim();
  const source = String(input.reviewedSource ?? "").trim();
  if (!reviewed || input.reviewedConfidence !== "high") return null;
  const reviewedProvenance = /^https:\/\//i.test(source) || source.toLowerCase() === "web-verified";
  if (!reviewedProvenance || isBillingOrLegalEntityAffiliation(reviewed)) return null;
  return reviewed;
}

// supabase/functions/_shared/heroCards.ts
function distinctClinicianSupport(posts) {
  const best = /* @__PURE__ */ new Map();
  const score = (post) => [
    /^\s*RT @/i.test(post.text ?? "") ? 0 : 1,
    post.likes + post.retweets + post.quotes,
    (post.text ?? "").length
  ];
  const better = (next, prior) => {
    const a = score(next), b = score(prior);
    return a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] !== b[2] ? a[2] > b[2] : String(next.tweetUrl ?? "") < String(prior.tweetUrl ?? "");
  };
  for (const post of posts) {
    const key = post.handle?.toLowerCase() || post.tweetUrl || `${post.name}:${post.text}`;
    const prior = best.get(key);
    if (!prior || better(post, prior)) best.set(key, post);
  }
  return [...best.values()];
}
function authoredClinicianSupportCount(posts, sourceTitle) {
  const sourceTitles = typeof sourceTitle === "string" ? [sourceTitle] : sourceTitle ?? [];
  const normalizedTitles = sourceTitles.map((title) => String(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()).filter(Boolean);
  const authored = posts.filter((post) => {
    const text = String(post.textEn?.trim() || post.text || "");
    if (/^\s*RT\s+@/i.test(text)) return false;
    const withoutTransport = (value) => value.replace(/https?:\/\/\S+/g, " ").replace(/@[A-Za-z0-9_]+/g, " ").replace(/#[A-Za-z0-9_]+/g, " ").replace(/^\s*(?:new\s+)?(?:(?:article|paper)(?:\s+link)?|link)\s*:\s*/i, "").trim();
    const ownWords = (value) => withoutTransport(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
    const hasCommentary = (value) => {
      const words = ownWords(value);
      if (!words) return false;
      const matchesSourceTitle = normalizedTitles.some((normalizedTitle) => {
        const publisherPipeLead = withoutTransport(value).split(/\s+\|\s+/)[0] ?? "";
        if (ownWords(publisherPipeLead) === normalizedTitle) return true;
        const contentTokens = words.split(/\s+/).filter(Boolean);
        const titleTokens = new Set(normalizedTitle.split(/\s+/).filter(Boolean));
        const titleCoverage = contentTokens.filter((token) => titleTokens.has(token)).length / contentTokens.length;
        if (contentTokens.length >= 6 && (normalizedTitle.includes(words) || titleCoverage >= 0.65)) return true;
        const shorter = Math.min(words.length, normalizedTitle.length);
        const longer = Math.max(words.length, normalizedTitle.length);
        if (shorter / longer >= 0.9 && (words.includes(normalizedTitle) || normalizedTitle.includes(words))) {
          return true;
        }
        return false;
      });
      return !matchesSourceTitle;
    };
    return hasCommentary(text) || (post.thread ?? []).some((part) => hasCommentary(part.text));
  });
  return distinctClinicianSupport(authored).length;
}
var TERM_ELIGIBLE_RE = /\b(efficacy|futility|safety|toxicity|dsmb|regulatory)\b/i;
var TERM_INELIGIBLE_RE = /\b(accrual|enrol?lment|funding|business|sponsor decision|administrativ|strategic|logistic)\b/i;
var TERM_NEGATION_RE = /\b(?:not|no|without|unrelated to)\b[^.;]{0,40}\b(efficacy|futility|safety|toxicity|concern)\b|\b(efficacy|futility|safety|toxicity)\b[^.;]{0,25}\bnot\b/i;
function eventHeroEligible(e) {
  const t = e.title ?? "";
  if (e.type === "fda_oncology_notification" && e.verified === true && /^https:\/\/(?:www\.)?fda\.gov\//i.test(e.primaryUrl ?? "")) return { eligible: true, label: "FDA approval" };
  if (/^FDA approval:/i.test(t)) return { eligible: true, label: "FDA approval" };
  if (/^FDA label expansion:/i.test(t)) return { eligible: true, label: "FDA label expansion" };
  if (e.type === "boxed_warning_added" && e.verified === true) return { eligible: true, label: "Boxed warning added" };
  if (e.type === "trial_terminated") {
    const w = (e.whyStopped ?? "").trim();
    if (!w) return { eligible: false, label: null };
    if (TERM_NEGATION_RE.test(w)) return { eligible: false, label: null };
    if (TERM_INELIGIBLE_RE.test(w) && !TERM_ELIGIBLE_RE.test(w)) return { eligible: false, label: null };
    if (TERM_ELIGIBLE_RE.test(w)) {
      const reason = w.match(TERM_ELIGIBLE_RE)[1].toLowerCase();
      return { eligible: true, label: `${e.sponsorReported ? "Sponsor-reported: " : ""}stopped for ${reason}` };
    }
  }
  return { eligible: false, label: null };
}
var RANK_WEIGHTS = {
  clinicianSharers: 10,
  // distinct verified clinicians engaging the anchor
  episodesDiscussing: 40,
  // EPISODE BASE — a curated recent episode competes with a ~5-sharer paper
  independentPublishers: 4,
  eventBand: 1,
  // events score their BAND × AGING (eventBandScore below); trace-transparent
  tierOneShow: 10,
  verifiedAuthor: 6,
  likesCapped: 1,
  // popularity: 1pt per like, HARD CAP below
  depthMoments: 5
  // per distinct substantive moment, HARD CAP 3 — max 65 total for episodes
};
var LIKES_CAP = 15;
var MOMENTS_CAP = 3;
var EVENT_HERO_WINDOW_DAYS = 14;
var KIND_TIE_ORDER = ["event", "readout", "development", "paper", "episode", "thread"];
function traceRank(inputs) {
  const trace = inputs.filter((i) => i.value > 0).map((i) => {
    const raw = i.input === "likesCapped" ? Math.min(i.value, LIKES_CAP) : i.input === "depthMoments" ? Math.min(i.value, MOMENTS_CAP) : i.value;
    const weight = RANK_WEIGHTS[i.input];
    return { input: i.input, value: raw, weight, contribution: raw * weight };
  });
  return { trace, total: trace.reduce((s, t) => s + t.contribution, 0) };
}
function anchorNoun(kind, eventLabel) {
  switch (kind) {
    case "paper":
      return "1 paper";
    case "episode":
      return "1 in-depth episode";
    case "thread":
      return "1 original clinician post";
    case "event":
      return /^FDA/i.test(eventLabel ?? "") ? "1 FDA event" : "1 registry event";
    case "readout":
      return "1 trial readout";
    case "development":
      return "1 primary report";
  }
}
function anchoredWhy(kind, rest, eventLabel) {
  return rest ? `${anchorNoun(kind, eventLabel)} \xB7 ${rest}` : anchorNoun(kind, eventLabel);
}
function whyLine(counts, extra) {
  const parts = [];
  if (counts.clinicianSharers) parts.push(`shared by ${counts.clinicianSharers} clinician${counts.clinicianSharers === 1 ? "" : "s"}`);
  if (counts.clinicianSharers && Object.hasOwn(counts, "authoredClinicians")) {
    parts.push(counts.authoredClinicians ? counts.authoredClinicians === 1 ? "1 commentary" : `${counts.authoredClinicians} clinician comments` : "reposts only");
  }
  if (counts.episodesDiscussing) parts.push(`discussed on ${counts.episodesDiscussing} episode${counts.episodesDiscussing === 1 ? "" : "s"}`);
  if (counts.independentPublishers) parts.push(`${counts.independentPublishers} publisher${counts.independentPublishers === 1 ? "" : "s"}`);
  if (counts.drugConversations) parts.push(`${counts.drugConversations} drug conversation${counts.drugConversations === 1 ? "" : "s"}`);
  if (extra) parts.unshift(extra);
  return parts.length ? parts.join(" \xB7 ") : "verified primary source";
}
function eventWhyLine(counts) {
  const parts = [];
  if (counts.clinicianComments) {
    parts.push(`${counts.clinicianComments} clinician${counts.clinicianComments === 1 ? "" : "s"} commented`);
  }
  if (counts.relatedSources) {
    parts.push(`${counts.relatedSources} related source${counts.relatedSources === 1 ? "" : "s"}`);
  }
  const ageDays = Math.max(0, counts.ageDays ?? 0);
  parts.push(ageDays === 0 ? "today" : `${ageDays}d ago`);
  return parts.join(" \xB7 ");
}
function resolveCollisions(cards) {
  const out = [];
  const claimed = /* @__PURE__ */ new Map();
  const nctClaim = /* @__PURE__ */ new Map();
  const hasFiner = (c) => !!(c.eventId || c.doi);
  const sorted = [...cards].sort((a, b) => b.rankTotal - a.rankTotal || KIND_TIE_ORDER.indexOf(a.kind) - KIND_TIE_ORDER.indexOf(b.kind));
  for (const c of sorted) {
    const fineKeys = [];
    if (c.eventId) fineKeys.push(`ev:${c.eventId}`);
    const doi = bibliographicIdentity({ doi: c.doi }).doi;
    if (doi) fineKeys.push(`doi:${doi}`);
    const fineWinner = fineKeys.map((k) => claimed.get(k)).find(Boolean);
    if (fineWinner) {
      fineWinner.siblings.push({ kind: c.kind, id: c.id, label: c.headline.slice(0, 80), url: c.url });
      continue;
    }
    if (c.nct) {
      const w = nctClaim.get(c.nct);
      if (w && !(hasFiner(w) && hasFiner(c))) {
        w.siblings.push({ kind: c.kind, id: c.id, label: c.headline.slice(0, 80), url: c.url });
        continue;
      }
      if (!w) nctClaim.set(c.nct, c);
    }
    for (const k of fineKeys) claimed.set(k, c);
    out.push(c);
  }
  return out;
}
var xPostId = (value) => value?.match(/(?:status\/|^)(\d{8,})/)?.[1] ?? null;
function foldSupportedThreads(cards) {
  const eventByPost = /* @__PURE__ */ new Map();
  for (const card of cards) {
    if (card.kind !== "event" && card.kind !== "development") continue;
    for (const post of [
      ...card.support?.clinicianPosts ?? [],
      ...card.support?.publisherPosts ?? [],
      ...card.support?.otherPosts ?? []
    ]) {
      const id = xPostId(post.tweetUrl);
      if (id) eventByPost.set(id, card);
    }
    if (Array.isArray(card.poolMeta?.storyPostIds)) {
      for (const value of card.poolMeta.storyPostIds) {
        const id = String(value ?? "").trim();
        if (id) eventByPost.set(id, card);
      }
    }
  }
  return cards.filter((card) => {
    if (card.kind !== "thread") return true;
    const event = eventByPost.get(xPostId(card.anchorId) ?? xPostId(card.url) ?? card.anchorId);
    if (!event) return true;
    event.siblings.push({ kind: card.kind, id: card.id, label: card.headline.slice(0, 80), url: card.url });
    return false;
  });
}
function supportedEpisodeOwners(cards, episode, seatedEventIds) {
  if (episode.kind !== "episode") return [];
  const normalizeDrug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const episodeDrugs = new Set((episode.drugTags ?? []).map(normalizeDrug).filter(Boolean));
  const selectedMomentCoversAction = /\b(?:fda|approv(?:e[sd]?|al)|label expansion|expanded indication)\b/i.test(episode.excerpt ?? "");
  if (!episodeDrugs.size || !selectedMomentCoversAction) return [];
  return cards.filter((card) => card.kind === "event" && seatedEventIds.has(card.id) && card.support?.links?.some(
    (link) => link.kind === "episode" && link.relationshipType === "covers_approval" && link.id === episode.anchorId
  ) && (card.drugTags ?? []).some((drug) => episodeDrugs.has(normalizeDrug(drug))));
}
var isEventClass = (c) => c.kind === "event" || c.kind === "readout";
var EVENT_CLASS_CAP = 2;
function buildHeroCandidates(candidates, cap = 5) {
  const prepared = candidates.map((card) => ({
    ...card,
    siblings: [...card.siblings ?? []]
  }));
  const resolved = resolveCollisions(foldSupportedThreads(prepared));
  const totals = resolved.map((c) => c.rankTotal).sort((a, b) => b - a);
  let tieCount = 0;
  for (let i = 1; i < Math.min(totals.length, cap + 1); i++) if (totals[i] === totals[i - 1]) tieCount++;
  const eventClass = resolved.filter(isEventClass);
  let allowed = new Set(eventClass.slice(0, EVENT_CLASS_CAP));
  if (eventClass.length > EVENT_CLASS_CAP) {
    const picked = eventClass.slice(0, EVENT_CLASS_CAP);
    if (!picked.some((c) => c.kind === "event")) {
      const bestEvent = eventClass.find((c) => c.kind === "event");
      if (bestEvent) picked[EVENT_CLASS_CAP - 1] = bestEvent;
    }
    allowed = new Set(picked);
  }
  let eligible = resolved.filter((c) => !isEventClass(c) || allowed.has(c));
  const allocate = (pool) => {
    let seated = pool.slice(0, cap);
    if (seated.length === cap && !seated.some((c) => c.kind === "episode")) {
      const bestEpisode = pool.slice(cap).find((c) => c.kind === "episode");
      if (bestEpisode) {
        let evictIdx = -1;
        for (let i = seated.length - 1; i >= 0; i--) if (seated[i].kind !== "event") {
          evictIdx = i;
          break;
        }
        if (evictIdx >= 0) seated = [...seated.slice(0, evictIdx), ...seated.slice(evictIdx + 1), bestEpisode];
      }
    }
    return seated;
  };
  let cards = allocate(eligible);
  const seatedEventIds = new Set(cards.filter((card) => card.kind === "event").map((card) => card.id));
  const proposals = /* @__PURE__ */ new Map();
  for (const episode of eligible.filter((card) => card.kind === "episode")) {
    const owners = supportedEpisodeOwners(eligible, episode, seatedEventIds);
    if (owners.length === 1) proposals.set(episode.id, owners[0]);
  }
  if (proposals.size) {
    const tentativeEligible = eligible.filter((card) => !proposals.has(card.id));
    const tentativeCards = allocate(tentativeEligible);
    const tentativeEventIds = new Set(tentativeCards.filter((card) => card.kind === "event").map((card) => card.id));
    const accepted = /* @__PURE__ */ new Map();
    for (const episode of eligible.filter((card) => proposals.has(card.id))) {
      const owners = supportedEpisodeOwners(eligible, episode, tentativeEventIds);
      if (owners.length === 1 && owners[0].id === proposals.get(episode.id)?.id) {
        accepted.set(episode.id, owners[0]);
      }
    }
    if (accepted.size) {
      for (const episode of eligible.filter((card) => accepted.has(card.id))) {
        accepted.get(episode.id)?.siblings.push({
          kind: episode.kind,
          id: episode.id,
          label: episode.headline.slice(0, 80),
          url: episode.url
        });
      }
      eligible = eligible.filter((card) => !accepted.has(card.id));
      cards = allocate(eligible);
    }
  }
  return { cards, tieCount };
}
function selectDominantDrugMoments(moments, cap = MOMENTS_CAP) {
  const usable = moments.filter((m) => m.moment.startMs != null);
  if (!usable.length) return null;
  const byDrug = /* @__PURE__ */ new Map();
  for (const m of usable) {
    const g = byDrug.get(m.drugId) ?? { drugName: m.drugName, list: [] };
    g.list.push(m.moment);
    byDrug.set(m.drugId, g);
  }
  const groups = [...byDrug.values()].map((g) => ({
    drugName: g.drugName,
    list: g.list,
    distinct: new Set(g.list.map((x) => x.startMs)).size,
    total: g.list.reduce((s, x) => s + Number(x.mentionCount ?? 0), 0)
  })).sort((a, b) => b.distinct - a.distinct || b.total - a.total || a.drugName.localeCompare(b.drugName));
  const dom = groups[0];
  const seen = /* @__PURE__ */ new Set();
  const pool = dom.list.slice().sort((a, b) => b.mentionCount - a.mentionCount).filter((x) => !seen.has(x.startMs) && (seen.add(x.startMs), true));
  return { selected: pool.slice(0, cap), poolSize: pool.length, drugName: dom.drugName };
}
var paperEligible = (a) => (
  // scholarly identity REQUIRED (DOI/PubMed/journal metadata) — promo pages fail structurally,
  // not by vocabulary (the Mammo congress-promo case); PROMO_RE stays as defense-in-depth only.
  // HERO floor is stricter than the rail (Codex, v2 artifact review): 1-sharer papers padded
  // Gyn to five at ranks 14-23 — "up to five" means the floor decides, not the count. Two
  // clinician sharers minimum; papers carry no other closed importance signal today.
  (a.peerReviewed === true || !!a.journal) && (a.kolSharers ?? 0) >= 2
);
var paperCanAnchorHero = (a) => a.circulationState !== "resurfaced";
var episodeEligible = (e) => e.substantiveMoments >= 1 && !!e.audioUrl;
var eventCardEligible = (e, todayIso) => {
  if (!e.eligibleLabel) return false;
  if (!e.url) return false;
  const days = Math.floor((Date.parse(todayIso) - Date.parse(e.occurredOn)) / 864e5);
  return days >= 0 && days <= EVENT_HERO_WINDOW_DAYS;
};
var threadEligible = (t) => !!t.tweetUrl && (t.text ?? "").trim().length > 60 && !/^RT @/i.test(t.text ?? "");
function eventBandScore(label, ageDays) {
  const band = /approval|boxed|withdraw|hold/i.test(label) ? 120 : /label expansion/i.test(label) ? 90 : /stopped for/i.test(label) ? 75 : 0;
  const aging = /approval/i.test(label) ? ageDays <= EVENT_HERO_WINDOW_DAYS ? 1 : 0 : ageDays <= 3 ? 1 : ageDays <= 7 ? 0.75 : ageDays <= EVENT_HERO_WINDOW_DAYS ? 0.5 : 0;
  return Math.round(band * aging);
}
var TRACKED_AREAS = /* @__PURE__ */ new Set([
  "Breast",
  "Gyn",
  "GU",
  "Lung",
  "GI",
  "Heme",
  "Skin"
]);
var EVENT_AREA_CUES = [
  ["Breast", /\bbreast\b|\btnbc\b|\bher2[+-]?\s*(?:breast|m?bc)\b|\bm?bc\b/i],
  ["Gyn", /\bovarian\b|\bovary\b|\bendometrial\b|\buterine\b|\bcervical\b/i],
  ["GU", /\bprostate\b|\bpsma\b|\bm(?:hspc|crpc|cspc)\b|\bbladder\b|\burothelial\b|\bnmibc\b|\bmibc\b|\bkidney\b|\brenal cell\b|\brcc\b/i],
  ["Lung", /\blung\b|\bnsclc\b|\bsclc\b|non[- ]small cell/i],
  ["GI", /\bcolorectal\b|\bcolon\b|\brectal\b|\bcrc\b|\bpancreatic\b|\bpancreas\b|\bgastric\b|\bgej\b|gastroesophageal|\bliver\b|\bhcc\b|hepatocellular/i],
  ["Heme", /\bmyeloma\b|\brrmm\b|\bndmm\b|\bcll\b|chronic lymphocytic leukemia|\blymphoma\b|\bdlbcl\b|\bleukemia\b|\baml\b|\bcml\b|acute lymphoblastic/i],
  // cSCC/BCC/Merkel forms all carry their own cutaneous context — a bare \bscc\b here
  // would route every head & neck and esophageal approval into Skin. Ambiguous → no area.
  [
    "Skin",
    /\bmelanoma\b|\bmerkel\b|cutaneous squamous|\bcscc\b|basal cell carcinoma|\bskin cancers?\b/i
  ],
  // Explicitly recognized but not represented by a current Readout edition. Their presence
  // prevents a stale stored tag from routing the event into an unrelated tracked area.
  [null, /head and neck|head & neck|\bhnscc\b|\boropharyngeal\b/i]
];
function resolveEventReadoutAreas(title, summary, storedAreas) {
  const sourceText = `${title ?? ""} ${summary ?? ""}`;
  const explicit = EVENT_AREA_CUES.filter(([, cue]) => cue.test(sourceText));
  if (explicit.length) return [...new Set(explicit.map(([area]) => area).filter((area) => !!area))];
  return [...new Set((storedAreas ?? []).filter((area) => TRACKED_AREAS.has(area)))];
}
function buildEventCard(e, todayIso) {
  const elig = eventHeroEligible(e);
  const applDigits = (e.application ?? "").replace(/[^0-9]/g, "");
  const url = e.primaryUrl ?? (applDigits ? `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${applDigits}` : null);
  if (!eventCardEligible({ eligibleLabel: elig.label, occurredOn: e.occurredOn || "1970-01-01", url }, todayIso)) return null;
  const ageDays = Math.max(0, Math.floor((Date.parse(todayIso) - Date.parse(e.occurredOn)) / 864e5));
  const r = traceRank([{ input: "eventBand", value: eventBandScore(elig.label ?? "", ageDays) }]);
  const id = e.eventId.startsWith("event:") ? e.eventId : `event:${e.eventId}`;
  return {
    id,
    kind: "event",
    anchorId: e.eventId,
    headline: e.title,
    why: eventWhyLine({ ageDays }),
    sourceLabel: e.type === "trial_terminated" ? "ClinicalTrials.gov" : e.source === "fda_oncology_notification" ? "U.S. Food and Drug Administration" : "FDA",
    url,
    excerpt: e.summary?.trim() || `${elig.label} \xB7 ${e.drug ?? ""} \xB7 ${e.occurredOn}`.trim(),
    excerptVerbatim: false,
    drugTags: e.drugForms?.length ? e.drugForms : e.drug ? [e.drug] : [],
    nct: e.nct ?? null,
    doi: null,
    eventId: e.eventId,
    siblings: [],
    rankTrace: r.trace,
    rankTotal: r.total,
    counts: { ageDays },
    // Same value `ageDays` was floored from — the rail renders this, the card renders the age.
    occurredOn: e.occurredOn || null
  };
}

// supabase/functions/_shared/storySupport.ts
var ENTITY_MAP = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  ndash: "-",
  mdash: "-"
};
function decodeHtml(value) {
  return value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_m, raw) => {
    const n = raw[0].toLowerCase() === "x" ? Number.parseInt(raw.slice(1), 16) : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : " ";
  }).replace(/&([a-z]+);/gi, (_m, name) => ENTITY_MAP[name.toLowerCase()] ?? " ");
}
function normalizeIdentity(value) {
  return (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
var PUBLISHER_DOMAIN_LABELS = {
  "ascopost.com": "The ASCO Post",
  "bloodcancerstoday.com": "Blood Cancers Today",
  "cancernetwork.com": "CancerNetwork",
  "cancerletter.com": "The Cancer Letter",
  "cancertherapyadvisor.com": "Cancer Therapy Advisor",
  "guoncologynow.com": "GU Oncology Now",
  "healio.com": "Healio",
  "lungcancerstoday.com": "Lung Cancer Today",
  "medpagetoday.com": "MedPage Today",
  "medscape.com": "Medscape",
  "myeloma.org": "International Myeloma Foundation",
  "oncodaily.com": "OncoDaily",
  "onclive.com": "OncLive",
  "oncologynexus.com": "Oncology Nexus",
  "targetedonc.com": "Targeted Oncology",
  "urotoday.com": "UroToday",
  "vjoncology.com": "VJOncology"
};
function hostnameOf(value) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
function publicationSourceLabel(journal, domain, url) {
  const named = (journal ?? "").trim();
  if (named) return named;
  const host = hostnameOf(domain) ?? hostnameOf(url);
  if (!host) return "Source";
  for (const [knownDomain, label] of Object.entries(PUBLISHER_DOMAIN_LABELS)) {
    if (host === knownDomain || host.endsWith(`.${knownDomain}`)) return label;
  }
  return host;
}
function containsNormalizedPhrase(normalizedHaystack, phrase) {
  const p = normalizeIdentity(phrase);
  if (!normalizedHaystack || !p || p.length < 5) return false;
  return ` ${normalizedHaystack} `.includes(` ${p} `);
}
function containsContextualTrialAcronym(normalizedHaystack, acronym) {
  const p = normalizeIdentity(acronym);
  if (!normalizedHaystack || p.length < 5 || !containsNormalizedPhrase(normalizedHaystack, p)) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const context = "(?:trial|study|phase\\s+(?:[1-4]|i{1,3}|iv)|results?|data|readout|publication|cohort)";
  return new RegExp(`(?:${context})(?:\\s+[a-z0-9]+){0,4}\\s+${escaped}|${escaped}(?:\\s+[a-z0-9]+){0,4}\\s+(?:${context})`, "i").test(normalizedHaystack);
}
function storySupportEdgeIsCurrent(anchorRunId, supportRunId) {
  const anchor = String(anchorRunId ?? "").trim();
  return anchor.length > 0 && anchor === String(supportRunId ?? "").trim();
}

// supabase/functions/_shared/readoutWatch.ts
var DEAD_STATUSES = /* @__PURE__ */ new Set(["TERMINATED", "WITHDRAWN", "SUSPENDED"]);
var WATCH_WINDOW_PAST_DAYS = 45;
var WATCH_WINDOW_FUTURE_DAYS = 120;
var WATCH_CAP = 6;
var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthLabel(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}
function watchEligible(t, area, todayIso) {
  if (t.phase !== "PHASE3") return false;
  if (DEAD_STATUSES.has(t.overall_status ?? "")) return false;
  if (!(t.tumor_categories ?? []).includes(area)) return false;
  if (!t.primary_completion_date) return false;
  const d = Date.parse(t.primary_completion_date);
  const today = Date.parse(todayIso);
  return d >= today - WATCH_WINDOW_PAST_DAYS * 864e5 && d <= today + WATCH_WINDOW_FUTURE_DAYS * 864e5;
}
function watchLine(pcd, todayIso) {
  const past = Date.parse(pcd) < Date.parse(todayIso);
  return past ? `Registry lists primary completion ${monthLabel(pcd)} \u2014 reached` : `Registry lists primary completion ${monthLabel(pcd)}`;
}
function moveLine(from, to) {
  if (!from || !to) return null;
  const months = Math.round((Date.parse(to) - Date.parse(from)) / (30.44 * 864e5));
  if (!Number.isFinite(months) || months === 0) return null;
  const n = Math.max(1, Math.abs(months));
  return months < 0 ? `Registry moved primary completion up ${n} month${n === 1 ? "" : "s"}` : `Registry moved primary completion out ${n} month${n === 1 ? "" : "s"}`;
}
function buildWatchCards(rows, area, todayIso, movesByNct, cap = WATCH_CAP) {
  return rows.filter((t) => watchEligible(t, area, todayIso)).sort((a, b) => String(a.primary_completion_date).localeCompare(String(b.primary_completion_date))).slice(0, cap).map((t) => {
    const mv = movesByNct.get(t.nct_id);
    const mvLine = mv ? moveLine(mv.from, mv.to) : null;
    return {
      storyId: `watch:${t.nct_id}`,
      nctId: t.nct_id,
      acronym: t.acronym,
      title: t.brief_title ?? t.acronym ?? t.nct_id,
      phase: "Phase 3",
      primaryCompletionDate: t.primary_completion_date,
      sponsor: t.lead_sponsor,
      intervention: (t.interventions ?? [])[0] ?? null,
      line: watchLine(t.primary_completion_date, todayIso),
      move: mv && mvLine ? { ...mv, line: mvLine } : null,
      url: `https://clinicaltrials.gov/study/${t.nct_id}`
    };
  });
}

// supabase/functions/_shared/trialIdentity.ts
var NCT_RE = /NCT\d{8}/gi;
function explicitTrialIds(value) {
  return [...new Set((String(value ?? "").match(NCT_RE) ?? []).map((id) => id.toUpperCase()))];
}
function explicitTrialIdentityAgrees(value, heldNct) {
  const ids = explicitTrialIds(value);
  return ids.length === 0 || ids.length === 1 && !!heldNct && ids[0] === heldNct.toUpperCase();
}
var trialKey = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
function buildTrialResolver(trials, aliases) {
  const byKey = /* @__PURE__ */ new Map();
  const claim = (key, row) => {
    if (!key || key.length < 5) return;
    const prior = byKey.get(key);
    if (prior === void 0) byKey.set(key, row);
    else if (prior !== null && prior.nct_id !== row.nct_id) byKey.set(key, null);
  };
  const byNct = new Map(trials.map((t) => [t.nct_id, t]));
  for (const t of trials) claim(trialKey(t.acronym), t);
  for (const a of aliases) {
    const row = a.nct_id ? byNct.get(a.nct_id) : void 0;
    if (row) claim(trialKey(a.variant_key), row);
  }
  return { byKey, byNct, trials };
}
var isBareAlpha = (a) => /^[A-Za-z]+$/.test(a) && (a === a.toUpperCase() || a === a.toLowerCase());
var BARE_ALPHA_STOPWORDS = /* @__PURE__ */ new Set(["CLEAR", "EXPAND", "FIRST", "FORWARD", "OPINION", "PANCREATIC", "SECURE", "SPOTLIGHT", "SUMMIT", "TARGET", "TRUST"]);
function bareAlphaAdmissible(acronym, sourceText) {
  if (!isBareAlpha(acronym)) return true;
  if (BARE_ALPHA_STOPWORDS.has(acronym.toUpperCase())) return false;
  const re = new RegExp(`(^|[^A-Za-z0-9])${acronym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9]|$)`);
  return re.test(sourceText);
}
function resolveTrialNct(text, resolver, area, normalizeIdentityFn, opts) {
  const t = String(text ?? "");
  const areaOk = (row) => !area || !(row.tumor_categories ?? []).length || (row.tumor_categories ?? []).includes(area);
  const nctHits = explicitTrialIds(t);
  if (nctHits.length > 1) return null;
  if (nctHits.length === 1) {
    const row = resolver.byNct.get(nctHits[0]);
    return row && areaOk(row) ? nctHits[0] : null;
  }
  const normalized = normalizeIdentityFn(t);
  if (!normalized) return null;
  const words = normalized.split(" ").filter(Boolean);
  const grams = /* @__PURE__ */ new Set();
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      grams.add(trialKey(words.slice(i, i + n).join("")));
    }
  }
  const hits = /* @__PURE__ */ new Set();
  for (const [key, row] of resolver.byKey) {
    if (row === null) continue;
    if (!grams.has(key)) continue;
    if (!areaOk(row)) continue;
    const isCanonical = !!row.acronym && trialKey(row.acronym) === key;
    if (isCanonical && !containsContextualTrialAcronym(normalized, row.acronym)) continue;
    if (opts?.strictBareAlpha && isCanonical && row.acronym && !bareAlphaAdmissible(row.acronym, t)) continue;
    hits.add(row.nct_id);
    if (hits.size > 1) return null;
  }
  return hits.size === 1 ? [...hits][0] : null;
}

// supabase/functions/_shared/focusScope.ts
var AREA_DISEASES = {
  GU: {
    bladder: /\b(bladder|urotheli\w*|MIBC|NMIBC|cystectom\w*|upper[- ]tract|UTUC)\b/i,
    kidney: /(renal cell|RCC\b|kidney|nephrectom\w*|clear[- ]cell renal|papillary renal|belzutifan|LITESPARK)/i,
    prostate: /\b(prostat\w*|\bm?CRPC\b|\bm?HSPC\b|\bm?CSPC\b|castration[- ](resistant|sensitive)|\bPSA\b)\b/i,
    testicular: /\b(testicular|germ[- ]cell|seminoma)\b/i
  },
  Gyn: {
    endometrial: /\b(endometri\w*|uterine)\b/i,
    ovarian: /\b(ovarian|fallopian|primary peritoneal)\b/i,
    cervical: /\b(cervic\w*)\b/i,
    vulvar: /\b(vulvar|vaginal)\b/i
  },
  Heme: {
    myeloma: /\b(myeloma|plasma[- ]cell|MGUS|smoldering|amyloidosis|AL amyloid)\b/i,
    lymphoma: /\b(lymphoma|\bDLBCL\b|follicular|Hodgkin|mantle[- ]cell|marginal[- ]zone|Burkitt|Waldenstr\w*)\b/i,
    leukemia: /\b(leukemi\w*|\bAML\b|\bCLL\b|\bCML\b|acute myeloid|chronic lymphocytic|acute lymphoblastic|hairy[- ]cell)\b/i,
    mds: /\b(\bMDS\b|myelodysplas\w*)\b/i,
    mpn: /\b(myelofibrosis|\bMPN\b|polycythemia|essential thrombocythemia|myeloproliferative)\b/i,
    bpdcn: /(\bBPDCN\b|blastic plasmacytoid)/i,
    clonal_hematopoiesis: /\b(clonal h(?:a)?ematopoiesis|\bCHIP\b|\bCCUS\b)\b/i
  },
  GI: {
    colorectal: /\b(colorectal|\bm?CRC\b|colon cancer|rectal)\b/i,
    gastric: /\b(gastric|\bGEJ\b|stomach|gastroesophageal)\b/i,
    pancreatic: /\b(pancrea\w*|\bPDAC\b)\b/i,
    biliary: /\b(biliary|cholangio\w*|\bBTC\b|gallbladder|bile[- ]duct)\b/i,
    hcc: /\b(hepatocellular|\bHCC\b|liver cancer)\b/i,
    esophageal: /\b(esophag\w*|oesophag\w*)\b/i,
    net: /\b(neuroendocrine|\bNET\b|\bGIST\b)\b/i
  },
  // Reached ONLY by content already admitted to the Skin edition, so "squamous
  // cell" here is cutaneous by construction. The histology collision with lung /
  // head & neck / esophageal / cervical SCC is fought at ADMISSION (AREA_CUES +
  // AREA_DISEASE_CUES in briefingCore, and the tagger prompts), not here.
  Skin: {
    // "non-melanoma skin cancer" is the field's standard term for the other three
    // sub-areas, and \b matches after the hyphen \u2014 so a bare \bmelanoma\b files
    // every NMSC paper under melanoma. Same lookbehind trick as Lung's SCLC.
    // ("nonmelanoma" unhyphenated needs no guard: no word boundary before "m".)
    melanoma: /(?<!non[-\u2013\u2014 ])\bmelanoma\b|\b(melanocytic|lentigo maligna|uveal melanoma)\b/i,
    cscc: /\b(cutaneous squamous cell|cSCC|squamous cell carcinoma of the skin|keratinocyte carcinoma|actinic keratos\w*)\b/i,
    bcc: /\b(basal cell carcinoma|BCC|vismodegib|sonidegib|hedgehog inhibitor)\b/i,
    merkel: /\b(merkel|MCC)\b/i
  },
  Lung: {
    nsclc: /\b(NSCLC|non[-\u2013\u2014 ]small[-\u2013\u2014 ]cell(?: lung)?)\b/i,
    // The negative lookbehind prevents "non-small cell lung" from also
    // becoming SCLC. Explicit SCLC remains eligible when both diseases appear.
    sclc: /\bSCLC\b|(?<!non[-\u2013\u2014 ])\bsmall[-\u2013\u2014 ]cell lung\b/i,
    pulmonary_net: /\b(pulmonary carcinoid|bronchial carcinoid|lung neuroendocrine|thoracic neuroendocrine|large[- ]cell neuroendocrine|LCNEC)\b/i
  }
};
var SUBAREA_LABELS = {
  bladder: "Bladder",
  kidney: "Kidney (RCC)",
  prostate: "Prostate",
  testicular: "Testicular",
  endometrial: "Endometrial",
  ovarian: "Ovarian",
  cervical: "Cervical",
  vulvar: "Vulvar/vaginal",
  myeloma: "Myeloma",
  lymphoma: "Lymphoma",
  leukemia: "Leukemia",
  mds: "MDS",
  mpn: "MPN",
  bpdcn: "BPDCN",
  clonal_hematopoiesis: "Clonal hematopoiesis",
  colorectal: "Colorectal",
  gastric: "Gastric/GEJ",
  pancreatic: "Pancreatic",
  biliary: "Biliary",
  hcc: "Liver (HCC)",
  esophageal: "Esophageal",
  net: "NET/GIST",
  nsclc: "NSCLC",
  sclc: "SCLC",
  pulmonary_net: "Pulmonary NETs",
  melanoma: "Melanoma",
  cscc: "cSCC",
  bcc: "Basal cell",
  merkel: "Merkel cell"
};
function diseaseOf(text, area) {
  const diseases = AREA_DISEASES[area];
  if (!diseases || !text) return null;
  for (const [name, re] of Object.entries(diseases)) {
    if (re.test(text) || area === "Heme" && name === "leukemia" && /\bALL\b/.test(text)) return name;
  }
  return null;
}
function subAreasOf(area, ...texts) {
  const diseases = AREA_DISEASES[area];
  if (!diseases) return [];
  const haystack = texts.filter(Boolean).join("  ").slice(0, 6e3);
  if (!haystack) return [];
  return Object.entries(diseases).filter(
    ([name, re]) => re.test(haystack) || area === "Heme" && name === "leukemia" && /\bALL\b/.test(haystack)
  ).map(([name]) => name);
}

// supabase/functions/_shared/xEvidence.ts
function preferredEvidenceDisplayName(source, personName) {
  const sourceName = String(source?.name ?? "").trim() || null;
  if (source?.source_type !== "kol") return sourceName;
  return String(personName ?? "").trim() || sourceName;
}
var HARD_PUBLISHER_TYPES = /* @__PURE__ */ new Set(["journal", "news"]);
var KNOWN_PUBLISHER_HANDLES = /* @__PURE__ */ new Set([
  "annals_oncology",
  "blood_cancers",
  "ccr_aacr",
  "esmo_open",
  "jama_current",
  "jcooa_asco",
  "naturemedicine",
  "oncodailybreast"
]);
var CLINICIAN_VERIFY_TIERS = /* @__PURE__ */ new Set(["us_npi", "pubmed", "intl_pubmed", "primary_source"]);
function isTrustedVerifyTier(tier) {
  return CLINICIAN_VERIFY_TIERS.has(String(tier ?? "").toLowerCase());
}
function isIndependentlyVerifiedClinician(profile) {
  const category = String(profile.verify_detail?.category ?? "").toLowerCase();
  return category === "clinician" && isTrustedVerifyTier(profile.verify_tier);
}
function normalizeXHandle(value) {
  const normalized = String(value ?? "").trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}
function stripClassicRepost(value) {
  const text = decodeHtml(String(value ?? "")).replace(/^\s*RT\s+@[^:]+:\s*/i, "").trim();
  return text || null;
}
function sourceLaneFor(source, clinicianSourceIds, fallbackHandle) {
  const type = String(source?.source_type ?? "").toLowerCase();
  if (HARD_PUBLISHER_TYPES.has(type)) return "publisher";
  if (source?.id && clinicianSourceIds.has(source.id)) return "clinician";
  if (source?.evidence_identity) return source.evidence_identity;
  const handle = normalizeXHandle(source?.x_handle) ?? normalizeXHandle(fallbackHandle);
  if (handle && KNOWN_PUBLISHER_HANDLES.has(handle)) return "publisher";
  return "other";
}
function evidenceSourceFromOriginProfile(profile) {
  const handle = normalizeXHandle(profile.handle);
  if (!handle) return null;
  const detail = profile.verify_detail ?? {};
  const category = String(detail.category ?? "").toLowerCase();
  let identity = "other";
  if (isIndependentlyVerifiedClinician(profile)) identity = "clinician";
  else if (category === "media" || KNOWN_PUBLISHER_HANDLES.has(handle)) identity = "publisher";
  return {
    id: profile.x_user_id ? `origin:${profile.x_user_id}` : `origin:${handle}`,
    name: String(profile.name ?? "").trim() || `@${handle}`,
    x_handle: handle,
    avatar_url: profile.avatar_url ?? null,
    source_type: "off_panel",
    active: false,
    evidence_identity: identity
  };
}
var METRIC_KEYS = {
  likes: ["likes", "like_count"],
  retweets: ["retweets", "retweet_count"],
  quotes: ["quotes", "quote_count"],
  views: ["views", "impression_count"],
  bookmarks: ["bookmarks", "bookmark_count"]
};
var metric = (row, key) => {
  for (const candidate of METRIC_KEYS[key]) {
    const value = row.metrics_24h?.[candidate] ?? row.metrics?.[candidate];
    if (value != null) return Number(value);
  }
  return 0;
};
var displayName = (source, handle) => String(source?.name ?? "").trim() || (handle ? `@${handle}` : "X account");
var tweetUrl = (handle, id) => handle && id ? `https://x.com/${handle}/status/${id}` : null;
function makeEvidenceEntry(row, currentSource, sourceByHandle, clinicianSourceIds) {
  const currentHandle = normalizeXHandle(currentSource.x_handle);
  const isClassicRepost = !!row.rt_tweet_id || /^\s*RT\s+@/i.test(String(row.content ?? ""));
  if (!isClassicRepost) {
    const id = String(row.x_post_id ?? "").trim() || null;
    const text2 = decodeHtml(String(row.content ?? "")).trim() || null;
    if (!id && !text2) return null;
    const url = tweetUrl(currentHandle, id);
    return {
      key: id ? `post:${id}` : `post:${currentHandle ?? "unknown"}:${text2}`,
      authored: true,
      post: {
        name: displayName(currentSource, currentHandle),
        handle: currentHandle,
        avatar: currentSource.avatar_url ?? null,
        tweetUrl: url,
        text: text2,
        receiptNote: text2 && !url ? "X excerpt \xB7 original link unavailable" : null,
        lang: row.lang ?? null,
        textEn: row.content_en ? decodeHtml(row.content_en) : null,
        thread: row.thread_parts?.length ? row.thread_parts.map((part) => ({ ...part, text: decodeHtml(part.text) })) : void 0,
        quotedContext: row.quoted_url || row.quoted_title || row.quoted_text || row.quoted_description ? {
          url: row.quoted_url ?? null,
          title: row.quoted_title ? decodeHtml(row.quoted_title) : null,
          text: row.quoted_text ? decodeHtml(row.quoted_text) : null,
          description: row.quoted_description ? decodeHtml(row.quoted_description) : null
        } : void 0,
        likes: metric(row, "likes"),
        retweets: metric(row, "retweets"),
        quotes: metric(row, "quotes"),
        views: metric(row, "views"),
        bookmarks: metric(row, "bookmarks"),
        sourceLane: sourceLaneFor(currentSource, clinicianSourceIds)
      }
    };
  }
  const originHandle = normalizeXHandle(row.rt_author_handle) ?? normalizeXHandle(String(row.content ?? "").match(/^\s*RT\s+@([^:]+):/i)?.[1]);
  const originSource = originHandle ? sourceByHandle.get(originHandle) : void 0;
  const originId = String(row.rt_tweet_id ?? "").trim() || null;
  const text = stripClassicRepost(row.content);
  if (!originId && !text) return null;
  const reposter = {
    name: displayName(currentSource, currentHandle),
    handle: currentHandle,
    avatar: currentSource.avatar_url ?? null,
    tweetUrl: tweetUrl(currentHandle, row.x_post_id)
  };
  const originalUrl = tweetUrl(originHandle, originId);
  return {
    key: originId ? `post:${originId}` : `repost:${originHandle ?? "unknown"}:${text}`,
    authored: false,
    post: {
      name: displayName(originSource, originHandle),
      handle: originHandle,
      avatar: originSource?.avatar_url ?? null,
      tweetUrl: originalUrl,
      text,
      receiptNote: text && !originalUrl ? "Reposted excerpt \xB7 original link unavailable" : null,
      // translation lane: the RT row's stored translation covers the original author's
      // words (the RT prefix is stripped the same way the original text is)
      lang: row.lang ?? null,
      textEn: stripClassicRepost(row.content_en ?? null),
      likes: 0,
      retweets: 0,
      quotes: 0,
      views: 0,
      bookmarks: 0,
      repostedBy: [reposter],
      sourceLane: sourceLaneFor(originSource, clinicianSourceIds, originHandle)
    }
  };
}
var reposterKey = (value) => normalizeXHandle(value.handle) ?? value.tweetUrl ?? value.name.toLowerCase();
function mergeEvidenceEntry(target, incoming) {
  const existing = target.get(incoming.key);
  if (!existing) {
    target.set(incoming.key, incoming);
    return;
  }
  const authored = existing.authored || incoming.authored;
  const primary = incoming.authored && !existing.authored ? incoming.post : existing.post;
  const secondary = primary === existing.post ? incoming.post : existing.post;
  const selfHandle = normalizeXHandle(primary.handle);
  const reposters = /* @__PURE__ */ new Map();
  for (const reposter of [...existing.post.repostedBy ?? [], ...incoming.post.repostedBy ?? []]) {
    if (selfHandle && normalizeXHandle(reposter.handle) === selfHandle) continue;
    reposters.set(reposterKey(reposter), reposter);
  }
  const mergedReposters = [...reposters.values()];
  target.set(incoming.key, {
    key: incoming.key,
    authored,
    post: {
      ...secondary,
      ...primary,
      thread: primary.thread?.length ? primary.thread : secondary.thread,
      repostedBy: mergedReposters.length ? mergedReposters : void 0
    }
  });
}
var evidenceScore = (post) => post.likes + post.retweets + post.quotes + (post.bookmarks ?? 0) + (post.repostedBy?.length ?? 0);
var receiptScore = (value) => Number(value.likes ?? 0) + Number(value.retweets ?? 0) + Number(value.quotes ?? 0) + Number(value.bookmarks ?? 0) + (value.repostedBy?.length ?? 0);
function mergeEvidenceReceipts(posts) {
  const byReceipt = /* @__PURE__ */ new Map();
  for (const [index, post] of posts.entries()) {
    const author = normalizeXHandle(post.handle) ?? String(post.name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    const text = decodeHtml(String(post.text ?? "")).replace(/\s+/g, " ").trim().toLowerCase();
    const key = author && text ? `author:${author}:text:${text}` : post.tweetUrl ? `url:${post.tweetUrl}` : `row:${index}`;
    const prior = byReceipt.get(key);
    if (!prior) {
      byReceipt.set(key, post);
      continue;
    }
    const primary = receiptScore(post) > receiptScore(prior) ? post : prior;
    const reposters = /* @__PURE__ */ new Map();
    for (const reposter of [...prior.repostedBy ?? [], ...post.repostedBy ?? []]) {
      reposters.set(reposterKey(reposter), reposter);
    }
    byReceipt.set(key, {
      ...primary,
      repostedBy: reposters.size ? [...reposters.values()] : void 0
    });
  }
  return [...byReceipt.values()].sort((a, b) => receiptScore(b) - receiptScore(a));
}
function partitionEvidence(entries) {
  const clinicianPosts = [];
  const publisherPosts = [];
  const otherPosts = [];
  for (const entry of entries) {
    if (entry.post.sourceLane === "clinician") clinicianPosts.push(entry.post);
    else if (entry.post.sourceLane === "publisher") publisherPosts.push(entry.post);
    else otherPosts.push(entry.post);
  }
  const sort = (a, b) => evidenceScore(b) - evidenceScore(a) || String(a.tweetUrl ?? "").localeCompare(String(b.tweetUrl ?? ""));
  clinicianPosts.sort(sort);
  publisherPosts.sort(sort);
  otherPosts.sort(sort);
  return { clinicianPosts, publisherPosts, otherPosts };
}

// supabase/functions/_shared/dailyConversation.ts
var AREA_TERMS = {
  GU: /\b(prostate|renal cell|kidney cancer|rcc|bladder|urothel(?:ial|ium)?|psma|germ cell|testicular)\b/i,
  Lung: /\b(lung|nsclc|sclc|mesothelioma|thoracic|pleural)\b/i,
  Breast: /\b(breast|tnbc|triple[- ]negative)\b/i,
  GI: /\b(colorectal|colon|rectal|gastric|gastro-?oesophageal|esophag(?:eal|us)?|oesophag(?:eal|us)?|pancrea(?:s|tic)|hepatocellular|hcc|liver cancer|biliary|cholangio(?:carcinoma)?|neuroendocrine|anal)\b/i,
  Heme: /\b(leuk(?:emia|aemia)|lymphoma|myeloma|cll|cml|mds|myelofibrosis|myeloid|npm1|car-?t)\b/i,
  Gyn: /\b(ovarian|cervical|endometrial|uterine|vulvar)\b/i,
  // Bare SCC/squamous and basal-cell language are deliberately excluded: those
  // histologies occur in several organs and cannot establish a Skin context alone.
  Skin: /\b(melanoma|merkel|cutaneous squamous|cscc|basal cell carcinoma|skin cancers?|keratinocyte carcinoma)\b/i
};
var AREA_KEYS2 = Object.keys(AREA_TERMS);
var normalizeAreas = (areas) => [...new Set(areas.filter((a) => AREA_KEYS2.includes(a)))].sort((a, b) => AREA_KEYS2.indexOf(a) - AREA_KEYS2.indexOf(b));
var GYN_REPRODUCTIVE_BIOLOGY_RE = /\b(?:ovarian\s+(?:ag(?:e|ing|eing)|reserve)|reproductive\s+(?:ag(?:e|ing|eing)|lifespan)|fertility|infertility|oocytes?|follicles?)\b/i;
var GYN_CANCER_IDENTITY_RE = /\b(?:ovarian|cervical|endometrial|uterine|vulvar)(?:\s+(?:high[- ]grade|low[- ]grade|serous|clear[- ]cell|mucinous|epithelial|squamous[- ]cell|endometrioid|germ[- ]cell|stromal|intraepithelial)){0,4}\s+(?:cancers?|carcinoma|adenocarcinoma|malignan\w*|sarcoma|neoplas(?:ia|ms?)|tumou?rs?)\b/i;
var NON_GYN_CERVICAL_RE = /\bcervical\s+(?:lymphadenopathy|lymph(?:\s+nodes?)?|spine|vertebrae?|radiculopathy|myelopathy|pain|collar)\b/i;
function directAreaMention(area, text) {
  if (!AREA_TERMS[area].test(text)) return false;
  if (area === "GU" && /\bovarian\b/i.test(text) && /\bgerm[- ]cell\b/i.test(text) && !/\b(prostate|renal|kidney|bladder|urothel|testicular)\b/i.test(text)) return false;
  if (area !== "Gyn" || GYN_CANCER_IDENTITY_RE.test(text)) return true;
  if (GYN_REPRODUCTIVE_BIOLOGY_RE.test(text)) return false;
  if (NON_GYN_CERVICAL_RE.test(text) && !/\b(ovarian|endometrial|uterine|vulvar)\b/i.test(text)) return false;
  return true;
}
var DAILY_SOURCE_MAX_AGE_MS = 14 * 864e5;
function explicitlyReportsMetEndpoints(value) {
  return /\bmet (?:its |the )?(?:primary |key secondary )?endpoints?\b/i.test(value);
}
var SOURCE_SENTENCE_SEGMENTER = new Intl.Segmenter("en", { granularity: "sentence" });
function classifyConversationAreas(input) {
  const sourceAreas = normalizeAreas(input.sourceAreas ?? []);
  const entityAreas = normalizeAreas(input.entityAreas ?? []);
  const direct = AREA_KEYS2.filter((area) => directAreaMention(area, input.text));
  const guShorthand = /\bGU\s+(?:cancers?|oncology|onc|tumou?rs?|protocols?|trials?|stud(?:y|ies)|program(?:me)?s?)\b/i.test(input.text) && (sourceAreas.includes("GU") || entityAreas.includes("GU"));
  const allShorthand = /\bALL\b/.test(input.text) && (sourceAreas.includes("Heme") || entityAreas.includes("Heme"));
  const amlShorthand = /\bAML\b/.test(input.text) && (sourceAreas.includes("Heme") || entityAreas.includes("Heme"));
  return normalizeAreas([...direct, ...guShorthand ? ["GU"] : [], ...allShorthand || amlShorthand ? ["Heme"] : []]);
}
var resultMilestoneFromText = (value, regulatory = false) => {
  const text = value.toLowerCase();
  if (regulatory || /\bfda\b|approval|label expansion/.test(text)) return "regulatory";
  if (/results?\s+(?:are\s+)?(?:expected|pending|forthcoming)|no results? (?:were |have been )?announced|without results?/.test(text)) return null;
  const analysis = /\b(?:subgroup|subpopulation|biomarker[- ](?:defined|selected)|(?:pd[- ]?l1|ctdna|hrd|brca)[- ](?:positive|negative|high|low))\b/.test(text) ? "subgroup" : /\b(?:secondary|exploratory|post[- ]?hoc|preplanned|prespecified)\b[^.!?;:]{0,48}\banalys(?:is|es)\b/.test(text) ? "secondary" : null;
  const timing = /\b(?:updated?|follow[- ]?up|long[- ]?term|mature|\d+[- ]year)\b/.test(text) ? "update" : /\binterim(?: analysis)?\b/.test(text) ? "interim" : /\bfinal(?: analysis)?\b/.test(text) ? "final" : null;
  const reportsResults = /topline|met (?:its |the )?endpoints?|positive phase|positive (?:late-stage|late stage|trial)|reported (?:positive )?(?:primary )?results?|\b(?:announc(?:e|es|ed)|report(?:s|ed)?)\b[^.!?;:]{0,60}\bresults?\b|results? (?:show|showed|demonstrate|demonstrated|found)|(?:met|improv(?:e[ds]?|ing)?|positive|significant).*(?:overall survival|\bos\b|recurrence[- ]free survival|\brfs\b|distant metastasis[- ]free survival|\bdmfs\b|progression[- ]free survival|\bpfs\b)|(?:overall survival|\bos\b|recurrence[- ]free survival|\brfs\b|distant metastasis[- ]free survival|\bdmfs\b|progression[- ]free survival|\bpfs\b).*(?:met|improv|positive|significant)/.test(text) || !!analysis && /\b(?:efficacy|effectiveness|outcomes?|results?|survival|response|safety|endpoints?)\b/.test(text);
  if (reportsResults) return ["results", analysis, timing].filter(Boolean).join(":");
  if (/updated|follow[- ]?up|overall survival|\bos\b/.test(text)) return "update";
  return null;
};
var normalizedId = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
var trialIdsFrom = (anchor) => {
  const explicit = anchor.trialIds ?? [];
  const extracted = (`${anchor.title}`.match(/\b(?:NCT\d{8}|[A-Za-z][A-Za-z0-9]{2,}(?:[- ]\d{3,}))\b/g) ?? []).filter((value) => !/^(?:(?:ASCO|ESMO|SABCS|AACR|WCLC)[- ]?\d{4}|(?:phase|stage)[- ]?\d+)$/i.test(value));
  const ids = [...new Set([...explicit, ...extracted].map(normalizedId).filter((id) => id.length >= 6))].sort();
  const ncts = ids.filter((id) => /^nct\d{8}$/.test(id));
  return ncts.length ? ncts : ids;
};
var milestoneOf = (anchor) => resultMilestoneFromText(
  `${anchor.title} ${anchor.description ?? ""}`,
  anchor.kind === "fda_event"
);
function conversationStoryKey(anchor) {
  const trials = trialIdsFrom(anchor);
  const milestone = milestoneOf(anchor);
  if (trials.length && milestone) return `trial:${trials.join("+")}:${milestone}`;
  const bibliographic = bibliographicIdentity(anchor);
  if (bibliographic.key) return bibliographic.key;
  if (anchor.eventKey) return `event:${normalizedId(anchor.eventKey)}`;
  if (anchor.kind === "trial" && trials.length) return `trial-record:${trials.join("+")}`;
  if (anchor.episodeId) return `episode:${normalizedId(anchor.episodeId)}`;
  return `url:${canonicalUrlIdentity(anchor.url) || normalizedId(anchor.id)}`;
}
var anchorRank = (anchor) => ({
  paper: 6,
  fda_event: 5,
  primary_report: 4,
  trial: 3,
  episode: 2,
  publisher_report: 1
})[anchor.kind];
var reactionIdentity = (reaction) => reaction.text.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
var conversationSourcesMatch = (a, b) => {
  if (bibliographicIdentifiersConflict(a, b)) return false;
  if (bibliographicIdentitiesMatch(a, b)) return true;
  return canonicalUrlIdentity(a.url) === canonicalUrlIdentity(b.url);
};
var displayConversationSource = (source) => ({
  ...source,
  label: /^https?:\/\/(?:www\.)?pubmed\.ncbi\.nlm\.nih\.gov\//i.test(source.url) ? "PubMed" : source.label
});
function groupDailyConversationStories(values) {
  const grouped = /* @__PURE__ */ new Map();
  const paperIdentity = new PaperIdentityIndex();
  const paperGroupByKey = /* @__PURE__ */ new Map();
  const trialGroups = /* @__PURE__ */ new Map();
  const storyConflictsWith = (story, anchor) => [story.anchor, ...story.sources].some((held) => bibliographicIdentifiersConflict(held, anchor));
  const mergeGroups = (targetId, sourceId) => {
    if (targetId === sourceId) return;
    const target = grouped.get(targetId), source = grouped.get(sourceId);
    if (!target || !source) return;
    if (anchorRank(source.anchor) > anchorRank(target.anchor)) target.anchor = source.anchor;
    for (const item of source.sources) {
      if (!target.sources.some((existing) => conversationSourcesMatch(existing, item))) target.sources.push(item);
    }
    target.areas = normalizeAreas([...target.areas, ...source.areas]);
    for (const reaction of source.reactions) {
      const duplicate = target.reactions.some((existing) => existing.postId === reaction.postId || existing.sourceId === reaction.sourceId && reactionIdentity(existing) === reactionIdentity(reaction));
      if (!duplicate) target.reactions.push(reaction);
    }
    grouped.delete(sourceId);
    for (const [key, groupId] of paperGroupByKey) {
      if (groupId === sourceId) paperGroupByKey.set(key, targetId);
    }
    for (const ids of trialGroups.values()) {
      if (ids.delete(sourceId)) ids.add(targetId);
    }
  };
  const unusedGroupId = (initialId, paperKey, anchor) => {
    if (!grouped.has(initialId)) return initialId;
    if (paperKey && !grouped.has(paperKey)) return paperKey;
    const urlKey = `url:${canonicalUrlIdentity(anchor.url) || normalizedId(anchor.id)}`;
    if (!grouped.has(urlKey)) return urlKey;
    return `${urlKey}:anchor:${normalizedId(anchor.id)}`;
  };
  const orderedValues = values.map((value, index) => ({ value, index })).sort((a, b) => {
    const left = bibliographicIdentity(a.value.anchor), right = bibliographicIdentity(b.value.anchor);
    const leftStrength = Number(!!left.doi) + Number(!!left.pmid);
    const rightStrength = Number(!!right.doi) + Number(!!right.pmid);
    if (rightStrength !== leftStrength) return rightStrength - leftStrength;
    if (leftStrength > 0) {
      const leftKey = `${left.key ?? ""}|${canonicalUrlIdentity(a.value.anchor.url)}|${normalizedId(a.value.anchor.id)}`;
      const rightKey = `${right.key ?? ""}|${canonicalUrlIdentity(b.value.anchor.url)}|${normalizedId(b.value.anchor.id)}`;
      const identityOrder = leftKey.localeCompare(rightKey);
      if (identityOrder) return identityOrder;
    }
    return a.index - b.index;
  });
  for (const { value } of orderedValues) {
    const initialId = conversationStoryKey(value.anchor);
    const bibliographic = bibliographicIdentity(value.anchor);
    const paperResolution = bibliographic.key ? paperIdentity.resolve(value.anchor) : null;
    const resolvedPaperKeys = [...new Set([
      paperResolution?.key,
      ...paperResolution?.absorbedKeys ?? []
    ].filter((key) => !!key))];
    const exactPaperGroups = [...new Set(resolvedPaperKeys.map((key) => paperGroupByKey.get(key)).filter((groupId) => !!groupId && grouped.has(groupId)))];
    let id;
    if (exactPaperGroups.length) {
      id = exactPaperGroups[0];
      for (const sourceId of exactPaperGroups.slice(1)) mergeGroups(id, sourceId);
    } else if (/^trial:/.test(initialId)) {
      const compatibleTrialGroups = [...trialGroups.get(initialId) ?? []].filter((groupId) => {
        const story2 = grouped.get(groupId);
        return !!story2 && !storyConflictsWith(story2, value.anchor);
      });
      id = compatibleTrialGroups.length === 1 ? compatibleTrialGroups[0] : unusedGroupId(initialId, paperResolution?.key ?? null, value.anchor);
    } else {
      id = grouped.has(initialId) ? initialId : unusedGroupId(initialId, paperResolution?.key ?? null, value.anchor);
    }
    let story = grouped.get(id) ?? {
      id,
      anchor: value.anchor,
      sources: [],
      areas: [],
      reactions: []
    };
    if (anchorRank(value.anchor) > anchorRank(story.anchor)) story.anchor = value.anchor;
    for (const rawSource of [{
      label: value.anchor.label,
      url: value.anchor.url,
      doi: value.anchor.doi,
      pmid: value.anchor.pmid
    }, ...value.additionalSources ?? []]) {
      const source = displayConversationSource(rawSource);
      if (!story.sources.some((existing) => conversationSourcesMatch(existing, source))) {
        story.sources.push(source);
      }
    }
    story.areas = normalizeAreas([...story.areas, ...story.anchor.areas ?? [], ...value.reaction.areas]);
    const duplicate = story.reactions.some((reaction) => reaction.postId === value.reaction.postId || reaction.sourceId === value.reaction.sourceId && reactionIdentity(reaction) === reactionIdentity(value.reaction));
    if (!duplicate) story.reactions.push(value.reaction);
    grouped.set(id, story);
    for (const key of resolvedPaperKeys) paperGroupByKey.set(key, id);
    if (/^trial:/.test(initialId)) {
      const ids = trialGroups.get(initialId) ?? /* @__PURE__ */ new Set();
      ids.add(id);
      trialGroups.set(initialId, ids);
    }
  }
  for (const story of grouped.values()) {
    story.sources.sort((a, b) => Number(canonicalUrlIdentity(a.url) !== canonicalUrlIdentity(story.anchor.url)) - Number(canonicalUrlIdentity(b.url) !== canonicalUrlIdentity(story.anchor.url)));
    story.reactions.sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name));
  }
  return [...grouped.values()].sort((a, b) => (b.reactions[0]?.likes ?? 0) - (a.reactions[0]?.likes ?? 0) || a.id.localeCompare(b.id));
}
function specialtyToConversationAreas(value) {
  const specialty = String(value ?? "").toLowerCase();
  const areas = [];
  const add = (area) => {
    if (!areas.includes(area)) areas.push(area);
  };
  if (/^(?:gu|genitourinary)$/.test(specialty) || /genitourinary|\burolog|prostate|renal|kidney|bladder|testicular/.test(specialty)) add("GU");
  if (/melanoma|cutaneous|skin/.test(specialty)) add("Skin");
  if (/^skin$/.test(specialty)) add("Skin");
  if (/breast/.test(specialty)) add("Breast");
  if (/thoracic|\blung\b/.test(specialty)) add("Lung");
  if (/gastro|colorectal|pancrea|hepatobiliary|\bgi\b/.test(specialty)) add("GI");
  if (/gynec|ovarian|cervical|uterine|endometrial/.test(specialty)) add("Gyn");
  if (/\bheme\b|hemat|myeloma|lymphoma|leukemia|leukaemia|stem cell transplant|\bbmt\b/.test(specialty)) add("Heme");
  return areas;
}
function eventPrimaryUrl(nct, detail) {
  const values = [detail?.source_url, detail?.sourceUrl, detail?.url, detail?.link];
  const direct = values.map((value) => String(value ?? "").trim()).find((value) => /^https?:\/\//i.test(value));
  if (direct) return direct;
  const application = String(detail?.application ?? "").match(/\d+/)?.[0] ?? null;
  if (application) return `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${application}`;
  if (/^NCT\d{8}$/i.test(String(nct ?? ""))) return `https://clinicaltrials.gov/study/${String(nct).toUpperCase()}`;
  return null;
}

// supabase/functions/_shared/anchoredDevelopments.ts
var READOUT_AREAS = ["GU", "Lung", "Breast", "GI", "Heme", "Gyn", "Skin"];
function refreshArchivedAnchorDescriptions(values, articles) {
  const byId = new Map(articles.map((article) => [article.id, article]));
  const byUrl = new Map(articles.map((article) => [canonicalUrlIdentity(article.canonical_url), article]));
  return values.map((value) => {
    if (String(value.anchor.description ?? "").trim()) return value;
    const current = byId.get(value.anchor.id) ?? byUrl.get(canonicalUrlIdentity(value.anchor.url));
    const description = String(current?.description ?? "").trim();
    return description ? { ...value, anchor: { ...value.anchor, description } } : value;
  });
}
function specialtyAreas(values) {
  return [...new Set(values.flatMap((value) => specialtyToConversationAreas(value)))].filter((value) => READOUT_AREAS.includes(value)).sort((a, b) => READOUT_AREAS.indexOf(a) - READOUT_AREAS.indexOf(b));
}
function isSpecialtyLocal(area, areas) {
  return areas.includes(area);
}
function enrichArchivedConversationValues(archived, live) {
  const liveByPost = /* @__PURE__ */ new Map();
  for (const value of live) {
    const prior = liveByPost.get(value.reaction.postId);
    if (!prior || value.reaction.text.length > prior.text.length) {
      liveByPost.set(value.reaction.postId, value.reaction);
    }
  }
  const enriched = archived.map((value) => {
    const current = liveByPost.get(value.reaction.postId);
    if (!current) return value;
    return {
      ...value,
      reaction: {
        ...value.reaction,
        ...current,
        text: current.text.length >= value.reaction.text.length ? current.text : value.reaction.text
      }
    };
  });
  return [...enriched, ...live];
}
function developmentSubAreas(candidate) {
  return subAreasOf(candidate.area, ...candidate.allEvidence.map((reaction) => reaction.text));
}
function developmentIdentity(anchor) {
  const nct = (anchor.trialIds ?? []).find((value) => /^NCT\d{8}$/i.test(value.trim()))?.trim().toUpperCase() ?? null;
  return {
    nct,
    doi: anchor.doi?.trim() || null,
    eventId: anchor.eventKey?.trim() || null
  };
}
function trialMentionQueryVariants(values) {
  return [...new Set(values.flatMap((value) => {
    const clean2 = value.trim();
    return clean2 ? [clean2, clean2.toUpperCase(), clean2.toLowerCase()] : [];
  }))];
}
function externalUrlQueryVariants2(values) {
  return externalUrlQueryVariants(values);
}
var authoredWords = (text) => text.replace(/https?:\/\/\S+/g, " ").replace(/@[A-Za-z0-9_]+/g, " ").replace(/#[A-Za-z0-9_]+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean).length;
var isAuthored = (reaction) => !/^\s*RT\s+@/i.test(reaction.text) && authoredWords(reaction.text) >= 12;
function conversationSpan(reactions) {
  const authoredTouches = reactions.filter(isAuthored);
  const authoredClinicians = strongestPerClinician(authoredTouches);
  const timestamps = authoredTouches.map((reaction) => reaction.postedAt).filter((value) => !!value && Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b));
  const firstTouchAt = timestamps[0] ?? null;
  const lastTouchAt = timestamps.at(-1) ?? null;
  const elapsedMs = firstTouchAt && lastTouchAt ? Date.parse(lastTouchAt) - Date.parse(firstTouchAt) : 0;
  return {
    authoredClinicians: authoredClinicians.length,
    spanDays: timestamps.length ? Math.max(1, Math.ceil(elapsedMs / 864e5)) : 0,
    firstTouchAt,
    lastTouchAt
  };
}
var strongestPerClinician = (reactions) => {
  const best = /* @__PURE__ */ new Map();
  for (const reaction of reactions) {
    const key = reaction.sourceId || reaction.handle.toLowerCase();
    const prior = best.get(key);
    if (!prior || reaction.likes > prior.likes || reaction.likes === prior.likes && reaction.text.length > prior.text.length) best.set(key, reaction);
  }
  return [...best.values()].sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name));
};
var resolvableSource = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !/(?:^|\.)x\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
};
function evaluateAnchoredDevelopment(story, area, evidenceLimit = 4) {
  if (story.anchor.kind !== "primary_report") {
    return { eligible: false, rejection: "anchor_is_not_primary_report", candidate: null };
  }
  if (!resolvableSource(story.anchor.url)) {
    return { eligible: false, rejection: "source_url_is_not_resolvable", candidate: null };
  }
  if (!/^trial:.+:results(?::[a-z+]+)*$/.test(story.id)) {
    return { eligible: false, rejection: "identity_is_not_trial_results", candidate: null };
  }
  const authored = story.reactions.filter(isAuthored);
  const evidenceLocal = (reaction) => reaction.sourceAreas?.includes(area);
  const specialtyLocalTouches = authored.filter(
    (reaction) => reaction.areas.includes(area) && evidenceLocal(reaction)
  );
  const sourceHome = story.anchor.areas?.includes(area) ?? false;
  const areaTouches = authored.filter((reaction) => reaction.areas.includes(area));
  const explicitTouches = sourceHome ? areaTouches : specialtyLocalTouches;
  const referenceTouches = authored.filter((reaction) => reaction.referenceAreas?.includes(area));
  const qualifying = strongestPerClinician(explicitTouches);
  if (!qualifying.length) {
    return { eligible: false, rejection: "no_explicit_area_reaction", candidate: null };
  }
  const reference = strongestPerClinician(referenceTouches)[0];
  if (new Set(qualifying.map((reaction) => reaction.sourceId)).size < 2) {
    return { eligible: false, rejection: "insufficient_independent_clinician_breadth", candidate: null };
  }
  const specialty = strongestPerClinician(specialtyLocalTouches);
  const areaEvidence = strongestPerClinician([
    ...qualifying,
    ...referenceTouches
  ]);
  const allAreaTouches = [...new Map([...explicitTouches, ...referenceTouches].map((reaction) => [reaction.postId || reaction.url, reaction])).values()];
  const localClinicians = strongestPerClinician([
    ...specialtyLocalTouches,
    ...referenceTouches
  ]);
  const localIds = new Set(localClinicians.map((reaction) => reaction.sourceId));
  let selected = [
    ...localClinicians,
    ...qualifying.filter((reaction) => !localIds.has(reaction.sourceId))
  ].slice(0, Math.max(1, evidenceLimit));
  if (reference && !selected.some((reaction) => reaction.sourceId === reference.sourceId)) {
    selected = selected.length < evidenceLimit ? [...selected, reference] : [...selected.slice(0, Math.max(0, evidenceLimit - 1)), reference];
  }
  selected = [...new Map(selected.map((reaction) => [
    reaction.sourceId || reaction.handle.toLowerCase(),
    reaction
  ])).values()].slice(0, evidenceLimit);
  const engagement = specialty.reduce((sum, reaction) => sum + Math.max(0, reaction.likes), 0);
  const engagementScore = Math.min(20, Math.round(Math.log2(engagement + 1) * 3));
  const referencePreserved = !!reference && selected.some((reaction) => reaction.sourceId === reference.sourceId);
  const laneScore = specialty.length * 10 + engagementScore;
  return {
    eligible: true,
    rejection: null,
    candidate: {
      id: `development:${story.id}:${area}`,
      area,
      anchor: story.anchor,
      sources: story.sources,
      explicitClinicians: specialty.length,
      totalAreaEvidence: areaEvidence.length,
      referencePreserved,
      engagement,
      laneScore,
      selectedEvidence: selected,
      allEvidence: areaEvidence,
      allEvidenceTouches: allAreaTouches,
      specialtyEvidenceTouches: specialtyLocalTouches,
      // Duplicate suppression is broader than presentation. Keep every exact
      // authored root id grouped to this source even when that physician is not
      // suitable for this specialty's visible evidence drawer.
      storyPostIds: [...new Set(authored.map((reaction) => reaction.postId))]
    }
  };
}
var ENDPOINT_ACRONYMS = ["RFS", "DMFS", "PFS", "OS", "ORR", "EFS", "DFS"];
function developmentHeadline(sourceTitle) {
  const clean2 = sourceTitle.replace(/\s+/g, " ").trim();
  const trial = clean2.match(/\b([A-Za-z][A-Za-z0-9]*(?:[- ]\d{3,}))\b/)?.[1];
  const endpoints = ENDPOINT_ACRONYMS.filter(
    (endpoint) => new RegExp(`\\b${endpoint}\\b`, "i").test(clean2)
  );
  const disease = clean2.match(/\b(melanoma|breast cancer|lung cancer|prostate cancer|kidney cancer|renal cell carcinoma|bladder cancer|colorectal cancer|pancreatic cancer|ovarian cancer|multiple myeloma|lymphoma|leukemia)\b/i)?.[1];
  if (trial && endpoints.length && explicitlyReportsMetEndpoints(clean2)) {
    const endpointText = endpoints.length === 1 ? endpoints[0] : `${endpoints.slice(0, -1).join(", ")} and ${endpoints.at(-1)}`;
    return `${trial.replace(/ /g, "-")} meets ${endpointText} endpoint${endpoints.length === 1 ? "" : "s"}${disease ? ` in ${disease.toLowerCase()}` : ""}`;
  }
  if (clean2.length <= 180) return clean2;
  const clipped = clean2.slice(0, 177).replace(/\s+\S*$/, "").trim();
  return `${clipped}...`;
}
function seatAnchoredDevelopment(current, candidate, cap = 5) {
  const cards = current.slice(0, cap);
  if (!candidate) return { cards, displaced: null, reason: "no_candidate" };
  if (cards.some((card) => card.id === candidate.id || card.siblings?.some((sibling) => sibling.id === candidate.id) || candidate.siblings?.some((sibling) => sibling.id === card.id))) {
    return { cards, displaced: null, reason: "already_present" };
  }
  if (cards.length < cap) return { cards: [...cards, candidate], displaced: null, reason: "inserted" };
  let replace = -1;
  for (let index = cards.length - 1; index >= 0; index--) {
    if (cards[index].kind !== "event" && cards[index].kind !== "episode") {
      replace = index;
      break;
    }
  }
  if (replace < 0) return { cards, displaced: null, reason: "no_replaceable_slot" };
  const displaced = cards[replace];
  return {
    cards: [...cards.slice(0, replace), ...cards.slice(replace + 1), candidate],
    displaced,
    reason: "replaced_lowest_unprotected"
  };
}
function collapseDevelopmentReceiptThreads(cards, candidate) {
  const storyPostIds = new Set(
    Array.isArray(candidate?.poolMeta?.storyPostIds) ? candidate.poolMeta.storyPostIds.map(String) : []
  );
  const storySourceUrls = new Set(
    Array.isArray(candidate?.poolMeta?.storySourceUrls) ? candidate.poolMeta.storySourceUrls.map((url) => canonicalUrlIdentity(String(url))).filter(Boolean) : []
  );
  if (!storyPostIds.size && !storySourceUrls.size) return cards;
  return cards.filter((card) => {
    if (card === candidate || card.kind !== "thread") return true;
    if (storyPostIds.has(card.anchorId)) return false;
    const links = Array.isArray(card.poolMeta?.links) ? card.poolMeta.links : [];
    return !links.some((url) => storySourceUrls.has(canonicalUrlIdentity(String(url))));
  });
}
function removeStandaloneThreadPadding(cards, completeDeckAnchors = 4) {
  const anchoredCount = cards.filter((card) => card.kind !== "thread").length;
  if (anchoredCount < completeDeckAnchors) return cards;
  return cards.filter((card) => card.kind !== "thread");
}

// supabase/functions/_shared/clinicianEvidence.ts
var READOUT_HCP_IDENTITIES = /* @__PURE__ */ new Set(["doctor_verified", "doctor_probable"]);
function selectReadoutClinicianPeople(people, bannedSourceIds) {
  const personIdBySourceId = /* @__PURE__ */ new Map();
  for (const person of people) {
    const sourceId = person.x_source_id ? String(person.x_source_id) : null;
    if (!person.id || !sourceId || bannedSourceIds.has(sourceId) || !READOUT_HCP_IDENTITIES.has(person.person_hcp_identity ?? "")) continue;
    if (!personIdBySourceId.has(sourceId)) {
      personIdBySourceId.set(sourceId, String(person.id));
    }
  }
  return personIdBySourceId;
}

// supabase/functions/_shared/specialtyBriefingBuilder.ts
var EMPTY_RECAP = { recap: null, whys: {}, headline: null, headlineStoryId: null, moverHeadlines: {}, storyWhys: {}, storyHeadlines: {} };
function createSpecialtyRecap({ url, key, fetch: fetch2 = globalThis.fetch }) {
  return async function recapFor({ area, movers, events, stories = [], leadStories = [] }) {
    if (!url || !key || movers.length === 0 && stories.length === 0) return { recap: null, whys: {}, headline: null, headlineStoryId: null, moverHeadlines: {}, storyWhys: {}, storyHeadlines: {} };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch2(`${url}/functions/v1/briefing-recap`, {
          method: "POST",
          headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
          body: JSON.stringify({
            area,
            movers: movers.slice(0, 8).map((m) => ({
              drug: m.drug,
              brand: m.brand,
              // gates off-topic tweets by drug name
              glosses: (m.podcast ?? []).map((c) => c.gloss).filter(Boolean).slice(0, 6),
              // podcast synthesis
              paperTitles: (m.papers ?? []).map((p) => p.title).filter(Boolean).slice(0, 3),
              // REAL titles — the ONLY thing that licenses "paper"
              paperPosts: (m.papers ?? []).flatMap((p) => (p.posts ?? []).map((s) => s.text)).filter(Boolean).slice(0, 4),
              // paper-sharers' takes
              tweetTexts: (m.posts ?? []).map((p) => p.text).filter(Boolean).slice(0, 6),
              // raw drug-matched tweet bodies (likes-sorted)
              // Send EPISODES, not raw segments: the card defines a "conversation" as
              // one episode (5 clips of one episode = 1 conversation), so passing
              // podConvs (11 segments) made the prose say "eleven discussions" over a
              // card reading "4 conversations". Align the number the AI narrates with
              // what the reader sees (2026-08-02, Codex follow-up #2).
              podConvs: m.podEpisodes ?? m.podConvs,
              xSharers: m.xSharers,
              articleCount: m.articleCount,
              event: m.eventChip
            })),
            // PAPER/TOPIC story atoms → one grounded takeaway each (storyWhys), same anti-hallucination rules.
            stories: stories.slice(0, 8).map((s) => ({
              id: s.id,
              kind: s.kind,
              headline: s.headline,
              paperTitles: (s.papers ?? []).map((p) => p.title).filter(Boolean).slice(0, 6),
              abstracts: (s.papers ?? []).map((p) => p.abstract).filter(Boolean).slice(0, 2),
              glosses: (s.podcast ?? []).map((p) => p.gloss).filter(Boolean).slice(0, 3),
              // Paper facts and numbers come from primary text. Physician posts remain
              // visible receipts, but never become drafting input for a paper summary.
              posts: s.kind === "paper" ? [] : (s.posts ?? []).map((p) => p.text).filter(Boolean).slice(0, 4)
            })),
            events: events.filter((e) => !e.ahead).slice(0, 4).map((e) => ({ type: e.type, title: e.title, drug: e.drug })),
            // The ORDERED lead stories (top 3 as actually ranked). The cover headline
            // must be ABOUT one of these, and briefing-recap returns headlineStoryId —
            // so the headline can't promise a theme the reader's top cards don't
            // deliver (GU's "bladder ADC" headline over a prostate lead). 2026-08-02.
            leadStories: leadStories.slice(0, 3).map((s) => ({ id: s.id, kind: s.kind, headline: s.headline }))
          }),
          signal: AbortSignal.timeout(attempt === 0 ? 35e3 : 55e3)
        });
        if (!r.ok) {
          console.error(`briefing-recap ${area}: HTTP ${r.status} (attempt ${attempt + 1}/2)`);
          continue;
        }
        const j = await r.json();
        if (!j?.recap && !j?.headline && attempt === 0) {
          console.error(`briefing-recap ${area}: empty prose (attempt 1/2), retrying`);
          continue;
        }
        return { recap: j?.recap ?? null, whys: j?.whys ?? {}, headline: j?.headline ?? null, headlineStoryId: j?.headlineStoryId ?? null, moverHeadlines: j?.moverHeadlines ?? {}, storyWhys: j?.storyWhys ?? {}, storyHeadlines: j?.storyHeadlines ?? {} };
      } catch (e) {
        console.error(`briefing-recap ${area}: ${e?.message ?? e} (attempt ${attempt + 1}/2)`);
      }
    }
    console.error(`briefing-recap ${area}: FAILED after 2 attempts - edition ships without prose`);
    return { recap: null, whys: {}, headline: null, headlineStoryId: null, moverHeadlines: {}, storyWhys: {}, storyHeadlines: {} };
  };
}
async function collectInIdBatches(ids, load, batchSize = 200) {
  const out = [];
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    out.push(...await load(ids.slice(offset, offset + batchSize)));
  }
  return out;
}
function createSpecialtyBriefingBuilder(input) {
  const deps = { ...input, now: input.now ?? (() => Date.now()), loadPriorSnapshot: input.loadPriorSnapshot ?? (async () => null), effectsMode: input.effectsMode ?? "apply" };
  const sb = deps.db;
  function weekOfMonday(d = new Date(deps.now())) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7);
    return x.toISOString().slice(0, 10);
  }
  const DEVELOPMENT_WINDOW_HOURS = 72;
  async function loadAnchoredDevelopmentCard(area, now, clinicianSourceIds, sourceByHandle) {
    const floor = new Date(now - DEVELOPMENT_WINDOW_HOURS * 60 * 60 * 1e3).toISOString();
    const dailyRows = await rows(sb.from("daily_readout").select("payload").gte("generated_at", floor).order("generated_at", { ascending: false }));
    const archivedValuesRaw = dailyRows.flatMap((row) => (row.payload?.conversationStories ?? []).flatMap(
      (story) => story.reactions.map((reaction) => ({
        anchor: story.anchor,
        reaction,
        additionalSources: story.sources.filter(
          (source) => canonicalUrlIdentity(source.url) !== canonicalUrlIdentity(story.anchor.url)
        )
      }))
    ));
    const missingAnchorIds = [...new Set(archivedValuesRaw.filter((value) => !String(value.anchor.description ?? "").trim()).map((value) => value.anchor.id).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))];
    const currentAnchorArticles = [];
    for (let offset = 0; offset < missingAnchorIds.length; offset += 100) {
      currentAnchorArticles.push(...await rows(sb.from("x_shared_articles").select("id,canonical_url,description").in("id", missingAnchorIds.slice(offset, offset + 100))));
    }
    const archivedValues = refreshArchivedAnchorDescriptions(archivedValuesRaw, currentAnchorArticles);
    const stories = groupDailyConversationStories(archivedValues).filter(
      (story) => story.anchor.kind === "primary_report" && /^trial:.+:results(?::[a-z+]+)*$/.test(story.id)
    );
    if (!stories.length) return null;
    const normalized = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const trialSurfaces = trialMentionQueryVariants(stories.flatMap((story) => [
      ...story.anchor.trialIds ?? [],
      ...story.anchor.title.match(/\b(?:NCT\d{8}|[A-Za-z][A-Za-z0-9]{2,}(?:[- ]\d{3,}))\b/g) ?? []
    ]));
    const anchorUrls = externalUrlQueryVariants2(stories.map((story) => story.anchor.url).filter(Boolean));
    const select = "content,content_en,lang,rt_tweet_id,metrics,metrics_24h,trial_mentions,x_post_id,external_url,quoted_url,posted_at,x_sources!inner(id,name,x_handle,avatar_url,source_type,tumor_categories)";
    const postRows = /* @__PURE__ */ new Map();
    if (trialSurfaces.length) {
      for (const row of await rows(sb.from("x_posts_product").select(select).eq("x_sources.source_type", "kol").gte("posted_at", floor).overlaps("trial_mentions", trialSurfaces))) {
        postRows.set(String(row.x_post_id), row);
      }
    }
    if (anchorUrls.length) {
      for (const row of await rows(sb.from("x_posts_product").select(select).eq("x_sources.source_type", "kol").gte("posted_at", floor).in("external_url", anchorUrls))) {
        postRows.set(String(row.x_post_id), row);
      }
      for (const row of await rows(sb.from("x_posts_product").select(select).eq("x_sources.source_type", "kol").gte("posted_at", floor).in("quoted_url", anchorUrls))) {
        postRows.set(String(row.x_post_id), row);
      }
    }
    const archivedPostIds = [...new Set(archivedValues.map((value) => value.reaction.postId).filter(Boolean))];
    for (let offset = 0; offset < archivedPostIds.length; offset += 100) {
      for (const row of await rows(sb.from("x_posts_product").select(select).eq("x_sources.source_type", "kol").in("x_post_id", archivedPostIds.slice(offset, offset + 100)))) {
        postRows.set(String(row.x_post_id), row);
      }
    }
    const referenceRows = await rows(sb.from("daily_reference_kols").select("x_source_id,area").eq("active", true));
    const referenceAreas = /* @__PURE__ */ new Map();
    for (const row of referenceRows) {
      referenceAreas.set(row.x_source_id, [.../* @__PURE__ */ new Set([...referenceAreas.get(row.x_source_id) ?? [], row.area])]);
    }
    const handles = [...new Set([...postRows.values()].map((post) => String(post.x_sources?.x_handle ?? "")).filter(Boolean))];
    const personAreas = /* @__PURE__ */ new Map();
    for (let offset = 0; offset < handles.length; offset += 100) {
      for (const person of await rows(sb.from("v_public_person").select("x_handle,specialty").in("x_handle", handles.slice(offset, offset + 100)))) {
        const handle = String(person.x_handle ?? "").toLowerCase();
        personAreas.set(handle, [.../* @__PURE__ */ new Set([
          ...personAreas.get(handle) ?? [],
          ...specialtyToConversationAreas(person.specialty)
        ])]);
      }
    }
    const storiesByTrial = /* @__PURE__ */ new Map();
    const storiesByUrl = /* @__PURE__ */ new Map();
    const storiesByArchivedPost = /* @__PURE__ */ new Map();
    for (const story of stories) {
      for (const sourceUrl of [story.anchor.url, ...story.sources.map((source) => source.url)]) {
        const urlIdentity = canonicalUrlIdentity(sourceUrl);
        if (!urlIdentity) continue;
        const matches = storiesByUrl.get(urlIdentity) ?? /* @__PURE__ */ new Set();
        matches.add(story);
        storiesByUrl.set(urlIdentity, matches);
      }
      for (const reaction of story.reactions) {
        const matches = storiesByArchivedPost.get(reaction.postId) ?? /* @__PURE__ */ new Set();
        matches.add(story);
        storiesByArchivedPost.set(reaction.postId, matches);
      }
      const key = /^trial:(.+):results(?::[a-z+]+)*$/.exec(story.id)?.[1];
      for (const trial of key?.split("+") ?? []) {
        const normalizedTrial = normalized(trial);
        storiesByTrial.set(normalizedTrial, [...storiesByTrial.get(normalizedTrial) ?? [], story]);
      }
    }
    const liveValues = [];
    for (const post of postRows.values()) {
      const source = post.x_sources ?? {};
      if (!source.id || !clinicianSourceIds.has(String(source.id)) || post.rt_tweet_id) continue;
      const trialCandidates = /* @__PURE__ */ new Set();
      for (const trial of post.trial_mentions ?? []) {
        for (const story of storiesByTrial.get(normalized(trial)) ?? []) trialCandidates.add(story);
      }
      const exactCandidates = new Set(storiesByArchivedPost.get(String(post.x_post_id)) ?? []);
      for (const linkedUrl of [post.external_url, post.quoted_url]) {
        for (const story of storiesByUrl.get(canonicalUrlIdentity(linkedUrl)) ?? []) exactCandidates.add(story);
      }
      const matched = exactCandidates.size === 1 ? exactCandidates : exactCandidates.size === 0 && trialCandidates.size === 1 ? trialCandidates : /* @__PURE__ */ new Set();
      if (!matched.size) continue;
      const sourceAreas = [.../* @__PURE__ */ new Set([
        ...(source.tumor_categories ?? []).flatMap((value) => specialtyToConversationAreas(value)),
        ...personAreas.get(String(source.x_handle ?? "").toLowerCase()) ?? []
      ])];
      const text = String(post.content_en ?? post.content ?? "");
      const reaction = {
        postId: String(post.x_post_id),
        sourceId: String(source.id),
        name: String(source.name),
        handle: String(source.x_handle),
        text: String(post.content ?? post.content_en ?? "").replace(/\s+/g, " ").trim(),
        url: `https://x.com/${source.x_handle}/status/${post.x_post_id}`,
        likes: Number((post.metrics_24h ?? post.metrics)?.likes ?? 0),
        postedAt: String(post.posted_at ?? "") || null,
        areas: classifyConversationAreas({ text, sourceAreas }),
        sourceAreas,
        referenceAreas: referenceAreas.get(String(source.id)) ?? [],
        translatedFrom: post.content_en ? String(post.lang ?? "") : null
      };
      for (const story of matched) liveValues.push({
        anchor: story.anchor,
        reaction,
        additionalSources: story.sources.filter(
          (sourceLink) => canonicalUrlIdentity(sourceLink.url) !== canonicalUrlIdentity(story.anchor.url)
        )
      });
    }
    const decisions = groupDailyConversationStories(enrichArchivedConversationValues(archivedValues, liveValues)).map((story) => ({ story, candidate: evaluateAnchoredDevelopment(story, area).candidate })).filter((value) => !!value.candidate).sort((a, b) => b.candidate.laneScore - a.candidate.laneScore || a.candidate.id.localeCompare(b.candidate.id));
    const selected = decisions[0];
    if (!selected) return null;
    const { candidate } = selected;
    const selectedIds = new Set(candidate.selectedEvidence.map((reaction) => reaction.postId));
    const evidence = [...candidate.selectedEvidence, ...candidate.allEvidence.filter((reaction) => !selectedIds.has(reaction.postId))];
    const clinicianPosts = evidence.map((reaction) => {
      const source = sourceByHandle.get(normalizeXHandle(reaction.handle) ?? "");
      return {
        name: reaction.name,
        handle: reaction.handle,
        avatar: source?.avatar_url ?? null,
        tweetUrl: reaction.url,
        text: reaction.text,
        likes: reaction.likes,
        retweets: 0,
        quotes: 0,
        views: 0,
        sourceLane: "clinician",
        sourceAreas: reaction.sourceAreas ?? []
      };
    });
    const rankTrace = [
      { input: "specialtyClinicians", value: candidate.explicitClinicians, weight: 10, contribution: candidate.explicitClinicians * 10 },
      { input: "engagementCapped", value: candidate.engagement, weight: 1, contribution: candidate.laneScore - candidate.explicitClinicians * 10 }
    ];
    const identity = developmentIdentity(candidate.anchor);
    const span = conversationSpan(candidate.specialtyEvidenceTouches);
    const conversationWhy = span.spanDays > 1 ? `${span.authoredClinicians} ${area} clinicians commented over ${span.spanDays} days` : `${span.authoredClinicians} ${area} clinicians commented`;
    const sourceExcerpt = abstractFindings(candidate.anchor.description, 240) ?? truncateSentence(candidate.anchor.description, 240);
    return {
      id: candidate.id,
      kind: "development",
      anchorId: candidate.id,
      headline: developmentHeadline(candidate.anchor.title),
      why: anchoredWhy("development", conversationWhy),
      sourceLabel: candidate.anchor.label,
      url: candidate.anchor.url,
      excerpt: sourceExcerpt,
      excerptVerbatim: false,
      drugTags: [],
      subAreas: developmentSubAreas(candidate),
      nct: identity.nct,
      doi: identity.doi,
      eventId: identity.eventId,
      siblings: [],
      rankTrace,
      rankTotal: candidate.laneScore,
      counts: { specialtyClinicians: candidate.explicitClinicians, physicianReactions: candidate.totalAreaEvidence },
      conversation: span,
      poolMeta: { storyPostIds: candidate.storyPostIds, storySourceUrls: [candidate.anchor.url] },
      support: {
        clinicianPosts,
        publisherPosts: [],
        otherPosts: [],
        links: [{
          kind: "article",
          id: candidate.anchor.id,
          title: candidate.anchor.title,
          url: candidate.anchor.url,
          sourceLabel: candidate.anchor.label,
          description: sourceExcerpt,
          relationshipType: "primary_source",
          occurredAt: null
        }]
      }
    };
  }
  async function rows(b) {
    const { data, error } = await b;
    if (error) throw error;
    return data ?? [];
  }
  async function pageAll(make, pageSize = 1e3) {
    const out = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await make(from, from + pageSize - 1);
      if (error) throw error;
      const batch = data ?? [];
      out.push(...batch);
      if (batch.length < pageSize) break;
    }
    return out;
  }
  async function pageEachBatch(make, onBatch, pageSize = 1e3) {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await make(from, from + pageSize - 1);
      if (error) throw error;
      const batch = data ?? [];
      const rawLen = batch.length;
      await onBatch(batch);
      if (rawLen < pageSize) break;
    }
  }
  const realNameBySourceId = /* @__PURE__ */ new Map();
  function withRealName(src) {
    if (src?.id) {
      const rn = realNameBySourceId.get(src.id);
      const displayName2 = preferredEvidenceDisplayName(src, rn);
      if (displayName2) src.name = displayName2;
    }
    return src;
  }
  async function hydrateEvidenceOrigins(batch, sourceByHandle) {
    const handles = [...new Set(batch.map((row) => normalizeXHandle((row?.x_posts ?? row)?.rt_author_handle)).filter((handle) => !!handle && !sourceByHandle.has(handle)))];
    if (!handles.length) return;
    for (let i = 0; i < handles.length; i += 100) {
      const wanted = handles.slice(i, i + 100);
      const { data, error } = await sb.from("x_kol_candidates").select("x_user_id,handle,name,avatar_url,verify_tier,verify_detail").in("handle_normalized", wanted);
      if (error) throw new Error(`evidence origin profiles: ${error.message}`);
      for (const candidate of data ?? []) {
        const source = evidenceSourceFromOriginProfile(candidate);
        const handle = normalizeXHandle(source?.x_handle);
        if (source && handle && !sourceByHandle.has(handle)) sourceByHandle.set(handle, source);
      }
    }
  }
  async function loadEpisodeXReceipts(episodeIds, clinicianSourceIds, sourceAreasForHandle = () => []) {
    const announcements = /* @__PURE__ */ new Map();
    const amplifiers = /* @__PURE__ */ new Map();
    const amplifierIds = /* @__PURE__ */ new Map();
    if (!episodeIds.length) return { announcements, amplifiers, amplifierIds };
    const [announcementRows, amplifierRows] = await Promise.all([
      rows(sb.from("v_episode_x_announcement_receipts").select("episode_id,announcement_id,name,handle,avatar,text,lang,text_en,likes,retweets,quotes,views,posted_at").in("episode_id", episodeIds).order("posted_at", { ascending: false })),
      rows(sb.from("v_episode_x_amplifiers").select("episode_id,announcement_id,amplifier_post_id,x_source_id,name,handle,avatar,is_quote,text,lang,text_en,likes").in("episode_id", episodeIds).order("likes", { ascending: false }))
    ]);
    for (const r of announcementRows) {
      const arr = announcements.get(r.episode_id) ?? [];
      if (arr.length < 2 && !arr.some((x) => x.tweetUrl?.endsWith(`/status/${r.announcement_id}`))) {
        const handle = String(r.handle ?? "").replace(/^@/, "") || null;
        arr.push({
          name: r.name ?? (handle ? `@${handle}` : "Podcast"),
          handle,
          avatar: r.avatar ?? null,
          tweetUrl: handle && r.announcement_id ? `https://x.com/${handle}/status/${r.announcement_id}` : null,
          text: String(r.text ?? "").trim() || null,
          lang: r.lang ?? null,
          textEn: r.text_en ?? null,
          likes: Number(r.likes ?? 0),
          retweets: Number(r.retweets ?? 0),
          quotes: Number(r.quotes ?? 0),
          views: Number(r.views ?? 0)
        });
      }
      announcements.set(r.episode_id, arr);
    }
    for (const r of amplifierRows) {
      if (!r.x_source_id || !clinicianSourceIds.has(String(r.x_source_id))) continue;
      const identity = String(r.handle ?? r.name).toLowerCase();
      const ids = amplifierIds.get(r.episode_id) ?? /* @__PURE__ */ new Set();
      if (ids.has(identity)) continue;
      ids.add(identity);
      amplifierIds.set(r.episode_id, ids);
      const arr = amplifiers.get(r.episode_id) ?? [];
      const handle = String(r.handle ?? "").replace(/^@/, "") || null;
      arr.push({
        name: r.name,
        handle,
        avatar: r.avatar ?? null,
        isQuote: !!r.is_quote,
        text: r.text,
        lang: r.lang ?? null,
        textEn: r.text_en ?? null,
        likes: Number(r.likes ?? 0),
        announcementId: r.announcement_id ?? null,
        tweetUrl: handle && r.amplifier_post_id ? `https://x.com/${handle}/status/${r.amplifier_post_id}` : null,
        sourceAreas: sourceAreasForHandle(handle)
      });
      amplifiers.set(r.episode_id, arr);
    }
    return { announcements, amplifiers, amplifierIds };
  }
  const ROUNDUP_CAP = 4;
  const TOPIC_DEFS = {
    GU: [
      { label: "Prostate cancer", terms: ["prostate", "prostatic", "mcrpc", "crpc", "mcspc", "psa"] },
      { label: "PSMA & radioligand therapy", terms: ["psma", "radioligand", "lutetium", "pluvicto", "theranostic"] },
      { label: "Bladder & urothelial", terms: ["bladder", "urothelial", "nmibc", "mibc", "muc"] },
      { label: "Kidney cancer (RCC)", terms: ["renal", "kidney", "rcc", "ccrcc", "nephrectomy"] }
    ],
    Breast: [
      { label: "Triple-negative breast", terms: ["tnbc", "triple negative"] },
      { label: "HR+/HER2\u2212 breast", terms: ["hr positive", "hormone receptor", "estrogen receptor", "endocrine"] },
      { label: "HER2+ breast", terms: ["her2 positive"] },
      { label: "HER2-low disease", terms: ["her2 low", "her2-low"] },
      { label: "CDK4/6 inhibition", terms: ["cdk4", "cdk 4 6", "cdk4 6"] },
      { label: "Brain metastases", terms: ["brain metastas", "cns metastas", "leptomeningeal"] },
      { label: "ctDNA & residual disease", terms: ["ctdna", "circulating tumor dna", "residual disease", "molecular residual"] }
    ],
    Lung: [
      { label: "NSCLC", terms: ["nsclc", "non small cell"] },
      { label: "Small cell lung", terms: ["sclc", "small cell"] },
      { label: "EGFR-mutant lung", terms: ["egfr"] },
      { label: "ALK / ROS1", terms: ["alk", "ros1"] },
      { label: "KRAS G12C", terms: ["kras", "g12c"] },
      { label: "Perioperative & resectable", terms: ["neoadjuvant", "perioperative", "adjuvant", "resectable"] },
      { label: "Brain metastases", terms: ["brain metastas", "cns metastas", "leptomeningeal"] }
    ],
    GI: [
      { label: "Colorectal cancer", terms: ["colorectal", "colon", "rectal", "crc"] },
      { label: "Pancreatic cancer", terms: ["pancreatic", "pancreas", "pdac"] },
      { label: "Gastric & esophageal", terms: ["gastric", "stomach", "esophageal", "gej", "gastroesophageal", "gastro esophageal"] },
      { label: "Biliary & liver", terms: ["biliary", "cholangiocarcinoma", "hepatocellular", "hcc"] },
      { label: "Anal cancer & GIST", terms: ["anal", "gist"] },
      { label: "ctDNA & MRD", terms: ["ctdna", "circulating tumor dna", "minimal residual", "molecular residual", "measurable residual"] },
      { label: "MSI & mismatch repair", terms: ["msi", "microsatellite", "mismatch repair", "dmmr", "mmr"] },
      { label: "HER2 in GI", terms: ["her2"] },
      { label: "KRAS-targeted GI", terms: ["kras", "g12c", "g12d"] }
    ],
    Heme: [
      { label: "Multiple myeloma", terms: ["myeloma"] },
      { label: "Lymphoma", terms: ["lymphoma", "dlbcl", "follicular", "mantle cell", "hodgkin", "waldenstrom"] },
      { label: "Leukemia", terms: ["leukemia", "aml", "cll", "cml"] },
      { label: "Myelodysplastic syndromes", terms: ["mds", "myelodysplastic", "myelofibrosis"] },
      { label: "CAR-T & cell therapy", terms: ["car t", "car-t", "cell therapy", "car nk"] },
      { label: "Bispecific antibodies", terms: ["bispecific", "bcma", "bite"] },
      { label: "MRD in heme", terms: ["mrd", "minimal residual", "measurable residual"] }
    ],
    Gyn: [
      { label: "Ovarian cancer", terms: ["ovarian", "fallopian", "peritoneal"] },
      { label: "Endometrial cancer", terms: ["endometrial", "uterine"] },
      { label: "Cervical cancer", terms: ["cervical"] },
      { label: "PARP & HRD", terms: ["parp", "hrd", "homologous recombination", "brca"] },
      { label: "Maintenance therapy", terms: ["maintenance"] }
    ],
    // Terms run against papers ALREADY admitted to Skin, so "cutaneous squamous" needs no
    // further guarding here — but note there is still no bare "squamous"/"basal cell"/"scc"
    // term, because a Skin paper discussing a head & neck comparator must not cluster as cSCC.
    Skin: [
      { label: "Melanoma", terms: ["melanoma", "melanocytic", "lentigo maligna"] },
      { label: "Cutaneous SCC", terms: ["cutaneous squamous", "cscc", "keratinocyte carcinoma", "actinic keratosis"] },
      { label: "Basal cell carcinoma", terms: ["basal cell carcinoma", "vismodegib", "sonidegib", "hedgehog"] },
      { label: "Merkel cell carcinoma", terms: ["merkel"] },
      { label: "Adjuvant & neoadjuvant", terms: ["neoadjuvant", "adjuvant", "resectable", "sentinel lymph node"] },
      { label: "BRAF/MEK-targeted", terms: ["braf", "mek", "dabrafenib", "trametinib", "encorafenib", "binimetinib"] },
      { label: "Immunotherapy", terms: ["pembrolizumab", "nivolumab", "ipilimumab", "cemiplimab", "avelumab", "relatlimab", "tebentafusp"] }
    ]
  };
  const topicForm = (t) => ` ${t.replace(/[^a-z0-9]+/g, " ").trim()} `;
  const MALIGNANCY_RE = /cancer|carcinoma|tumou?r|neoplas|malignan|oncolog|leukemi|lymphoma|myelom|melanoma|sarcoma|blastoma|metasta|mesotheli|adenocarc|\bmds\b|myelodyspl|myelofibros/i;
  const BENIGN_RE = /insufficiency|fertility|\bbenign\b|endometriosis|adenomyosis|prolapse|incontinence|pregnan|menopaus|contracept|\bibd\b|inflammatory bowel/i;
  const isNonOncTitle = (title) => {
    const t = title ?? "";
    return BENIGN_RE.test(t) && !MALIGNANCY_RE.test(t);
  };
  const NON_THERAPY_RE = /\bimaging\b|\bmri\b|\bct scan\b|contrast agent|radiotracer|gadolinium|manganese|complete response letter|\bcrl\b|angiography|fractional flow/i;
  const BACKBONE_CHEMO = /* @__PURE__ */ new Set([
    "paclitaxel",
    "nab-paclitaxel",
    "docetaxel",
    "carboplatin",
    "cisplatin",
    "oxaliplatin",
    "gemcitabine",
    "fluorouracil",
    "5-fu",
    "capecitabine",
    "doxorubicin",
    "liposomal doxorubicin",
    "epirubicin",
    "cyclophosphamide",
    "pemetrexed",
    "etoposide",
    "irinotecan",
    "topotecan",
    "vinorelbine",
    "vinblastine",
    "methotrexate",
    "leucovorin"
  ]);
  const TRIAL_FIX = [
    [/\bELINA\b/g, "ALINA"]
    // adjuvant alectinib, ALK+ resected NSCLC (NEJM 2024) — mis-heard as "ELINA"
  ];
  const fixGloss = (t) => {
    let s = t ?? "";
    for (const [re, to] of TRIAL_FIX) s = s.replace(re, to);
    return stripTranscriptCorrectionAside(s);
  };
  const CROSS_AREA_TOPICS = /* @__PURE__ */ new Set([
    "HER2-low disease",
    "CDK4/6 inhibition",
    "Brain metastases",
    "ctDNA & residual disease",
    "EGFR-mutant lung",
    "KRAS G12C",
    "Perioperative & resectable",
    "ctDNA & MRD",
    "MSI & mismatch repair",
    "HER2 in GI",
    "KRAS-targeted GI",
    "CAR-T & cell therapy",
    "Bispecific antibodies",
    "MRD in heme",
    "PARP & HRD",
    "Maintenance therapy"
  ]);
  const num = (m, k) => Number(m?.[k] ?? 0);
  const freshNum = (m24, m0, k) => Number(m24?.[k] ?? m0?.[k] ?? 0);
  const isRt = (content) => /^\s*RT @/.test(content ?? "");
  const ownNum = (content, m24, m0, k) => isRt(content) ? 0 : freshNum(m24, m0, k);
  const isAuthoredEvidencePost = (row) => !row.rt_tweet_id && !isRt(typeof row.content === "string" ? row.content : null);
  const oneRelation = (value) => Array.isArray(value) ? value[0] ?? null : value ?? null;
  const bannedSourceIds = /* @__PURE__ */ new Set();
  const bannedHandles = /* @__PURE__ */ new Set();
  const notBanned = (row) => {
    const o = oneRelation(row?.x_sources);
    if (o?.id != null && bannedSourceIds.has(String(o.id))) return false;
    const h = typeof o?.x_handle === "string" ? o.x_handle.toLowerCase().replace(/^@/, "") : null;
    if (h && bannedHandles.has(h)) return false;
    return true;
  };
  const dropBanned = (batch) => {
    for (let i = batch.length - 1; i >= 0; i--) if (!notBanned(batch[i])) batch.splice(i, 1);
    return batch;
  };
  async function loadHeroSupportGraph(area, todayIso, sourceByHandle, clinicianSourceIds, sourceAreasFor) {
    const oldest = new Date(Date.parse(todayIso) - 60 * 864e5).toISOString().slice(0, 10);
    const anchors = await rows(sb.from("briefing_story_anchors_shadow").select("anchor_key,anchor_kind,source,source_record_id,title,url,occurred_on,primary_drug_id,drug_ids,nct_ids,doi,pmid,disease_area,metadata,last_run_id").in("anchor_kind", ["event", "paper"]).gte("occurred_on", oldest).order("occurred_on", { ascending: false }));
    const eventAnchors = anchors.filter((anchor) => {
      if (anchor.anchor_kind !== "event") return false;
      const ageDays = Math.floor((Date.parse(todayIso) - Date.parse(anchor.occurred_on)) / 864e5);
      const summary = typeof anchor.metadata?.summary === "string" ? anchor.metadata.summary : null;
      return ageDays >= 0 && ageDays <= EVENT_HERO_WINDOW_DAYS && resolveEventReadoutAreas(anchor.title, summary, anchor.disease_area).includes(area);
    });
    const paperRecordIds = anchors.filter((anchor) => anchor.anchor_kind === "paper" && anchor.source_record_id).map((anchor) => anchor.source_record_id);
    const paperEligibilityRows = paperRecordIds.length ? await rows(sb.from("x_shared_articles").select("id,title,onc_relevant,promotional").in("id", paperRecordIds)) : [];
    const eligiblePaperRecordIds = new Set(paperEligibilityRows.filter(articleIsOncologyEligible).map((article) => article.id));
    const paperAnchors = anchors.filter((anchor) => anchor.anchor_kind === "paper" && (!anchor.source_record_id || eligiblePaperRecordIds.has(anchor.source_record_id)));
    const relevant = [...eventAnchors, ...paperAnchors];
    const anchorKeys = relevant.map((anchor) => anchor.anchor_key);
    const loadedSupportRows = anchorKeys.length ? await rows(sb.from("briefing_story_support_shadow").select("anchor_key,support_kind,support_id,relationship_type,support_title,support_url,occurred_at,last_run_id").in("anchor_key", anchorKeys)) : [];
    const anchorRunByKey = new Map(relevant.map((anchor) => [anchor.anchor_key, anchor.last_run_id]));
    const supportRows = loadedSupportRows.filter((edge) => storySupportEdgeIsCurrent(anchorRunByKey.get(edge.anchor_key), edge.last_run_id));
    const xIds = [...new Set(supportRows.filter((row) => row.support_kind === "x_post").map((row) => row.support_id))];
    const articleIds = [...new Set(supportRows.filter((row) => row.support_kind === "article" || row.support_kind === "paper").map((row) => row.support_id))];
    const episodeIds = [...new Set(supportRows.filter((row) => row.support_kind === "episode").map((row) => row.support_id))];
    const [xRows, articleRows, episodeRows] = await Promise.all([
      xIds.length ? rows(sb.from("x_posts_product").select("id,x_post_id,content,lang,content_en,thread_parts,quoted_url,quoted_title,quoted_text,quoted_description,metrics,metrics_24h,rt_tweet_id,rt_author_handle,x_sources(id,name,x_handle,avatar_url,source_type,feed_eligible,active,entity_id,primary_institution,tumor_categories)").in("id", xIds)) : Promise.resolve([]),
      articleIds.length ? rows(sb.from("x_shared_articles").select("id,title,canonical_url,journal,domain,abstract,description,pub_date,first_shared_at,last_shared_at,onc_relevant,promotional").in("id", articleIds)) : Promise.resolve([]),
      episodeIds.length ? rows(sb.from("episodes").select("id,title,link,audio_url,duration_seconds,description,published_at,shows(title)").in("id", episodeIds)) : Promise.resolve([])
    ]);
    await hydrateEvidenceOrigins(dropBanned(xRows), sourceByHandle);
    const xById = new Map(xRows.map((row) => [String(row.id), row]));
    const articleById = new Map(articleRows.filter(articleIsOncologyEligible).map((row) => [String(row.id), row]));
    const episodeById = new Map(episodeRows.map((row) => [String(row.id), row]));
    const bundleByAnchor = /* @__PURE__ */ new Map();
    for (const anchor of relevant) {
      const bundle = { clinicianPosts: [], publisherPosts: [], otherPosts: [], links: [] };
      const xEvidence = /* @__PURE__ */ new Map();
      const seenLinks = /* @__PURE__ */ new Set();
      for (const edge of supportRows.filter((row) => row.anchor_key === anchor.anchor_key)) {
        if (edge.support_kind === "x_post") {
          if (anchor.anchor_kind === "paper") continue;
          const post = xById.get(edge.support_id);
          if (!post) throw new Error(`story support ${edge.anchor_key}: missing x_post ${edge.support_id}`);
          const src = withRealName(oneRelation(post.x_sources));
          const evidence2 = makeEvidenceEntry(post, src ?? {}, sourceByHandle, clinicianSourceIds);
          if (evidence2) {
            const evidenceSource = sourceByHandle.get(normalizeXHandle(evidence2.post.handle) ?? "") ?? src;
            evidence2.post.sourceAreas = sourceAreasFor(evidenceSource);
            mergeEvidenceEntry(xEvidence, evidence2);
          }
          continue;
        }
        const source = edge.support_kind === "episode" ? episodeById.get(edge.support_id) : articleById.get(edge.support_id);
        if (!source) throw new Error(`story support ${edge.anchor_key}: missing ${edge.support_kind} ${edge.support_id}`);
        const url = edge.support_kind === "episode" ? source.link ?? edge.support_url ?? source.audio_url ?? null : edge.support_url ?? source.canonical_url ?? null;
        if (!url) throw new Error(`story support ${edge.anchor_key}: ${edge.support_kind} ${edge.support_id} has no URL`);
        const urlKey = canonicalUrlIdentity(url) || `${edge.support_kind}:${edge.support_id}`;
        if (seenLinks.has(urlKey)) continue;
        seenLinks.add(urlKey);
        const show = oneRelation(source.shows);
        const link = {
          kind: edge.support_kind,
          id: edge.support_id,
          title: edge.support_title ?? source.title ?? "Related source",
          url,
          sourceLabel: edge.support_kind === "episode" ? show?.title ?? "Podcast" : publicationSourceLabel(source.journal, source.domain, url),
          description: edge.support_kind === "episode" ? cleanPodcastDescription(source.description) : abstractFindings(source.abstract, 260) ?? truncateSentence(source.description, 260),
          ...edge.support_kind === "episode" ? {
            audioUrl: cleanMediaUrl(source.audio_url ?? edge.support_url),
            durationSeconds: typeof source.duration_seconds === "number" ? source.duration_seconds : null
          } : {},
          relationshipType: edge.relationship_type,
          occurredAt: edge.occurred_at ?? source.published_at ?? source.pub_date ?? source.first_shared_at ?? source.last_shared_at ?? null
        };
        bundle.links.push(link);
      }
      const evidence = partitionEvidence(xEvidence.values());
      bundle.clinicianPosts = distinctClinicianSupport(evidence.clinicianPosts);
      bundle.publisherPosts = evidence.publisherPosts;
      bundle.otherPosts = evidence.otherPosts;
      bundle.links.sort((a, b) => String(b.occurredAt ?? "").localeCompare(String(a.occurredAt ?? "")) || a.title.localeCompare(b.title));
      if (bundle.clinicianPosts.length || bundle.publisherPosts.length || bundle.otherPosts.length || bundle.links.length) {
        bundleByAnchor.set(anchor.anchor_key, bundle);
      }
    }
    return {
      eventAnchors,
      paperAnchorByUrl: new Map(paperAnchors.map((anchor) => [canonicalUrlIdentity(anchor.url), anchor])),
      bundleByAnchor
    };
  }
  const cleanDesc = cleanPodcastDescription;
  const cleanTitle = (t) => cleanSourceTitle(t).replace(/\s*[|—-]\s*(NEJM|Nature|JCO.*|PubMed)\s*$/i, "").trim();
  const cleanMediaUrl = (value) => decodeBriefingText(value) || null;
  const L2 = (n) => Math.log2(1 + n);
  const L1p = (n) => Math.log(1 + n);
  const ONC_MEDIA = [
    "onclive.com",
    "targetedonc.com",
    "cancernetwork.com",
    "healio.com",
    "oncodaily.com",
    "urotoday.com",
    "ascopost.com",
    "cancertherapyadvisor.com",
    "medscape.com",
    "medpagetoday.com",
    "vjoncology.com",
    "guoncologynow.com",
    "oncologynexus.com",
    "bloodcancerstoday.com",
    "lungcancerstoday.com",
    "cancerletter.com"
  ];
  const JOURNAL_DOMAINS = [
    // major biomedical publishers
    "sciencedirect.com",
    "elsevier.com",
    "cell.com",
    "springer.com",
    "nature.com",
    "wiley.com",
    "oup.com",
    "tandfonline.com",
    "sagepub.com",
    "karger.com",
    "lww.com",
    "mdpi.com",
    "frontiersin.org",
    "plos.org",
    "bmj.com",
    "thelancet.com",
    "nejm.org",
    "jamanetwork.com",
    "pnas.org",
    "biomedcentral.com",
    "dovepress.com",
    "spandidos-publications.com",
    // oncology / hematology society journals
    "aacrjournals.org",
    "ascopubs.org",
    "annalsofoncology.org",
    "esmoopen.com",
    "jto.org",
    "redjournal.org",
    "practicalradonc.org",
    "astctjournal.org",
    "ashpublications.org",
    "bloodjournal.org",
    "haematologica.org",
    "clinical-lung-cancer.com",
    "clinical-genitourinary-cancer.com",
    "clinical-breast-cancer.com",
    "clinical-colorectal-cancer.com",
    "europeanurology.com",
    "auajournals.org",
    "neuro-oncology.org",
    // preprints + PubMed / open access
    "biorxiv.org",
    "medrxiv.org",
    "researchsquare.com",
    "ncbi.nlm.nih.gov"
  ];
  const ARTICLE_DOMAINS = [...ONC_MEDIA, ...JOURNAL_DOMAINS];
  const isArticleDomain = (d) => {
    if (!d) return false;
    const dom = d.toLowerCase().replace(/^www\./, "");
    return ARTICLE_DOMAINS.some((base) => dom === base || dom.endsWith("." + base));
  };
  const stripAbstractLabel = (s) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    if (!t) return null;
    return t.replace(/^Abstract(?=[A-Z])/, "").replace(/^Abstract\s*[:.]?\s*/i, "").trim() || null;
  };
  const JUNK_TITLE_RE = /checking your browser|just a moment|attention required|access denied|are you (a )?(human|robot)|verify(ing)? you are human|please enable (javascript|js|cookies)|recaptcha|captcha|cloudflare|forbidden|not acceptable|page not found|redirecting|log ?in to|subscribe to (read|continue)/i;
  const isEligible = (a) => (
    // needs a renderable title (a metadata-less row with no title can't be a paper card, even on
    // a journal domain), a "this is an article" signal, and not a bot-interstitial title.
    !!(a && articleIsOncologyEligible(a) && (a.title ?? "").trim().length > 3 && (a.journal || a.article_doi || a.pmid || isArticleDomain(a.domain)) && !JUNK_TITLE_RE.test(a.title ?? ""))
  );
  const isCredibleClinician = (src, clinicianSourceIds) => !!(src?.id && clinicianSourceIds?.has(src.id));
  async function recapFor(area, movers, events, stories = [], leadStories = []) {
    if (!deps.recap || movers.length === 0 && stories.length === 0) return EMPTY_RECAP;
    try {
      return await deps.recap({ area, movers, events, stories, leadStories });
    } catch (error) {
      console.error(`briefing-recap ${area}: ${error?.message ?? error}`);
      return EMPTY_RECAP;
    }
  }
  const normEv = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function isVerbatimQuote(evidence, sourceText) {
    const e = normEv(String(evidence ?? "").replace(/^[….\s]+|[….\s]+$/g, ""));
    if (e.length < 12) return false;
    const src = normEv(String(sourceText ?? ""));
    return src.length > 0 && src.includes(e);
  }
  const STANCE_JUNK_RE = /contaminat|mis-?transcrib|no (?:clear )?(?:judg|opinion|take|stance)|no clinical (?:stance|opinion)|not determinable|control arm|only (?:named|mentioned) in passing|(?:named|mentioned) only in passing|passing mention/i;
  const showableEvidence = (ev) => {
    const t = String(ev ?? "").trim();
    return t.length >= 8 && !STANCE_JUNK_RE.test(t);
  };
  const BACKBONE_CHEMOS = /* @__PURE__ */ new Set([
    "carboplatin",
    "cisplatin",
    "oxaliplatin",
    "paclitaxel",
    "nab-paclitaxel",
    "docetaxel",
    "gemcitabine",
    "doxorubicin",
    "liposomal doxorubicin",
    "cyclophosphamide",
    "capecitabine",
    "fluorouracil",
    "5-fluorouracil",
    "etoposide",
    "pemetrexed",
    "irinotecan",
    "vinorelbine",
    "methotrexate",
    "cytarabine",
    "bendamustine"
  ]);
  function scopeMoverToDisease(m, area) {
    if (!AREA_DISEASES[area]) return;
    const score = {};
    const bump = (t, w) => {
      const d = diseaseOf(t, area);
      if (d) score[d] = (score[d] ?? 0) + w;
    };
    for (const p of m.posts ?? []) bump(p.text ?? "", 2);
    if (m.eventChip) bump(m.eventChip, 3);
    for (const c of m.podcast ?? []) bump(c.gloss ?? "", 1);
    for (const p of m.papers ?? []) bump(`${p.title ?? ""} ${p.abstract ?? ""}`, 1);
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((s, [, v]) => s + v, 0);
    if (ranked.length < 2 || total === 0 || ranked[0][1] / total < 0.5) return;
    const dom = ranked[0][0];
    m.podcast = (m.podcast ?? []).filter((c) => {
      const d = diseaseOf(c.gloss ?? "", area);
      return !d || d === dom;
    });
    m.papers = (m.papers ?? []).filter((p) => {
      const d = diseaseOf(`${p.title ?? ""} ${p.abstract ?? ""}`, area);
      return !d || d === dom;
    });
  }
  async function buildArea(area, opts, effects) {
    const _t0 = deps.now();
    const TRACE = !!deps.trace;
    let _stageN = 0;
    const _trace = [];
    const _runId = `${area}-${_t0}`;
    const stageDb = async (n, label, ms, heap, rss) => {
      if (!deps.trace) return;
      try {
        await deps.trace({ runId: _runId, area, n, label, ms, heapMb: heap, rssMb: rss });
      } catch {
      }
    };
    const stage = async (label) => {
      _stageN++;
      let memory;
      try {
        memory = deps.memoryUsage?.();
      } catch {
      }
      const heap = Math.round((memory?.heapUsed ?? -1048576) / 1048576);
      const rss = Math.round((memory?.rss ?? -1048576) / 1048576);
      const line = `${_stageN}. ${String(deps.now() - _t0).padStart(6)}ms heap=${heap}MB rss=${rss}MB  ${label}`;
      _trace.push(line);
      await stageDb(_stageN, label, deps.now() - _t0, heap, rss);
      if (opts?.stopAfter && _stageN >= opts.stopAfter) {
        const e = new Error("STAGE_PROBE");
        e._probe = _trace;
        throw e;
      }
    };
    await stage("start");
    const now = deps.now();
    const RECENT = opts?.recentDays && opts.recentDays > 0 ? opts.recentDays : RECENT_DAYS;
    const { recentCutoff, priorCutoff, today, ahead30 } = windowCutoffs(now, RECENT);
    bannedSourceIds.clear();
    bannedHandles.clear();
    const excludedSrcRows = await rows(sb.from("x_sources").select("id,x_handle").eq("excluded", true));
    for (const r of excludedSrcRows ?? []) {
      bannedSourceIds.add(String(r.id));
      if (r.x_handle) bannedHandles.add(String(r.x_handle).toLowerCase().replace(/^@/, ""));
    }
    const suppressedRows = await rows(sb.from("people").select("x_source_id").eq("display_suppressed", true).not("x_source_id", "is", null));
    for (const r of suppressedRows ?? []) bannedSourceIds.add(String(r.x_source_id));
    const clinicianPeople = await pageAll((from, to) => sb.from("people").select("id,x_source_id,affiliation,full_name,credential,person_hcp_identity").not("x_source_id", "is", null).order("x_source_id", { ascending: true }).order("id", { ascending: true }).range(from, to));
    const clinicianPersonBySourceId = selectReadoutClinicianPeople(
      clinicianPeople,
      bannedSourceIds
    );
    const clinicianSourceIds = new Set(clinicianPersonBySourceId.keys());
    const sourceAffiliation = /* @__PURE__ */ new Map();
    const reviewedAffiliationRows = await pageAll((from, to) => sb.from("person_affiliation").select("person_id,institution,source,confidence").eq("confidence", "high").like("source", "https://%").order("person_id", { ascending: true }).range(from, to));
    const reviewedAffiliationByPersonId = new Map(reviewedAffiliationRows.map((row) => [row.person_id, row]));
    const sourceIdByPersonId = /* @__PURE__ */ new Map();
    realNameBySourceId.clear();
    for (const p of clinicianPeople ?? []) {
      const sid = p.x_source_id;
      if (!sid || bannedSourceIds.has(String(sid))) continue;
      if (p.id && clinicianPersonBySourceId.get(String(sid)) === String(p.id)) {
        sourceIdByPersonId.set(String(p.id), String(sid));
      }
      const reviewedAffiliation = reviewedAffiliationByPersonId.get(String(p.id));
      const publicAffiliation = publicProfessionalAffiliation({
        raw: p.affiliation,
        reviewed: reviewedAffiliation?.institution,
        reviewedSource: reviewedAffiliation?.source,
        reviewedConfidence: reviewedAffiliation?.confidence
      });
      if (publicAffiliation && !sourceAffiliation.has(sid)) sourceAffiliation.set(sid, publicAffiliation);
      const fullName = typeof p.full_name === "string" ? p.full_name.trim() : "";
      const credential = typeof p.credential === "string" ? p.credential.trim() : "";
      if (fullName && !realNameBySourceId.has(sid)) realNameBySourceId.set(sid, credential ? `${fullName}, ${credential}` : fullName);
    }
    const personSpecialtyAreasBySourceId = /* @__PURE__ */ new Map();
    const displaySpecialists = await pageAll((from, to) => sb.from("person_display_specialty").select("person_id,specialty").order("person_id", { ascending: true }).range(from, to));
    for (const person of displaySpecialists) {
      const sourceId = sourceIdByPersonId.get(String(person.person_id));
      if (!sourceId) continue;
      personSpecialtyAreasBySourceId.set(sourceId, [.../* @__PURE__ */ new Set([
        ...personSpecialtyAreasBySourceId.get(sourceId) ?? [],
        ...specialtyAreas([person.specialty])
      ])]);
    }
    const evidenceSources = await pageAll((from, to) => sb.from("x_sources").select("id,name,x_handle,avatar_url,source_type,active,entity_id,primary_institution,tumor_categories").not("x_handle", "is", null).order("id", { ascending: true }).range(from, to));
    const sourceByHandle = /* @__PURE__ */ new Map();
    for (const source of evidenceSources) {
      if (bannedSourceIds.has(String(source.id))) {
        const bh = normalizeXHandle(source.x_handle);
        if (bh) bannedHandles.add(bh);
        continue;
      }
      withRealName(source);
      const handle = normalizeXHandle(source.x_handle);
      if (handle && !sourceByHandle.has(handle)) sourceByHandle.set(handle, source);
    }
    const sourceAreasFor = (source) => {
      const sourceId = String(source?.id ?? "");
      const stored = Array.isArray(source?.tumor_categories) ? source.tumor_categories ?? [] : [];
      return [.../* @__PURE__ */ new Set([
        ...personSpecialtyAreasBySourceId.get(sourceId) ?? [],
        ...specialtyAreas(stored)
      ])];
    };
    const sourceAreasForHandle = (handle) => sourceAreasFor(sourceByHandle.get(normalizeXHandle(handle) ?? ""));
    await stage("clinicianPeople loaded");
    const convRows = await pageAll((from, to) => sb.from("mention_conversations").select("drug_id,gloss,mention_count,start_ms,drugs!inner(canonical_name,kind,tumor_categories),episodes!inner(id,title,link,published_at,tumor_categories,audio_url,duration_seconds,transcription_status,shows(title,artwork_url))").eq("area", area).eq("discussed", true).eq("drugs.kind", "drug").is("suppressed_at", null).neq("episodes.transcription_status", "duplicate").gte("episodes.published_at", recentCutoff).order("episode_id", { ascending: true }).order("drug_id", { ascending: true }).order("start_ms", { ascending: true }).range(from, to));
    const convPriorRows = await pageAll((from, to) => sb.from("mention_conversations").select("drug_id,drugs!inner(canonical_name,kind,tumor_categories),episodes!inner(id,title,published_at,tumor_categories,transcription_status)").eq("area", area).eq("discussed", true).eq("drugs.kind", "drug").is("suppressed_at", null).neq("episodes.transcription_status", "duplicate").gte("episodes.published_at", priorCutoff).lt("episodes.published_at", recentCutoff).order("episode_id", { ascending: true }).order("drug_id", { ascending: true }).order("start_ms", { ascending: true }).range(from, to));
    const podByDrug = /* @__PURE__ */ new Map();
    const coveredEpIds = /* @__PURE__ */ new Set();
    const epConvCount = /* @__PURE__ */ new Map();
    const conversationBelongsToArea = (r) => {
      const drugAreas = r.drugs?.tumor_categories ?? [];
      const episodeAreas = r.episodes?.tumor_categories ?? [];
      return (!drugAreas.length || drugAreas.includes(area)) && (!episodeAreas.length || episodeAreas.includes(area));
    };
    const areaConvRows = (convRows ?? []).filter(conversationBelongsToArea);
    for (const r of areaConvRows) {
      const drugId = r.drug_id;
      const ep = r.episodes ?? {};
      if (ep.id) {
        coveredEpIds.add(ep.id);
        epConvCount.set(ep.id, (epConvCount.get(ep.id) ?? 0) + 1);
      }
      const publishedAt = ep.published_at ?? "";
      let p = podByDrug.get(drugId);
      if (!p) {
        p = { name: r.drugs?.canonical_name ?? "", window: [], eps: /* @__PURE__ */ new Set(), depth: 0, priorConvs: 0, priorEps: /* @__PURE__ */ new Set() };
        podByDrug.set(drugId, p);
      }
      const sh = Array.isArray(ep.shows) ? ep.shows[0] : ep.shows;
      p.window.push({
        gloss: fixGloss(r.gloss),
        mentionCount: Number(r.mention_count ?? 0),
        startMs: normalizePodcastStartMs(r.start_ms, ep.duration_seconds),
        episodeId: ep.id ?? "",
        episodeTitle: ep.title ?? "",
        show: sh?.title ?? "\u2014",
        showArt: cleanMediaUrl(sh?.artwork_url),
        audioUrl: cleanMediaUrl(ep.audio_url),
        sourceUrl: ep.link ?? null,
        durationSeconds: ep.duration_seconds ?? null,
        publishedAt
      });
      p.eps.add(ep.title ?? publishedAt);
      p.depth += L2(Number(r.mention_count ?? 0));
    }
    for (const r of convPriorRows ?? []) {
      const cats = r.drugs?.tumor_categories ?? [];
      if (cats.length && !cats.includes(area)) continue;
      const ep = r.episodes ?? {};
      const epCats2 = ep.tumor_categories ?? [];
      if (epCats2.length && !epCats2.includes(area)) continue;
      if (ep.id) {
        coveredEpIds.add(ep.id);
        epConvCount.set(ep.id, (epConvCount.get(ep.id) ?? 0) + 1);
      }
      const drugId = r.drug_id;
      let p = podByDrug.get(drugId);
      if (!p) {
        p = { name: r.drugs?.canonical_name ?? "", window: [], eps: /* @__PURE__ */ new Set(), depth: 0, priorConvs: 0, priorEps: /* @__PURE__ */ new Set() };
        podByDrug.set(drugId, p);
      }
      p.priorConvs++;
      p.priorEps.add(ep.title ?? ep.published_at ?? "");
    }
    const drugRows = await rows(sb.from("drugs").select("id,canonical_name,brand_names,tumor_categories").eq("kind", "drug").eq("active", true).contains("tumor_categories", [area]));
    const forms = [];
    const multiArea = /* @__PURE__ */ new Map();
    const nameById = /* @__PURE__ */ new Map();
    for (const d of drugRows ?? []) {
      const trackedCount = (d.tumor_categories ?? []).filter((c) => AREA_KEYS.includes(c)).length;
      multiArea.set(d.id, trackedCount > 1);
      nameById.set(d.id, d.canonical_name);
      const surfaces = [d.canonical_name, ...d.brand_names ?? []].filter(Boolean);
      for (const s of surfaces) {
        const f = normTitle(s).trim();
        if (f.length >= 5) forms.push({ drugId: d.id, name: d.canonical_name, form: ` ${f} ` });
      }
    }
    const backboneIds = /* @__PURE__ */ new Set();
    for (const [id, nm] of nameById) if (BACKBONE_CHEMO.has((nm ?? "").toLowerCase())) backboneIds.add(id);
    const demoteBackbone = (ids) => ids.some((id) => !backboneIds.has(id)) ? ids.filter((id) => !backboneIds.has(id)) : ids;
    const IO_COMBO_AGENTS = /* @__PURE__ */ new Set([
      "pembrolizumab",
      "nivolumab",
      "atezolizumab",
      "durvalumab",
      "cemiplimab",
      "avelumab",
      "ipilimumab",
      "tislelizumab",
      "dostarlimab",
      "retifanlimab",
      "tremelimumab"
    ]);
    const ioIds = /* @__PURE__ */ new Set();
    for (const [id, nm] of nameById) if (IO_COMBO_AGENTS.has((nm ?? "").toLowerCase())) ioIds.add(id);
    const drugFormRe = forms.length ? new RegExp(forms.map((f) => f.form.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")) : null;
    const matchDrugIds = (hay) => {
      if (drugFormRe && !drugFormRe.test(hay)) return [];
      const hits = forms.filter((f) => hay.includes(f.form) && bareNamed(hay, f.form));
      if (!hits.length) return [];
      const bestByDrug = /* @__PURE__ */ new Map();
      for (const h of hits) {
        const cur = bestByDrug.get(h.drugId);
        if (!cur || h.form.length > cur.form.length) bestByDrug.set(h.drugId, { form: h.form });
      }
      const names = [...bestByDrug.entries()];
      return names.filter(([vId, v]) => !names.some(([wId, w]) => wId !== vId && w.form.length > v.form.length && w.form.includes(v.form) && countOcc(hay, v.form) <= countOcc(hay, w.form))).map(([id]) => id);
    };
    const reOf2 = (forms2) => forms2.length ? new RegExp(forms2.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")) : null;
    const cueForms = AREA_CUE_FORMS[area] ?? [];
    const otherCueForms = AREA_KEYS.filter((a) => a !== area).flatMap((a) => AREA_CUE_FORMS[a] ?? []);
    const cueRe = reOf2(cueForms), otherCueRe = reOf2(otherCueForms);
    const hasAreaCue = (hay) => !!cueRe && cueRe.test(areaCueHay(area, hay));
    const otherAreaHay = (hay) => hay.includes(" angiomyolipoma ") ? hay.replace(/\saml\s/g, " ") : hay;
    const hasOtherAreaCue = (hay) => !!otherCueRe && otherCueRe.test(otherAreaHay(hay));
    const areaDiseaseForms = AREA_DISEASE_CUE_FORMS[area] ?? [];
    const areaDiseaseRe = reOf2(areaDiseaseForms);
    const hasAreaDiseaseCue = (hay) => !!areaDiseaseRe && areaDiseaseRe.test(areaCueHay(area, hay));
    const otherDiseaseForms = AREA_KEYS.filter((a) => a !== area).flatMap((a) => AREA_DISEASE_CUE_FORMS[a] ?? []);
    const otherDiseaseRe = reOf2(otherDiseaseForms);
    const hasOtherAreaDiseaseCue = (hay) => !!otherDiseaseRe && otherDiseaseRe.test(otherAreaHay(hay));
    const titleOffArea = (title) => {
      const t = normTitle(title);
      return hasForeignTumorCue(t) || hasOtherAreaDiseaseCue(t) && !hasAreaDiseaseCue(t);
    };
    const oncoTitle = (title) => {
      const t = normTitle(title);
      return MALIGNANCY_RE.test(title ?? "") || hasAreaDiseaseCue(t) || hasOtherAreaDiseaseCue(t) || hasForeignTumorCue(t) || matchDrugIds(t).length > 0;
    };
    await stage("conversations loaded");
    const allDrugRows = await pageAll((from, to) => sb.from("drugs").select("canonical_name,brand_names,tumor_categories").eq("kind", "drug").eq("active", true).order("id", { ascending: true }).range(from, to));
    const trialDrugGroups = (allDrugRows ?? []).map((drug) => ({
      canonical: String(drug.canonical_name ?? ""),
      surfaces: [drug.canonical_name, ...drug.brand_names ?? []].filter(Boolean).map(String)
    }));
    const foreignDrugForms = [];
    for (const d of allDrugRows ?? []) {
      const tracked = (d.tumor_categories ?? []).filter((c) => AREA_KEYS.includes(c));
      if (tracked.length !== 1 || tracked[0] === area) continue;
      for (const s of [d.canonical_name, ...d.brand_names ?? []].filter(Boolean)) {
        const f = normTitle(s).trim();
        if (f.length >= 5) foreignDrugForms.push(` ${f} `);
      }
    }
    const foreignDrugRe = reOf2(foreignDrugForms);
    const namesForeignDrug = (hay) => !!foreignDrugRe && foreignDrugRe.test(hay);
    await stage("drugs loaded");
    let allTrialRows = await pageAll((from, to) => sb.from("trials").select("nct_id,acronym,tumor_categories,phase").order("nct_id", { ascending: true }).range(from, to));
    const trialAreasByKey = /* @__PURE__ */ new Map();
    const trialMeta = /* @__PURE__ */ new Map();
    const trialMetaAny = /* @__PURE__ */ new Map();
    const readoutTrialRows = [];
    for (const t of allTrialRows ?? []) {
      const cats = (t.tumor_categories ?? []).filter((c) => AREA_KEYS.includes(c));
      if (cats.includes(area) || !cats.length) readoutTrialRows.push({ nct_id: t.nct_id, acronym: t.acronym ?? null, tumor_categories: cats, phase: t.phase ?? null });
      const k = stripKey(t.acronym);
      if (!k) continue;
      if (!trialMetaAny.has(k)) trialMetaAny.set(k, t);
      if (cats.includes(area) && !trialMeta.has(k)) trialMeta.set(k, t);
      if (!cats.length) continue;
      const prev2 = trialAreasByKey.get(k);
      trialAreasByKey.set(k, prev2 ? [.../* @__PURE__ */ new Set([...prev2, ...cats])] : cats);
    }
    allTrialRows = null;
    const aliasRows = await rows(sb.from("trial_aliases").select("variant_key,canonical_acronym,nct_id")).catch(() => []);
    const canonicalTrial = /* @__PURE__ */ new Map();
    for (const a of aliasRows ?? []) if (a.variant_key && a.canonical_acronym) canonicalTrial.set(a.variant_key, a.canonical_acronym);
    const readoutResolver = buildTrialResolver(readoutTrialRows, aliasRows ?? []);
    const trialAreaCue = (text) => {
      let self = false, other = false;
      for (const raw2 of extractTrials(text)) {
        const cats = trialAreasByKey.get(stripKey(raw2));
        if (!cats?.length) continue;
        if (cats.includes(area)) self = true;
        else other = true;
      }
      return { self, other };
    };
    await stage("trials loaded");
    const artHitByPost = /* @__PURE__ */ new Map();
    const isPeerReviewed = (a) => publicationIsResearchSource(a);
    const mergePubTypes = (left, right) => {
      const merged = [...new Set([...left ?? [], ...right ?? []].map(String).filter(Boolean))];
      return merged.length ? merged : null;
    };
    const aggregateIsPrimaryResearch = (a) => publicationIsResearchSource({ journal: a.journal, doi: a.doi, pmid: a.pmid, pub_types: a.pubTypes, abstract: a.abstract });
    const articleAgg = /* @__PURE__ */ new Map();
    const articleIdentity = new PaperIdentityIndex();
    const mergeArticleAgg = (target, source) => {
      const preferred = preferPaperRecord(
        { title: target.title, canonical_url: target.url, journal: target.journal, article_doi: target.doi, pmid: target.pmid, validated_publisher_url: target.validatedPublisherUrl, publisher_url_status: target.publisherUrlStatus, publisher_url_source: target.publisherUrlSource, pub_types: target.pubTypes, abstract: target.abstract, description: target.description, pub_date: target.pubDate, first_shared_at: target.firstSharedAt },
        { title: source.title, canonical_url: source.url, journal: source.journal, article_doi: source.doi, pmid: source.pmid, validated_publisher_url: source.validatedPublisherUrl, publisher_url_status: source.publisherUrlStatus, publisher_url_source: source.publisherUrlSource, pub_types: source.pubTypes, abstract: source.abstract, description: source.description, pub_date: source.pubDate, first_shared_at: source.firstSharedAt },
        now
      );
      if (preferred.canonical_url === source.url) {
        target.title = source.title;
        target.url = source.url;
        target.journal = source.journal;
        target.domain = source.domain;
        target.doi = source.doi;
        target.pmid = source.pmid;
        target.validatedPublisherUrl = source.validatedPublisherUrl;
        target.publisherUrlStatus = source.publisherUrlStatus;
        target.publisherUrlSource = source.publisherUrlSource;
        target.abstract = source.abstract;
        target.description = source.description;
        target.pubDate = source.pubDate;
        target.firstSharedAt = source.firstSharedAt;
      }
      target.abstract ??= source.abstract;
      target.description ??= source.description;
      target.journal ??= source.journal;
      target.domain ??= source.domain;
      target.doi ??= source.doi;
      target.pmid ??= source.pmid;
      if (source.publisherUrlStatus === "valid" && source.validatedPublisherUrl) {
        target.validatedPublisherUrl = source.validatedPublisherUrl;
        target.publisherUrlStatus = source.publisherUrlStatus;
        target.publisherUrlSource = source.publisherUrlSource;
      }
      target.pubTypes = mergePubTypes(target.pubTypes, source.pubTypes);
      target.pubDate ??= source.pubDate;
      target.firstSharedAt ??= source.firstSharedAt;
      target.areas = [.../* @__PURE__ */ new Set([...target.areas, ...source.areas])];
      for (const [handle, avatar] of source.sharers) if (!target.sharers.has(handle)) target.sharers.set(handle, avatar);
      for (const [personId, sharer] of source.personSharers) if (!target.personSharers.has(personId)) target.personSharers.set(personId, sharer);
      for (const evidence of source.posts.values()) mergeEvidenceEntry(target.posts, evidence);
      target.topLikes = Math.max(target.topLikes, source.topLikes);
      target.peerReviewed = aggregateIsPrimaryResearch(target);
      return target;
    };
    await pageEachBatch((from, to) => sb.from("x_article_shares").select("x_posts!inner(x_post_id,content,lang,content_en,thread_parts,quoted_url,quoted_title,quoted_text,quoted_description,posted_at,metrics,metrics_24h,rt_tweet_id,rt_author_handle),x_sources!inner(id,name,x_handle,avatar_url,source_type,active,entity_id,primary_institution),x_shared_articles!inner(id,title,canonical_url,journal,domain,article_doi,pmid,validated_publisher_url,publisher_url_status,publisher_url_source,pub_types,tumor_categories,abstract,description,pub_date,first_shared_at,onc_relevant,promotional)").eq("x_sources.source_type", "kol").gte("x_posts.posted_at", recentCutoff).not("x_shared_articles.title", "is", null).is("x_shared_articles.canonical_article_id", null).order("id", { ascending: true }).range(from, to), async (batch) => {
      await hydrateEvidenceOrigins(dropBanned(batch), sourceByHandle);
      for (const r of batch) {
        const pid = r.x_posts?.x_post_id;
        const a = r.x_shared_articles;
        if (!a || !isEligible(a)) continue;
        const resolvedArticle = articleIdentity.resolve(a);
        const articleKey = resolvedArticle.key;
        if (!articleKey) continue;
        const areas = a.tumor_categories ?? [];
        if (pid) {
          let hit = artHitByPost.get(pid);
          if (!hit) {
            hit = { self: false, other: false, keys: [] };
            artHitByPost.set(pid, hit);
          }
          if (areas.includes(area)) hit.self = true;
          if (areas.some((x) => x !== area && AREA_KEYS.includes(x))) hit.other = true;
          const ak = articleKey;
          for (const absorbedKey of resolvedArticle.absorbedKeys) {
            const absorbed = articleAgg.get(absorbedKey);
            if (!absorbed) continue;
            const target = articleAgg.get(ak);
            if (target) mergeArticleAgg(target, absorbed);
            else articleAgg.set(ak, absorbed);
            articleAgg.delete(absorbedKey);
          }
          if (!hit.keys.includes(ak)) hit.keys.push(ak);
        }
        const handle = r.x_sources?.x_handle;
        const artHay = normTitle(`${a.title} ${a.abstract ?? ""}`);
        const singleAreaTitleDrug = matchDrugIds(normTitle(a.title)).some((id) => !multiArea.get(id));
        const artOffArea = hasForeignTumorCue(artHay) && !hasAreaCue(artHay) || titleOffArea(a.title);
        const artThisEv = areas.includes(area) || hasAreaCue(artHay);
        const artOtherEv = areas.some((x) => x !== area && AREA_KEYS.includes(x)) || hasOtherAreaCue(artHay);
        const readHere = !artOffArea && articleBelongsHere(area, a.title ?? "", a.abstract ?? null, areas) && (artThisEv || !artOtherEv && singleAreaTitleDrug);
        if (handle && isCredibleClinician(r.x_sources, clinicianSourceIds) && readHere) {
          const aKey = articleKey;
          let agg = articleAgg.get(aKey);
          const candidateTitle = cleanTitle(a.title);
          if (!agg) {
            agg = { title: candidateTitle, url: a.canonical_url, journal: a.journal ?? null, domain: a.domain ?? null, doi: a.article_doi ?? null, pmid: a.pmid ?? null, validatedPublisherUrl: a.validated_publisher_url ?? null, publisherUrlStatus: a.publisher_url_status ?? null, publisherUrlSource: a.publisher_url_source ?? null, pubTypes: a.pub_types ?? null, abstract: cleanArticleContext(a.abstract), description: cleanArticleContext(a.description), pubDate: a.pub_date ?? null, firstSharedAt: a.first_shared_at ?? null, areas, sharers: /* @__PURE__ */ new Map(), personSharers: /* @__PURE__ */ new Map(), posts: /* @__PURE__ */ new Map(), topLikes: 0, peerReviewed: isPeerReviewed(a) };
            articleAgg.set(aKey, agg);
          } else {
            const preferred = preferPaperRecord(
              { title: agg.title, canonical_url: agg.url, journal: agg.journal, article_doi: agg.doi, pmid: agg.pmid, validated_publisher_url: agg.validatedPublisherUrl, publisher_url_status: agg.publisherUrlStatus, publisher_url_source: agg.publisherUrlSource, abstract: agg.abstract, description: agg.description, pub_date: agg.pubDate, first_shared_at: agg.firstSharedAt },
              { title: candidateTitle, canonical_url: a.canonical_url, journal: a.journal, article_doi: a.article_doi, pmid: a.pmid, validated_publisher_url: a.validated_publisher_url, publisher_url_status: a.publisher_url_status, publisher_url_source: a.publisher_url_source, abstract: cleanArticleContext(a.abstract), description: cleanArticleContext(a.description), pub_date: a.pub_date, first_shared_at: a.first_shared_at },
              now
            );
            if (preferred.canonical_url === a.canonical_url || sourceTitleQuality(candidateTitle, a.abstract, a.journal) > sourceTitleQuality(agg.title, agg.abstract, agg.journal)) {
              agg.title = candidateTitle;
              agg.url = a.canonical_url;
              agg.journal = a.journal ?? agg.journal;
              agg.domain = a.domain ?? agg.domain;
              agg.doi = a.article_doi ?? agg.doi;
              agg.pmid = a.pmid ?? agg.pmid;
              agg.validatedPublisherUrl = a.validated_publisher_url ?? agg.validatedPublisherUrl;
              agg.publisherUrlStatus = a.publisher_url_status ?? agg.publisherUrlStatus;
              agg.publisherUrlSource = a.publisher_url_source ?? agg.publisherUrlSource;
              agg.abstract = cleanArticleContext(a.abstract) ?? agg.abstract;
              agg.description = cleanArticleContext(a.description) ?? agg.description;
              agg.pubDate = a.pub_date ?? agg.pubDate;
              agg.firstSharedAt = a.first_shared_at ?? agg.firstSharedAt;
            } else {
              agg.abstract ??= cleanArticleContext(a.abstract);
              agg.description ??= cleanArticleContext(a.description);
              agg.journal ??= a.journal ?? null;
              agg.domain ??= a.domain ?? null;
              agg.doi ??= a.article_doi ?? null;
              agg.pmid ??= a.pmid ?? null;
              if (a.publisher_url_status === "valid" && a.validated_publisher_url) {
                agg.validatedPublisherUrl = a.validated_publisher_url;
                agg.publisherUrlStatus = a.publisher_url_status;
                agg.publisherUrlSource = a.publisher_url_source ?? null;
              }
              agg.pubDate ??= a.pub_date ?? null;
              agg.firstSharedAt ??= a.first_shared_at ?? null;
            }
            agg.pubTypes = mergePubTypes(agg.pubTypes, a.pub_types);
            agg.areas = [.../* @__PURE__ */ new Set([...agg.areas, ...areas])];
            agg.peerReviewed = aggregateIsPrimaryResearch(agg);
          }
          agg.areas = [.../* @__PURE__ */ new Set([...agg.areas, ...areas, area])];
          if (!agg.sharers.has(handle)) agg.sharers.set(handle, r.x_sources?.avatar_url ?? null);
          const sourceId = String(r.x_sources?.id ?? "");
          const personId = clinicianPersonBySourceId.get(sourceId);
          if (personId && !agg.personSharers.has(personId)) {
            agg.personSharers.set(personId, { handle, avatar: r.x_sources?.avatar_url ?? null });
          }
          const m24 = r.x_posts?.metrics_24h, m0 = r.x_posts?.metrics;
          const body = r.x_posts?.content;
          const likes = ownNum(body, m24, m0, "likes");
          const evidence = makeEvidenceEntry(r.x_posts ?? {}, withRealName(r.x_sources) ?? {}, sourceByHandle, clinicianSourceIds);
          if (evidence) {
            const evidenceSource = sourceByHandle.get(normalizeXHandle(evidence.post.handle) ?? "") ?? withRealName(r.x_sources);
            evidence.post.sourceAreas = sourceAreasFor(evidenceSource);
            mergeEvidenceEntry(agg.posts, evidence);
          }
          agg.topLikes = Math.max(agg.topLikes, likes);
        }
      }
    });
    const artByDrug = /* @__PURE__ */ new Map();
    const artLikesByDrug = /* @__PURE__ */ new Map();
    for (const agg of articleAgg.values()) {
      if (!agg.peerReviewed) continue;
      const safeReaderUrl = readerArticleUrl({ ...agg, validated_publisher_url: agg.validatedPublisherUrl, publisher_url_status: agg.publisherUrlStatus, publisher_url_source: agg.publisherUrlSource });
      if (!safeReaderUrl) continue;
      const hay = normTitle(`${agg.title}  ${agg.abstract ?? ""}`);
      const ids = demoteBackbone(matchDrugIds(normTitle(agg.title)));
      if (!ids.length || ids.length > ROUNDUP_CAP + 2) continue;
      const thisEv = agg.areas.includes(area) || hasAreaCue(hay);
      const otherEv = agg.areas.some((x) => x !== area && AREA_KEYS.includes(x)) || hasOtherAreaCue(hay);
      const sharers = [...agg.personSharers.values()].map(({ handle, avatar }) => ({ name: handle, handle, avatar, tweetUrl: null, text: null, likes: 0, retweets: 0, quotes: 0, views: 0 }));
      const evidence = partitionEvidence(agg.posts.values());
      const paper = {
        title: agg.title,
        url: safeReaderUrl,
        journal: agg.journal,
        domain: agg.domain,
        doi: agg.doi,
        pmid: agg.pmid,
        publishedAt: agg.pubDate,
        circulationState: paperCirculationState({ pub_date: agg.pubDate }, now),
        abstract: agg.abstract,
        description: agg.description,
        sharers: sharers.slice(0, 6),
        sharerCount: agg.personSharers.size,
        topLikes: agg.topLikes,
        posts: evidence.clinicianPosts.slice(0, 24),
        publisherPosts: evidence.publisherPosts.slice(0, 24),
        otherPosts: evidence.otherPosts.slice(0, 24),
        peerReviewed: agg.peerReviewed
      };
      for (const id of ids) {
        if (!thisEv && (otherEv || multiArea.get(id))) continue;
        let arr = artByDrug.get(id);
        if (!arr) {
          arr = [];
          artByDrug.set(id, arr);
        }
        arr.push(paper);
        artLikesByDrug.set(id, Math.max(artLikesByDrug.get(id) ?? 0, agg.topLikes));
      }
    }
    const xByDrug = /* @__PURE__ */ new Map();
    const bump = (drugId) => {
      let x = xByDrug.get(drugId);
      if (!x) {
        x = { posts: /* @__PURE__ */ new Map(), signalPosts: /* @__PURE__ */ new Map(), sharers: /* @__PURE__ */ new Set(), peakLikes: 0 };
        xByDrug.set(drugId, x);
      }
      return x;
    };
    const kolByHandle = /* @__PURE__ */ new Map();
    const postTrialHits = [];
    const { data: missing } = await sb.rpc("x_posts_needing_features", { p_limit: 1, p_version: FEAT_VERSION });
    const newestMissing = (missing ?? [])[0]?.posted_at;
    const featuresReady = !opts?.noFeatures && (!newestMissing || newestMissing < recentCutoff);
    await stage(`features ${featuresReady ? "READY (prefiltered)" : "INCOMPLETE (full scan fallback)"}`);
    await pageEachBatch((from, to) => {
      let q = sb.from("x_posts_product").select("x_post_id,content,lang,content_en,thread_parts,external_url,quoted_url,quoted_title,quoted_text,quoted_description,posted_at,metrics,metrics_24h,rt_tweet_id,rt_author_handle,x_sources!inner(id,name,x_handle,avatar_url,source_type,active,entity_id,primary_institution,tumor_categories)" + (featuresReady ? ",x_post_features!inner(cand_areas)" : "")).eq("x_sources.source_type", "kol").gte("posted_at", recentCutoff);
      if (featuresReady) q = q.contains("x_post_features.cand_areas", [area]);
      return q.order("x_post_id", { ascending: true }).range(from, to);
    }, async (batch) => {
      await hydrateEvidenceOrigins(dropBanned(batch), sourceByHandle);
      for (const r of batch) {
        const src = withRealName(r.x_sources);
        const handle = src?.x_handle;
        if (!handle) continue;
        if (!isCredibleClinician(src, clinicianSourceIds)) continue;
        if (isLowValuePost(r.content)) continue;
        const pid = r.x_post_id;
        const artHit = pid ? artHitByPost.get(pid) : void 0;
        const contentHay = normTitle(r.content);
        let contentIds = demoteBackbone(matchDrugIds(contentHay));
        if (contentIds.length > ROUNDUP_CAP) contentIds = [];
        const articleAreaHit = artHit?.self === true;
        const articleOtherHit = artHit?.other === true;
        const singleAreaDrugHit = contentIds.some((id) => !multiArea.get(id));
        const contentOffArea = hasForeignTumorCue(contentHay) || hasOtherAreaDiseaseCue(contentHay) && !hasAreaDiseaseCue(contentHay);
        const trialCue = trialAreaCue(r.content);
        const thisCue = !contentOffArea && (hasAreaCue(contentHay) || articleAreaHit || trialCue.self);
        const otherCue = contentOffArea || hasOtherAreaCue(contentHay) || namesForeignDrug(contentHay) || articleOtherHit || trialCue.other && !trialCue.self;
        const authored = isAuthoredEvidencePost(r);
        const sourceAreas = sourceAreasFor(src);
        const contextAllowsDrug = areaContextAllowsDrugMention({ area, sourceAreas, thisCue, otherCue, authored });
        const okHere = (id) => thisCue ? true : contextAllowsDrug && (!multiArea.get(id) || singleAreaDrugHit);
        const likes = ownNum(r.content, r.metrics_24h, r.metrics, "likes");
        const evidence = makeEvidenceEntry(r, src, sourceByHandle, clinicianSourceIds);
        if (evidence) {
          const evidenceSource = sourceByHandle.get(normalizeXHandle(evidence.post.handle) ?? "") ?? src;
          evidence.post.sourceAreas = sourceAreasFor(evidenceSource);
          evidence.post.sourceUrls = [r.external_url, r.quoted_url].filter(Boolean).map(String);
        }
        const sharer = {
          name: src.name ?? handle,
          handle,
          avatar: src.avatar_url ?? null,
          tweetUrl: pid ? `https://x.com/${handle}/status/${pid}` : null,
          text: (r.content ?? "").trim() || null,
          lang: r.lang ?? null,
          textEn: r.content_en ?? null,
          // translation lane (0322)
          thread: Array.isArray(r.thread_parts) ? r.thread_parts : void 0,
          likes,
          retweets: ownNum(r.content, r.metrics_24h, r.metrics, "retweets"),
          quotes: ownNum(r.content, r.metrics_24h, r.metrics, "quotes"),
          views: ownNum(r.content, r.metrics_24h, r.metrics, "views"),
          sourceAreas,
          sourceUrls: [r.external_url, r.quoted_url].filter(Boolean).map(String)
        };
        const trialKeys = extractTrials(r.content);
        if (trialKeys.size) postTrialHits.push({ keys: trialKeys, handle, evidence });
        const addSharer = (drugId) => {
          const x = bump(drugId);
          const signalPrev = x.signalPosts.get(handle);
          if (!signalPrev || sharer.likes > signalPrev.likes) x.signalPosts.set(handle, sharer);
          if (evidence) mergeEvidenceEntry(x.posts, evidence);
          x.sharers.add(handle);
          x.peakLikes = Math.max(x.peakLikes, likes);
        };
        const attributedIds = /* @__PURE__ */ new Set();
        for (const id of contentIds) if (okHere(id)) {
          addSharer(id);
          attributedIds.add(id);
        }
        const localAreas = [.../* @__PURE__ */ new Set([
          ...src.id ? personSpecialtyAreasBySourceId.get(String(src.id)) ?? [] : [],
          ...specialtyAreas(Array.isArray(src.tumor_categories) ? src.tumor_categories : [])
        ])];
        const specialtyLocal = isSpecialtyLocal(area, localAreas);
        const explicitConversationAreas = classifyConversationAreas({
          text: String(r.content ?? "")
        });
        const postThisArea = attributedIds.size > 0 || explicitConversationAreas.includes(area) || articleAreaHit || trialCue.self;
        if (!postThisArea) continue;
        let rec = kolByHandle.get(handle);
        if (!rec) {
          rec = { sourceId: String(src.id ?? ""), name: sharer.name, handle, avatar: sharer.avatar, institution: publicProfessionalAffiliation({ raw: src.primary_institution }) ?? (src.id ? sourceAffiliation.get(src.id) ?? null : null), tweets: 0, drugs: /* @__PURE__ */ new Set(), peakLikes: 0, posts: [], articles: /* @__PURE__ */ new Map(), specialtyLocal };
          kolByHandle.set(handle, rec);
        } else rec.specialtyLocal ||= specialtyLocal;
        if (authored) {
          rec.tweets += 1;
          rec.posts.push(sharer);
        }
        for (const id of attributedIds) {
          const nm = nameById.get(id);
          if (nm) rec.drugs.add(nm);
        }
        if (likes > rec.peakLikes) rec.peakLikes = likes;
        for (const rawKey of artHit?.keys ?? []) {
          const ak = articleIdentity.canonicalKey(rawKey) ?? rawKey;
          const agg = articleAgg.get(ak);
          const safeReaderUrl = agg ? readerArticleUrl({ ...agg, validated_publisher_url: agg.validatedPublisherUrl, publisher_url_status: agg.publisherUrlStatus, publisher_url_source: agg.publisherUrlSource }) : null;
          if (agg && safeReaderUrl && !rec.articles.has(ak)) rec.articles.set(ak, { title: agg.title, url: safeReaderUrl, journal: agg.journal, domain: agg.domain, abstract: agg.abstract, description: agg.description, peerReviewed: agg.peerReviewed });
        }
      }
    });
    await stage("movers pass done");
    const ampOf = (k) => k.posts.reduce((s, p) => s + p.retweets + p.quotes, 0);
    const allKols = [...kolByHandle.values()];
    const byTweets = allKols.slice().sort((a, b) => b.tweets - a.tweets || b.peakLikes - a.peakLikes || b.drugs.size - a.drugs.size).slice(0, 20);
    const inPool = new Set(byTweets.map((k) => k.handle));
    const byAmp = allKols.filter((k) => !inPool.has(k.handle) && ampOf(k) > 0).sort((a, b) => ampOf(b) - ampOf(a)).slice(0, 8);
    const localKols = allKols.filter((kol) => kol.specialtyLocal).sort((a, b) => ampOf(b) - ampOf(a) || b.peakLikes - a.peakLikes);
    const acrossAmplifiers = byAmp.filter((kol) => !kol.specialtyLocal);
    const considerationPool = [...new Map([
      ...localKols.slice(0, 20),
      ...acrossAmplifiers.slice(0, 4),
      ...byTweets,
      ...byAmp
    ].map((kol) => [kol.handle, kol])).values()];
    const topKols = considerationPool.map((k) => ({
      name: k.name,
      handle: k.handle,
      avatar: k.avatar,
      institution: k.institution,
      tweets: k.tweets,
      drugs: [...k.drugs].slice(0, 6),
      peakLikes: k.peakLikes,
      // computed over ALL their window posts, not just the 8 emitted below
      amp: ampOf(k),
      paperShares: k.articles.size,
      posts: k.posts.slice().sort((a, b) => b.likes - a.likes).slice(0, 8),
      articles: [...k.articles.values()].slice(0, 6),
      specialtyLocal: k.specialtyLocal
    })).sort((a, b) => Number(b.specialtyLocal) - Number(a.specialtyLocal) || compareKolSignal(a, b)).slice(0, 28);
    const guestKey = episodeGuestAppearanceKey;
    const guestRows = await pageAll((from, to) => sb.from("person_appearances").select("person_id,people!inner(full_name,affiliation,person_type,npi,x_sources(avatar_url)),episodes!inner(id,title,content_key,link,description,published_at,audio_url,duration_seconds,tumor_categories,transcription_status,shows(title,artwork_url))").eq("role", "guest").gte("confidence", 0.75).or("extracted_from.is.null,extracted_from.neq.transcript").eq("people.person_type", "clinician").neq("episodes.transcription_status", "duplicate").contains("episodes.tumor_categories", [area]).order("person_id", { ascending: true }).order("id", { ascending: true }).range(from, to));
    const hostRows = await pageAll((from, to) => sb.from("person_appearances").select("person_id,people!inner(full_name,affiliation,person_type,npi,x_sources(avatar_url)),episodes!inner(id,title,content_key,link,published_at,audio_url,duration_seconds,tumor_categories,transcription_status,shows!inner(title,artwork_url,pro_interview))").eq("role", "host").gte("confidence", 0.75).or("extracted_from.is.null,extracted_from.neq.transcript").eq("people.person_type", "clinician").neq("episodes.transcription_status", "duplicate").eq("episodes.shows.pro_interview", false).contains("episodes.tumor_categories", [area]).order("person_id", { ascending: true }).order("id", { ascending: true }).range(from, to));
    const guestAgg = /* @__PURE__ */ new Map();
    const hostAgg = /* @__PURE__ */ new Map();
    const addAppearance = (agg, r) => {
      const p = r.people, ep = r.episodes;
      if (!p || !ep) return;
      const episodeHay = `${ep.title ?? ""} ${ep.description ?? ""}`;
      if (!episodeOncologyEligible(episodeHay, epConvCount.get(ep.id) ?? 0)) return;
      let g = agg.get(r.person_id);
      if (!g) {
        const reviewedAffiliation = reviewedAffiliationByPersonId.get(String(r.person_id));
        const affiliation = publicProfessionalAffiliation({
          raw: p.affiliation,
          reviewed: reviewedAffiliation?.institution,
          reviewedSource: reviewedAffiliation?.source,
          reviewedConfidence: reviewedAffiliation?.confidence
        });
        g = { name: p.full_name, aff: affiliation?.split(",")[0].trim() || null, npi: !!p.npi, av: p.x_sources?.avatar_url ?? null, recs: /* @__PURE__ */ new Map() };
        agg.set(r.person_id, g);
      }
      const k = guestKey(ep.id, ep.title), prev2 = g.recs.get(k);
      if (!prev2 || (ep.published_at ?? "") > prev2.pub) g.recs.set(k, { title: ep.title ?? "", pub: ep.published_at ?? "", audio: cleanMediaUrl(ep.audio_url), sourceUrl: ep.link ?? null, durationSeconds: ep.duration_seconds ?? null, show: ep.shows?.title ?? null, showArt: cleanMediaUrl(ep.shows?.artwork_url), description: ep.description ?? null, episodeId: ep.id ?? null, recordingKey: k });
    };
    for (const r of guestRows) addAppearance(guestAgg, r);
    for (const r of hostRows) addAppearance(hostAgg, r);
    const peopleOf = (agg, cap, byCadence = true) => [...agg.values()].map((g) => {
      const recs = [...g.recs.values()];
      const week = recs.filter((r) => r.pub >= recentCutoff).sort((a, b) => a.pub < b.pub ? 1 : -1);
      return {
        name: g.name,
        affiliation: g.aff,
        verified: g.npi,
        avatar: g.av,
        thisWeek: week.length,
        career: recs.length,
        shows: [...new Set(week.map((r) => r.show).filter(Boolean))].slice(0, 3),
        episodes: week.slice(0, 4).map((r) => ({ title: r.title, audioUrl: r.audio, sourceUrl: r.sourceUrl, durationSeconds: r.durationSeconds, show: r.show, showArt: r.showArt, description: cleanDesc(r.description), episodeId: r.episodeId, recordingKey: r.recordingKey }))
      };
    }).filter((g) => g.thisWeek > 0).sort((a, b) => byCadence ? b.thisWeek - a.thisWeek || b.career - a.career : b.career - a.career || b.thisWeek - a.thisWeek).slice(0, cap);
    const guests = peopleOf(guestAgg, 10);
    const hosts = peopleOf(hostAgg, 12, false);
    const epRows = await pageAll((from, to) => sb.from("episodes").select("id,title,content_key,link,description,published_at,audio_url,duration_seconds,transcription_status,shows(title,artwork_url,tier)").contains("tumor_categories", [area]).gte("published_at", recentCutoff).not("audio_url", "is", null).order("published_at", { ascending: false }).order("id", { ascending: true }).range(from, to));
    const epByKey = /* @__PURE__ */ new Map();
    for (const e of epRows) {
      if (e.transcription_status === "duplicate") continue;
      if (!isReadoutListenEpisodeEligible({ title: e.title, description: e.description }).eligible) continue;
      const episodeHay = `${e.title ?? ""} ${e.description ?? ""}`;
      const hasOncologySignal = episodeOncologyEligible(episodeHay, epConvCount.get(e.id) ?? 0);
      if (!hasOncologySignal) continue;
      const k = guestKey(e.id, e.title);
      const prev2 = epByKey.get(k);
      if (!prev2 || (e.published_at ?? "") > (prev2.published_at ?? "")) epByKey.set(k, e);
    }
    const epHeroInputs = [...epByKey.values()].map((e) => {
      const sh = Array.isArray(e.shows) ? e.shows[0] : e.shows;
      return {
        episodeId: e.id,
        title: e.title ?? "",
        show: sh?.title ?? null,
        tier: Number(sh?.tier ?? 9),
        audioUrl: cleanMediaUrl(e.audio_url),
        sourceUrl: e.link ?? null,
        durationSeconds: e.duration_seconds ?? null,
        convCount: epConvCount.get(e.id) ?? 0
      };
    });
    const episodeCandidates = [...epByKey.values()].map((e) => {
      const sh = Array.isArray(e.shows) ? e.shows[0] : e.shows;
      return { title: e.title ?? "", show: sh?.title ?? null, showArt: cleanMediaUrl(sh?.artwork_url), audioUrl: cleanMediaUrl(e.audio_url), sourceUrl: e.link ?? null, durationSeconds: e.duration_seconds ?? null, description: cleanDesc(e.description), publishedAt: e.published_at ?? "", episodeId: e.id, tier: Number(sh?.tier ?? 9), featured: coveredEpIds.has(e.id), convCount: epConvCount.get(e.id) ?? 0 };
    });
    let episodeAnnouncements = /* @__PURE__ */ new Map();
    let episodeAmplifiers = /* @__PURE__ */ new Map();
    let episodeAmplifierIds = /* @__PURE__ */ new Map();
    try {
      const railIds = episodeCandidates.map((e) => e.episodeId).filter(Boolean);
      if (railIds.length) {
        const receipts = await loadEpisodeXReceipts(railIds, clinicianSourceIds, sourceAreasForHandle);
        episodeAnnouncements = receipts.announcements;
        episodeAmplifiers = receipts.amplifiers;
        episodeAmplifierIds = receipts.amplifierIds;
      }
    } catch (e) {
      console.error("rail X receipt fetch failed", e.message);
    }
    const episodes = episodeCandidates.map((e) => ({
      ...e,
      amplifierCount: episodeAmplifierIds.get(e.episodeId)?.size ?? 0,
      amplifiers: episodeAmplifiers.get(e.episodeId),
      announcements: episodeAnnouncements.get(e.episodeId)
    })).sort(compareEpisodeSignal).slice(0, 20).map(({ tier: _t, amplifierCount: _a, ...e }) => e);
    const readingByKey = /* @__PURE__ */ new Map();
    for (const [k, agg] of articleAgg) {
      readingByKey.set(k, {
        title: agg.title,
        url: agg.url,
        journal: agg.journal,
        domain: agg.domain,
        doi: agg.doi,
        pmid: agg.pmid,
        validatedPublisherUrl: agg.validatedPublisherUrl,
        publisherUrlStatus: agg.publisherUrlStatus,
        publisherUrlSource: agg.publisherUrlSource,
        pubTypes: agg.pubTypes,
        abstract: agg.abstract,
        description: agg.description,
        pubDate: agg.pubDate,
        firstSharedAt: agg.firstSharedAt,
        personSharers: new Map(agg.personSharers),
        publishers: /* @__PURE__ */ new Map(),
        evidence: new Map(agg.posts),
        topLikes: agg.topLikes,
        peerReviewed: agg.peerReviewed
      });
    }
    await stage("KOL shares streamed");
    await pageEachBatch((from, to) => sb.from("x_article_shares").select("x_posts!inner(posted_at,x_post_id,content,lang,content_en,thread_parts,quoted_url,quoted_title,quoted_text,quoted_description,metrics,metrics_24h,rt_tweet_id,rt_author_handle),x_sources!inner(id,name,x_handle,avatar_url,source_type,active,entity_id,primary_institution),x_shared_articles!inner(id,title,canonical_url,journal,domain,article_doi,pmid,validated_publisher_url,publisher_url_status,publisher_url_source,pub_types,tumor_categories,abstract,description,pub_date,first_shared_at,onc_relevant,promotional)").in("x_sources.source_type", ["organization", "journal", "news", "brand", "advocacy"]).gte("x_posts.posted_at", recentCutoff).not("x_shared_articles.title", "is", null).is("x_shared_articles.canonical_article_id", null).order("id", { ascending: true }).range(from, to), async (batch) => {
      await hydrateEvidenceOrigins(dropBanned(batch), sourceByHandle);
      for (const r of batch) {
        const a = r.x_shared_articles;
        if (!a || !isEligible(a)) continue;
        const areas = a.tumor_categories ?? [];
        const artHay = normTitle(`${a.title} ${a.abstract ?? ""}`);
        const singleAreaTitleDrug = matchDrugIds(normTitle(a.title)).some((id) => !multiArea.get(id));
        const artOffArea = hasForeignTumorCue(artHay) && !hasAreaCue(artHay) || titleOffArea(a.title);
        const artThisEv = areas.includes(area) || hasAreaCue(artHay);
        const artOtherEv = areas.some((x) => x !== area && AREA_KEYS.includes(x)) || hasOtherAreaCue(artHay);
        if (artOffArea || !oncoTitle(a.title) || !articleBelongsHere(area, a.title ?? "", a.abstract ?? null, areas) || !(artThisEv || !artOtherEv && singleAreaTitleDrug)) continue;
        const resolved = articleIdentity.resolve(a);
        const k = resolved.key;
        if (!k) continue;
        for (const absorbedKey of resolved.absorbedKeys) {
          const absorbed = readingByKey.get(absorbedKey);
          if (!absorbed) continue;
          const target = readingByKey.get(k);
          if (!target) readingByKey.set(k, absorbed);
          else {
            for (const [personId, sharer] of absorbed.personSharers) if (!target.personSharers.has(personId)) target.personSharers.set(personId, sharer);
            for (const [p, av] of absorbed.publishers) if (!target.publishers.has(p)) target.publishers.set(p, av);
            for (const evidence2 of absorbed.evidence.values()) mergeEvidenceEntry(target.evidence, evidence2);
          }
          readingByKey.delete(absorbedKey);
        }
        let rd = readingByKey.get(k);
        if (!rd) {
          rd = { title: cleanTitle(a.title), url: a.canonical_url, journal: a.journal ?? null, domain: a.domain ?? null, doi: a.article_doi ?? null, pmid: a.pmid ?? null, validatedPublisherUrl: a.validated_publisher_url ?? null, publisherUrlStatus: a.publisher_url_status ?? null, publisherUrlSource: a.publisher_url_source ?? null, pubTypes: a.pub_types ?? null, abstract: cleanArticleContext(a.abstract), description: cleanArticleContext(a.description), pubDate: a.pub_date ?? null, firstSharedAt: a.first_shared_at ?? null, personSharers: /* @__PURE__ */ new Map(), publishers: /* @__PURE__ */ new Map(), evidence: /* @__PURE__ */ new Map(), topLikes: 0, peerReviewed: isPeerReviewed(a) };
          readingByKey.set(k, rd);
        } else if (preferPaperRecord(
          { title: rd.title, canonical_url: rd.url, journal: rd.journal, article_doi: rd.doi, pmid: rd.pmid, validated_publisher_url: rd.validatedPublisherUrl, publisher_url_status: rd.publisherUrlStatus, publisher_url_source: rd.publisherUrlSource, abstract: rd.abstract, description: rd.description, pub_date: rd.pubDate, first_shared_at: rd.firstSharedAt },
          { title: a.title, canonical_url: a.canonical_url, journal: a.journal, article_doi: a.article_doi, pmid: a.pmid, validated_publisher_url: a.validated_publisher_url, publisher_url_status: a.publisher_url_status, publisher_url_source: a.publisher_url_source, abstract: cleanArticleContext(a.abstract), description: cleanArticleContext(a.description), pub_date: a.pub_date, first_shared_at: a.first_shared_at },
          now
        ).canonical_url === a.canonical_url || sourceTitleQuality(a.title, a.abstract, a.journal) > sourceTitleQuality(rd.title, rd.abstract, rd.journal)) {
          rd.title = cleanTitle(a.title);
          rd.url = a.canonical_url;
          rd.journal = a.journal ?? rd.journal;
          rd.domain = a.domain ?? rd.domain;
          rd.doi = a.article_doi ?? rd.doi;
          rd.pmid = a.pmid ?? rd.pmid;
          rd.validatedPublisherUrl = a.validated_publisher_url ?? rd.validatedPublisherUrl;
          rd.publisherUrlStatus = a.publisher_url_status ?? rd.publisherUrlStatus;
          rd.publisherUrlSource = a.publisher_url_source ?? rd.publisherUrlSource;
          rd.abstract = cleanArticleContext(a.abstract) ?? rd.abstract;
          rd.description = cleanArticleContext(a.description) ?? rd.description;
          rd.pubDate = a.pub_date ?? rd.pubDate;
          rd.firstSharedAt = a.first_shared_at ?? rd.firstSharedAt;
        }
        rd.pubTypes = mergePubTypes(rd.pubTypes, a.pub_types);
        rd.peerReviewed = publicationIsResearchSource({ journal: rd.journal, doi: rd.doi, pmid: rd.pmid, pub_types: rd.pubTypes, abstract: rd.abstract });
        const pubName = r.x_sources?.name || r.x_sources?.x_handle;
        if (pubName && sourceLaneFor(r.x_sources, clinicianSourceIds) === "publisher" && !rd.publishers.has(pubName)) {
          rd.publishers.set(pubName, r.x_sources?.avatar_url ?? null);
        }
        const evidence = makeEvidenceEntry(r.x_posts ?? {}, withRealName(r.x_sources) ?? {}, sourceByHandle, clinicianSourceIds);
        if (evidence) {
          const evidenceSource = sourceByHandle.get(normalizeXHandle(evidence.post.handle) ?? "") ?? withRealName(r.x_sources);
          evidence.post.sourceAreas = sourceAreasFor(evidenceSource);
          mergeEvidenceEntry(rd.evidence, evidence);
        }
      }
    });
    const readingByTitle = /* @__PURE__ */ new Map();
    for (const rd of readingByKey.values()) {
      const tk = normTitle(rd.title);
      const bucket = readingByTitle.get(tk) ?? [];
      const ex = bucket.find((candidate) => {
        const bothRolesKnown = !!candidate.pubTypes?.length && !!rd.pubTypes?.length;
        const publicationRoleConflict = bothRolesKnown && publicationTypesExcludePrimaryResearch(candidate.pubTypes) !== publicationTypesExcludePrimaryResearch(rd.pubTypes);
        return !publicationRoleConflict && paperIdentifiersCompatible(
          { article_doi: candidate.doi, pmid: candidate.pmid },
          { article_doi: rd.doi, pmid: rd.pmid }
        );
      });
      if (!ex) {
        bucket.push(rd);
        readingByTitle.set(tk, bucket);
        continue;
      }
      for (const [personId, sharer] of rd.personSharers) if (!ex.personSharers.has(personId)) ex.personSharers.set(personId, sharer);
      for (const [p, av] of rd.publishers) if (!ex.publishers.has(p)) ex.publishers.set(p, av);
      for (const evidence of rd.evidence.values()) mergeEvidenceEntry(ex.evidence, evidence);
      ex.topLikes = Math.max(ex.topLikes, rd.topLikes);
      if (!ex.abstract && rd.abstract) ex.abstract = rd.abstract;
      if (!ex.description && rd.description) ex.description = rd.description;
      ex.doi ??= rd.doi;
      ex.pmid ??= rd.pmid;
      if (rd.publisherUrlStatus === "valid" && rd.validatedPublisherUrl) {
        ex.validatedPublisherUrl = rd.validatedPublisherUrl;
        ex.publisherUrlStatus = rd.publisherUrlStatus;
        ex.publisherUrlSource = rd.publisherUrlSource;
      }
      ex.pubDate ??= rd.pubDate;
      ex.firstSharedAt ??= rd.firstSharedAt;
      ex.pubTypes = mergePubTypes(ex.pubTypes, rd.pubTypes);
      if (!ex.journal && rd.journal) ex.journal = rd.journal;
      ex.peerReviewed = publicationIsResearchSource({ journal: ex.journal, doi: ex.doi, pmid: ex.pmid, pub_types: ex.pubTypes, abstract: ex.abstract });
    }
    const normBrand = (x) => (x ?? "").toLowerCase().replace(/^www\./, "").replace(/\.(com|org|net|io|co|health)$/, "").replace(/[^a-z0-9]+/g, "");
    const independentPublisherNames = (a) => {
      const dom = normBrand(a.domain ?? "");
      return [...a.publishers.keys()].filter((pn) => {
        const b = normBrand(pn);
        return !(dom && b && (dom.includes(b) || b.includes(dom)));
      });
    };
    const independentPubs = (a) => independentPublisherNames(a).length;
    const sourceUrlByReaderUrl = /* @__PURE__ */ new Map();
    const topArticles = [...readingByTitle.values()].flat().filter((a) => isReaderReadySourceTitle(a.title) && a.peerReviewed && !!readerArticleUrl({ ...a, validated_publisher_url: a.validatedPublisherUrl, publisher_url_status: a.publisherUrlStatus, publisher_url_source: a.publisherUrlSource }) && (a.personSharers.size >= 1 || independentPubs(a) >= 2)).map((a) => {
      const evidence = partitionEvidence(a.evidence.values());
      const context = readerPaperContext(a);
      const authoredClinicianCount = authoredClinicianSupportCount(evidence.clinicianPosts, a.title);
      const clinicianPosts = evidence.clinicianPosts.slice(0, 24);
      const publisherPosts = evidence.publisherPosts.slice(0, 24);
      const otherPosts = evidence.otherPosts.slice(0, 24);
      const knownClinicians = new Set([...a.personSharers.values()].map(({ handle }) => normalizeXHandle(handle)).filter(Boolean));
      const revealableClinicians = /* @__PURE__ */ new Set();
      for (const post of [...clinicianPosts, ...publisherPosts, ...otherPosts]) {
        const author = normalizeXHandle(post.handle);
        if (author && knownClinicians.has(author)) revealableClinicians.add(author);
        for (const reposter of post.repostedBy ?? []) {
          const handle = normalizeXHandle(reposter.handle);
          if (handle && knownClinicians.has(handle)) revealableClinicians.add(handle);
        }
      }
      const readerUrl = readerArticleUrl({ ...a, validated_publisher_url: a.validatedPublisherUrl, publisher_url_status: a.publisherUrlStatus, publisher_url_source: a.publisherUrlSource });
      sourceUrlByReaderUrl.set(readerUrl, a.url);
      return {
        title: a.title,
        url: readerUrl,
        journal: a.journal,
        domain: a.domain,
        doi: a.doi,
        pmid: a.pmid,
        abstract: context.abstract,
        description: context.description,
        publishedAt: a.pubDate,
        circulationState: paperCirculationState({ pub_date: a.pubDate }, now),
        sharers: a.personSharers.size + a.publishers.size,
        kolSharers: a.personSharers.size,
        revealableClinicianCount: revealableClinicians.size,
        authoredClinicianCount,
        independentPublisherCount: independentPubs(a),
        publishers: independentPublisherNames(a),
        publisherPosts,
        otherPosts,
        faces: [...a.personSharers.values()].map(({ avatar }) => avatar).filter(Boolean).slice(0, 5),
        topLikes: a.topLikes,
        posts: clinicianPosts,
        peerReviewed: a.peerReviewed
      };
    }).sort(comparePaperSignal).slice(0, 24);
    for (const rd of readingByKey.values()) {
      if (rd.personSharers.size === 0 || !rd.peerReviewed) continue;
      const readerUrl = readerArticleUrl({ ...rd, validated_publisher_url: rd.validatedPublisherUrl, publisher_url_status: rd.publisherUrlStatus, publisher_url_source: rd.publisherUrlSource });
      if (!readerUrl) continue;
      const ids = demoteBackbone(matchDrugIds(normTitle(rd.title)));
      if (!ids.length || ids.length > ROUNDUP_CAP + 2) continue;
      const tk = normTitle(rd.title);
      const evidence = partitionEvidence(rd.evidence.values());
      const context = readerPaperContext(rd);
      const litPaper = {
        title: rd.title,
        url: readerUrl,
        journal: rd.journal,
        domain: rd.domain,
        doi: rd.doi,
        pmid: rd.pmid,
        abstract: context.abstract,
        description: context.description,
        publishedAt: rd.pubDate,
        circulationState: paperCirculationState({ pub_date: rd.pubDate }, now),
        sharers: [...rd.personSharers.values()].map(({ handle, avatar }) => ({ name: handle, handle, avatar, tweetUrl: null, text: null, likes: 0, retweets: 0, quotes: 0, views: 0 })).slice(0, 6),
        sharerCount: rd.personSharers.size,
        topLikes: rd.topLikes,
        posts: evidence.clinicianPosts.slice(0, 24),
        publishers: [...rd.publishers.keys()].slice(0, 3),
        publisherPosts: evidence.publisherPosts.slice(0, 24),
        otherPosts: evidence.otherPosts.slice(0, 24),
        peerReviewed: rd.peerReviewed
      };
      for (const id of ids) {
        let arr = artByDrug.get(id);
        if (!arr) {
          arr = [];
          artByDrug.set(id, arr);
        }
        if (arr.some((p) => p.url === readerUrl || normTitle(p.title) === tk)) continue;
        arr.push(litPaper);
        artLikesByDrug.set(id, Math.max(artLikesByDrug.get(id) ?? 0, rd.topLikes));
      }
    }
    const EVENTS_WINDOW_DAYS = 30;
    const eventsCutoff = new Date(now - EVENTS_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
    const evRows = await pageAll((from, to) => sb.from("events").select("id,event_type,title,occurred_on,drug_id,nct_id,disease_area,detail,drugs(canonical_name,tumor_categories),companies(canonical_name)").gte("occurred_on", eventsCutoff).order("occurred_on", { ascending: false }).order("id", { ascending: true }).range(from, to));
    const events = [];
    const eventDrug = /* @__PURE__ */ new Map();
    const eventDrugName = /* @__PURE__ */ new Map();
    const seenEvent = /* @__PURE__ */ new Set();
    const orphanNcts = [...new Set((evRows ?? []).filter((e) => (e.disease_area ?? []).length === 0 && !(e.drugs?.tumor_categories ?? []).length && e.nct_id).map((e) => e.nct_id))];
    const trialCatsByNct = /* @__PURE__ */ new Map();
    if (orphanNcts.length) {
      try {
        const { data: tRows } = await sb.from("trials").select("nct_id,tumor_categories").in("nct_id", orphanNcts.slice(0, 500));
        for (const t of tRows ?? [])
          trialCatsByNct.set(t.nct_id, t.tumor_categories ?? []);
      } catch (e) {
        console.error("trial area fallback failed", e.message);
      }
    }
    const eventPriority = (type) => type === "trial_terminated" ? 4 : type === "trial_results_posted" ? 3 : type === "trial_status_change" ? 2 : type === "trial_new" ? 1 : 0;
    const orderedEventRows = [...evRows ?? []].sort(
      (a, b) => String(b.occurred_on ?? "").localeCompare(String(a.occurred_on ?? "")) || eventPriority(String(b.event_type ?? "")) - eventPriority(String(a.event_type ?? "")) || String(a.id ?? "").localeCompare(String(b.id ?? ""))
    );
    for (const e of orderedEventRows) {
      const isMeeting = e.event_type === "meeting_window";
      const da = e.disease_area ?? [];
      const drugCats = e.drugs?.tumor_categories ?? [];
      const primarySourceUrl = eventPrimaryUrl(e.nct_id ?? null, e.detail ?? null);
      if (!labelChangeIsReaderReady(e.event_type, da, primarySourceUrl)) continue;
      const inArea = da.includes(area) || da.length === 0 && drugCats.includes(area) || da.length === 0 && drugCats.length === 0 && (trialCatsByNct.get(e.nct_id)?.includes(area) ?? false);
      if (!inArea) continue;
      const on = (e.occurred_on ?? "").slice(0, 10);
      const ahead = on > today;
      if (isMeeting && (!ahead || on > ahead30)) continue;
      if (!isMeeting && ahead) continue;
      const dedup = e.nct_id && !isMeeting ? `trial-day:${e.nct_id}:${on}` : String(e.id ?? `${e.event_type}:${e.drug_id ?? ""}:${e.nct_id ?? ""}:${on}:${normTitle(e.title ?? "")}`);
      if (seenEvent.has(dedup)) continue;
      seenEvent.add(dedup);
      const rawWhyStopped = e.event_type === "trial_terminated" ? String(e.detail?.why_stopped ?? "").trim() || null : null;
      const terminationEligible = e.event_type === "trial_terminated" && rawWhyStopped ? eventHeroEligible({
        eventId: String(e.id ?? ""),
        type: e.event_type,
        title: e.title ?? "",
        occurredOn: on,
        drug: e.drugs?.canonical_name ?? null,
        drugId: e.drug_id ?? null,
        nct: e.nct_id ?? null,
        whyStopped: rawWhyStopped,
        sponsorReported: true
      }).eligible : false;
      const eventTitle = e.event_type === "trial_terminated" ? `${String(e.title ?? "").replace(/\s+(?:terminated|withdrawn|suspended)(?:\s*:.*)?$/i, "").trim() || e.nct_id || "Trial"} ${String(e.detail?.status ?? "terminated").toLowerCase()}` : e.title ?? "";
      events.push({
        type: e.event_type,
        title: eventTitle,
        drug: e.drugs?.canonical_name ?? null,
        company: e.companies?.canonical_name ?? null,
        occurredOn: on,
        ahead,
        drugId: e.drug_id ?? null,
        application: e.detail?.application ?? null,
        // → Drugs@FDA primary-source link on event cards
        sourceUrl: primarySourceUrl,
        nct: e.nct_id ?? null,
        // §3 termination band input — CT.gov's sponsor-provided reason. Carried only for
        // terminations so the payload rail stays lean.
        whyStopped: terminationEligible ? rawWhyStopped : null
      });
      if (!isMeeting && e.drug_id && !eventDrug.has(e.drug_id)) {
        const kind = eventChipLabel(e.event_type, e.title);
        if (kind) {
          const days = Math.max(0, Math.floor((now - new Date(on).getTime()) / 864e5));
          eventDrug.set(e.drug_id, `${kind} \xB7 ${days === 0 ? "today" : days + "d ago"}`);
          if (e.drugs?.canonical_name) eventDrugName.set(e.drug_id, e.drugs.canonical_name);
        }
      }
    }
    events.sort((a, b) => Number(a.ahead) - Number(b.ahead) || (a.occurredOn < b.occurredOn ? 1 : -1));
    let readoutWatch = [];
    try {
      const winFrom = new Date(now - WATCH_WINDOW_PAST_DAYS * 864e5).toISOString().slice(0, 10);
      const winTo = new Date(now + WATCH_WINDOW_FUTURE_DAYS * 864e5).toISOString().slice(0, 10);
      const { data: watchRows } = await sb.from("trials").select("nct_id,acronym,brief_title,phase,overall_status,primary_completion_date,tumor_categories,lead_sponsor,interventions").eq("phase", "PHASE3").contains("tumor_categories", [area]).gte("primary_completion_date", winFrom).lte("primary_completion_date", winTo).limit(60);
      const ncts = (watchRows ?? []).map((t) => t.nct_id);
      const movesByNct = /* @__PURE__ */ new Map();
      if (ncts.length) {
        const { data: mvRows } = await sb.from("events").select("nct_id,occurred_on,detail").eq("event_type", "trial_completion_move").in("nct_id", ncts).gte("occurred_on", new Date(now - 90 * 864e5).toISOString().slice(0, 10)).order("occurred_on", { ascending: false });
        for (const m of mvRows ?? []) {
          if (!movesByNct.has(m.nct_id) && m.detail?.from && m.detail?.to)
            movesByNct.set(m.nct_id, { from: m.detail.from, to: m.detail.to, occurredOn: m.occurred_on });
        }
      }
      readoutWatch = buildWatchCards(watchRows ?? [], area, today, movesByNct);
      if (readoutWatch.length) {
        const ids = readoutWatch.map((w) => w.storyId);
        const { data: prior } = await sb.from("trial_story_ledger").select("story_id,event_type,detail").in("story_id", ids);
        const minted = new Set((prior ?? []).filter((r) => r.event_type === "minted").map((r) => r.story_id));
        const movedTo = new Set((prior ?? []).filter((r) => r.event_type === "date_moved").map((r) => `${r.story_id}:${r.detail?.to ?? ""}`));
        const ledgerRows = [];
        for (const w of readoutWatch) {
          if (!minted.has(w.storyId)) {
            ledgerRows.push({ story_id: w.storyId, nct_id: w.nctId, kind: "watch", area, build_id: deps.buildInfo.sha, edition: weekOfMonday(), event_type: "minted", detail: { pcd: w.primaryCompletionDate } });
          }
          if (w.move && !movedTo.has(`${w.storyId}:${w.move.to}`)) {
            ledgerRows.push({ story_id: w.storyId, nct_id: w.nctId, kind: "watch", area, build_id: deps.buildInfo.sha, edition: weekOfMonday(), event_type: "date_moved", detail: { from: w.move.from, to: w.move.to } });
          }
        }
        if (ledgerRows.length) {
          effects.trialLedgerInserts.push(...ledgerRows);
          if (deps.effectsMode === "apply") await sb.from("trial_story_ledger").insert(ledgerRows);
        }
      }
    } catch (e) {
      console.error("readout watch assembly failed", e.message);
    }
    const drugIds = [.../* @__PURE__ */ new Set([...podByDrug.keys(), ...xByDrug.keys(), ...artByDrug.keys(), ...eventDrug.keys()])];
    const companyByDrug = /* @__PURE__ */ new Map();
    const brandByDrug = /* @__PURE__ */ new Map();
    if (drugIds.length) {
      const { data: dc } = await sb.from("drug_companies").select("drug_id,companies(canonical_name)").eq("is_primary", true).in("drug_id", drugIds);
      for (const r of dc ?? []) if (r.companies?.canonical_name) companyByDrug.set(r.drug_id, r.companies.canonical_name);
      const { data: dn } = await sb.from("drugs").select("id,canonical_name,primary_brand").in("id", drugIds);
      for (const r of dn ?? []) {
        const b = displayPrimaryBrand(r.canonical_name, r.primary_brand);
        if (b) brandByDrug.set(r.id, b);
      }
    }
    const priorX = /* @__PURE__ */ new Map();
    const priorArt = /* @__PURE__ */ new Map();
    await stage("publisher shares streamed");
    await pageEachBatch((from, to) => sb.from("x_posts_product").select("content,rt_tweet_id,x_sources!inner(id,x_handle,source_type,tumor_categories)").eq("x_sources.source_type", "kol").gte("posted_at", priorCutoff).lt("posted_at", recentCutoff).order("x_post_id", { ascending: true }).range(from, to), (batch) => {
      dropBanned(batch);
      for (const r of batch) {
        const handle = r.x_sources?.x_handle;
        if (!handle) continue;
        if (isLowValuePost(r.content)) continue;
        const hay = normTitle(r.content);
        let ids = demoteBackbone(matchDrugIds(hay));
        if (ids.length > ROUNDUP_CAP) ids = [];
        const singleAreaDrugHit = ids.some((id) => !multiArea.get(id));
        const contentOffArea = hasForeignTumorCue(hay) || hasOtherAreaDiseaseCue(hay) && !hasAreaDiseaseCue(hay);
        const thisCue = !contentOffArea && hasAreaCue(hay);
        const otherCue = contentOffArea || hasOtherAreaCue(hay) || namesForeignDrug(hay);
        const sourceAreas = sourceAreasFor(r.x_sources);
        const contextAllowsDrug = areaContextAllowsDrugMention({
          area,
          sourceAreas,
          thisCue,
          otherCue,
          authored: isAuthoredEvidencePost(r)
        });
        for (const id of ids) {
          const ok = thisCue ? true : contextAllowsDrug && (!multiArea.get(id) || singleAreaDrugHit);
          if (!ok) continue;
          if (!priorX.has(id)) priorX.set(id, /* @__PURE__ */ new Set());
          priorX.get(id).add(handle);
        }
      }
    });
    await stage("prior posts streamed");
    const priorSeen = /* @__PURE__ */ new Set();
    const priorArticleIdentity = new PaperIdentityIndex();
    await pageEachBatch((from, to) => sb.from("x_article_shares").select("x_posts!inner(posted_at),x_sources!inner(x_handle,source_type),x_shared_articles!inner(id,title,canonical_url,journal,domain,article_doi,pmid,validated_publisher_url,publisher_url_status,publisher_url_source,pub_types,tumor_categories,abstract,pub_date,first_shared_at,onc_relevant,promotional)").eq("x_sources.source_type", "kol").gte("x_posts.posted_at", priorCutoff).lt("x_posts.posted_at", recentCutoff).not("x_shared_articles.title", "is", null).is("x_shared_articles.canonical_article_id", null).order("id", { ascending: true }).range(from, to), (batch) => {
      dropBanned(batch);
      for (const r of batch) {
        const a = r.x_shared_articles;
        if (!a || !isEligible(a) || !isPeerReviewed(a)) continue;
        const aid = priorArticleIdentity.resolve(a).key;
        if (!aid) continue;
        if (priorSeen.has(aid)) continue;
        priorSeen.add(aid);
        const title = a.title ?? "";
        const areas = a.tumor_categories ?? [];
        const hay = normTitle(`${title}  ${a.abstract ?? ""}`);
        const ids = demoteBackbone(matchDrugIds(normTitle(title)));
        if (!ids.length || ids.length > ROUNDUP_CAP + 2) continue;
        if (hasForeignTumorCue(hay) && !hasAreaCue(hay) || titleOffArea(title)) continue;
        const thisEv = areas.includes(area) || hasAreaCue(hay);
        for (const id of ids) {
          if (multiArea.get(id) && !thisEv) continue;
          if (!priorArt.has(id)) priorArt.set(id, /* @__PURE__ */ new Set());
          priorArt.get(id).add(aid);
        }
      }
    });
    await stage("prior windows done");
    const xEffective = (x) => {
      if (!x || x.signalPosts.size === 0) return x?.sharers.size ?? 0;
      let general = 0;
      const byTrial = /* @__PURE__ */ new Map();
      for (const s of x.signalPosts.values()) {
        const acs = extractTrials(s.text);
        if (acs.size === 0) {
          general++;
          continue;
        }
        const key = [...acs].sort()[0];
        byTrial.set(key, (byTrial.get(key) ?? 0) + 1);
      }
      let eff = general;
      for (const n of byTrial.values()) eff += Math.sqrt(n);
      return eff;
    };
    const raw = /* @__PURE__ */ new Map();
    for (const id of drugIds) {
      const p = podByDrug.get(id);
      const x = xByDrug.get(id);
      const distinctConv = p?.window.length ?? 0;
      const distinctEps = p?.eps.size ?? 0;
      const depth = p?.depth ?? 0;
      const convsPerEp = distinctEps > 0 ? distinctConv / distinctEps : 0;
      const podRaw = distinctEps > 0 ? distinctEps * (1 + 0.35 * L1p(convsPerEp)) + 0.5 * depth : 0;
      const xEff = xEffective(x);
      const xRaw = xEff > 0 ? xEff + 0.25 * L1p(x?.peakLikes ?? 0) : 0;
      const artCount = artByDrug.get(id)?.length ?? 0;
      const artRaw = artCount > 0 ? artCount + 0.25 * L1p(artLikesByDrug.get(id) ?? 0) : 0;
      raw.set(id, { pod: podRaw, x: xRaw, art: artRaw });
    }
    const maxPod = Math.max(1e-9, ...[...raw.values()].map((v) => v.pod));
    const maxX = Math.max(1e-9, ...[...raw.values()].map((v) => v.x));
    const maxArt = Math.max(1e-9, ...[...raw.values()].map((v) => v.art));
    const movers = [];
    for (const id of drugIds) {
      const p = podByDrug.get(id);
      const x = xByDrug.get(id);
      const podConvs = p?.window.length ?? 0;
      const distinctEps = p?.eps.size ?? 0;
      const podShowsN = new Set((p?.window ?? []).map((c) => c.show).filter(Boolean)).size;
      const deepPod = distinctEps >= 1 && podConvs >= distinctEps * 2;
      const podSignal = distinctEps + (deepPod ? 1 : 0);
      const xSharers = x?.sharers.size ?? 0;
      const articleCount = artByDrug.get(id)?.length ?? 0;
      const totalSignal = podSignal + xSharers + articleCount;
      const hasEvent = eventDrug.has(id);
      if (totalSignal === 0) continue;
      if (totalSignal < 2 && !hasEvent) continue;
      const rr = raw.get(id) ?? { pod: 0, x: 0, art: 0 };
      const podN = rr.pod / maxPod, xN = rr.x / maxX, artN = rr.art / maxArt;
      const channels = [podN > 0, xN > 0, artN > 0].filter(Boolean).length;
      const multi = channels >= 2 ? 1.2 : 1;
      let score = Math.round(100 * (0.5 * podN + 0.3 * xN + 0.2 * artN) * multi * (hasEvent ? 1.4 : 1));
      if (hasEvent) score = Math.max(score, 45 + (ioIds.has(id) ? 0 : Math.min(20, 4 * podSignal + 5 * articleCount + 2 * xSharers)));
      const shape = hasEvent ? "regulatory" : podN > 0 && xN > 0 ? "both" : podN >= xN && podN >= artN ? "pods" : "x";
      const barTotal = Math.max(1, distinctEps + xSharers + articleCount);
      const podPct = Math.round(100 * distinctEps / barTotal);
      const xPct = Math.round(100 * xSharers / barTotal);
      const perEp = /* @__PURE__ */ new Map();
      const convs = (p?.window ?? []).slice().sort((a, b) => b.mentionCount - a.mentionCount).filter((c) => {
        const k = c.episodeId || c.episodeTitle;
        const n = perEp.get(k) ?? 0;
        if (n >= 2) return false;
        perEp.set(k, n + 1);
        return true;
      });
      const evidence = partitionEvidence(x?.posts.values() ?? []);
      const posts = evidence.clinicianPosts;
      const avatars = [...new Set([
        ...evidence.clinicianPosts,
        ...evidence.publisherPosts,
        ...evidence.otherPosts
      ].map((s) => s.avatar).filter(Boolean))].slice(0, 4);
      const showArt = [...new Set((p?.window ?? []).map((c) => c.showArt).filter(Boolean))].slice(0, 4);
      const shows = [...new Set((p?.window ?? []).map((c) => c.show))].slice(0, 3);
      const papers = (artByDrug.get(id) ?? []).slice().sort((a, b) => b.sharers.length - a.sharers.length || b.topLikes - a.topLikes);
      movers.push({
        drugId: id,
        drug: p?.name ?? eventDrugName.get(id) ?? forms.find((f) => f.drugId === id)?.name ?? "\u2014",
        brand: brandByDrug.get(id) ?? null,
        company: companyByDrug.get(id) ?? null,
        score,
        signalShape: shape,
        // momentum: this week's activity minus the prior 2 weeks', across all 3 channels.
        // Podcast uses distinct EPISODES (not intra-episode clusters) so one new deep-dive
        // episode moves the arrow by +1, not +6.
        delta: distinctEps + xSharers + articleCount - ((p?.priorEps.size ?? 0) + (priorX.get(id)?.size ?? 0) + (priorArt.get(id)?.size ?? 0)),
        podConvs,
        podEpisodes: distinctEps,
        podShows: podShowsN,
        xSharers,
        articleCount,
        podPct,
        xPct,
        articlePct: Math.max(0, 100 - podPct - xPct),
        topLikes: x?.peakLikes ?? 0,
        why: convs[0]?.gloss ?? null,
        eventChip: eventDrug.get(id) ?? null,
        stanceChip: null,
        stance: null,
        avatars,
        showArt,
        shows,
        posts: posts.slice(0, 24),
        publisherPosts: evidence.publisherPosts.slice(0, 24),
        otherPosts: evidence.otherPosts.slice(0, 24),
        papers,
        podcast: convs
      });
    }
    movers.sort((a, b) => b.score - a.score || b.podEpisodes - a.podEpisodes || b.podConvs - a.podConvs || b.xSharers - a.xSharers);
    const topMovers = movers.slice(0, 8);
    const STANCE_MIN = 4;
    const SMEAR_AREA_MIN = 4;
    const AXIS_PLURALITY = 0.4;
    const STANCE_OPINION = /* @__PURE__ */ new Set(["enthusiastic", "favorable", "skeptical", "negative", "equipoise"]);
    const stanceCut = new Date(now - 30 * 864e5).toISOString();
    const moverIds = topMovers.map((m) => m.drugId);
    if (moverIds.length) {
      const stanceRows = await pageAll((from, to) => sb.from("pharma_stance").select("entity_id,source_kind,source_id,stance_valence,practice_signal,stance_axis,occurred_at,evidence,disease_area").in("entity_id", moverIds).is("suppressed_reason", null).gte("occurred_at", stanceCut).order("occurred_at", { ascending: false }).range(from, to));
      const byDrug = /* @__PURE__ */ new Map();
      let smearDropped = 0;
      for (const r of stanceRows ?? []) {
        if (!STANCE_OPINION.has(r.stance_valence)) continue;
        const da = r.disease_area ?? [];
        if (da.length && !da.includes(area)) continue;
        const trackedSpan = da.filter((x) => AREA_KEYS.includes(x)).length;
        if (trackedSpan >= 2) {
          smearDropped++;
          continue;
        }
        const ev = String(r.evidence ?? "").toLowerCase();
        if (hasOtherAreaDiseaseCue(ev) && !hasAreaDiseaseCue(ev)) continue;
        if (!showableEvidence(r.evidence)) continue;
        const a = byDrug.get(r.entity_id) ?? [];
        a.push(r);
        byDrug.set(r.entity_id, a);
      }
      const orderRows = (rows2) => [...rows2].sort((a, b) => {
        const w = (x) => x.practice_signal === "practice-changing" || x.practice_signal === "abandoning" ? 1 : 0;
        return w(b) - w(a) || String(b.occurred_at ?? "").localeCompare(String(a.occurred_at ?? ""));
      });
      const TAKE_CAP = 24;
      const keep = /* @__PURE__ */ new Map();
      const podIds = /* @__PURE__ */ new Set(), xIds = /* @__PURE__ */ new Set();
      for (const m of topMovers) {
        if (BACKBONE_CHEMOS.has((m.drug ?? "").trim().toLowerCase())) continue;
        const rows2 = byDrug.get(m.drugId) ?? [];
        if (rows2.length < STANCE_MIN) continue;
        const ordered = orderRows(rows2);
        keep.set(m.drugId, ordered);
        for (const r of ordered.slice(0, TAKE_CAP)) {
          if (r.source_kind === "podcast" && r.source_id) podIds.add(r.source_id);
        }
        for (const r of ordered) if (r.source_kind === "x" && r.source_id) xIds.add(r.source_id);
      }
      const epMap = /* @__PURE__ */ new Map();
      if (podIds.size) {
        try {
          const eps = await rows(sb.from("episodes").select("id,title,link,audio_url,shows(title)").in("id", [...podIds]));
          for (const e of eps) {
            const sh = Array.isArray(e.shows) ? e.shows[0] : e.shows;
            const show = sh?.title ?? null, title = e.title ?? "";
            epMap.set(e.id, { label: show ? title ? `${show} \u2014 ${title}` : show : title || "Podcast episode", url: e.link ?? e.audio_url ?? null });
          }
        } catch (e) {
          console.error("stance receipt: episode resolve failed", area, e.message);
        }
      }
      const xpMap = /* @__PURE__ */ new Map();
      if (xIds.size) {
        try {
          const xps = (await collectInIdBatches([...xIds], (batch) => rows(sb.from("x_posts_product").select("id,x_post_id,content,rt_tweet_id,quoted_tweet_id,x_sources(id,name,x_handle,source_type)").in("id", batch)))).filter(notBanned);
          for (const p of xps) {
            const xs = withRealName(Array.isArray(p.x_sources) ? p.x_sources[0] : p.x_sources);
            const handle = xs?.x_handle ?? null, name = xs?.name ?? null;
            const label = name ? handle ? `${name} (@${handle})` : name : handle ? `@${handle}` : "Clinician on X";
            const clinician = !!(xs?.id && clinicianSourceIds.has(xs.id));
            const isAmp = !!(p.quoted_tweet_id || p.rt_tweet_id);
            const added = String(p.content ?? "").replace(/^\s*RT @\w+:?\s*/i, "").replace(/https?:\/\/\S+/g, "").replace(/[@#]\w+/g, "").trim();
            const substantive = added.length >= 15;
            const origin = p.quoted_tweet_id ?? p.rt_tweet_id ?? p.x_post_id ?? p.id;
            xpMap.set(p.id, { label, url: handle && p.x_post_id ? `https://x.com/${handle}/status/${p.x_post_id}` : null, content: p.content ?? null, clinician, isAmp, substantive, origin });
          }
        } catch (e) {
          console.error("stance receipt: x_post resolve failed", area, e.message);
        }
      }
      for (const m of topMovers) {
        const kept = keep.get(m.drugId);
        if (!kept) continue;
        let mediaAmp = 0;
        const clin = kept.filter((r) => {
          if (r.source_kind !== "x") return true;
          const info = xpMap.get(r.source_id);
          if (isRt(info?.content)) return false;
          if (info?.isAmp && !info?.substantive) {
            mediaAmp++;
            return false;
          }
          if (!info?.clinician) {
            mediaAmp++;
            return false;
          }
          return true;
        });
        if (!clin.length) continue;
        const seenTake = /* @__PURE__ */ new Set();
        const seenOrigin = /* @__PURE__ */ new Set();
        const deduped = clin.filter((r) => {
          const k = `${r.source_id}|${normTitle(String(r.evidence ?? "")).slice(0, 140)}`;
          if (seenTake.has(k)) return false;
          seenTake.add(k);
          if (r.source_kind === "x") {
            const origin = xpMap.get(r.source_id)?.origin;
            if (origin) {
              if (seenOrigin.has(origin)) return false;
              seenOrigin.add(origin);
            }
          }
          return true;
        });
        const axisCount = {};
        for (const r of deduped) for (const ax of r.stance_axis ?? []) axisCount[ax] = (axisCount[ax] ?? 0) + 1;
        const axis = Object.entries(axisCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        if (!axis) continue;
        const ordered = orderRows(deduped.filter((r) => (r.stance_axis ?? []).includes(axis))).filter((r) => {
          const source = r.source_kind === "podcast" ? epMap.get(r.source_id) : xpMap.get(r.source_id);
          return !!source?.url;
        });
        if (ordered.length < STANCE_MIN) continue;
        if (ordered.length < AXIS_PLURALITY * deduped.length) continue;
        const fav = ordered.filter((r) => r.stance_valence === "favorable" || r.stance_valence === "enthusiastic").length;
        const skep = ordered.filter((r) => r.stance_valence === "skeptical" || r.stance_valence === "negative").length;
        const mixed = ordered.filter((r) => r.stance_valence === "equipoise").length;
        const episodeCount = new Set(ordered.filter((r) => r.source_kind === "podcast").map((r) => r.source_id)).size;
        const postCount = new Set(ordered.filter((r) => r.source_kind === "x").map((r) => r.source_id)).size;
        const takes = ordered.slice(0, TAKE_CAP).map((r) => {
          const isPod = r.source_kind === "podcast";
          const src = isPod ? epMap.get(r.source_id) : xpMap.get(r.source_id);
          const raw2 = String(r.evidence ?? "").trim();
          let text = raw2;
          if (raw2.length > 220) {
            const window = raw2.slice(0, 220);
            const lastEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
            text = lastEnd > 80 ? window.slice(0, lastEnd + 1) : window.slice(0, window.lastIndexOf(" ") > 80 ? window.lastIndexOf(" ") : 217) + "\u2026";
          }
          return {
            valence: r.stance_valence,
            text,
            verbatim: !isPod && isVerbatimQuote(text, src?.content),
            sourceType: isPod ? "podcast" : "x",
            sourceLabel: src?.label ?? (isPod ? "Podcast episode" : "Clinician on X"),
            url: src?.url ?? null,
            occurredAt: r.occurred_at ?? null,
            practiceChanging: r.practice_signal === "practice-changing"
          };
        });
        const lead = takes[0];
        m.stance = {
          total: ordered.length,
          favorable: fav,
          skeptical: skep,
          mixed,
          quote: lead?.text ?? "",
          quoteVerbatim: !!lead?.verbatim,
          practiceChanging: ordered.some((r) => r.practice_signal === "practice-changing"),
          axis,
          episodeCount,
          postCount,
          takes,
          ...mediaAmp > 0 ? { mediaAmplification: mediaAmp } : {}
        };
      }
      if (smearDropped) console.log(`[stance] ${area}: dropped ${smearDropped} pan-tumor smear row(s) (\u2265${SMEAR_AREA_MIN} areas)`);
    }
    for (const m of topMovers) {
      scopeMoverToDisease(m, area);
      const pods = m.podcast ?? [];
      m.podConvs = pods.length;
      m.podEpisodes = new Set(pods.map((c) => c.episodeId)).size;
      m.podShows = new Set(pods.map((c) => c.show).filter(Boolean)).size;
      m.articleCount = (m.papers ?? []).length;
      const visibleXIdentities = /* @__PURE__ */ new Set();
      for (const post of [...m.posts ?? [], ...m.publisherPosts ?? [], ...m.otherPosts ?? []]) {
        const authored = String(post.handle ?? post.name ?? "").toLowerCase();
        if (post.sourceLane === "clinician" && authored) visibleXIdentities.add(authored);
        for (const reposter of post.repostedBy ?? []) {
          const identity = String(reposter.handle ?? reposter.name ?? "").toLowerCase();
          if (identity) visibleXIdentities.add(identity);
        }
      }
      m.xSharers = visibleXIdentities.size;
      const barTotal = Math.max(1, m.podEpisodes + m.xSharers + m.articleCount);
      m.podPct = Math.round(100 * m.podEpisodes / barTotal);
      m.xPct = Math.round(100 * m.xSharers / barTotal);
      m.articlePct = Math.max(0, 100 - m.podPct - m.xPct);
    }
    const RESULTS_WINDOW_MS = 120 * 864e5;
    const acronymByNct = /* @__PURE__ */ new Map();
    for (const t of readoutResolver.trials) if (t.acronym) acronymByNct.set(t.nct_id, t.acronym);
    const seedResolvedTrial = (text, keys) => {
      const nct = resolveTrialNct(text, readoutResolver, area, normalizeIdentity, { strictBareAlpha: true });
      if (!nct) return keys;
      const acr = acronymByNct.get(nct);
      if (!acr) return keys;
      if (isNonTrialChip(acr)) return keys;
      keys.add(acr);
      return keys;
    };
    const trialMentions = /* @__PURE__ */ new Map();
    const getAcc = (key) => {
      let a = trialMentions.get(key);
      if (!a) {
        a = { x: 0, art: 0, pods: [], podEpSeen: /* @__PURE__ */ new Set(), dictPodEps: /* @__PURE__ */ new Set(), glossEps: /* @__PURE__ */ new Set(), posts: /* @__PURE__ */ new Map(), xVoices: /* @__PURE__ */ new Set(), articles: /* @__PURE__ */ new Map() };
        trialMentions.set(key, a);
      }
      return a;
    };
    for (const r of areaConvRows) {
      const ep = r.episodes ?? {};
      if ((ep.published_at ?? "") < recentCutoff) continue;
      const gloss = fixGloss(r.gloss);
      const keys = seedResolvedTrial(gloss, extractTrials(gloss));
      if (!keys.size) continue;
      const sh = Array.isArray(ep.shows) ? ep.shows[0] : ep.shows;
      const pod = {
        gloss,
        mentionCount: Number(r.mention_count ?? 0),
        startMs: normalizePodcastStartMs(r.start_ms, ep.duration_seconds),
        episodeId: ep.id ?? "",
        episodeTitle: ep.title ?? "",
        show: sh?.title ?? "\u2014",
        showArt: cleanMediaUrl(sh?.artwork_url),
        audioUrl: cleanMediaUrl(ep.audio_url),
        sourceUrl: ep.link ?? null,
        durationSeconds: ep.duration_seconds ?? null,
        publishedAt: ep.published_at ?? ""
      };
      for (const k of keys) {
        const a = getAcc(k);
        if (ep.id) a.glossEps.add(ep.id);
        if (ep.id && !a.podEpSeen.has(ep.id)) {
          a.podEpSeen.add(ep.id);
          if (a.pods.length < 6) a.pods.push(pod);
        }
      }
    }
    for (const agg of articleAgg.values()) {
      if (!agg.areas.includes(area) || !agg.peerReviewed) continue;
      const safeReaderUrl = readerArticleUrl({ ...agg, validated_publisher_url: agg.validatedPublisherUrl, publisher_url_status: agg.publisherUrlStatus, publisher_url_source: agg.publisherUrlSource });
      if (!safeReaderUrl) continue;
      const artText = agg.title;
      const keys = seedResolvedTrial(artText, extractTrials(artText));
      if (!keys.size) continue;
      const sharers = [...agg.personSharers.values()].map(({ handle, avatar }) => ({
        name: handle,
        handle,
        avatar,
        tweetUrl: null,
        text: null,
        likes: 0,
        retweets: 0,
        quotes: 0,
        views: 0
      }));
      const evidence = partitionEvidence(agg.posts.values());
      const paper = {
        title: agg.title,
        url: safeReaderUrl,
        journal: agg.journal,
        domain: agg.domain,
        abstract: agg.abstract,
        description: agg.description,
        sharers: sharers.slice(0, 6),
        sharerCount: agg.personSharers.size,
        topLikes: agg.topLikes,
        posts: evidence.clinicianPosts.slice(0, 24),
        publisherPosts: evidence.publisherPosts.slice(0, 24),
        otherPosts: evidence.otherPosts.slice(0, 24),
        peerReviewed: agg.peerReviewed
      };
      for (const k of keys) {
        const heldNct = trialMeta.get(stripKey(k))?.nct_id;
        if (!explicitTrialIdentityAgrees(`${agg.title} ${agg.abstract ?? ""}`, heldNct)) continue;
        const a = getAcc(k);
        a.art++;
        if (!a.articles.has(agg.url)) a.articles.set(agg.url, paper);
      }
    }
    await stage("prior shares streamed");
    await pageEachBatch((from, to) => sb.from("transcript_mentions").select("start_ms,snippet,drugs!inner(canonical_name,kind,tumor_categories),episodes!inner(id,title,link,published_at,audio_url,duration_seconds,transcription_status,shows(title,artwork_url))").eq("kind", "trial").is("suppressed_reason", null).neq("episodes.transcription_status", "duplicate").gte("episodes.published_at", recentCutoff).order("id", { ascending: true }).range(from, to), (batch) => {
      for (const r of batch) {
        const cats = r.drugs?.tumor_categories ?? [];
        const keys = extractTrials(r.drugs?.canonical_name ?? "");
        if (!keys.size) continue;
        const ep = r.episodes ?? {};
        if (!ep.id || (ep.published_at ?? "") < recentCutoff) continue;
        const hay = normTitle(r.snippet ?? "");
        let selfArea = false;
        if (cats.length) {
          if (!cats.includes(area)) continue;
          if (hasOtherAreaCue(hay) && !hasAreaCue(hay)) continue;
        } else {
          selfArea = hasAreaCue(hay) && !hasOtherAreaCue(hay);
        }
        const sh = Array.isArray(ep.shows) ? ep.shows[0] : ep.shows;
        const pod = {
          gloss: r.snippet ?? "",
          mentionCount: 1,
          startMs: normalizePodcastStartMs(r.start_ms, ep.duration_seconds),
          episodeId: ep.id,
          episodeTitle: ep.title ?? "",
          show: sh?.title ?? "\u2014",
          showArt: cleanMediaUrl(sh?.artwork_url),
          audioUrl: cleanMediaUrl(ep.audio_url),
          sourceUrl: ep.link ?? null,
          durationSeconds: ep.duration_seconds ?? null,
          publishedAt: ep.published_at ?? ""
        };
        for (const k of keys) {
          if (cats.length === 0 && !selfArea && !trialMentions.has(k)) continue;
          const a = getAcc(k);
          a.dictPodEps.add(ep.id);
          if (!a.podEpSeen.has(ep.id)) {
            a.podEpSeen.add(ep.id);
            if (a.pods.length < 6) a.pods.push(pod);
          }
        }
      }
    });
    for (const h of postTrialHits) {
      for (const k of h.keys) {
        const a = trialMeta.has(stripKey(k)) ? getAcc(k) : trialMentions.get(k);
        if (!a) continue;
        a.x++;
        a.xVoices.add(h.handle);
        if (h.evidence) mergeEvidenceEntry(a.posts, h.evidence);
      }
    }
    await stage("trial pods + X trial counts done");
    const mergeAcc = (into, from) => {
      for (const pod of from.pods) {
        if (!into.pods.some((existing) => existing.episodeId === pod.episodeId)) into.pods.push(pod);
      }
      for (const e of from.podEpSeen) into.podEpSeen.add(e);
      for (const e of from.dictPodEps) into.dictPodEps.add(e);
      for (const e of from.glossEps) into.glossEps.add(e);
      for (const h of from.xVoices) into.xVoices.add(h);
      for (const evidence of from.posts.values()) mergeEvidenceEntry(into.posts, evidence);
      for (const [u, pa] of from.articles) if (!into.articles.has(u)) into.articles.set(u, pa);
    };
    const collapsed = /* @__PURE__ */ new Map();
    for (const [key, acc] of trialMentions) {
      const canonical = canonicalTrial.get(stripKey(key));
      const displayKey = canonical ?? key;
      const sk = stripKey(displayKey);
      const existing = collapsed.get(sk);
      if (!existing) {
        collapsed.set(sk, { key: displayKey, acc });
        continue;
      }
      mergeAcc(existing.acc, acc);
      if (canonical) existing.key = canonical;
    }
    trialMentions.clear();
    for (const { key, acc } of collapsed.values()) {
      acc.x = acc.posts.size;
      acc.art = acc.articles.size;
      trialMentions.set(key, acc);
    }
    const trialSurvivors = [...trialMentions.entries()].filter(([key, c]) => {
      const meta = trialMeta.get(stripKey(key));
      const cats = meta?.tumor_categories ?? [];
      if (cats.length && !cats.includes(area)) return false;
      return !!meta?.nct_id || c.dictPodEps.size >= 1 || c.glossEps.size >= 2 || c.xVoices.size >= 2 || c.art >= 2;
    });
    const survivorNctIds = [...new Set(trialSurvivors.map(([key]) => trialMeta.get(stripKey(key))?.nct_id).filter(Boolean))];
    const trialHeavyByNct = /* @__PURE__ */ new Map();
    if (survivorNctIds.length) {
      const heavyRows = await pageAll((from, to) => sb.from("trials").select("nct_id,brief_title,phase,overall_status,lead_sponsor,interventions,results_first_posted,primary_completion_date").in("nct_id", survivorNctIds).order("nct_id", { ascending: true }).range(from, to));
      for (const h of heavyRows ?? []) if (h.nct_id) trialHeavyByNct.set(h.nct_id, h);
    }
    const trials = trialSurvivors.map(([key, c]) => {
      const lite = trialMeta.get(stripKey(key));
      const t = lite?.nct_id ? { ...lite, ...trialHeavyByNct.get(lite.nct_id) } : lite;
      if (!t?.nct_id) return null;
      const tcats = t?.tumor_categories ?? [];
      if (tcats.length && !tcats.includes(area)) return null;
      const resultsFresh = !!t?.results_first_posted && now - new Date(t.results_first_posted).getTime() <= RESULTS_WINDOW_MS;
      const interventions = Array.isArray(t?.interventions) ? t.interventions : [];
      const safePods = c.pods.filter((pod) => !trialGlossHasContradictoryRegimen(pod.gloss, interventions, trialDrugGroups));
      const podMentions = new Set(safePods.map((pod) => pod.episodeId).filter(Boolean)).size;
      const evidence = partitionEvidence(c.posts.values());
      const articles = [...c.articles.values()].slice(0, 5);
      return {
        nctId: t?.nct_id ?? "",
        // prefer the trial's REAL acronym (fixes the zero-drop display bug: LITESPARK-22 → LITESPARK-022)
        acronym: cleanTrialAcronym(t?.acronym ?? key),
        title: t?.brief_title ?? "",
        phase: t?.phase ?? null,
        status: t?.overall_status ?? null,
        sponsor: t?.lead_sponsor ?? null,
        primaryCompletionDate: t?.primary_completion_date ?? null,
        interventions,
        podMentions,
        xMentions: c.x,
        articleMentions: c.art,
        totalMentions: podMentions + c.x + c.art,
        resultsFresh,
        pods: safePods,
        posts: mergeEvidenceReceipts([...evidence.clinicianPosts, ...articles.flatMap((article) => article.posts ?? [])]).slice(0, 24),
        publisherPosts: mergeEvidenceReceipts([...evidence.publisherPosts, ...articles.flatMap((article) => article.publisherPosts ?? [])]).slice(0, 24),
        otherPosts: mergeEvidenceReceipts([...evidence.otherPosts, ...articles.flatMap((article) => article.otherPosts ?? [])]).slice(0, 24),
        articles,
        url: t?.nct_id ? `https://clinicaltrials.gov/study/${t.nct_id}` : `https://clinicaltrials.gov/search?term=${encodeURIComponent(key)}`
      };
    }).filter((t) => t !== null).filter((t) => !isKnownNonTrialIdentity(t.acronym ?? "")).sort(compareTrialSignal).slice(0, 12);
    await stage("trials section done");
    const topics = [];
    await stage("14b topics done");
    const moverLeadTitles = new Set(topMovers.map((m) => normTitle(m.papers?.[0]?.title ?? "")).filter((s) => s.trim()));
    const bestShare = Math.max(0, ...topArticles.map((a) => a.kolSharers));
    const paperFloor = Math.max(3, Math.ceil(0.3 * bestShare));
    const paperCandidates = topArticles.filter((a) => paperCanAnchorHero(a) && a.kolSharers >= paperFloor && a.peerReviewed !== false && !moverLeadTitles.has(normTitle(a.title))).slice(0, 12);
    const moverStory = (m) => {
      const podcastDebate = m.podConvs >= 5 && m.podEpisodes >= 2;
      if (podcastDebate) {
        return {
          kind: "drug",
          id: `${m.drugId}:podcast-debate`,
          headline: m.drug,
          subtitle: `${m.podEpisodes} podcast conversations`,
          description: m.why,
          score: m.score,
          delta: m.delta,
          bar: [100, 0, 0],
          podConvs: m.podConvs,
          podEpisodes: m.podEpisodes,
          podShows: m.podShows,
          xSharers: 0,
          articleCount: 0,
          clinicianCount: 0,
          topLikes: 0,
          podcast: m.podcast,
          posts: [],
          publisherPosts: [],
          otherPosts: [],
          papers: [],
          drugId: m.drugId,
          stance: m.stance ?? null,
          sourceScoped: true
        };
      }
      const paper = m.papers.find((candidate) => paperCanAnchorHero(candidate) && !!candidate.url && (!!candidate.doi || !!candidate.pmid || !!normTitle(candidate.title)));
      if (paper) {
        const posts = paper.posts ?? [];
        const publisherPosts = paper.publisherPosts ?? [];
        const otherPosts = paper.otherPosts ?? [];
        const xSharers = paper.sharerCount ?? new Set(posts.map((post) => post.handle ?? post.name)).size;
        const identity = paper.doi ? `doi:${paper.doi.toLowerCase()}` : paper.pmid ? `pmid:${paper.pmid}` : `title:${normTitle(paper.title)}`;
        return {
          kind: "drug",
          id: `${m.drugId}:${identity}`,
          headline: paper.title,
          subtitle: [paper.journal ?? paper.domain, paper.circulationState === "resurfaced" ? "Resurfaced in physician discussion" : null].filter(Boolean).join(" \xB7 ") || null,
          description: authoritativePaperExcerpt({ abstract: paper.abstract, description: paper.description ?? null }),
          score: m.score,
          delta: m.delta,
          bar: [0, xSharers > 0 ? 50 : 0, 50],
          podConvs: 0,
          podEpisodes: 0,
          podShows: 0,
          xSharers,
          articleCount: 1,
          clinicianCount: xSharers,
          topLikes: paper.topLikes,
          podcast: [],
          posts,
          publisherPosts,
          otherPosts,
          papers: [paper],
          drugId: m.drugId,
          stance: null,
          sourceScoped: true
        };
      }
      const episode = m.podcast[0];
      if (!episode) return null;
      return {
        kind: "drug",
        id: `${m.drugId}:episode:${episode.episodeId}`,
        headline: episode.episodeTitle,
        subtitle: episode.show || "Podcast",
        description: episode.gloss,
        score: m.score,
        delta: m.delta,
        bar: [100, 0, 0],
        podConvs: 1,
        podEpisodes: 1,
        podShows: 1,
        xSharers: 0,
        articleCount: 0,
        clinicianCount: 0,
        topLikes: 0,
        podcast: [episode],
        posts: [],
        publisherPosts: [],
        otherPosts: [],
        papers: [],
        drugId: m.drugId,
        stance: null,
        sourceScoped: true
      };
    };
    const paperStory = (a) => ({
      kind: "paper",
      id: `paper:${normTitle(a.title).trim().replace(/\s+/g, "-").slice(0, 60)}`,
      headline: a.title,
      subtitle: [a.journal || a.domain, a.circulationState === "resurfaced" ? "Resurfaced in physician discussion" : null].filter(Boolean).join(" \xB7 ") || null,
      description: authoritativePaperExcerpt({ abstract: a.abstract, description: a.description ?? null }),
      score: null,
      delta: 0,
      bar: null,
      podConvs: 0,
      podEpisodes: 0,
      podShows: 0,
      xSharers: 0,
      articleCount: 1,
      clinicianCount: a.kolSharers,
      topLikes: a.topLikes,
      podcast: [],
      posts: a.posts,
      publisherPosts: a.publisherPosts,
      otherPosts: a.otherPosts,
      // sharerCount carries the REAL clinician count; `sharers` stays capped/empty for payload
      // size, but the count must not read as 0 when the reading list shows 11 for this paper.
      papers: [{
        title: a.title,
        url: a.url,
        journal: a.journal,
        domain: a.domain,
        doi: a.doi,
        pmid: a.pmid,
        abstract: a.abstract,
        description: a.description,
        publishedAt: a.publishedAt,
        circulationState: a.circulationState,
        sharers: [],
        sharerCount: a.kolSharers,
        topLikes: a.topLikes,
        posts: a.posts,
        publisherPosts: a.publisherPosts,
        otherPosts: a.otherPosts,
        publishers: a.publishers,
        peerReviewed: a.peerReviewed
      }],
      drugId: null
    });
    const trialPhase = (p) => {
      if (!p) return null;
      const nums = p.split("/").map((x) => x.replace(/[^0-9]/g, "")).filter(Boolean);
      return nums.length ? `Phase ${nums.join("/")}` : null;
    };
    const trialStory = (t) => ({
      kind: "trial",
      id: `trial:${t.nctId || stripKey(t.acronym)}`,
      headline: t.acronym || t.title || "Trial update",
      subtitle: [trialPhase(t.phase), t.sponsor].filter(Boolean).join(" \xB7 ") || null,
      description: null,
      score: null,
      delta: 0,
      bar: null,
      podConvs: t.pods.length,
      podEpisodes: new Set(t.pods.map((c) => c.episodeId).filter(Boolean)).size,
      podShows: new Set(t.pods.map((c) => c.show).filter(Boolean)).size,
      xSharers: t.xMentions,
      articleCount: t.articles.length,
      clinicianCount: 0,
      topLikes: t.pods[0]?.mentionCount ?? 0,
      podcast: t.pods,
      posts: t.posts,
      publisherPosts: t.publisherPosts,
      otherPosts: t.otherPosts,
      papers: t.articles,
      drugId: null
    });
    const domTrialOf = (m) => {
      const cnt = /* @__PURE__ */ new Map();
      const add = (t) => {
        for (const k of extractTrials(t ?? "")) {
          const s = stripKey(k);
          cnt.set(s, (cnt.get(s) ?? 0) + 1);
        }
      };
      for (const p of m.posts) add(p.text);
      for (const p of m.papers) add(p.title);
      for (const c of m.podcast) add(c.gloss);
      let best = null, bn = 0;
      for (const [k, n] of cnt) if (n > bn) {
        bn = n;
        best = k;
      }
      return bn >= 2 ? best : null;
    };
    const atoms = [];
    for (const m of topMovers) {
      const story = moverStory(m);
      if (story) atoms.push({
        score: m.score,
        story,
        dom: domTrialOf({ ...m, posts: story.posts, papers: story.papers, podcast: story.podcast }),
        lead: normTitle(story.papers[0]?.title ?? story.podcast[0]?.episodeTitle ?? "") || void 0
      });
    }
    const maxShare = Math.max(1, ...paperCandidates.map((a) => a.kolSharers));
    const maxPaperLikes = Math.max(1e-9, ...paperCandidates.map((a) => L1p(a.topLikes)));
    const paperScore = (a) => Math.round(Math.min(95, 100 * (0.75 * (a.kolSharers / maxShare) + 0.25 * (L1p(a.topLikes) / maxPaperLikes))));
    for (const a of paperCandidates) atoms.push({ score: paperScore(a), story: paperStory(a), lead: normTitle(a.title) || void 0 });
    for (const t of trials) {
      if (!t.nctId) continue;
      if (t.podMentions < 1 || t.totalMentions < 2) continue;
      atoms.push({
        score: Math.min(92, 8 * t.podMentions + 5 * t.xMentions + 4 * t.articleMentions + (t.resultsFresh ? 12 : 0)),
        story: trialStory(t),
        dom: stripKey(t.acronym) || null,
        lead: t.articles[0]?.title ? normTitle(t.articles[0].title) : void 0
      });
    }
    const isDebate = (at) => at.story.kind === "drug" && (at.story.podConvs ?? 0) >= 5 && (at.story.podEpisodes ?? 0) >= 2;
    atoms.sort((a, b) => Number(isDebate(b)) - Number(isDebate(a)) || b.score - a.score);
    const CAP = 7;
    const DRUG_CAP = atoms.some((a) => a.story.kind !== "drug") ? 5 : CAP;
    const PAPER_CAP = 3;
    const topStories = [];
    const usedTrials = /* @__PURE__ */ new Set();
    const usedLeadPapers = /* @__PURE__ */ new Set();
    const deferredDrugs = [];
    const deferredPapers = [];
    let drugN = 0, paperN = 0;
    const sameStory = (at) => !!at.dom && usedTrials.has(at.dom) || !!at.lead && usedLeadPapers.has(at.lead);
    const claimStory = (at) => {
      if (at.dom) usedTrials.add(at.dom);
      if (at.lead) usedLeadPapers.add(at.lead);
    };
    const evText = (m) => [m.why, ...(m.podcast ?? []).map((c) => c.gloss ?? ""), ...(m.papers ?? []).map((p) => p.title ?? "")].join(" ").toLowerCase();
    const nameTokens = (m) => [m.drug, m.brand].filter(Boolean).map((s) => s.toLowerCase()).filter((s) => s.length > 3);
    const sameEvent = (a, b) => {
      const aP = new Set((a.papers ?? []).map((p) => p.url).filter(Boolean));
      if ((b.papers ?? []).some((p) => p.url && aP.has(p.url))) return true;
      const aE = new Set((a.podcast ?? []).map((c) => c.episodeId).filter(Boolean));
      if (!(b.podcast ?? []).some((c) => c.episodeId && aE.has(c.episodeId))) return false;
      const ta = evText(a), tb = evText(b);
      return nameTokens(b).some((t) => ta.includes(t)) || nameTokens(a).some((t) => tb.includes(t));
    };
    const claimedDrugMovers = [];
    for (const at of atoms) {
      if (topStories.length >= CAP) break;
      if (at.story.kind === "drug") {
        const m = topMovers.find((mm) => mm.drugId === at.story.drugId);
        if (!m || m.podEpisodes + m.xSharers + m.articleCount < 2) continue;
        if (sameStory(at)) continue;
        if (claimedDrugMovers.some((cm) => sameEvent(m, cm))) continue;
        if (drugN >= DRUG_CAP) {
          deferredDrugs.push(at);
          continue;
        }
        claimStory(at);
        claimedDrugMovers.push(m);
        drugN++;
      } else {
        if (sameStory(at)) continue;
        if (at.story.kind === "paper") {
          if (paperN >= PAPER_CAP) {
            deferredPapers.push(at);
            continue;
          }
          paperN++;
        }
        claimStory(at);
      }
      topStories.push(at.story);
    }
    for (const at of [...deferredDrugs, ...deferredPapers]) {
      if (topStories.length >= CAP) break;
      if (sameStory(at)) continue;
      const m = at.story.kind === "drug" ? topMovers.find((mm) => mm.drugId === at.story.drugId) : null;
      if (m && claimedDrugMovers.some((cm) => sameEvent(m, cm))) continue;
      claimStory(at);
      if (m) claimedDrugMovers.push(m);
      topStories.push(at.story);
    }
    const fnv = (s) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(36);
    };
    const PROSE_PROMPT_VERSION = "5";
    const evKey = (papers, pods, extra) => fnv(PROSE_PROMPT_VERSION + "\u2016" + [...new Set(papers.map((p) => p.url))].sort().join("|") + "\u2016" + [...pods.map((c) => `${c.episodeId}:${fnv(c.gloss ?? "")}`)].sort().join("|") + "\u2016" + [...extra].sort().join("|"));
    const evByDrug = /* @__PURE__ */ new Map();
    for (const e of events) if (e.drugId && !e.ahead) {
      const a = evByDrug.get(e.drugId) ?? [];
      a.push(`${e.type}:${e.occurredOn}`);
      evByDrug.set(e.drugId, a);
    }
    for (const m of topMovers) m.fp = evKey(m.papers, m.podcast, [m.drugId, ...evByDrug.get(m.drugId) ?? []]);
    for (const s of topStories) s.fp = s.sourceScoped ? evKey(s.papers, s.podcast, [s.id]) : s.kind === "drug" ? topMovers.find((mm) => mm.drugId === s.drugId)?.fp ?? s.id : evKey(s.papers, s.podcast, [s.id]);
    const eventsFp = fnv(events.map((e) => `${e.type}:${e.drugId ?? e.title}:${e.occurredOn}`).sort().join("|"));
    const proseFp = fnv([eventsFp, ...topMovers.map((m) => `${m.drugId}=${m.fp}`), ...topStories.map((s) => `${s.id}=${s.fp}`)].join("\u2016"));
    const prev = (await deps.loadPriorSnapshot(area).catch(() => null))?.data;
    const priorMoverWhy = new Map((prev?.movers ?? []).filter((m) => m.fp && m.why).map((m) => [m.fp, m.why]));
    const priorStory = new Map((prev?.topStories ?? []).filter((s) => s.fp).map((s) => [s.fp, s]));
    const priorTopicWhy = new Map((prev?.topics ?? []).filter((t) => t.fp && t.why).map((t) => [t.fp, t.why]));
    const fullReuse = !!prev?.proseFp && prev.proseFp === proseFp && !!prev.recap;
    const storyCandidates = topStories.filter((s) => s.kind !== "drug");
    const leadStories = topStories.slice(0, 3).map((s) => ({
      id: s.id,
      kind: s.kind,
      headline: s.headline || (s.kind === "drug" ? topMovers.find((mm) => mm.drugId === s.drugId)?.drug ?? "" : "")
    }));
    const recapOut = fullReuse ? { recap: prev.recap, headline: prev.headline, headlineStoryId: prev.headlineStoryId ?? null, whys: {}, moverHeadlines: {}, storyWhys: {}, storyHeadlines: {} } : await recapFor(area, topMovers, events, storyCandidates, leadStories);
    let { recap, headline } = recapOut;
    const { whys, moverHeadlines, storyWhys, storyHeadlines } = recapOut;
    const top3Ids = topStories.slice(0, 3).map((s) => s.id);
    const headlineStoryId = recapOut.headlineStoryId && top3Ids.includes(recapOut.headlineStoryId) ? recapOut.headlineStoryId : topStories[0]?.id ?? null;
    for (const m of topMovers) m.why = whys[m.drug] ?? m.why;
    for (const m of topMovers) {
      const w = m.fp && priorMoverWhy.get(m.fp);
      if (w) m.why = w;
    }
    for (const s of topStories) {
      if (s.kind === "drug") {
        const m = topMovers.find((mm) => mm.drugId === s.drugId);
        if (s.sourceScoped) continue;
        if (m) s.description = m.why;
        const mh = m ? moverHeadlines[m.drug] : "";
        if (mh) {
          s.subtitle = [s.headline, s.subtitle].filter(Boolean).join(" \xB7 ");
          s.headline = mh;
        }
        continue;
      }
      if (s.kind === "topic") {
        const h = storyHeadlines[s.id];
        if (h) {
          s.subtitle = s.headline;
          s.headline = h;
        }
      }
      if (s.kind === "paper") {
        s.description = authoritativePaperExcerpt({ abstract: s.papers[0]?.abstract ?? null, description: s.papers[0]?.description ?? null });
        continue;
      }
      const ai = storyWhys[s.id];
      if (ai) {
        s.description = ai;
        continue;
      }
    }
    for (const t of topics) {
      const ai = storyWhys[`topic:${t.key}`];
      if (ai) t.why = ai;
    }
    for (const s of topStories) {
      const p = s.fp && priorStory.get(s.fp);
      if (p) {
        s.headline = p.headline;
        s.subtitle = p.subtitle;
        s.description = p.description;
      }
    }
    for (const s of topStories) {
      if (s.kind !== "paper") continue;
      s.description = authoritativePaperExcerpt({
        abstract: s.papers[0]?.abstract ?? null,
        description: s.papers[0]?.description ?? null
      });
    }
    for (const t of topics) {
      const w = t.fp && priorTopicWhy.get(t.fp);
      if (w) t.why = w;
    }
    const todayIso = new Date(deps.now()).toISOString().slice(0, 10);
    let storyGraph = null;
    try {
      storyGraph = await loadHeroSupportGraph(area, todayIso, sourceByHandle, clinicianSourceIds, sourceAreasFor);
    } catch (e) {
      console.error("hero support graph failed", area, e.message);
    }
    const approvalTitleRe = /\b(?:FDA (?:grants? )?(?:accelerated )?approval|FDA approves?|approved by (?:the )?FDA)\b/i;
    const approvalAnchors = (storyGraph?.eventAnchors ?? []).filter((anchor) => approvalTitleRe.test(anchor.title ?? ""));
    const verifiedApprovalTitles = [
      ...events.filter((e) => approvalTitleRe.test(e.title ?? "")).map((e) => normTitle(`${e.title ?? ""} ${e.drug ?? ""}`)),
      ...approvalAnchors.map((anchor) => normTitle([
        anchor.title,
        typeof anchor.metadata?.summary === "string" ? anchor.metadata.summary : "",
        ...Array.isArray(anchor.metadata?.drugForms) ? anchor.metadata.drugForms : []
      ].join(" ")))
    ];
    for (const m of topMovers) {
      const forms2 = [m.drug, m.brand].filter(Boolean).map((value) => normTitle(value));
      const hasVerifiedApproval = verifiedApprovalTitles.some((title) => forms2.some((form) => form && title.includes(form)));
      if (!hasVerifiedApproval) continue;
      m.podcast = (m.podcast ?? []).filter(
        (clip) => suppressOutdatedApprovalForecast(clip.gloss, true) !== null
      );
      m.why = suppressOutdatedApprovalForecast(m.why, true);
      const primaryAnchor = approvalAnchors.find((anchor) => anchor.primary_drug_id === m.drugId);
      const kind = primaryAnchor ? eventChipLabel("drug_approval", primaryAnchor.title) : null;
      if (primaryAnchor && kind) {
        const days = Math.max(0, Math.floor((Date.parse(todayIso) - Date.parse(primaryAnchor.occurred_on)) / 864e5));
        m.eventChip = `${kind} \xB7 ${days === 0 ? "today" : `${days}d ago`}`;
      }
    }
    const CONSENSUS_MIN = 5;
    const phraseFor = (hasPod, hasX) => hasPod && hasX ? "Podcast discussions and clinicians on X" : hasX ? "Clinicians on X" : hasPod ? "Podcast discussions" : "Clinicians";
    const capFirst = (s) => s.replace(/^(\s*)([a-z])/, (_m, w, c) => w + c.toUpperCase());
    const attributeVoice = (t, hasPod, hasX) => {
      if (t == null) return t;
      const phrase = phraseFor(hasPod, hasX);
      return capFirst(t.replace(/(^|[.;:]\s+)(?:KOLs|KOL|Clinicians|clinicians)\b(?!\s+on\s+X)/g, (_m, pre) => pre + phrase).replace(/(^|[.;:]\s+)clinicians(\s+on\s+X)/g, (_m, pre, onx) => pre + "Clinicians" + onx).replace(/\bKOLs\b/g, "clinicians").replace(/\bKOL\b/g, "clinician"));
    };
    const deKolCap = (t) => t == null ? t : capFirst(t.replace(/\bKOLs\b/g, "clinicians").replace(/\bKOL\b/g, "clinician"));
    const neutralizeConsensus = (t, split) => t && split ? neutralizeConsensusText(t) : t;
    const stanceSplit = (m) => {
      const s = m?.stance;
      if (!s) return true;
      return (s.skeptical ?? 0) > 0 || (s.total ?? 0) < CONSENSUS_MIN;
    };
    const hasPodEv = (m) => !!(m && (m.podcast ?? []).length);
    const hasXEv = (m) => !!(m && (m.posts ?? []).length);
    for (const m of topMovers) {
      const hasPod = hasPodEv(m);
      const hasX = hasXEv(m);
      const attributed = neutralizeConsensus(attributeVoice(m.why, hasPod, hasX), stanceSplit(m)) ?? null;
      m.why = attributed && (!hasX && /\bon X\b/i.test(attributed) || !hasPod && /\bpodcasts?\b/i.test(attributed)) ? null : attributed;
    }
    for (const m of topMovers) if (m.why && ENDPOINT_NUM_RE.test(m.why)) m.why = null;
    for (const t of topics) t.why = neutralizeConsensus(attributeVoice(t.why, true, true), true) ?? null;
    for (const s of topStories) {
      const m = s.kind === "drug" ? topMovers.find((mm) => mm.drugId === s.drugId) : void 0;
      const sp = m ? hasPodEv(m) : (s.podcast ?? []).length > 0;
      const sx = m ? hasXEv(m) : (s.posts ?? []).length > 0;
      s.description = neutralizeConsensus(attributeVoice(s.description, sp, sx), stanceSplit(m)) ?? null;
      if (s.description && ENDPOINT_NUM_RE.test(s.description)) s.description = null;
      s.headline = deKolCap(s.headline) ?? s.headline;
      s.subtitle = deKolCap(s.subtitle) ?? null;
    }
    recap = neutralizeConsensus(attributeVoice(recap, true, true), true) ?? null;
    headline = deKolCap(headline) ?? null;
    await stage("top stories + topics done");
    let subAreasCat;
    if (AREA_DISEASES[area]) {
      for (const s of topStories) s.subAreas = subAreasOf(
        area,
        s.headline,
        s.subtitle,
        s.description,
        ...s.podcast.map((p) => p.gloss),
        ...s.posts.map((p) => p.text),
        ...s.papers.flatMap((p) => [p.title, p.abstract])
      );
      for (const m of topMovers) m.subAreas = subAreasOf(
        area,
        m.drug,
        m.why,
        m.eventChip,
        ...m.podcast.map((p) => p.gloss),
        ...m.posts.map((p) => p.text),
        ...m.papers.flatMap((p) => [p.title, p.abstract])
      );
      for (const k of topKols) k.subAreas = subAreasOf(area, ...k.drugs, ...k.posts.map((p) => p.text), ...k.articles.map((a) => a.title));
      for (const t of trials) t.subAreas = subAreasOf(area, t.acronym, t.title, ...t.interventions);
      for (const a of topArticles) a.subAreas = subAreasOf(area, a.title, a.abstract, ...a.posts.map((p) => p.text));
      for (const g of guests) g.subAreas = subAreasOf(area, ...g.episodes.flatMap((e) => [e.title, e.description]));
      for (const e of episodes) e.subAreas = subAreasOf(area, e.title, e.description);
      const cat = Object.keys(AREA_DISEASES[area]).map((key) => ({
        key,
        label: SUBAREA_LABELS[key] ?? key,
        count: topStories.filter((s) => s.subAreas?.includes(key)).length + trials.filter((t) => t.subAreas?.includes(key)).length + topMovers.filter((m) => m.subAreas?.includes(key)).length + topArticles.filter((a) => a.subAreas?.includes(key)).length + episodes.filter((e) => e.subAreas?.includes(key)).length + topKols.filter((k) => k.subAreas?.includes(key)).length + guests.filter((g) => g.subAreas?.includes(key)).length
      })).filter((s) => s.count > 0);
      if (cat.length >= 2) subAreasCat = cat;
    }
    await stage("sub-tumor done");
    let congress;
    try {
      let mrow = null;
      if (opts?.congressPreview) {
        const prev2 = await rows(sb.from("meetings").select("*").eq("series_key", opts.congressPreview).order("year", { ascending: false }).limit(1));
        mrow = prev2[0] ?? null;
      } else {
        const lo = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
        const hi = new Date(now + 7 * 864e5).toISOString().slice(0, 10);
        const cands = (await rows(sb.from("meetings").select("*").lte("start_date", hi).gte("end_date", lo))).filter((m) => (m.tumor_focus ?? []).includes(area) || (m.tumor_focus ?? []).includes("General"));
        const rank = (m) => today >= m.start_date && today <= m.end_date ? 0 : today < m.start_date ? 1 : 2;
        cands.sort((a, b) => rank(a) - rank(b) || String(a.start_date).localeCompare(String(b.start_date)));
        mrow = cands[0] ?? null;
      }
      if (mrow) {
        const linked = await pageAll((from, to) => sb.from("content_meetings").select("source_id").eq("meeting_id", mrow.id).eq("source_kind", "x_post").order("source_id", { ascending: true }).range(from, to));
        const statusIds = /* @__PURE__ */ new Set();
        const uuids = linked.map((r) => r.source_id);
        for (let i = 0; i < uuids.length; i += 200) {
          const xs = await rows(sb.from("x_posts_product").select("x_post_id").in("id", uuids.slice(i, i + 200)));
          for (const x of xs) if (x.x_post_id) statusIds.add(String(x.x_post_id));
        }
        const acronym = String(mrow.short_name ?? "").replace(/\s+\d{4}$/, "").trim();
        const toks = [...mrow.hashtags ?? [], .../\s/.test(acronym) ? [acronym] : []].map((t) => t.trim()).filter((t) => t && t.toLowerCase() !== "lcsm");
        const congRe = new RegExp(
          "(^|[^a-z0-9])(" + toks.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]?")).join("|") + ")($|[^a-z0-9])",
          "i"
        );
        const urlId = (u) => /\/status\/(\d+)/.exec(u ?? "")?.[1] ?? null;
        const hitPosts = (ps) => (ps ?? []).some((p) => {
          const id = urlId(p.tweetUrl);
          return !!id && statusIds.has(id) || congRe.test(p.text ?? "");
        });
        const hitText = (...ts) => congRe.test(ts.filter(Boolean).join("  "));
        for (const s of topStories) s.congress = hitPosts(s.posts) || hitText(s.headline, s.description, ...s.podcast.map((p) => p.gloss), ...s.papers.map((p) => p.title)) || void 0;
        for (const mv of topMovers) mv.congress = hitPosts(mv.posts) || hitText(mv.why, ...mv.podcast.map((p) => p.gloss), ...mv.papers.map((p) => p.title)) || void 0;
        for (const k of topKols) k.congress = hitPosts(k.posts) || hitText(...k.articles.map((a) => a.title)) || void 0;
        for (const t of trials) t.congress = hitPosts(t.posts) || hitText(...t.pods.map((p) => p.gloss), ...t.articles.map((a) => a.title)) || void 0;
        for (const a of topArticles) a.congress = hitPosts(a.posts) || hitText(a.title, a.abstract) || void 0;
        for (const g of guests) g.congress = hitText(...g.episodes.flatMap((e) => [e.title, e.description])) || void 0;
        for (const e of episodes) e.congress = hitText(e.title, e.description) || void 0;
        congress = {
          key: mrow.series_key,
          name: mrow.name,
          shortName: mrow.short_name,
          location: mrow.location ?? null,
          startDate: mrow.start_date,
          endDate: mrow.end_date,
          taggedStories: topStories.filter((s) => s.congress).length
        };
      }
    } catch (e) {
      console.error("congress block failed (brief ships without the bar)", area, e.message);
    }
    let heroCandidates;
    try {
      if (!storyGraph) throw new Error("hero support graph unavailable");
      const cands = [];
      for (const a of topArticles.slice(0, 12)) {
        if (!paperEligible(a) || !paperCanAnchorHero(a)) continue;
        if (!isReaderReadySourceTitle(a.title)) continue;
        if (PROMO_RE.test(a.title ?? "")) continue;
        const graphAnchor = storyGraph.paperAnchorByUrl.get(canonicalUrlIdentity(sourceUrlByReaderUrl.get(a.url) ?? a.url));
        const graphSupport = graphAnchor ? storyGraph.bundleByAnchor.get(graphAnchor.anchor_key) : void 0;
        const clinicianPosts = distinctClinicianSupport([
          ...a.posts ?? [],
          ...graphSupport?.clinicianPosts ?? []
        ]);
        const dedupePosts = (posts) => [...new Map(posts.map((post) => [
          post.tweetUrl ?? `${post.handle ?? post.name}:${post.text ?? ""}`,
          post
        ])).values()];
        const support = {
          clinicianPosts,
          publisherPosts: dedupePosts([...a.publisherPosts ?? [], ...graphSupport?.publisherPosts ?? []]),
          otherPosts: dedupePosts([...a.otherPosts ?? [], ...graphSupport?.otherPosts ?? []]),
          links: graphSupport?.links ?? []
        };
        const visibleClinicians = Math.min(a.kolSharers ?? 0, a.revealableClinicianCount ?? clinicianPosts.length);
        const counts = {
          clinicianSharers: visibleClinicians,
          authoredClinicians: Math.min(visibleClinicians, a.authoredClinicianCount ?? authoredClinicianSupportCount(clinicianPosts, a.title)),
          independentPublishers: a.independentPublisherCount ?? 0,
          likes: a.topLikes ?? 0
        };
        const r = traceRank([
          { input: "clinicianSharers", value: a.kolSharers ?? 0 },
          { input: "independentPublishers", value: counts.independentPublishers },
          { input: "likesCapped", value: a.topLikes ?? 0 }
        ]);
        const findings = abstractFindings(a.abstract, 320) ?? abstractFindings(stripAbstractLabel(a.description), 320);
        const paperExcerpt = findings;
        const paperCard = {
          id: `paper:${a.url}`,
          kind: "paper",
          anchorId: a.url,
          headline: a.title,
          why: whyLine(counts),
          sourceLabel: a.journal ?? a.domain ?? "paper",
          url: a.url,
          excerpt: paperExcerpt,
          excerptVerbatim: false,
          drugTags: [],
          subAreas: a.subAreas,
          congress: a.congress,
          // A title can identify the reported trial. An abstract can mention
          // comparators, prior studies, or future confirmatory trials, so it is
          // evidence context rather than paper identity.
          nct: resolveTrialNct(a.title, readoutResolver, area, normalizeIdentity, { strictBareAlpha: true }),
          doi: a.doi ?? null,
          eventId: null,
          siblings: [],
          rankTrace: r.trace,
          rankTotal: r.total,
          counts,
          support
        };
        cands.push(paperCard);
      }
      const graphEventDates = /* @__PURE__ */ new Set();
      for (const anchor of storyGraph.eventAnchors) {
        const summary = typeof anchor.metadata?.summary === "string" ? anchor.metadata.summary : null;
        const drugForms = Array.isArray(anchor.metadata?.drugForms) ? anchor.metadata.drugForms.filter((value) => typeof value === "string" && value.length > 0) : [];
        const card = buildEventCard({
          eventId: anchor.anchor_key,
          type: "fda_oncology_notification",
          title: anchor.title,
          occurredOn: anchor.occurred_on,
          drug: drugForms[0] ?? null,
          drugId: anchor.primary_drug_id,
          nct: anchor.nct_ids?.[0] ?? null,
          verified: true,
          primaryUrl: anchor.url,
          summary,
          drugForms,
          source: anchor.source
        }, todayIso);
        if (!card) continue;
        card.subAreas = subAreasOf(area, anchor.title, summary, ...drugForms);
        card.congress = false;
        card.support = storyGraph.bundleByAnchor.get(anchor.anchor_key);
        card.counts = {
          ...card.counts,
          clinicianComments: authoredClinicianSupportCount(card.support?.clinicianPosts ?? []),
          relatedSources: card.support?.links.length ?? 0
        };
        card.why = eventWhyLine(card.counts);
        cands.push(card);
        graphEventDates.add(`${anchor.primary_drug_id ?? ""}|${anchor.occurred_on}`);
      }
      for (const e of events.filter((ev) => !ev.ahead)) {
        if (graphEventDates.has(`${e.drugId ?? ""}|${e.occurredOn}`)) continue;
        const card = buildEventCard({
          eventId: `${e.drugId ?? e.title}:${e.type}:${e.occurredOn}`,
          type: e.type,
          title: e.title,
          occurredOn: e.occurredOn ?? "",
          drug: e.drug,
          drugId: e.drugId,
          nct: e.nct ?? null,
          application: e.application ?? null,
          // §3 termination band, wired 2026-08-16 (was never passed, so the signed band could
          // never fire). why_stopped is the sponsor's own registry-reported reason; the trial's
          // CT.gov page is the primary source the card links to.
          whyStopped: e.whyStopped ?? null,
          sponsorReported: e.whyStopped ? true : void 0,
          primaryUrl: e.type === "trial_terminated" && e.nct ? `https://clinicaltrials.gov/study/${e.nct}` : null
        }, todayIso);
        if (card) {
          card.subAreas = topMovers.find((m) => m.drugId === e.drugId)?.subAreas ?? subAreasOf(area, e.title, e.drug);
          card.congress = false;
          cands.push(card);
        }
      }
      const epReceipts = /* @__PURE__ */ new Map();
      const ampByEp = /* @__PURE__ */ new Map();
      let announcementReceiptsByEp = /* @__PURE__ */ new Map();
      let ampReceiptsByEp = /* @__PURE__ */ new Map();
      try {
        const epIds = epHeroInputs.map((e) => e.episodeId).filter(Boolean);
        if (epIds.length) {
          const receipts2 = await loadEpisodeXReceipts(epIds, clinicianSourceIds, sourceAreasForHandle);
          announcementReceiptsByEp = receipts2.announcements;
          ampReceiptsByEp = receipts2.amplifiers;
          for (const [episodeId, ids] of receipts2.amplifierIds) ampByEp.set(episodeId, ids.size);
        }
      } catch (e) {
        console.error("episode amplification fetch failed", e.message);
      }
      for (const ep of epHeroInputs.slice().sort((a2, b2) => b2.convCount - a2.convCount).slice(0, 8)) {
        const sel = selectDominantDrugMoments(
          [...podByDrug.entries()].flatMap(([drugId, pp]) => pp.window.filter((c) => c.episodeId === ep.episodeId).map((moment) => ({ drugId, drugName: pp.name, moment })))
        );
        if (!sel) continue;
        if (!episodeEligible({ substantiveMoments: sel.poolSize, audioUrl: ep.audioUrl })) continue;
        const selected = sel.selected;
        const moments = selected.length;
        let pick = pickCleanSentence(selected.map((g) => g.gloss));
        let excerptVerified = false;
        if (!pick) {
          try {
            const winOr = selected.map((g) => {
              const s = Math.max(0, Math.round(g.startMs / 1e3));
              return `and(start_time_seconds.lte.${s + 180},end_time_seconds.gte.${Math.max(0, s - 60)})`;
            }).join(",");
            const { data: chunks } = await sb.from("transcript_chunks").select("start_time_seconds,end_time_seconds,chunk_text").eq("episode_id", ep.episodeId).or(winOr);
            const blobs = selected.map((g) => {
              const s = Math.round(g.startMs / 1e3);
              return (chunks ?? []).filter((c) => c.start_time_seconds <= s + 180 && c.end_time_seconds >= s - 60).map((c) => c.chunk_text).join(" ");
            });
            const { data: srcArts } = await sb.from("x_shared_articles").select("abstract").not("abstract", "is", null).or("onc_relevant.eq.true,onc_relevant.is.null").or("promotional.eq.false,promotional.is.null").ilike("abstract", `%${sel.drugName}%`).gte("last_shared_at", new Date(now - 180 * 864e5).toISOString()).order("last_shared_at", { ascending: false }).limit(12);
            const sources = (srcArts ?? []).map((a) => a.abstract);
            if (sources.length) {
              pick = pickCleanSentence(selected.map((g) => g.gloss), 216, {
                maxVerified: 300,
                verifyNumbers: (sentence, i) => verifySentenceNumbers(sentence, blobs[i], sources)
              });
              excerptVerified = !!pick;
            }
          } catch (e) {
            console.error("verified-numbers lane failed", ep.episodeId, e.message);
          }
        }
        if (!pick) continue;
        const amp = ampByEp.get(ep.episodeId) ?? 0;
        const r = traceRank([
          { input: "episodesDiscussing", value: 1 },
          { input: "tierOneShow", value: ep.tier === 1 ? 1 : 0 },
          { input: "depthMoments", value: sel.poolSize },
          ...amp > 0 ? [{ input: "clinicianSharers", value: amp }] : []
        ]);
        epReceipts.set(ep.episodeId, selected);
        cands.push({
          id: `episode:${ep.episodeId}`,
          kind: "episode",
          anchorId: ep.episodeId,
          headline: ep.title,
          why: anchoredWhy("episode", `${moments} selected moment${moments === 1 ? "" : "s"}${amp > 0 ? ` \xB7 amplified by ${amp} clinician${amp === 1 ? "" : "s"}` : ""}`),
          sourceLabel: ep.show ?? "podcast",
          url: ep.sourceUrl ?? ep.audioUrl,
          startMs: selected[pick.sourceIndex].startMs,
          durationSeconds: ep.durationSeconds,
          momentStartMs: selected.map((g) => g.startMs),
          amplifiers: amp > 0 ? ampReceiptsByEp.get(ep.episodeId) ?? [] : void 0,
          announcements: announcementReceiptsByEp.get(ep.episodeId),
          excerpt: `This episode discusses: ${pick.sentence}`,
          excerptVerbatim: false,
          // the ONE subject the selected moments share — visible on the card precisely because
          // raw episode titles (CME "Proceedings…" feeds) can be vague about their content
          drugTags: [sel.drugName],
          subAreas: episodes.find((e) => e.episodeId === ep.episodeId)?.subAreas ?? subAreasOf(area, ep.title, pick.sentence),
          congress: episodes.find((e) => e.episodeId === ep.episodeId)?.congress,
          nct: resolveTrialNct(ep.title, readoutResolver, area, normalizeIdentity, { strictBareAlpha: true }),
          doi: null,
          eventId: null,
          siblings: [],
          rankTrace: r.trace,
          rankTotal: r.total,
          // verifiedNumbers=1 marks an excerpt admitted by the verified-numbers lane (audit trail)
          counts: { selectedMoments: moments, clinicianAmplifiers: amp, ...excerptVerified ? { verifiedNumbers: 1 } : {} }
        });
      }
      const seenTweet = /* @__PURE__ */ new Set();
      const postPool = topMovers.flatMap((m) => (m.posts ?? []).map((p2) => ({ p: p2, drug: m.drug, subAreas: m.subAreas, congress: m.congress }))).filter(({ p }) => isSpecialtyLocal(area, p.sourceAreas ?? [])).sort((a2, b2) => (b2.p.likes ?? 0) - (a2.p.likes ?? 0));
      for (const { p: post, drug, subAreas, congress: congress2 } of postPool) {
        if (!threadEligible({ text: post.text ?? null, tweetUrl: post.tweetUrl ?? null })) continue;
        const tid = /\/status\/(\d+)/.exec(post.tweetUrl ?? "")?.[1] ?? post.tweetUrl;
        if (seenTweet.has(tid)) continue;
        seenTweet.add(tid);
        if (seenTweet.size > 4) break;
        const r = traceRank([{ input: "verifiedAuthor", value: 1 }, { input: "likesCapped", value: post.likes ?? 0 }]);
        const linksInPost = [.../* @__PURE__ */ new Set([
          ...post.sourceUrls ?? [],
          ...[...String(post.text ?? "").matchAll(/https?:\/\/\S+/g)].map((mm) => mm[0])
        ])];
        let amplifiers = 0;
        try {
          const { count } = await sb.from("x_posts_product").select("id", { count: "exact", head: true }).or(`rt_tweet_id.eq.${tid},quoted_tweet_id.eq.${tid}`);
          amplifiers = count ?? 0;
        } catch {
        }
        cands.push({
          id: `thread:${tid}`,
          kind: "thread",
          anchorId: tid,
          headline: cleanVerbatimExcerpt(truncateSentence((post.text ?? "").split(/\r?\n/)[0].replace(/[:\s]+$/, ""), 110)) ?? `${post.name} on X`,
          why: anchoredWhy("thread", `${post.likes ?? 0} likes`),
          sourceLabel: `${post.name}${post.handle ? ` (@${post.handle})` : ""} on X`,
          url: post.tweetUrl ?? null,
          excerpt: cleanVerbatimExcerpt(truncateSentence(post.text, 280)),
          excerptVerbatim: true,
          drugTags: [drug],
          subAreas,
          congress: congress2,
          nct: resolveTrialNct(post.text ?? "", readoutResolver, area, normalizeIdentity, { strictBareAlpha: true }),
          doi: null,
          eventId: null,
          siblings: [],
          rankTrace: r.trace,
          rankTotal: r.total,
          counts: {},
          poolMeta: { fullText: post.text ?? "", original: true, links: linksInPost, amplifiers }
        });
      }
      let anchoredDevelopment = null;
      try {
        anchoredDevelopment = await loadAnchoredDevelopmentCard(area, now, clinicianSourceIds, sourceByHandle);
        if (anchoredDevelopment) cands.push(anchoredDevelopment);
      } catch (e) {
        console.error("anchored development lane failed (brief ships without the optional seat)", area, e.message);
      }
      for (const c of cands) {
        if (!c.subAreas?.length) c.subAreas = subAreasOf(area, c.headline, c.excerpt, c.sourceLabel, ...c.drugTags);
        if (c.congress == null) c.congress = false;
      }
      const developmentCollapsed = collapseDevelopmentReceiptThreads(cands, anchoredDevelopment);
      const rankedPool = buildHeroCandidates(developmentCollapsed, Math.min(20, developmentCollapsed.length));
      const unpaddedPool = removeStandaloneThreadPadding(rankedPool.cards);
      const built = buildHeroCandidates(unpaddedPool, 5);
      const seated = seatAnchoredDevelopment(built.cards, anchoredDevelopment, 5);
      const editorialDeck = seated.cards;
      const receipts = editorialDeck.filter((c) => c.kind === "episode").flatMap((c) => epReceipts.get(c.anchorId) ?? []);
      heroCandidates = { cards: editorialDeck.map(({ poolMeta: _pm, ...c }) => c), tieCount: built.tieCount, receipts };
      const poolNow = new Date(deps.now()).toISOString();
      const poolWithShadow = cands;
      const heroPoolInsert = { area, generated_at: poolNow, pool: poolWithShadow, tie_count: heroCandidates.tieCount };
      effects.heroPoolInserts.push(heroPoolInsert);
      if (deps.effectsMode === "apply") {
        await sb.from("briefing_hero_pool").insert(heroPoolInsert).then(({ error }) => {
          if (error) console.error("hero pool write failed", area, error.message);
        });
      }
      const retentionStart = deps.effectsMode === "collect" ? 2 : 3;
      const retentionEnd = deps.effectsMode === "collect" ? 49 : 50;
      const { data: old } = await sb.from("briefing_hero_pool").select("generated_at").eq("area", area).order("generated_at", { ascending: false }).range(retentionStart, retentionEnd);
      const staleHeroPools = (old ?? []).map((row) => ({ area, generatedAt: row.generated_at }));
      effects.heroPoolDeletes.push(...staleHeroPools);
      if (deps.effectsMode === "apply") {
        for (const stale of staleHeroPools) await sb.from("briefing_hero_pool").delete().eq("area", stale.area).eq("generated_at", stale.generatedAt);
      }
    } catch (e) {
      console.error("heroCandidates assembly failed (promotion will refuse this build)", area, e.message);
    }
    return {
      area,
      areas: AREA_KEYS,
      windowDays: RECENT,
      generatedAt: new Date(deps.now()).toISOString(),
      // BUILD IDENTITY (Phase 3a): which code produced this snapshot. "created
      // after the deploy" proves nothing — a deploy ships the working tree, and on
      // 2026-08-02 that shipped a mid-refactor tree. sha="unstamped" means someone
      // deployed without scripts/deploy-briefing.sh; dirty=true means the deployed
      // tree had uncommitted changes. The acceptance gate checks all of this.
      build: { sha: deps.buildInfo.sha, dirty: deps.buildInfo.dirty, stampedAt: deps.buildInfo.stampedAt, featVersion: FEAT_VERSION, sourceRunId: opts?.sourceRunId ?? null },
      recap,
      headline,
      headlineStoryId,
      events,
      movers: topMovers,
      topKols,
      topArticles,
      trials,
      guests,
      hosts,
      episodes,
      topStories,
      topics,
      proseFp,
      readoutWatch,
      // registry-anchored anticipation rail (trial-stories Phase 1; additive-optional for clients)
      subAreas: subAreasCat,
      congress,
      heroCandidates
      // authoritative when the frozen build is promoted into hero mode
    };
  }
  return {
    weekOfMonday,
    async buildSpecialtyArea(area, opts) {
      const effects = { trialLedgerInserts: [], heroPoolInserts: [], heroPoolDeletes: [] };
      const data = await buildArea(area, opts, effects);
      return { data, effects };
    }
  };
}
export {
  collectInIdBatches,
  createSpecialtyBriefingBuilder,
  createSpecialtyRecap
};
