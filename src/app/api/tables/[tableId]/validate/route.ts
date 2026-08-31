import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTableSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/tables/:tableId/validate
 *
 * Le staff présent à la table déclare que tous ses jurés ont voté pour le
 * candidat en cours (§5, étape 5). Les votes de cette table pour ce candidat
 * sont dès lors verrouillés côté tablette.
 *
 * L'opération est idempotente : re-valider une table déjà validée n'est pas une
 * erreur, ce qui évite qu'un renvoi après coupure réseau ne se solde par un échec.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tableId: string }> },
) {
  const { tableId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide" }, { status: 400 });
  }

  const parsed = validateTableSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Charge utile invalide", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { candidateId } = parsed.data;

  const [table, candidate] = await Promise.all([
    prisma.votingTable.findUnique({ where: { id: tableId } }),
    prisma.candidate.findUnique({ where: { id: candidateId } }),
  ]);

  if (!table) {
    return Response.json({ error: "Table inconnue" }, { status: 404 });
  }
  if (!candidate) {
    return Response.json({ error: "Candidat inconnu" }, { status: 404 });
  }

  const validation = await prisma.tableValidation.upsert({
    where: { tableId_candidateId: { tableId, candidateId } },
    update: {},
    create: { tableId, candidateId },
  });

  return Response.json({
    tableId,
    candidateId,
    validatedAt: validation.validatedAt.toISOString(),
  });
}
