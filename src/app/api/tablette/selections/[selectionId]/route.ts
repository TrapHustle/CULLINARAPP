import { lireAppareil, lireConfiguration } from "@/lib/tablette";

export const dynamic = "force-dynamic";

/**
 * GET /api/tablette/selections/<id>
 *
 * Tout ce qu'il faut pour voter hors ligne : candidats, votes en salle et
 * leurs critères avec barème, chronomètre, tables. La tablette le garde en
 * mémoire et le relit quand elle retrouve le réseau.
 */
export async function GET(request: Request, { params }: { params: Promise<{ selectionId: string }> }) {
  const appareil = await lireAppareil(request);
  if (!appareil) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  const { selectionId } = await params;
  const configuration = await lireConfiguration(appareil, selectionId);
  if (!configuration) return Response.json({ erreur: "Concours introuvable." }, { status: 404 });
  return Response.json(configuration);
}
