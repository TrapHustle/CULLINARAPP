import { computeTimeline } from "@/lib/timeline";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/results/timeline
 *
 * Évolution du classement vote après vote, pour l'écran temps réel.
 *
 * Protégée comme `/api/results` : un classement intermédiaire renseigne autant
 * qu'un classement final, et ne doit pas fuiter avant la proclamation.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Non authentifié" }, { status: 401 });
  }

  return Response.json(await computeTimeline());
}
