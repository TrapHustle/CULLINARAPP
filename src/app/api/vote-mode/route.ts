import type { NextRequest } from "next/server";
import { getOrCreateSession, prisma, SESSION_ID } from "@/lib/prisma";
import { voteModeUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/vote-mode
 *
 * Change le déroulé du vote d'une catégorie, depuis une tablette.
 *
 * Le même réglage existe dans Configuration → Vote : c'est le même champ de
 * session, il n'y a pas deux vérités. Le doubler ici sert le cas où
 * l'organisateur est en salle, tablette en main, et n'a pas son dashboard sous
 * les yeux.
 *
 * Volontairement non authentifiée, comme les autres routes des tablettes (§7) :
 * elles n'ont pas de mot de passe, et le serveur n'est joignable que depuis le
 * réseau de la salle. Le garde-fou est côté tablette — le code staff, exigé
 * avant d'ouvrir ce réglage. Il tient contre un juré curieux, pas contre
 * quelqu'un qui sait forger une requête : à ce compte, `/api/sync/votes` est
 * déjà ouverte, et c'est le réseau lui-même qui fait la frontière.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide" }, { status: 400 });
  }

  const parsed = voteModeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Catégorie ou déroulé inconnu", details: parsed.error.issues },
      { status: 400 },
    );
  }

  await getOrCreateSession();

  const { category, mode } = parsed.data;
  const session = await prisma.session.update({
    where: { id: SESSION_ID },
    data: category === "SPECIAL" ? { voteModeSpecial: mode } : { voteModePublic: mode },
  });

  return Response.json({
    voteModePublic: session.voteModePublic,
    voteModeSpecial: session.voteModeSpecial,
  });
}
