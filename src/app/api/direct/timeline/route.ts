import { computeTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/direct/timeline
 *
 * La course des candidats, pour l'écran projeté.
 *
 * `/api/results/timeline` exige une session, que la machine du vidéoprojecteur
 * n'a pas — et lui en donner une reviendrait à laisser le dashboard entier
 * ouvert dans la salle.
 *
 * Route **publique**, comme `/api/direct` et `/api/config` : l'organisateur a
 * choisi d'ouvrir la courbe sans code, pour la montrer entre deux candidats
 * sans saisir quatre chiffres devant l'assemblée. Conséquence assumée : le
 * classement en cours est lisible par qui connaît l'adresse du serveur. Seule
 * la **proclamation** reste gardée par un code — c'est elle qui doit conserver
 * son effet de surprise.
 */
export async function GET() {
  return Response.json(await computeTimeline());
}
