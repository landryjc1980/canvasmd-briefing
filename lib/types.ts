// Shapes shared between the API route handlers and the client components.
// These mirror the Supabase view/table columns confirmed in migrations
// 0067 (drugs), 0090 (voice/share rollups), 0104 (stance).

export type DrugListItem = {
  entity_id: string;
  canonical_name: string;
  kind: "drug" | "trial";
  brand_names: string[];
  tumor_categories: string[];
  total_voices: number;
  months_tracked: number;
  has_stance: boolean;
};

export type SourceKind = "podcast" | "x";

// One point in the share-of-voice chart: a month with podcast/x split, both in
// raw "voices" and normalized share-of-area (0..1) terms.
export type VoicePoint = {
  month: string; // YYYY-MM-DD (first of month)
  podcastVoices: number;
  xVoices: number;
  totalVoices: number;
  podcastShare: number | null; // share-of-area for the selected area
  xShare: number | null;
};

// One point in the stance chart.
export type StancePoint = {
  month: string;
  positive: number;
  neutral: number;
  skeptical: number;
  negative: number;
  classified: number;
  practiceChanging: number;
  netSentiment: number | null;
};

// One point in the discussion-depth series: podcast episodes that month split by
// whether the drug was substantively discussed vs only name-dropped.
export type DepthPoint = {
  month: string;
  substantive: number;
  incidental: number;
};

export type EvidenceItem = {
  occurred_at: string;
  source_kind: SourceKind;
  stance_valence: string;
  practice_signal: string;
  stance_axis: string[];
  disease_area: string[];
  quote: string | null; // VERBATIM source — tweet content or transcript snippet (never AI text)
  rationale: string | null; // the AI's "why this stance" read (was `evidence`)
  sourceUrl: string | null; // permalink to the tweet (X)
  audioUrl: string | null; // episode audio enclosure (podcast)
  startMs: number | null; // timestamp of the quoted moment, for seek-to-play
  episodeTitle: string | null;
  showName: string | null;
};

export type DrugOverview = {
  drug: {
    entity_id: string;
    canonical_name: string;
    generic_name: string | null;
    brand_names: string[];
    tumor_categories: string[];
    kind: "drug" | "trial";
  };
  stats: {
    totalVoices: number;
    monthsTracked: number;
    favorableShare: number | null; // 0..1 across all classified stance
    netSentiment: number | null; // -1..1 weighted across all classified
    practiceChanging: number;
    peakMonth: string | null;
    peakVoices: number;
  };
  areas: string[]; // tumor areas with share-of-voice data (for the normalize toggle)
  voiceSeries: VoicePoint[];
  stanceSeries: StancePoint[];
  evidence: EvidenceItem[];
  // Mention depth (podcast): how substantively the drug is discussed, not just how often named.
  depth: {
    primary: number; // a focus — a cluster of 3+ mentions within one episode
    secondary: number; // discussed briefly — a 2-mention cluster
    incidental: number; // name-drop only — singleton mentions
    substantiveEpisodes: number; // primary + secondary
    totalPodcastEpisodes: number;
    substantiveShare: number | null; // 0..1, or null if no podcast mentions
  };
  depthSeries: DepthPoint[];
  context: DrugContext; // company, regulatory, trials, top KOLs — everything links to evidence
};

// Cross-dimension context for a drug — ties the SoV/stance view to the company,
// the regulatory timeline, the discussed trials, and the doctors driving it.
export type DrugContext = {
  company: { id: string; name: string; role: string | null } | null;
  approvals: { title: string; on: string | null; company: string | null }[];
  trials: { nctId: string; acronym: string | null; title: string; phase: string | null; status: string | null }[];
  topKols: { id: string; name: string; specialty: string | null; institution: string | null; episodes: number }[];
};

// ---- Opinion evolution (stance over time) ----------------------------------
// One dated stance, scored -2..+2 (enthusiastic→negative), for a sparkline.
export type EvoPoint = { date: string; score: number };

// A KOL whose stance on a drug shifted meaningfully over time.
export type Mover = {
  personId: string;
  personName: string;
  specialty: string | null;
  drugId: string;
  drugName: string;
  drugKind: "drug" | "trial";
  fromLabel: string; // valence label of the early window
  toLabel: string; // valence label of the recent window
  shift: number; // recent − early, on the -4..+4 valence scale
  n: number; // # attributed stances backing the trajectory
  firstDate: string;
  lastDate: string;
  confidence: "x" | "single-guest" | "mixed"; // how the stance was attributed to this person
  points: EvoPoint[];
};

// A drug the whole field's stance moved on over time (field-level, no attribution needed).
export type DrugShift = {
  drugId: string;
  drugName: string;
  drugKind: "drug" | "trial";
  fromLabel: string;
  toLabel: string;
  shift: number;
  n: number; // # classified stances behind the trajectory
  firstDate: string;
  lastDate: string;
  points: EvoPoint[]; // monthly net stance, for the sparkline
};

// Field-level (all speakers) net stance for a drug in a month.
export type FieldEvoPoint = { month: string; net: number | null; n: number };

export type DrugEvolution = {
  drug: { entity_id: string; canonical_name: string; kind: "drug" | "trial" };
  field: FieldEvoPoint[]; // the whole field's net stance over time
  movers: Mover[]; // KOLs who shifted on this drug
};

// ---- Consensus & open questions --------------------------------------------
// One conversation backing a canonical question (for verbatim drill-down).
export type ConsensusConversation = {
  gloss: string | null; // AI one-sentence summary of what was discussed
  context: string; // the AI clinical-question tag
  drug: string | null;
  drugId: string | null; // links back to the Drug Overview hub
  episodeTitle: string | null;
  showName: string | null;
  date: string | null;
  audioUrl: string | null; // listen at the moment, reusing the Evidence Rail standard
  startMs: number | null;
};

// A canonical clinical question (a cluster of related conversation tags) + where
// the field is landing on it.
export type ConsensusQuestion = {
  id: string;
  area: string;
  label: string; // representative question text
  conversations: number;
  episodes: number;
  drugs: string[];
  firstDate: string | null;
  lastDate: string | null;
  status: "emerging-consensus" | "leaning" | "contested" | "early";
  netStance: number | null; // -2..+2 mean valence of the involved drugs in this area
  stanceN: number;
  glosses: string[]; // example AI summaries
  items: ConsensusConversation[]; // drill-down
};

export type ConsensusArea = {
  area: string;
  questions: ConsensusQuestion[];
};

// ---- KOL relationship network (the doctor map) -----------------------------
// Built from the public-safe people graph (v_public_person + person_appearances
// + v_public_person_topics). Nodes = doctors, links = co-appearance on the same
// episode. Associational only — "appears with" / "discusses", never attributive.
export type KolNode = {
  id: string;
  name: string;
  specialty: string | null;
  appearances: number; // node size
  topAreas: string[];
  drugCount: number;
};
export type KolLink = {
  source: string;
  target: string;
  weight: number; // shared episodes (edge thickness)
};
export type KolNetwork = {
  nodes: KolNode[];
  links: KolLink[];
  facets: { areas: string[]; drugs: string[]; shows: string[] };
  total: number; // matching doctors before the top-N cap
  shown: number;
};

export type PersonTopicRow = {
  canonical_name: string;
  kind: "drug" | "trial";
  episode_count: number;
  mention_count: number;
};
export type PersonEpisodeRow = {
  episode_title: string;
  show_title: string | null;
  published_at: string | null;
  role: string;
};
export type PersonDetail = {
  person: {
    person_id: string;
    display_name: string;
    specialty: string | null;
    institution: string | null;
    x_handle: string | null;
    appearance_count: number;
    category: string;
  };
  topics: PersonTopicRow[];
  episodes: PersonEpisodeRow[];
};

// ---- KOL intelligence (leaderboard + dossier) ------------------------------
export type Facets = {
  drugs: { name: string; kind: "drug" | "trial" }[];
  areas: string[];
};

// One row of the Top-Voices / Speaker leaderboard.
export type LeaderboardRow = {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  onTopicEpisodes: number; // episodes on the selected drug/area (= totalEpisodes when mode=all)
  onTopicMentions: number;
  totalEpisodes: number; // overall appearances
  lastActive: string | null; // YYYY-MM-DD of most recent episode
  recent: number; // episodes in the last 180 days
  influence: number; // "invited as the expert" score — default rank for All voices
  invited: number; // times a guest (invited expert), the core of influence
  xRecent: number; // posts on their linked X account in the last 180 days
};
export type LeaderboardResult = {
  mode: "drug" | "area" | "all";
  value: string | null;
  sort: "influence" | "volume" | "recent";
  rows: LeaderboardRow[];
  total: number; // matching doctors before the limit
};

// "Who looks like Dr. X" — a similar doctor + why.
export type LookalikeRow = {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  score: number; // 0..1
  sharedDrugs: string[];
  sharedAreas: string[];
  sharedShows: string[];
  coAppearances: number;
};

export type DossierTopic = { id: string; name: string; kind: "drug" | "trial"; episodes: number; mentions: number };
export type DossierShow = { name: string; episodes: number };
export type EgoNode = { id: string; name: string; specialty: string | null; appearances: number };
export type EgoLink = { source: string; target: string; weight: number };
export type DossierEpisode = {
  episodeId: string | null;
  title: string;
  show: string | null;
  date: string | null;
  role: string;
  audioUrl: string | null; // listenable in place — no dead-end captions
};

// A person's stance on one drug — attributed via X-authorship or single-guest
// episodes (the "Where they stand" panel). Sparse but high-confidence.
export type PersonDrugStance = {
  drugId: string;
  drugName: string;
  kind: "drug" | "trial";
  n: number; // # attributed substantive stances
  nPosts: number; // of n, how many are the person's own X posts (their words)
  nEpisodes: number; // of n, how many are episode-level (a show they guested on)
  basis: "posts" | "episodes" | "mixed"; // what the label actually rests on
  score: number; // mean valence, -2..+2
  label: string; // Champion | Positive | Mixed | Skeptical | Negative
  tone: "champion" | "positive" | "neutral" | "negative"; // for coloring
  practiceChanging: boolean;
  trend: "cooling" | "warming" | null;
};

export type KolDossier = {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  institutionAsOf: number | null;
  xHandle: string | null;
  totalEpisodes: number;
  lastActive: string | null;
  recent: number;
  topAreas: string[];
  topics: DossierTopic[];
  shows: DossierShow[];
  lookalikes: LookalikeRow[];
  ego: { nodes: EgoNode[]; links: EgoLink[] };
  recentEpisodes: DossierEpisode[];
  stance: PersonDrugStance[]; // "Where they stand" — per-drug attributed stance
  payments: KolPayments | null; // CMS Open Payments (industry $), with a paid-vs-organic COI lens
};

// CMS Open Payments for a doctor — industry money received, and the med-affairs
// conflict lens: which drugs they discuss on-air are marketed by a paying sponsor.
export type KolPayments = {
  npi: string | null;
  totalReceived: number;
  years: number[];
  distinctCompanies: number;
  totalPayments: number; // # of payment records
  byCompany: {
    companyId: string | null;
    company: string; // canonical company name (or manufacturer_raw fallback)
    total: number;
    count: number;
    kinds: string[]; // e.g. consulting, speaking, research
    matched: boolean; // company_id resolved to an onc company we track
  }[];
  // paid-vs-organic: drugs this KOL discusses on-air that a paying sponsor markets
  conflicts: { company: string; drugs: { id: string; name: string }[] }[];
};

// ---- "What changed" brief (30d vs prior 30d) --------------------------------
export type BriefSovMover = {
  drugId: string;
  drugName: string;
  kind: "drug" | "trial";
  current: number; // podcast mentions, last 30d
  previous: number; // podcast mentions, the 30d before
  delta: number;
};
export type BriefStanceShift = {
  drugId: string;
  drugName: string;
  kind: "drug" | "trial";
  from: number; // mean valence, prior window (-2..+2)
  to: number; // mean valence, last 30d
  shift: number;
  n: number; // classified stances across both windows
};
export type BriefRisingVoice = {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  recent: number; // episodes last 180d
  total: number; // career episodes
};
export type BriefData = {
  windowDays: number;
  generatedAt: string;
  coverage: { episodesInWindow: number };
  sovMovers: BriefSovMover[];
  stanceShifts: BriefStanceShift[];
  kolMovers: Mover[];
  rising: BriefRisingVoice[];
};

export type PersonSearchRow = {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  totalEpisodes: number;
};

// ---- Reading dashboard: journal leaderboard + shared-article intelligence --
export type JournalLeaderboardRow = {
  source: string; // raw key (journal name, or domain when journal is unattributed) — used to drill in
  displayName: string; // human-facing name (raw domains prettified, journals passed through)
  articles: number;
  shares: number;
  physicians: number;
  lastShared: string | null;
};
// One article under a source, for the expandable leaderboard drill-down.
export type SourceArticle = {
  id: string;
  title: string;
  url: string;
  sharers: number; // distinct KOL accounts that shared it
  sharerList: ArticleSharer[]; // WHO shared it (most recent first)
  tumorCategories: string[];
  lastShared: string | null;
};
export type ArticleSharer = {
  name: string | null;
  handle: string | null; // x handle, no leading @
  avatar: string | null;
};
export type TopSharedArticle = {
  id: string;
  title: string;
  url: string; // canonical (tracking params stripped)
  domain: string;
  journal: string | null; // true journal name (0145), null for trade press
  tumorCategories: string[];
  sharers: number; // distinct KOL accounts that shared it
  lastShared: string;
};
// One article in the live feed, with the physicians who shared it.
export type RecentDoctorShare = {
  articleId: string;
  title: string;
  url: string;
  domain: string;
  journal: string | null;
  sharedBy: string[]; // up to 3 physician names, most recent first
  lastShared: string;
};
export type ReadingData = {
  windowDays: number | null; // null = all-time (the leaderboard/top-shared default)
  latestWindowDays: number; // the live feed always has a window (default 30)
  journals: JournalLeaderboardRow[];
  topShared: TopSharedArticle[];
  recentShares: RecentDoctorShare[];
};

// ---- Weekly Briefing (per tumor area) ----------------------------------------
// The clinician-facing "what moved this week in {area}" digest: top papers with
// the verified oncologists who shared them (+ their X engagement), the loudest
// individual tweets, and the area's recent podcast episodes. Every figure is a
// real, linkable source.
// v2 "The Movers": the atom is the DRUG, not the paper. Each mover fuses two
// independent signals — how substantively KOLs discussed it on PODCASTS
// (mention_conversations glosses) and how loudly clinicians shared its papers on
// X — into one ranked "what's moving this week" spine, with a regulatory rail on
// top and a two-column receipts drawer (what was said + the papers shared).
export type BriefingSharer = {
  name: string;
  handle: string | null;
  avatar: string | null; // real X profile image (pbs.twimg.com), initials fallback
  tweetUrl: string | null;
  text: string | null;
  likes: number;
  retweets: number;
  views: number;
};
// One journal paper about a mover drug, with the verified oncologists who shared it.
export type BriefingPaper = {
  title: string;
  url: string;
  journal: string | null;
  abstract: string | null; // PubMed abstract (structured sections joined), for the expandable read
  sharers: BriefingSharer[];
  topLikes: number;
  posts?: BriefingSharer[]; // the clinicians' actual tweets about the paper (expandable "what they said")
  publishers?: string[]; // institutional/journal/news accounts that posted it (the "via" badge)
};
// One podcast conversation about a mover drug — the AI gloss of what was SAID,
// seekable to the moment.
export type BriefingPod = {
  gloss: string;
  mentionCount: number;
  startMs: number | null;
  episodeId: string; // real episodes.id UUID — used to count distinct episodes ("N conversations")
  episodeTitle: string;
  show: string;
  showArt: string | null; // podcast show artwork, shown next to the clip
  audioUrl: string | null;
  publishedAt: string;
};
// A regulatory-rail line (FDA approval / trial readout / congress).
export type BriefingEvent = {
  type: string; // drug_approval | trial_results_posted | trial_status_change | meeting_window
  title: string;
  drug: string | null;
  company: string | null;
  occurredOn: string | null;
  ahead: boolean; // true = upcoming congress, false = already happened
  drugId: string | null; // anchors a jump to the mover row
};
export type BriefingMover = {
  drugId: string;
  drug: string; // canonical name
  brand: string | null;
  company: string | null;
  score: number;
  signalShape: "both" | "pods" | "x" | "regulatory";
  delta: number; // momentum: this week's total activity (convos + X + papers) minus the prior 2 weeks' (▲/▼)
  podConvs: number; // intra-episode SEGMENTS (depth) — not the headline count
  podEpisodes: number; // distinct EPISODES = the honest "N conversations" count
  podShows: number; // distinct shows across those episodes (breadth)
  xSharers: number; // distinct this-week clinician sharers (tweet takes)
  articleCount: number; // distinct shared journal articles about this drug (title+abstract match)
  podPct: number; // 0..100 podcast share of the 3-way signal bar
  xPct: number; // 0..100 X share
  articlePct: number; // 0..100 article share
  topLikes: number;
  why: string | null; // the single highest-mention gloss, verbatim (the row's one-liner)
  eventChip: string | null; // e.g. "FDA approval · 3d ago"
  stanceChip: string | null; // only when clearly practice-changing/favorable
  avatars: string[]; // up to 4 X sharer avatar urls for the collapsed row
  showArt: string[]; // up to 4 podcast show artwork urls (fills the pile when X is sparse)
  shows: string[]; // up to 3 podcast show names for the collapsed row
  posts: BriefingSharer[]; // drawer: the KOL tweets that named this drug (their takes)
  papers: BriefingPaper[]; // drawer: journal papers a KOL shared while naming this drug
  podcast: BriefingPod[]; // drawer: podcast evidence
};
// A clinician driving the week's conversation on X (the "Most active" people lens).
export type BriefingKol = {
  name: string;
  handle: string | null;
  avatar: string | null;
  institution: string | null; // primary institution (Dana-Farber…) — the "who are they at?" answer
  tweets: number; // count of their in-area tweets this window
  drugs: string[]; // distinct drugs they discussed (up to a few)
  peakLikes: number;
  posts: BriefingSharer[]; // their actual tweets (for the expandable card)
  articles: { title: string; url: string; journal: string | null }[]; // articles they shared
};
// A journal article the field shared this week (the "what's being read" lens — includes
// the many papers whose titles never name a drug, so they're invisible in the drug spine).
export type BriefingArticle = {
  title: string;
  url: string;
  journal: string | null;
  domain: string | null;
  abstract: string | null; // PubMed abstract, for the expandable read
  sharers: number; // distinct accounts total (KOL + publisher)
  kolSharers: number; // distinct KOL (verified-clinician) accounts that shared it
  publishers: string[]; // institutional/journal/news accounts that posted it (OncLive, NEJM…) — the "via" badge
  faces: string[]; // up to 5 KOL sharer avatar urls
  topLikes: number;
  posts: BriefingSharer[]; // the actual tweets the KOLs posted about this paper (expandable)
};
// A clinical trial the field is TALKING ABOUT this week — matched by acronym against
// podcast conversations, KOL tweets and shared-article title/abstracts (not the raw
// CT.gov update feed). Enriched with CT.gov metadata for the card.
export type BriefingTrial = {
  nctId: string;
  acronym: string | null;
  title: string;
  phase: string | null;
  status: string | null;
  sponsor: string | null;
  interventions: string[]; // the drug/intervention names
  podMentions: number; // distinct podcast conversations naming it this week
  xMentions: number; // distinct KOL tweets naming it
  articleMentions: number; // distinct shared articles naming it (title/abstract)
  totalMentions: number;
  resultsFresh: boolean; // results posted in the last ~120d (a real readout)
  pods: BriefingPod[]; // the podcast conversations that named it (clip + listen)
  posts: BriefingSharer[]; // the tweets that named it
  articles: BriefingPaper[]; // the papers that named it (title/abstract)
  url: string; // clinicaltrials.gov permalink
};
// ---- Unified evidence (drug OR trial) — who/what discusses it ---------------
export type EvidencePod = {
  episodeId: string;
  episodeTitle: string;
  show: string | null;
  showArt: string | null;
  audioUrl: string | null;
  startMs: number | null;
  gloss: string;
  date: string | null;
};
export type EvidencePost = {
  handle: string | null;
  name: string;
  avatar: string | null;
  text: string | null;
  url: string | null;
  date: string | null;
  valence: string | null; // stance valence (favorable/skeptical/…) when classified
};
export type EvidenceArticle = {
  id: string;
  title: string;
  url: string;
  journal: string | null;
  abstract: string | null;
  date: string | null;
  sharers: { name: string; handle: string | null }[];
};
export type EvidenceKol = {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  episodes: number;
};
export type EntityEvidence = {
  entityId: string;
  name: string;
  kind: "drug" | "trial";
  windowDays: number | null;
  focusPerson: { id: string; name: string } | null; // set when drilled into one KOL
  counts: { podcasts: number; posts: number; articles: number; kols: number };
  podcasts: EvidencePod[];
  posts: EvidencePost[];
  articles: EvidenceArticle[];
  kols: EvidenceKol[];
};

// ---- Companies surface ------------------------------------------------------
export type CompanyListItem = {
  id: string;
  name: string;
  ticker: string | null;
  hqCountry: string | null;
  drugCount: number;
  trialCount: number;
  approvals: number; // FDA events tied to the company
  paidKols: number; // distinct doctors they paid (Open Payments)
};
export type CompanyDrug = {
  entityId: string;
  name: string;
  brands: string[];
  areas: string[];
  role: string | null; // marketer | originator | ...
  isPrimary: boolean;
  voices: number; // total distinct voices (podcast+X) all-time — portfolio weight
};
export type CompanyTrial = {
  nctId: string;
  acronym: string | null;
  title: string;
  phase: string | null;
  status: string | null;
  inCorpus: boolean;
};
export type CompanyEvent = { type: string; title: string; on: string | null; drug: string | null; drugId: string | null };
export type CompanyPaidKol = {
  personId: string;
  name: string;
  total: number;
  inGraph: boolean; // linkable to a dossier
  specialty: string | null;
};
export type CompanyDetail = {
  id: string;
  name: string;
  ticker: string | null;
  hqCountry: string | null;
  aliases: string[];
  drugCount: number;
  trialCount: number;
  totalPaid: number; // Σ Open Payments from this company to tracked doctors
  paidKolCount: number;
  drugs: CompanyDrug[];
  trials: CompanyTrial[];
  events: CompanyEvent[];
  paidKols: CompanyPaidKol[];
};

// ---- Trials (CT.gov) surface ------------------------------------------------
export type TrialListItem = {
  nctId: string;
  acronym: string | null;
  title: string;
  phase: string | null;
  status: string | null;
  sponsor: string | null;
  company: string | null;
  companyId: string | null;
  areas: string[];
  interventions: string[]; // drug/intervention names
  enrollment: number | null;
  hasResults: boolean;
  inCorpus: boolean; // the field actually discusses this one
  primaryCompletion: string | null;
  lastUpdate: string | null;
};
export type TrialDrugLink = { name: string; entityId: string | null }; // links to /?drug= when we track it
export type TrialDiscussant = {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  episodes: number;
};
export type TrialDetail = {
  nctId: string;
  acronym: string | null;
  title: string;
  phase: string | null;
  status: string | null;
  whyStopped: string | null;
  studyType: string | null;
  conditions: string[];
  interventions: TrialDrugLink[];
  sponsor: string | null;
  sponsorClass: string | null;
  company: string | null;
  companyId: string | null;
  collaborators: string[];
  enrollment: number | null;
  startDate: string | null;
  primaryCompletion: string | null;
  completionDate: string | null;
  resultsPosted: string | null;
  hasResults: boolean;
  areas: string[];
  inCorpus: boolean;
  entityId: string | null; // drugs-table trial entity (when the field discusses it)
  discussants: TrialDiscussant[]; // KOLs who discuss this trial on-air
  url: string; // clinicaltrials.gov permalink
};

// A TOPIC atom — a cluster of this-area papers/discussion on a subtype, biomarker, or
// procedure that names no single tracked drug (the non-drug depth the drug-mover threshold
// hides: colorectal, ctDNA, CAR-T…). Area-precedence + peer-vetted (verified physician) gated.
export type BriefingTopic = {
  key: string;
  label: string; // "Colorectal cancer"
  paperCount: number;
  doctorCount: number; // distinct verified clinicians who shared its papers
  topLikes: number;
  why: string | null; // AI takeaway (the theme the field engaged with)
  papers: BriefingPaper[];
  posts: BriefingSharer[];
  podcast: BriefingPod[];
};
// An atom-agnostic STORY — the best thing happening this week whether its atom is a DRUG
// (reuse the mover), a highly-shared PAPER, or a TOPIC cluster. Same card shell as the drug
// card (headline → description → metric line → one lead evidence → see all); only the metric
// line + lead evidence adapt by `kind`.
export type BriefingStory = {
  kind: "drug" | "paper" | "topic";
  id: string; // drugId | paper:<key> | topic:<key>
  headline: string;
  subtitle: string | null; // drug: "brand · company"; paper: journal/domain; topic: "N papers · M doctors"
  description: string | null; // AI why/takeaway
  score: number | null; // drug only (the area-relative fusion score)
  delta: number; // drug momentum (0 otherwise)
  bar: [number, number, number] | null; // drug 3-channel signal bar [pod%, x%, article%]
  podConvs: number; // intra-episode SEGMENTS (depth)
  podEpisodes: number; // distinct EPISODES = the honest "N conversations" count
  podShows: number; // distinct shows across those episodes
  xSharers: number;
  articleCount: number; // drug: papers; topic: papers in the cluster
  clinicianCount: number; // paper: distinct clinicians who shared; topic: distinct doctors
  topLikes: number;
  podcast: BriefingPod[]; // evidence — the web derives the ONE lead card from these; sheet shows all
  posts: BriefingSharer[];
  papers: BriefingPaper[];
  drugId: string | null; // drug stories → the Drugs board row
  fp?: string; // evidence fingerprint (identities only) — powers "Since your last read" NEW/UPDATED
};

export type BriefingData = {
  area: string;
  areas: string[]; // switcher options
  windowDays: number;
  generatedAt: string;
  recap: string | null; // editorial "the week in a sentence" (AI, grounded in movers + events)
  headline: string | null; // short 3-6 word editorial cover line (AI)
  events: BriefingEvent[]; // regulatory rail (approvals)
  movers: BriefingMover[]; // the ranked drug spine (the "Drugs" tab)
  topKols: BriefingKol[]; // "Most active on X" section
  topArticles: BriefingArticle[]; // "What the field is reading" section
  trials: BriefingTrial[]; // "Trials moving" section (CT.gov)
  topStories?: BriefingStory[]; // ADDITIVE — the atom-agnostic hero (optional: old snapshots omit it)
  topics?: BriefingTopic[]; // ADDITIVE — the topic atoms
  proseFp?: string; // ADDITIVE — area-level evidence fingerprint (prose stability)
};

// Per-reader seen-state for "Since your last read": storyId -> the evidence fingerprint that
// was on the story when the reader last actually viewed it (screen shown / scrolled into view).
export type SeenMap = Record<string, string>;
