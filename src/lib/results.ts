import { prisma } from "./prisma";
import {
  computeCandidateScore,
  computeCriterionAverage,
  maxTotalForCriteria,
  rankCandidates,
  round2,
  type ScoredVote,
  type TableType,
} from "./scoring";

export interface CriterionBreakdown {
  criterionId: string;
  name: string;
  /** Moyenne pondérée du critère, sur 5. `null` si le candidat n'a aucun vote. */
  averageOutOf5: number | null;
}

/** Le détail d'un seul juré, pour la popup ouverte depuis une pastille de table. */
export interface JurorVote {
  jurorIndex: number;
  /** Note de ce juré pour chaque critère, sur 5. */
  scores: { criterionId: string; name: string; value: number }[];
  /** Total de ce juré, sur `maxTotal`. */
  total: number;
}

export interface TableBreakdown {
  tableId: string;
  tableName: string;
  type: TableType;
  /** Moyenne des votes de cette seule table, sur `maxTotal` (15 avec 3 critères). */
  averageRaw: number | null;
  voterCount: number;
  /** Le détail juré par juré, pour la popup. */
  votes: JurorVote[];
}

export interface CandidateResult {
  candidateId: string;
  name: string;
  rank: number | null;
  /** `null` si le candidat n'a reçu aucun vote — il est alors « non noté », jamais 0. */
  averageRaw: number | null;
  /** Note finale, sur `maxTotal` (15 avec 3 critères) — c'est la même échelle que `averageRaw`. */
  finalScore: number | null;
  /** Moyenne des seuls votes du jury spécial, sur `maxTotal`. `null` si aucun. */
  specialScore: number | null;
  /** Moyenne des seules tables normales (le public), sur `maxTotal`. `null` si aucune. */
  publicScore: number | null;
  voterCount: number;
  weightTotal: number;
  byCriterion: CriterionBreakdown[];
  byTable: TableBreakdown[];
}

export interface ResultsPayload {
  criteria: { id: string; name: string }[];
  /** Total maximal d'un vote — 15 avec 3 critères, à 5 points chacun. */
  maxTotal: number;
  ranking: CandidateResult[];
  totals: { votes: number; candidates: number; tables: number };
}

/**
 * Calcule le classement complet et les statistiques détaillées.
 *
 * Les votes sont lus bruts depuis la base, puis convertis en `ScoredVote` : le
 * poids est dérivé ici du type de la table, jamais lu depuis le vote (§0.3).
 */
export async function computeResults(): Promise<ResultsPayload> {
  const [candidates, criteria, votes, tableCount] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.vote.findMany({ include: { scores: true, table: true } }),
    prisma.votingTable.count(),
  ]);

  const criterionIds = criteria.map((criterion) => criterion.id);
  const criterionNameById = new Map(criteria.map((criterion) => [criterion.id, criterion.name]));
  const maxTotal = maxTotalForCriteria(criteria.length);

  // Regroupement des votes par candidat, en gardant le juré et la table pour
  // le détail affiché dans la popup.
  const votesByCandidate = new Map<
    string,
    (ScoredVote & { jurorIndex: number })[]
  >();
  for (const vote of votes) {
    const scores: Record<string, number> = {};
    for (const score of vote.scores) {
      scores[score.criterionId] = score.rawValue;
    }

    const scoredVote: ScoredVote & { jurorIndex: number } = {
      tableType: vote.table.type as TableType,
      tableId: vote.tableId,
      jurorIndex: vote.jurorIndex,
      scores,
    };

    const existing = votesByCandidate.get(vote.candidateId);
    if (existing) existing.push(scoredVote);
    else votesByCandidate.set(vote.candidateId, [scoredVote]);
  }

  const ranked = rankCandidates(
    candidates.map((candidate) => ({
      candidate,
      votes: votesByCandidate.get(candidate.id) ?? [],
    })),
    criterionIds,
  );

  const tables = await prisma.votingTable.findMany({ orderBy: { name: "asc" } });

  const ranking: CandidateResult[] = ranked.map((entry) => {
    const candidateVotes = votesByCandidate.get(entry.candidate.id) ?? [];

    const byCriterion: CriterionBreakdown[] = criteria.map((criterion) => {
      const average = computeCriterionAverage(candidateVotes, criterion.id);
      return {
        criterionId: criterion.id,
        name: criterion.name,
        averageOutOf5: average === null ? null : round2(average),
      };
    });

    const byTable: TableBreakdown[] = tables.map((table) => {
      const tableVotes = candidateVotes.filter((vote) => vote.tableId === table.id);
      const score = computeCandidateScore(tableVotes, criterionIds);

      const jurorVotes: JurorVote[] = tableVotes
        .slice()
        .sort((a, b) => a.jurorIndex - b.jurorIndex)
        .map((vote) => ({
          jurorIndex: vote.jurorIndex,
          scores: criterionIds.map((criterionId) => ({
            criterionId,
            name: criterionNameById.get(criterionId) ?? "",
            value: vote.scores[criterionId] ?? 0,
          })),
          total: criterionIds.reduce((sum, id) => sum + (vote.scores[id] ?? 0), 0),
        }));

      return {
        tableId: table.id,
        tableName: table.name,
        type: table.type as TableType,
        averageRaw: score === null ? null : round2(score.averageRaw),
        voterCount: tableVotes.length,
        votes: jurorVotes,
      };
    });

    const specialScore = computeCandidateScore(
      candidateVotes.filter((vote) => vote.tableType === "SPECIAL"),
      criterionIds,
    );
    const publicScore = computeCandidateScore(
      candidateVotes.filter((vote) => vote.tableType === "LAMBDA"),
      criterionIds,
    );

    return {
      candidateId: entry.candidate.id,
      name: entry.candidate.name,
      rank: entry.rank,
      averageRaw: entry.score === null ? null : round2(entry.score.averageRaw),
      finalScore: entry.score === null ? null : round2(entry.score.averageRaw),
      specialScore: specialScore === null ? null : round2(specialScore.averageRaw),
      publicScore: publicScore === null ? null : round2(publicScore.averageRaw),
      voterCount: entry.score?.voterCount ?? 0,
      weightTotal: entry.score?.weightTotal ?? 0,
      byCriterion,
      byTable,
    };
  });

  return {
    criteria: criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })),
    maxTotal,
    ranking,
    totals: { votes: votes.length, candidates: candidates.length, tables: tableCount },
  };
}
