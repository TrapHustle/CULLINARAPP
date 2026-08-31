import { prisma } from "@/lib/prisma";

// Cette route reflète l'état de la base : jamais de mise en cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/config
 *
 * Configuration complète de l'événement, consommée par les tablettes au premier
 * lancement puis mise en cache localement (§12).
 *
 * Volontairement non authentifiée : les tablettes n'ont pas de mot de passe
 * (§7) et le serveur n'est joignable que depuis le réseau local de la salle.
 */
export async function GET() {
  const [candidates, tables, criteria] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.votingTable.findMany({ orderBy: { name: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
  ]);

  return Response.json({
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      photoUrl: candidate.photoUrl,
      order: candidate.order,
    })),
    tables: tables.map((table) => ({
      id: table.id,
      name: table.name,
      type: table.type,
      expectedJurors: table.expectedJurors,
    })),
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      order: criterion.order,
    })),
  });
}
