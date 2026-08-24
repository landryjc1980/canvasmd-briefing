import type {
  BriefingData,
  BriefingMover,
  BriefingTrial,
} from "@/lib/types";

export const SIGNAL_AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"] as const;

export type SignalState = "practice-shift" | "debate" | "breakout" | "early" | "active";

export type SignalReceipt = {
  id: string;
  kind: "x" | "podcast" | "paper";
  title: string;
  body: string;
  url: string | null;
  occurredAt: string | null;
  valence: string | null;
  verbatim: boolean;
};

export type SignalPeer = {
  area: string;
  delta: number;
  state: SignalState;
};

export type OncologySignal = {
  id: string;
  area: string;
  areaHeadline: string | null;
  mover: BriefingMover;
  state: SignalState;
  debated: boolean;
  practiceChanging: boolean;
  priority: number;
  channelCount: number;
  receipts: SignalReceipt[];
  trials: BriefingTrial[];
  peers: SignalPeer[];
};

const normal = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const identityFor = (mover: BriefingMover) => mover.drugId || normal(mover.drug);

const isDebated = (mover: BriefingMover) => {
  const stance = mover.stance;
  if (!stance || stance.total < 4) return false;
  const directional = stance.favorable + stance.skeptical;
  if (directional === 0) return false;
  return (
    stance.favorable >= 2 &&
    stance.skeptical >= 1 &&
    stance.favorable / directional >= 0.2 &&
    stance.skeptical / directional >= 0.18
  );
};

const stateFor = (mover: BriefingMover): SignalState => {
  if (isDebated(mover)) return "debate";
  if (mover.stance?.practiceChanging && mover.stance.total >= 4) return "practice-shift";

  const activity = mover.podEpisodes + mover.xSharers + mover.articleCount;
  if (mover.delta >= 5 && activity >= 5) return "breakout";
  if (mover.xSharers >= 5 && mover.podEpisodes === 0 && mover.articleCount <= 1) return "early";
  return "active";
};

const priorityFor = (mover: BriefingMover) => {
  const stance = mover.stance;
  const channels = [mover.podEpisodes, mover.xSharers, mover.articleCount].filter((count) => count > 0).length;
  return (
    mover.delta * 1.25 +
    Math.min(mover.xSharers, 40) * 1.2 +
    mover.podEpisodes * 4 +
    mover.articleCount * 5 +
    Math.min(mover.topLikes / 25, 15) +
    (stance?.total ?? 0) * 1.1 +
    (stance?.practiceChanging ? 10 : 0) +
    (isDebated(mover) ? 7 : 0) +
    channels * 2
  );
};

const addReceipt = (
  receipts: SignalReceipt[],
  seen: Set<string>,
  receipt: Omit<SignalReceipt, "id">
) => {
  const fingerprint = receipt.url || `${receipt.kind}:${receipt.title}:${receipt.body}`;
  if (seen.has(fingerprint)) return;
  seen.add(fingerprint);
  receipts.push({ ...receipt, id: fingerprint });
};

const receiptsFor = (mover: BriefingMover): SignalReceipt[] => {
  const receipts: SignalReceipt[] = [];
  const seen = new Set<string>();

  for (const take of mover.stance?.takes ?? []) {
    addReceipt(receipts, seen, {
      kind: take.sourceType,
      title: take.sourceLabel,
      body: take.text,
      url: take.url,
      occurredAt: take.occurredAt,
      valence: take.valence,
      verbatim: take.verbatim,
    });
  }

  for (const post of [...mover.posts].sort((a, b) => b.likes - a.likes)) {
    if (!post.text) continue;
    addReceipt(receipts, seen, {
      kind: "x",
      title: post.handle ? `${post.name} (@${post.handle})` : post.name,
      body: post.textEn || post.text,
      url: post.tweetUrl,
      occurredAt: null,
      valence: null,
      verbatim: true,
    });
  }

  for (const pod of mover.podcast) {
    addReceipt(receipts, seen, {
      kind: "podcast",
      title: `${pod.show}: ${pod.episodeTitle}`,
      body: pod.gloss,
      url: pod.sourceUrl || pod.audioUrl,
      occurredAt: pod.publishedAt,
      valence: null,
      verbatim: false,
    });
  }

  for (const paper of mover.papers) {
    addReceipt(receipts, seen, {
      kind: "paper",
      title: paper.title,
      body: paper.journal || paper.domain || "Published evidence",
      url: paper.url,
      occurredAt: null,
      valence: null,
      verbatim: false,
    });
  }

  return receipts.slice(0, 12);
};

const matchingTrials = (briefing: BriefingData, mover: BriefingMover) => {
  const names = [mover.drug, mover.brand]
    .map(normal)
    .filter((name) => name.length >= 5);
  if (names.length === 0) return [];

  return briefing.trials
    .filter((trial) =>
      trial.interventions.some((intervention) => {
        const candidate = normal(intervention);
        return names.some((name) => candidate.includes(name) || name.includes(candidate));
      })
    )
    .sort((a, b) => b.totalMentions - a.totalMentions)
    .slice(0, 3);
};

export function buildSignals(briefings: BriefingData[]): OncologySignal[] {
  const signals = briefings.flatMap((briefing) =>
    briefing.movers.map((mover): OncologySignal => ({
      id: `${briefing.area}:${identityFor(mover)}`,
      area: briefing.area,
      areaHeadline: briefing.headline,
      mover,
      state: stateFor(mover),
      debated: isDebated(mover),
      practiceChanging: Boolean(mover.stance?.practiceChanging),
      priority: priorityFor(mover),
      channelCount: [mover.podEpisodes, mover.xSharers, mover.articleCount].filter((count) => count > 0).length,
      receipts: receiptsFor(mover),
      trials: matchingTrials(briefing, mover),
      peers: [],
    }))
  );

  const byDrug = new Map<string, OncologySignal[]>();
  for (const signal of signals) {
    const identity = identityFor(signal.mover);
    byDrug.set(identity, [...(byDrug.get(identity) ?? []), signal]);
  }

  for (const signal of signals) {
    signal.peers = (byDrug.get(identityFor(signal.mover)) ?? [])
      .filter((peer) => peer.id !== signal.id)
      .map((peer) => ({ area: peer.area, delta: peer.mover.delta, state: peer.state }))
      .sort((a, b) => b.delta - a.delta);
  }

  return signals.sort((a, b) => b.priority - a.priority || b.mover.score - a.mover.score);
}

export const SIGNAL_STATE_LABELS: Record<SignalState, string> = {
  "practice-shift": "Practice signal",
  debate: "Debate",
  breakout: "Breakout",
  early: "Early signal",
  active: "Active",
};
