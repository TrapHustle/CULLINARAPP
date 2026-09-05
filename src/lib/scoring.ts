/**
 * Moteur de calcul des notes — cœur métier de l'application.
 *
 * Toutes les fonctions de ce module sont **pures** : aucune dépendance à la base
 * de données, aucun effet de bord. Elles sont couvertes par `scoring.test.ts`,
 * qui reprend l'exemple chiffré et le contre-exemple du §4.3 du cahier des charges.
 *
 * Règles implémentées ici :
 *  - une note brute va de `scoreMin` à `scoreMax` (1 à 5 par défaut), et vaut 0
 *    si le critère n'a pas été noté (§11) ;
 *  - les notes ne sont **jamais** remises à l'échelle : un critère reste sur
 *    `scoreMax`, et la note finale d'un candidat reste sur
 *    `criteriaCount × scoreMax` — ce que le juré a saisi est ce qui s'affiche
 *    partout, du détail par critère au palmarès ;
 *  - un vote issu de la table spéciale pèse plus qu'un vote normal (§4.2) —
 *    les deux poids sont configurables depuis Configuration → Vote, avec 1 et
 *    2 comme valeurs de départ ;
 *  - la moyenne d'un candidat est pondérée **par votant**, jamais par somme
 *    brute, afin qu'un candidat noté par 18 personnes ne soit ni avantagé ni
 *    désavantagé face à un candidat noté par 13 personnes (§4.3).
 */

export type TableType = "LAMBDA" | "SPECIAL";

/** Note brute minimale par défaut. Le réglage effectif vit sur `Session.scoreMin`. */
export const RAW_MIN = 1;
/** Note brute maximale par défaut. Le réglage effectif vit sur `Session.scoreMax`. */
export const RAW_MAX = 5;
/** Valeur enregistrée pour un critère laissé vide à l'expiration du chrono (§11). */
export const RAW_UNSCORED = 0;

/**
 * Part de chaque catégorie dans la note finale, en pourcentage.
 *
 * Ce n'est **pas** un poids par vote : c'est la part que pèse la *moyenne* de
 * la catégorie. « Jury spécial 60 % » signifie que l'avis du jury compte pour
 * 60 % de la note, qu'il soit composé de 3 personnes ou de 15.
 *
 * La distinction est décisive. Avec un poids par vote, l'influence d'un jury de
 * 3 personnes face à 15 convives dépend de sa taille, pas de ce qu'on a voulu
 * lui accorder : le doubler ne suffit pas à le faire peser. Avec une part, la
 * volonté de l'organisateur est respectée quel que soit le nombre de votants
 * de chaque côté.
 */
export type SharesByType = Record<TableType, number>;

/** Parts de départ, avant tout réglage depuis Configuration → Vote (§4.2). */
export const DEFAULT_SHARES: SharesByType = {
  LAMBDA: 40,
  SPECIAL: 60,
};

/** Part de la catégorie dans la note finale, en pourcentage (§4.2). */
export function shareForTableType(type: TableType, shares: SharesByType = DEFAULT_SHARES): number {
  return shares[type] ?? 0;
}

/**
 * Total maximal atteignable par un vote, en fonction du nombre de critères et
 * de la note maximale sélectionnable (`scoreMax`, 5 par défaut).
 * Avec les 3 critères de l'édition en cours : 3 × 5 = 15.
 *
 * Le nombre de critères et l'échelle des notes sont volontairement pris en
 * paramètre plutôt que codés en dur : les deux sont configurables depuis le
 * serveur (§14). C'est aussi l'échelle de la note finale d'un candidat — il
 * n'y a plus de conversion séparée vers un /20.
 */
export function maxTotalForCriteria(criteriaCount: number, scoreMax: number = RAW_MAX): number {
  return criteriaCount * scoreMax;
}

/** Un vote tel qu'il est consommé par le moteur de calcul. */
export interface ScoredVote {
  /** Type de la table émettrice — détermine le poids du vote. */
  tableType: TableType;
  /** Identifiant de la table, utilisé pour le détail par table. */
  tableId?: string;
  /** Notes brutes indexées par identifiant de critère. */
  scores: Record<string, number>;
}

/**
 * Total d'un vote, sur `maxTotalForCriteria(criterionIds.length, scoreMax)`.
 * Un critère absent du vote compte pour 0 (§11).
 */
export function voteTotal(vote: ScoredVote, criterionIds: string[]): number {
  return criterionIds.reduce(
    (total, criterionId) => total + (vote.scores[criterionId] ?? RAW_UNSCORED),
    0,
  );
}

/** Résultat du calcul pour un candidat. */
export interface CandidateScore {
  /** Moyenne pondérée, sur `maxTotalForCriteria(criterionIds.length, scoreMax)`. */
  averageRaw: number;
  /** Nombre de personnes ayant voté (non pondéré) — affiché à titre indicatif. */
  voterCount: number;
  /**
   * Somme des parts réellement retenues, c'est-à-dire le diviseur utilisé.
   *
   * Vaut 100 quand toutes les catégories ont voté, moins sinon : les parts sont
   * renormalisées sur celles qui se sont prononcées.
   */
  shareTotal: number;
}

/**
 * Moyenne pondérée d'un candidat.
 *
 *   moyenne = Σ (total_du_vote × poids) / Σ (poids)
 *
 * C'est aussi la note finale : plus de conversion séparée, l'échelle est déjà
 * celle affichée (§4.3, révisé pour rester sur l'échelle brute).
 *
 * Retourne `null` si le candidat n'a reçu aucun vote : il doit alors être
 * affiché « non noté », jamais 0, sous peine de fausser le classement (§11).
 * Ce retour `null` protège également de toute division par zéro.
 */
/**
 * Moyenne d'une catégorie, puis combinaison des catégories selon leurs parts.
 *
 * Deux temps, et l'ordre compte : on moyenne **d'abord** à l'intérieur de
 * chaque catégorie, on applique **ensuite** les parts. C'est ce qui rend
 * l'influence d'un jury indépendante de sa taille.
 *
 * Les parts sont renormalisées sur les seules catégories ayant voté. Sans
 * cela, un candidat noté par le public mais pas encore par le jury verrait sa
 * note amputée de la part du jury — comme si celui-ci lui avait mis zéro.
 */
function combineByShare(
  votes: ScoredVote[],
  valueOf: (vote: ScoredVote) => number,
  shares: SharesByType,
): { mean: number; shareTotal: number; voterCount: number } | null {
  const byType = new Map<TableType, { sum: number; count: number }>();

  for (const vote of votes) {
    const bucket = byType.get(vote.tableType) ?? { sum: 0, count: 0 };
    bucket.sum += valueOf(vote);
    bucket.count += 1;
    byType.set(vote.tableType, bucket);
  }

  let weighted = 0;
  let shareTotal = 0;

  for (const [type, bucket] of byType) {
    const share = shareForTableType(type, shares);
    // Une catégorie à 0 % est neutralisée : elle ne compte ni au numérateur ni
    // au dénominateur, et ne peut donc pas tirer la note vers le bas.
    if (share <= 0 || bucket.count === 0) continue;
    weighted += (bucket.sum / bucket.count) * share;
    shareTotal += share;
  }

  if (shareTotal === 0) return null;

  return { mean: weighted / shareTotal, shareTotal, voterCount: votes.length };
}

export function computeCandidateScore(
  votes: ScoredVote[],
  criterionIds: string[],
  shares: SharesByType = DEFAULT_SHARES,
): CandidateScore | null {
  if (votes.length === 0) return null;

  const combined = combineByShare(votes, (vote) => voteTotal(vote, criterionIds), shares);
  if (combined === null) return null;

  return {
    averageRaw: combined.mean,
    voterCount: combined.voterCount,
    shareTotal: combined.shareTotal,
  };
}

/**
 * Moyenne pondérée d'un candidat pour un seul critère, sur `scoreMax`.
 * Sert au détail par critère du dashboard (§4.4).
 */
export function computeCriterionAverage(
  votes: ScoredVote[],
  criterionId: string,
  shares: SharesByType = DEFAULT_SHARES,
): number | null {
  if (votes.length === 0) return null;

  const combined = combineByShare(
    votes,
    (vote) => vote.scores[criterionId] ?? RAW_UNSCORED,
    shares,
  );

  return combined === null ? null : combined.mean;
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
  shares: SharesByType = DEFAULT_SHARES,
): RankedCandidate<T>[] {
  const scored = entries.map((entry) => ({
    candidate: entry.candidate,
    score: computeCandidateScore(entry.votes, criterionIds, shares),
  }));

  const rated = scored
    .filter((entry): entry is { candidate: T; score: CandidateScore } => entry.score !== null)
    .sort((a, b) => b.score.averageRaw - a.score.averageRaw);

  const unrated = scored.filter((entry) => entry.score === null);

  const ranked: RankedCandidate<T>[] = [];
  let previousValue: number | null = null;
  let previousRank = 0;

  rated.forEach((entry, index) => {
    const value = entry.score.averageRaw;
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
