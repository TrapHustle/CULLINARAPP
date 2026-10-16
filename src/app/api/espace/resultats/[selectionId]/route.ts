import { utilisateurConnecte } from "@/lib/espace";
import { versCsv, vueResultats } from "@/lib/resultats-vue";

export const dynamic = "force-dynamic";

/** GET /api/espace/resultats/:selectionId — classement de la sélection en CSV. */
export async function GET(request: Request, context: { params: Promise<{ selectionId: string }> }) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ error: "Connexion requise" }, { status: 401 });
  if (!utilisateur.organisation.actif) return Response.json({ error: "Compte suspendu" }, { status: 403 });

  const { selectionId } = await context.params;
  const essai = new URL(request.url).searchParams.get("essai") === "1";
  const vue = await vueResultats(utilisateur.organisationId, selectionId, { inclureSimules: essai });
  if (!vue) return Response.json({ error: "Introuvable" }, { status: 404 });

  const nom = `${vue.selection.evenementNom} ${vue.selection.libelle}`
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return new Response(versCsv(vue), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resultats-${nom || "selection"}${essai ? "-essai" : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
