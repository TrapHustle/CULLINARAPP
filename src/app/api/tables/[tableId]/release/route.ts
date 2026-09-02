import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { claimTableSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/tables/<tableId>/release
 *
 * Rend une table à la salle, à la demande de la tablette qui la sert.
 *
 * Une tablette ne peut libérer **que la sienne** : la vérification porte sur
 * l'identifiant d'appareil, faute de quoi n'importe quelle tablette pourrait
 * déconnecter une table en plein vote. Le dashboard, lui, peut libérer
 * n'importe laquelle — c'est sa soupape quand une tablette est en panne.
 *
 * Les votes déjà enregistrés ne sont pas touchés : on libère la place, on
 * n'efface rien.
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

  const table = await prisma.votingTable.findUnique({ where: { id: tableId } });
  if (!table) {
    return Response.json({ error: "Table inconnue" }, { status: 404 });
  }

  // Table déjà libre : on répond succès plutôt qu'erreur. La tablette qui
  // réessaie après une coupure ne doit pas se heurter à un refus pour une
  // opération qui a, de fait, abouti.
  if (table.assignedDeviceId === null) {
    return Response.json({ released: true });
  }

  if (table.assignedDeviceId !== parsed.data.deviceId) {
    return Response.json(
      { error: "Cette table est servie par une autre tablette" },
      { status: 403 },
    );
  }

  await prisma.votingTable.update({
    where: { id: tableId },
    data: { assignedDeviceId: null, assignedAt: null },
  });

  return Response.json({ released: true });
}
