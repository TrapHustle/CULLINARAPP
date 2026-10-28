import { lireAppareil, recevoirSuffrages } from "@/lib/tablette";
import { lotTabletteSchema } from "@/lib/tablette-core";

export const dynamic = "force-dynamic";

/**
 * POST /api/tablette/selections/<id>/suffrages — { suffrages: [...] }
 *
 * Les votes saisis sur la tablette, envoyés par lots (souvent en fin de
 * soirée). Réponse : `acceptes` (identifiants à retirer de la file) et
 * `refuses` (avec le motif, et s'il vaut la peine de réessayer).
 */
export async function POST(request: Request, { params }: { params: Promise<{ selectionId: string }> }) {
  const appareil = await lireAppareil(request);
  if (!appareil) return Response.json({ erreur: "Connexion requise." }, { status: 401 });

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const lot = lotTabletteSchema.safeParse(corps);
  if (!lot.success) return Response.json({ erreur: lot.error.issues[0]?.message ?? "Lot invalide." }, { status: 400 });

  const { selectionId } = await params;
  const resultat = await recevoirSuffrages(appareil, selectionId, lot.data.suffrages);
  if (!resultat) return Response.json({ erreur: "Concours introuvable." }, { status: 404 });
  return Response.json(resultat);
}
