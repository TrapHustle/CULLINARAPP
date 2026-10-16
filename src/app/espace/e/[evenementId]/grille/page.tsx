import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { GrilleVote } from "@/components/espace/grille-vote";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { evenementDeLOrganisation } from "@/lib/evenements";
import { lireGrille } from "@/lib/grille";
import { poserGrilleProposeeAction } from "@/lib/grille-actions";

export const metadata: Metadata = { title: "Grille de référence — DIGITALYX-VOTE" };

export default async function PageGrilleEvenement({ params }: { params: Promise<{ evenementId: string }> }) {
  const { evenementId } = await params;
  const utilisateur = await exigerUtilisateur();
  const evenement = await evenementDeLOrganisation(utilisateur.organisationId, evenementId);
  if (!evenement) notFound();

  const types = await lireGrille(utilisateur.organisationId, { kind: "evenement", id: evenementId });

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>{evenement.nom}</div>
          <h1 className={styles.titre}>
            Grille de <em>vote</em>
          </h1>
          <p className={styles.sousTitre}>
            La grille de référence : elle est recopiée dans chaque nouvelle sélection, qui peut ensuite l&rsquo;adapter.
          </p>
        </div>
      </div>

      {types.length === 0 ? (
        <section className={styles.carte}>
          <div className={styles.vide}>
            <strong>Pas encore de grille</strong>
            Partez de la grille proposée — jury 40 %, salle 30 %, vote en ligne 30 % — puis ajustez-la.
            <div>
              <FormulaireAction
                action={poserGrilleProposeeAction.bind(null, evenementId)}
                bouton="Utiliser la grille proposée"
                style={{ marginTop: 18 }}
              />
            </div>
          </div>
        </section>
      ) : null}

      {types.length > 0 ? (
        <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
          <Icone nom="etincelle" taille={18} />
          <div>
            <strong>Les sélections déjà créées gardent leur grille</strong>
            <span>
              Pour qu&rsquo;une sélection en préparation reprenne cette grille, ouvrez son onglet « Grille de vote ».
            </span>
          </div>
        </div>
      ) : null}

      <GrilleVote evenementId={evenementId} selectionId={null} types={types} modifiable />
    </>
  );
}
