import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncVotesSchema, type IncomingVote } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface RejectedVote {
  id: string;
  reason: string;
  /** `false` si réessayer ne servira à rien : la tablette peut alors abandonner ce vote. */
  retryable: boolean;
}

/**
 * POST /api/sync/votes
 *
 * Réception par lot des votes accumulés sur une tablette (§12).
 *
 * Garanties :
 *  - **Idempotence** — l'identifiant est un UUID généré par la tablette ; le
 *    même vote renvoyé dix fois ne crée jamais de doublon (§11).
 *  - **Traitement unitaire** — un vote invalide n'annule pas le reste du lot,
 *    afin qu'une seule anomalie ne bloque pas la remontée de toute une table.
 *  - **Aucun calcul côté tablette** — seules des notes brutes de 0 à 5 sont
 *    acceptées ; le poids du vote est dérivé du type de la table au moment du
 *    calcul, jamais transmis par le client (§0.3).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide" }, { status: 400 });
  }

  const parsed = syncVotesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Charge utile invalide", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { votes } = parsed.data;
  if (votes.length === 0) {
    return Response.json({ accepted: [], rejected: [] });
  }

  // Chargement en une fois des référentiels, pour éviter une requête par vote.
  const [tables, candidates, criteria] = await Promise.all([
    prisma.votingTable.findMany({ select: { id: true } }),
    prisma.candidate.findMany({ select: { id: true, openedAt: true } }),
    prisma.criterion.findMany({ select: { id: true } }),
  ]);

  const tableIds = new Set(tables.map((table) => table.id));
  const criterionIds = new Set(criteria.map((criterion) => criterion.id));
  const openedByCandidate = new Map(
    candidates.map((candidate) => [candidate.id, candidate.openedAt !== null]),
  );

  const accepted: string[] = [];
  const rejected: RejectedVote[] = [];

  for (const vote of votes) {
    const rejection = validateAgainstReferences(vote, {
      tableIds,
      criterionIds,
      openedByCandidate,
    });

    if (rejection) {
      rejected.push(rejection);
      continue;
    }

    try {
      await persistVote(vote);
      accepted.push(vote.id);
    } catch (error) {
      console.error(`Échec d'enregistrement du vote ${vote.id}`, error);
      rejected.push({
        id: vote.id,
        reason: "Erreur serveur lors de l'enregistrement",
        // Erreur probablement transitoire : la tablette doit réessayer.
        retryable: true,
      });
    }
  }

  return Response.json({ accepted, rejected });
}

function validateAgainstReferences(
  vote: IncomingVote,
  refs: {
    tableIds: Set<string>;
    criterionIds: Set<string>;
    openedByCandidate: Map<string, boolean>;
  },
): RejectedVote | null {
  if (!refs.tableIds.has(vote.tableId)) {
    return { id: vote.id, reason: "Table inconnue", retryable: false };
  }

  const opened = refs.openedByCandidate.get(vote.candidateId);
  if (opened === undefined) {
    return { id: vote.id, reason: "Candidat inconnu", retryable: false };
  }

  // Un vote pour un candidat dont le vote n'a jamais été ouvert est refusé.
  // En revanche, un vote arrivant après la fermeture est accepté : c'est le cas
  // normal d'une tablette qui se resynchronise en retard (§11).
  if (!opened) {
    return {
      id: vote.id,
      reason: "Les votes n'ont jamais été ouverts pour ce candidat",
      retryable: false,
    };
  }

  const unknownCriterion = vote.scores.find((score) => !refs.criterionIds.has(score.criterionId));
  if (unknownCriterion) {
    return {
      id: vote.id,
      reason: `Critère inconnu : ${unknownCriterion.criterionId}`,
      retryable: false,
    };
  }

  return null;
}

/**
 * Enregistre un vote de façon idempotente.
 *
 * Deux clés peuvent identifier un vote déjà connu :
 *  1. son UUID — cas d'un simple renvoi du même lot ;
 *  2. le triplet (table, candidat, numéro de juré) — cas d'une tablette qui
 *     aurait régénéré un identifiant après modification d'un vote.
 *
 * Dans les deux cas on met à jour l'enregistrement existant au lieu d'en créer
 * un second, ce qui fausserait la moyenne du candidat.
 */
async function persistVote(vote: IncomingVote) {
  const slot = {
    tableId: vote.tableId,
    candidateId: vote.candidateId,
    jurorIndex: vote.jurorIndex,
  };

  await prisma.$transaction(async (tx) => {
    const existing =
      (await tx.vote.findUnique({ where: { id: vote.id } })) ??
      (await tx.vote.findUnique({ where: { tableId_candidateId_jurorIndex: slot } }));

    const voteId = existing?.id ?? vote.id;

    if (existing) {
      await tx.vote.update({
        where: { id: voteId },
        data: { createdAt: vote.createdAt, syncedAt: new Date() },
      });
      await tx.voteScore.deleteMany({ where: { voteId } });
    } else {
      await tx.vote.create({
        data: { id: voteId, ...slot, createdAt: vote.createdAt },
      });
    }

    await tx.voteScore.createMany({
      data: vote.scores.map((score) => ({
        voteId,
        criterionId: score.criterionId,
        rawValue: score.rawValue,
      })),
    });
  });
}
