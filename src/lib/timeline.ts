import { prisma } from "./prisma";
import {
  maxTotalForCriteria,
  voteTotal,
  weightForTableType,
  round2,
  type ScoredVote,
  type TableType,
  type WeightsByType,
} from "./scoring";

/** Un candidat suivi par la courbe, avec la couleur qui lui est réservée. */
export interface TimelineCandidate {
  id: string;
  name: string;
  color: string;
}

/**
 * L'état du classement après le n-ième vote reçu.
 *
 * `scores` suit l'ordre de `candidates` : `null` tant qu'un candidat n'a reçu
 * aucun vote — il n'est alors pas encore noté, et sa courbe ne commence pas.
 */
export interface TimelinePoint {
  /** Rang chronologique du vote, à partir de 1. */
  index: number;
  /** Horodatage du vote, en ISO 8601. */
  at: string;
  scores: (number | null)[];
  /** Rang de chaque candidat à cet instant, `null` s'il n'est pas encore noté. */
  ranks: (number | null)[];
}

export interface TimelinePayload {
  candidates: TimelineCandidate[];
  /** Total maximal d'un vote — le haut de l'axe vertical. */
  maxTotal: number;
  points: TimelinePoint[];
  totalVotes: number;
}

/**
 * Palette de la courbe, fixe et volontairement indépendante du thème du
 * dashboard : l'écran temps réel est le même en salle qu'au bureau, et deux
 * candidats ne doivent jamais échanger leur couleur d'un affichage à l'autre.
 * Les teintes sont assez foncées pour se lire sur le fond clair de la page.
 */
const SERIES_COLORS = [
  "#c2410c",
  "#1d4ed8",
  "#15803d",
  "#a21caf",
  "#b45309",
  "#0e7490",
  "#be123c",
  "#4d7c0f",
  "#6d28d9",
  "#0f766e",
];

/**
 * Reconstitue l'évolution du classement, vote après vote.
 *
 * Le principe : les votes sont relus dans l'ordre où les jurés les ont saisis,
 * et la moyenne pondérée de chaque candidat est recalculée après chacun d'eux —
 * exactement la formule du classement final, appliquée à un sous-ensemble qui
 * grandit. La dernière colonne de la courbe est donc toujours identique au
 * palmarès affiché sur la page Résultats ; il n'y a pas deux calculs.
 *
 * L'ordre est celui de `createdAt`, l'heure de saisie sur la tablette, et non
 * celui de la synchronisation : une tablette qui remonte en retard un lot de
 * votes ne doit pas faire bondir sa table à la fin de la courbe.
 */
export async function computeTimeline(): Promise<TimelinePayload> {
  const [candidates, criteria, votes, session] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.vote.findMany({
      include: { scores: true, table: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.session.findUnique({ where: { id: "singleton" } }),
  ]);

  const weights: WeightsByType = {
    LAMBDA: session?.weightPublic ?? 1,
    SPECIAL: session?.weightSpecial ?? 2,
  };
  const scoreMax = session?.scoreMax ?? 5;
  const criterionIds = criteria.map((criterion) => criterion.id);
  const maxTotal = maxTotalForCriteria(criteria.length, scoreMax);

  const series: TimelineCandidate[] = candidates.map((candidate, i) => ({
    id: candidate.id,
    name: candidate.name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
  }));
  const positionById = new Map(series.map((candidate, i) => [candidate.id, i]));

  // Cumuls courants : la moyenne se recalcule en O(1) par vote, plutôt que de
  // reparcourir tout l'historique à chaque point.
  const weightedSum = new Array(series.length).fill(0);
  const weightTotal = new Array(series.length).fill(0);

  const points: TimelinePoint[] = [];
  let index = 0;

  for (const vote of votes) {
    const position = positionById.get(vote.candidateId);
    // Un vote pour un candidat supprimé depuis : il ne fausse rien, il n'a
    // simplement plus de courbe où aller.
    if (position === undefined) continue;

    const scores: Record<string, number> = {};
    for (const score of vote.scores) {
      scores[score.criterionId] = score.rawValue;
    }
    const scoredVote: ScoredVote = { tableType: vote.table.type as TableType, scores };
    const weight = weightForTableType(scoredVote.tableType, weights);

    weightedSum[position] += voteTotal(scoredVote, criterionIds) * weight;
    weightTotal[position] += weight;

    index += 1;
    const current = series.map((_, i) =>
      weightTotal[i] === 0 ? null : round2(weightedSum[i] / weightTotal[i]),
    );

    points.push({
      index,
      at: vote.createdAt.toISOString(),
      scores: current,
      ranks: ranksOf(current),
    });
  }

  return { candidates: series, maxTotal, points, totalVotes: index };
}

/**
 * Rangs à un instant donné, à égalité partagée : deux candidats à la même note
 * portent le même rang, et le suivant saute d'autant. C'est la règle du
 * classement final, reprise ici pour que les deux affichages ne se contredisent
 * jamais.
 */
function ranksOf(scores: (number | null)[]): (number | null)[] {
  const ordered = scores
    .map((score, i) => ({ score, i }))
    .filter((entry): entry is { score: number; i: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score);

  const ranks: (number | null)[] = scores.map(() => null);
  let rank = 0;
  let previous: number | null = null;

  ordered.forEach((entry, position) => {
    if (previous === null || entry.score !== previous) rank = position + 1;
    previous = entry.score;
    ranks[entry.i] = rank;
  });

  return ranks;
}
