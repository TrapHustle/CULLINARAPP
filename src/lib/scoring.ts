/**
 * Moteur de calcul des notes — cœur métier de l'application.
 *
 * Toutes les fonctions de ce module sont **pures** : aucune dépendance à la base
 * de données, aucun effet de bord. Elles sont couvertes par `scoring.test.ts`,
 * qui reprend l'exemple chiffré et le contre-exemple du §4.3 du cahier des charges.
 *
 * Règles implémentées ici :
 *  - une note brute va de 1 à 5, et vaut 0 si le critère n'a pas été noté (§11) ;
 *  - chaque note brute est multipliée par 2 pour donner une note /10 (§4.1) ;
 *  - un vote issu de la table spéciale pèse double (§4.2) ;
 *  - la moyenne d'un candidat est pondérée **par votant**, jamais par somme
 *    brute, afin qu'un candidat noté par 18 personnes ne soit ni avantagé ni
 *    désavantagé face à un candidat noté par 13 personnes (§4.3).
 */

export type TableType = "LAMBDA" | "SPECIAL";

/** Note brute minimale sélectionnable par un juré. */
export const RAW_MIN = 1;
/** Note brute maximale sélectionnable par un juré. */
export const RAW_MAX = 5;
/** Valeur enregistrée pour un critère laissé vide à l'expiration du chrono (§11). */
export const RAW_UNSCORED = 0;
/** Facteur de conversion d'une note brute (1–5) vers une note /10 (§4.1). */
export const RAW_MULTIPLIER = 2;
/** Échelle de la note finale affichée au classement (§4.3). */
export const FINAL_SCALE = 20;

const WEIGHT_BY_TABLE_TYPE: Record<TableType, number> = {
  LAMBDA: 1,
  SPECIAL: 2,
};

/** Poids d'un vote selon le type de table dont il provient (§4.2). */
export function weightForTableType(type: TableType): number {
  return WEIGHT_BY_TABLE_TYPE[type] ?? WEIGHT_BY_TABLE_TYPE.LAMBDA;
}

/**
 * Total maximal atteignable par un vote, en fonction du nombre de critères.
 * Avec les 3 critères de l'édition en cours : 3 × 5 × 2 = 30.
 *
 * Cette valeur n'est volontairement pas codée en dur : le nombre de critères
 * est configurable depuis le serveur (§14).
 */
export function maxTotalForCriteria(criteriaCount: number): number {
  return criteriaCount * RAW_MAX * RAW_MULTIPLIER;
}

/** Convertit une note brute (1–5) en note sur 10. */
export function toScoreOutOf10(rawValue: number): number {
  return rawValue * RAW_MULTIPLIER;
}

/** Un vote tel qu'il est consommé par le moteur de calcul. */
export interface ScoredVote {
  /** Type de la table émettrice — détermine le poids du vote. */
  tableType: TableType;
  /** Identifiant de la table, utilisé pour le détail par table. */
  tableId?: string;
  /** Notes brutes (1–5) indexées par identifiant de critère. */
  scores: Record<string, number>;
}

/**
 * Total d'un vote, sur `maxTotalForCriteria(criterionIds.length)`.
 * Un critère absent du vote compte pour 0 (§11).
 */
export function voteTotal(vote: ScoredVote, criterionIds: string[]): number {
  return criterionIds.reduce(
    (total, criterionId) => total + toScoreOutOf10(vote.scores[criterionId] ?? RAW_UNSCORED),
    0,
  );
}

/** Résultat du calcul pour un candidat. */
export interface CandidateScore {
  /** Moyenne pondérée sur l'échelle brute (sur 30 avec 3 critères). */
  averageRaw: number;
  /** Note finale sur 20, utilisée pour le classement. */
  finalOutOf20: number;
  /** Nombre de personnes ayant voté (non pondéré) — affiché à titre indicatif. */
  voterCount: number;
  /** Somme des poids, c'est-à-dire le diviseur réellement utilisé. */
  weightTotal: number;
}

/**
 * Moyenne pondérée d'un candidat.
 *
 *   moyenne = Σ (total_du_vote × poids) / Σ (poids)
 *   note/20 = moyenne × 20 / total_maximal
 *
 * Retourne `null` si le candidat n'a reçu aucun vote : il doit alors être
 * affiché « non noté », jamais 0, sous peine de fausser le classement (§11).
 * Ce retour `null` protège également de toute division par zéro.
 */
export function computeCandidateScore(
  votes: ScoredVote[],
  criterionIds: string[],
): CandidateScore | null {
  if (votes.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const vote of votes) {
    const weight = weightForTableType(vote.tableType);
    weightedSum += voteTotal(vote, criterionIds) * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;

  const averageRaw = weightedSum / weightTotal;
  const maxTotal = maxTotalForCriteria(criterionIds.length);
  const finalOutOf20 = maxTotal === 0 ? 0 : (averageRaw * FINAL_SCALE) / maxTotal;

  return {
    averageRaw,
    finalOutOf20,
    voterCount: votes.length,
    weightTotal,
  };
}

/**
 * Moyenne pondérée d'un candidat pour un seul critère, sur 10.
 * Sert au détail par critère du dashboard (§4.4).
 */
export function computeCriterionAverage(
  votes: ScoredVote[],
  criterionId: string,
): number | null {
  if (votes.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const vote of votes) {
    const weight = weightForTableType(vote.tableType);
    weightedSum += toScoreOutOf10(vote.scores[criterionId] ?? RAW_UNSCORED) * weight;
    weightTotal += weight;
  }

  return weightTotal === 0 ? null : weightedSum / weightTotal;
}

/** Une ligne du classement général. */
export interface RankedCandidate<T> {
  candidate: T;
  score: CandidateScore | null;
  /** Rang à partir de 1. `null` pour un candidat non noté. */
  rank: number | null;
}

/**
 * Classement général, trié par note finale décroissante.
 *
 * Les candidats sans aucun vote sont placés en fin de liste avec un rang `null` :
 * ils ne sont pas comparables aux autres et ne doivent pas hériter d'un 0.
 * Les ex æquo partagent le même rang.
 */
export function rankCandidates<T>(
  entries: { candidate: T; votes: ScoredVote[] }[],
  criterionIds: string[],
): RankedCandidate<T>[] {
  const scored = entries.map((entry) => ({
    candidate: entry.candidate,
    score: computeCandidateScore(entry.votes, criterionIds),
  }));

  const rated = scored
    .filter((entry): entry is { candidate: T; score: CandidateScore } => entry.score !== null)
    .sort((a, b) => b.score.finalOutOf20 - a.score.finalOutOf20);

  const unrated = scored.filter((entry) => entry.score === null);

  const ranked: RankedCandidate<T>[] = [];
  let previousValue: number | null = null;
  let previousRank = 0;

  rated.forEach((entry, index) => {
    const value = entry.score.finalOutOf20;
    // Les ex æquo conservent le même rang.
    const rank = previousValue !== null && value === previousValue ? previousRank : index + 1;
    previousValue = value;
    previousRank = rank;
    ranked.push({ candidate: entry.candidate, score: entry.score, rank });
  });

  for (const entry of unrated) {
    ranked.push({ candidate: entry.candidate, score: null, rank: null });
  }

  return ranked;
}

/** Arrondi d'affichage à deux décimales. Ne jamais l'utiliser dans un calcul intermédiaire. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
