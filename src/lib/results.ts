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
  /** Moyenne pondérée du critère, sur 10. `null` si le candidat n'a aucun vote. */
  averageOutOf10: number | null;
}

export interface TableBreakdown {
  tableId: string;
  tableName: string;
  type: TableType;
  /** Moyenne des votes de cette seule table, sur l'échelle brute (30 avec 3 critères). */
  averageRaw: number | null;
  voterCount: number;
}

export interface CandidateResult {
  candidateId: string;
  name: string;
  rank: number | null;
  /** `null` si le candidat n'a reçu aucun vote — il est alors « non noté », jamais 0. */
  averageRaw: number | null;
  finalOutOf20: number | null;
  voterCount: number;
  weightTotal: number;
  byCriterion: CriterionBreakdown[];
  byTable: TableBreakdown[];
}

export interface ResultsPayload {
  criteria: { id: string; name: string }[];
  /** Total maximal d'un vote — 30 avec 3 critères. */
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

  // Regroupement des votes par candidat.
  const votesByCandidate = new Map<string, ScoredVote[]>();
  for (const vote of votes) {
    const scores: Record<string, number> = {};
    for (const score of vote.scores) {
      scores[score.criterionId] = score.rawValue;
    }

    const scoredVote: ScoredVote = {
      tableType: vote.table.type as TableType,
      tableId: vote.tableId,
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
        averageOutOf10: average === null ? null : round2(average),
      };
    });

    const byTable: TableBreakdown[] = tables.map((table) => {
      const tableVotes = candidateVotes.filter((vote) => vote.tableId === table.id);
      const score = computeCandidateScore(tableVotes, criterionIds);
      return {
        tableId: table.id,
        tableName: table.name,
        type: table.type as TableType,
        averageRaw: score === null ? null : round2(score.averageRaw),
        voterCount: tableVotes.length,
      };
    });

    return {
      candidateId: entry.candidate.id,
      name: entry.candidate.name,
      rank: entry.rank,
      averageRaw: entry.score === null ? null : round2(entry.score.averageRaw),
      finalOutOf20: entry.score === null ? null : round2(entry.score.finalOutOf20),
      voterCount: entry.score?.voterCount ?? 0,
      weightTotal: entry.score?.weightTotal ?? 0,
      byCriterion,
      byTable,
    };
  });

  return {
    criteria: criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })),
    maxTotal: maxTotalForCriteria(criteria.length),
    ranking,
    totals: { votes: votes.length, candidates: candidates.length, tables: tableCount },
  };
}
