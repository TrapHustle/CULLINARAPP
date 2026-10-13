import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormulaireSelection, SupprimerSelection } from "@/components/espace/formulaires-evenement";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { selectionDeLOrganisation } from "@/lib/evenements";
import { LIBELLES_ETAT, versChampDateHeure, type EtatSelection } from "@/lib/evenements-core";

export const metadata: Metadata = { title: "Sélection — DIGITALYX-VOTE" };

export default async function PageSelection({
  params,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const selection = await selectionDeLOrganisation(utilisateur.organisationId, selectionId);
  if (!selection || selection.evenementId !== evenementId) notFound();

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>
            <Link href={`/espace/e/${evenementId}/selections`} style={{ color: "inherit" }}>
              Sélections
            </Link>{" "}
            · n° {selection.rang}
          </div>
          <h1 className={styles.titre}>{selection.libelle}</h1>
          <p className={styles.sousTitre}>{selection.evenement.nom}</p>
        </div>
        <span className={`${styles.etat} ${styles[`etat${selection.etat}`]}`}>
          {LIBELLES_ETAT[selection.etat as EtatSelection]}
        </span>
      </div>

      <section className={styles.carte}>
        <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
          <div>
            <h2 className={styles.carteTitre}>Informations</h2>
          </div>
        </div>
        <FormulaireSelection
          evenementId={evenementId}
          selectionId={selection.id}
          valeurs={{
            libelle: selection.libelle,
            lieu: selection.lieu ?? "",
            debut: versChampDateHeure(selection.debut),
            fin: versChampDateHeure(selection.fin),
            nbQualifies: String(selection.nbQualifies),
          }}
        />
      </section>

      <section className={styles.carte}>
        <div className={styles.carteHaut}>
          <div>
            <h2 className={styles.carteTitre}>Lien public de vote</h2>
            <p className={styles.carteTexte}>
              Il deviendra actif à l&rsquo;ouverture de la sélection.
            </p>
          </div>
        </div>
        <div className={styles.carteCorps}>
          <div className={styles.lienPublic}>
            <Icone nom="cadenas" taille={16} />
            /v/{selection.slug}
          </div>
        </div>
      </section>

      {selection.etat === "PREPAREE" ? (
        <div className={styles.zoneDanger}>
          <div>
            <strong>Supprimer la sélection</strong>
            <p>Possible tant qu&rsquo;elle n&rsquo;a reçu ni vote ni paiement.</p>
          </div>
          <SupprimerSelection evenementId={evenementId} selectionId={selection.id} />
        </div>
      ) : null}
    </>
  );
}
