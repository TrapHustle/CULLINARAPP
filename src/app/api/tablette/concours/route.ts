import { lireAppareil, listerConcours } from "@/lib/tablette";

export const dynamic = "force-dynamic";

/**
 * GET /api/tablette/concours
 *
 * Les concours que la tablette peut ouvrir : ceux de l'organisation du
 * compte, ou de toutes pour le super-admin ; en préparation ou ouverts.
 */
export async function GET(request: Request) {
  const appareil = await lireAppareil(request);
  if (!appareil) return Response.json({ erreur: "Connexion requise." }, { status: 401 });
  return Response.json({ concours: await listerConcours(appareil) });
}
