import { detailVotes } from "@/lib/detail-votes";
import { utilisateurConnecte } from "@/lib/espace";

export const dynamic = "force-dynamic";

/**
 * GET /api/espace/resultats/:selectionId/detail?participation=…&essai=1 —
 * chaque vote et chaque paiement derrière les notes d'un candidat.
 */
export async function GET(request: Request, context: { params: Promise<{ selectionId: string }> }) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ error: "Connexion requise" }, { status: 401 });
  if (!utilisateur.organisation.actif && utilisateur.role !== "SUPERADMIN") {
    return Response.json({ error: "Compte suspendu" }, { status: 403 });
  }

  const { selectionId } = await context.params;
  const url = new URL(request.url);
  const participationId = url.searchParams.get("participation");
  if (!participationId) return Response.json({ error: "Candidat manquant" }, { status: 400 });

  const detail = await detailVotes(utilisateur.organisationId, selectionId, {
    participationId,
    inclureSimules: url.searchParams.get("essai") === "1",
  });
  if (!detail) return Response.json({ error: "Introuvable" }, { status: 404 });
  return Response.json(detail, { headers: { "Cache-Control": "no-store" } });
}
