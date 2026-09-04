import { prisma } from "./prisma";
import {
  computeCriterionAverage,
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
  /** Portrait servi par ce serveur, ou `null` — la courbe affiche alors l'initiale. */
  photoUrl: string | null;
  /**
   * Nombre de personnes ayant voté pour ce candidat, non pondéré.
   *
   * Affiché à titre indicatif à côté de la note : il dit combien de jurés se
   * sont prononcés, ce que la moyenne seule ne révèle pas. Ce n'est jamais lui
   * qui classe — deux candidats notés par 5 et par 18 restent comparables,
   * c'est tout l'objet de la pondération.
   */
  votes: number;
  /**
   * Moyenne par critère, sur 10, à l'instant présent.
   *
   * Affichée sous la note globale : elle dit *pourquoi* un candidat est là où
   * il est — excellent en goût, faible en présentation — ce que la moyenne
   * seule masque.
   */
  byCriterion: { name: string; average: number | null }[];
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
  /**
   * Votes attendus sur tout le concours : jurés attendus × candidats.
   *
   * C'est lui qui fixe la largeur de la courbe, et non le nombre de votes
   * reçus. Sans ça la courbe serait toujours pleine, et l'on ne verrait jamais
   * où en est le scrutin — un vote sur cent occuperait l'écran entier.
   */
  expectedVotes: number;
}

/**
 * Palette de la courbe, fixe et volontairement indépendante du thème du
 * dashboard : l'écran temps réel est le même en salle qu'au bureau, et deux
 * candidats ne doivent jamais échanger leur couleur d'un affichage à l'autre.
 *
 * L'ordre est fixe et jamais recyclé : la couleur suit le candidat, pas son
 * rang, sinon un dépassement repeindrait toute la courbe.
 *
 * Les teintes sont calibrées pour le fond sombre de la page et validées :
 * bande de luminosité, chroma, contraste, et séparation entre teintes voisines
 * pour les daltonismes deutan, protan et tritan. Les remplacer sans revalider
 * peut rendre deux candidats indiscernables.
 */
const SERIES_COLORS = [
  "#ea580c",
  "#3b82f6",
  "#16a34a",
  "#d946ef",
  "#d97706",
  "#0891b2",
  "#f43f5e",
  "#8b5cf6",
  "#0d9488",
  "#b45309",
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
  const [candidates, criteria, votes, session, tables] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.vote.findMany({
      include: { scores: true, table: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.session.findUnique({ where: { id: "singleton" } }),
    prisma.votingTable.findMany({ select: { expectedJurors: true } }),
  ]);

  // Chaque juré note chaque candidat : le total attendu est le produit des
  // deux. Il sert de repère à la courbe, jamais au calcul des notes.
  const expectedVotes =
    tables.reduce((sum, table) => sum + table.expectedJurors, 0) * candidates.length;

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
    photoUrl: candidate.photoUrl,
    votes: 0,
    byCriterion: criteria.map((criterion) => ({ name: criterion.name, average: null })),
  }));
  const positionById = new Map(series.map((candidate, i) => [candidate.id, i]));

  // Cumuls courants : la moyenne se recalcule en O(1) par vote, plutôt que de
  // reparcourir tout l'historique à chaque point.
  const weightedSum = new Array(series.length).fill(0);
  const weightTotal = new Array(series.length).fill(0);

  // Votes conservés par candidat : ils servent au détail par critère, calculé
  // une fois à la fin plutôt qu'à chaque point — seul l'état présent est montré.
  const votesByCandidate: ScoredVote[][] = series.map(() => []);

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
    series[position].votes += 1;
    votesByCandidate[position].push(scoredVote);

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

  series.forEach((candidate, position) => {
    candidate.byCriterion = criteria.map((criterion) => {
      const average = computeCriterionAverage(votesByCandidate[position], criterion.id, weights);
      return { name: criterion.name, average: average === null ? null : round2(average) };
    });
  });

  return { candidates: series, maxTotal, points, totalVotes: index, expectedVotes };
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
