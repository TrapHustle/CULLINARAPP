import { computeResults } from "@/lib/results";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/results
 *
 * Classement et statistiques détaillées (§12).
 *
 * Contrairement aux routes destinées aux tablettes, celle-ci est protégée : les
 * résultats intermédiaires ne doivent pas être consultables par un juré ou un
 * spectateur avant la proclamation.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Non authentifié" }, { status: 401 });
  }

  return Response.json(await computeResults());
}
