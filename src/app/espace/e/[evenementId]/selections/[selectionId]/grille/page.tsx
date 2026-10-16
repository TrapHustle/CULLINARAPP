import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { GrilleVote } from "@/components/espace/grille-vote";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { selectionDeLOrganisation } from "@/lib/evenements";
import { lireGrille } from "@/lib/grille";
import { reprendreGrilleAction } from "@/lib/grille-actions";

export const metadata: Metadata = { title: "Grille de vote — DIGITALYX-VOTE" };

export default async function PageGrilleSelection({
  params,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const selection = await selectionDeLOrganisation(utilisateur.organisationId, selectionId);
  if (!selection || selection.evenementId !== evenementId) notFound();

  const types = await lireGrille(utilisateur.organisationId, { kind: "selection", id: selectionId });
  const modifiable = selection.etat === "PREPAREE";

  return (
    <>
      <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
        <Icone nom="calendrier" taille={18} />
        <div>
          <strong>{modifiable ? "Grille propre à cette sélection" : "Grille figée"}</strong>
          <span>
            {modifiable ? (
              <>
                Recopiée de la{" "}
                <Link href={`/espace/e/${evenementId}/grille`}>grille de l&rsquo;événement</Link> à la création de la
                sélection. Ce que vous changez ici ne vaut que pour elle.
              </>
            ) : (
              "La sélection est ouverte ou clôturée : sa grille ne change plus, les votes s’y rattachent."
            )}
          </span>
        </div>
        {modifiable ? (
          <FormulaireAction
            action={reprendreGrilleAction.bind(null, evenementId, selectionId)}
            bouton="Reprendre la grille de l’événement"
            variante="secondaire"
            confirmer="Remplacer la grille de cette sélection par celle de l'événement ?"
            style={{ marginLeft: "auto" }}
          />
        ) : null}
      </div>

      <GrilleVote evenementId={evenementId} selectionId={selectionId} types={types} modifiable={modifiable} />
    </>
  );
}
