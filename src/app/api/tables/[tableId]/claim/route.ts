import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { claimTableSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/tables/<tableId>/claim
 *
 * Réserve une table pour une tablette. L'assignation est **exclusive** : deux
 * tablettes sur la même table feraient voter deux fois les mêmes jurés sans que
 * rien ne le signale, et les compteurs d'avancement deviendraient faux.
 *
 * Le serveur est seul juge parce que lui seul voit toutes les tablettes. C'est
 * aussi pourquoi cette étape est la seule du parcours qui exige une connexion :
 * hors ligne, aucune tablette ne peut savoir ce que les autres ont pris.
 *
 * Une tablette qui redemande **sa propre** table l'obtient : c'est le cas d'un
 * redémarrage en pleine soirée, qui ne doit jamais immobiliser une table.
 *
 * Une table déjà tenue par un autre appareil est refusée (409). Elle se libère
 * depuis le dashboard, page Connexion — une tablette ne peut pas en déloger une
 * autre, sous peine qu'un juré curieux déconnecte une table en plein vote.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  const { tableId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide" }, { status: 400 });
  }

  const parsed = claimTableSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Identifiant d'appareil manquant" }, { status: 400 });
  }

  const { deviceId } = parsed.data;

  const table = await prisma.votingTable.findUnique({ where: { id: tableId } });
  if (!table) {
    return Response.json({ error: "Table inconnue" }, { status: 404 });
  }

  if (table.assignedDeviceId && table.assignedDeviceId !== deviceId) {
    return Response.json(
      {
        error: "Table déjà prise par une autre tablette",
        assignedAt: table.assignedAt,
      },
      { status: 409 },
    );
  }

  // Une tablette ne tient qu'une table à la fois : réclamer la table B libère
  // la table A. Sans cela, un changement de table en cours de soirée laisserait
  // l'ancienne bloquée derrière elle.
  await prisma.$transaction([
    prisma.votingTable.updateMany({
      where: { assignedDeviceId: deviceId, id: { not: tableId } },
      data: { assignedDeviceId: null, assignedAt: null },
    }),
    prisma.votingTable.update({
      where: { id: tableId },
      data: { assignedDeviceId: deviceId, assignedAt: table.assignedAt ?? new Date() },
    }),
  ]);

  return Response.json({
    id: table.id,
    name: table.name,
    type: table.type,
    expectedJurors: table.expectedJurors,
  });
}
