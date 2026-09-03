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
  const [candidates, tables, criteria, session] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.votingTable.findMany({ orderBy: { name: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.session.findUnique({ where: { id: "singleton" }, select: { scoreMin: true, scoreMax: true } }),
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
      // L'identifiant de la tablette qui tient la table, ou `null` si elle est
      // libre. Il est renvoyé tel quel — et non un simple booléen « prise » —
      // pour qu'une tablette reconnaisse *sa* table après un redémarrage et la
      // propose au lieu de la griser.
      assignedDeviceId: table.assignedDeviceId,
    })),
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      order: criterion.order,
    })),
    // Bornes de la note qu'un juré peut saisir, réglables depuis
    // Configuration → Vote (1 à 5 par défaut). La tablette en tire le nombre
    // de cercles à afficher sur l'écran de saisie.
    scoreMin: session?.scoreMin ?? 1,
    scoreMax: session?.scoreMax ?? 5,
  });
}
