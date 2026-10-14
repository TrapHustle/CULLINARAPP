import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormulaireEvenement, ImageEvenement, SupprimerEvenement } from "@/components/espace/formulaires-evenement";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { evenementDeLOrganisation } from "@/lib/evenements";
import { versChampDate } from "@/lib/evenements-core";

export const metadata: Metadata = { title: "Paramètres — DIGITALYX-VOTE" };

export default async function PageParametres({ params }: { params: Promise<{ evenementId: string }> }) {
  const { evenementId } = await params;
  const utilisateur = await exigerUtilisateur();
  const evenement = await evenementDeLOrganisation(utilisateur.organisationId, evenementId);
  if (!evenement) notFound();

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>{evenement.nom}</div>
          <h1 className={styles.titre}>Paramètres de <em>l&rsquo;événement</em></h1>
        </div>
      </div>

      <section className={styles.carte}>
        <FormulaireEvenement
          evenementId={evenement.id}
          valeurs={{
            nom: evenement.nom,
            edition: evenement.edition ? String(evenement.edition) : "",
            sousTitre: evenement.sousTitre ?? "",
            date: versChampDate(evenement.date),
          }}
        />
      </section>

      <section className={styles.carte}>
        <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
          <div>
            <h2 className={styles.carteTitre}>Image du concours</h2>
            <p className={styles.carteTexte}>Bannière de la page de vote et vignette de l&rsquo;événement.</p>
          </div>
        </div>
        <ImageEvenement evenementId={evenement.id} afficheUrl={evenement.afficheUrl} />
      </section>

      <div className={styles.zoneDanger}>
        <div>
          <strong>Supprimer l&rsquo;événement</strong>
          <p>Possible tant qu&rsquo;aucune de ses sélections n&rsquo;a reçu de vote ou de paiement.</p>
        </div>
        <SupprimerEvenement evenementId={evenement.id} />
      </div>
    </>
  );
}
