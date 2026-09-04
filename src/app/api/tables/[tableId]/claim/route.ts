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
 * Une tablette peut en revanche tenir **plusieurs** tables : deux tablettes
 * suffisent alors à couvrir quatre tables. L'exclusivité porte sur la table,
 * jamais sur la tablette.
 *
 * Une table déjà tenue par un autre appareil est refusée (409) : une tablette
 * ne déloge pas une autre par accident, sous peine qu'un juré curieux
 * déconnecte une table en plein vote.
 *
 * Elle peut en revanche être **reprise** délibérément, avec `takeover: true` —
 * c'est le remplacement d'une tablette hors service, décidé en salle derrière
 * le code staff. Le serveur ne peut pas trancher lui-même : une tablette
 * silencieuse et une tablette morte lui ressemblent. Les votes déjà remontés
 * appartiennent à la table, pas à la tablette : ils restent en place.
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

  const { deviceId, takeover } = parsed.data;

  const table = await prisma.votingTable.findUnique({ where: { id: tableId } });
  if (!table) {
    return Response.json({ error: "Table inconnue" }, { status: 404 });
  }

  const heldByAnother = table.assignedDeviceId !== null && table.assignedDeviceId !== deviceId;

  if (heldByAnother && !takeover) {
    return Response.json(
      {
        error: "Table déjà prise par une autre tablette",
        assignedAt: table.assignedAt,
      },
      { status: 409 },
    );
  }

  // Une tablette peut tenir plusieurs tables : réclamer la table B ne libère
  // pas la table A. C'est ce qui permet de couvrir quatre tables avec deux
  // tablettes, le staff choisissant la table avant chaque série de jurés.
  //
  // L'exclusivité reste entière dans l'autre sens : une table n'appartient
  // qu'à une tablette, ce qui est la garantie recherchée.
  //
  // Une reprise repart d'un `assignedAt` neuf : la page Connexion du dashboard
  // affiche depuis quand la table est servie, et c'est la nouvelle tablette qui
  // la sert désormais.
  await prisma.votingTable.update({
    where: { id: tableId },
    data: {
      assignedDeviceId: deviceId,
      assignedAt: heldByAnother ? new Date() : (table.assignedAt ?? new Date()),
    },
  });

  return Response.json({
    id: table.id,
    name: table.name,
    type: table.type,
    expectedJurors: table.expectedJurors,
  });
}
