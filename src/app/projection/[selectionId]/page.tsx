import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/espace";
import { outfit } from "@/lib/police";
import { vueResultats } from "@/lib/resultats-vue";
import { Proclamation } from "./proclamation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proclamation — DIGITALYX-VOTE" };

/**
 * Écran de proclamation, à projeter dans la salle : le classement se dévoile
 * du dernier au premier, au rythme de l'organisateur.
 */
export default async function PageProclamation({ params }: { params: Promise<{ selectionId: string }> }) {
  const utilisateur = await exigerUtilisateur();
  const { selectionId } = await params;
  const vue = await vueResultats(utilisateur.organisationId, selectionId);
  if (!vue) notFound();

  return (
    <div className={outfit.className}>
      <Proclamation
        evenement={vue.selection.evenementNom}
        selection={vue.selection.libelle}
        afficheUrl={vue.selection.afficheUrl}
        officiel={vue.figeLe !== null}
        lignes={vue.lignes
          .filter((l) => l.rang !== null)
          .map((l) => ({ id: l.participationId, rang: l.rang!, nom: l.nom, ville: l.ville, photoUrl: l.photoUrl, note: l.note!, qualifie: l.qualifie, egalite: l.egalite }))}
      />
    </div>
  );
}
