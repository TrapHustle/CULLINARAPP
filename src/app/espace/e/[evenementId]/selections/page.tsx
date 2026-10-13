import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeplacerSelection, FormulaireSelection } from "@/components/espace/formulaires-evenement";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { evenementDeLOrganisation, listerSelections } from "@/lib/evenements";
import { LIBELLES_ETAT, type EtatSelection } from "@/lib/evenements-core";
import { dateHeure } from "@/lib/format-espace";

export const metadata: Metadata = { title: "Sélections — DIGITALYX-VOTE" };

export default async function PageSelections({ params }: { params: Promise<{ evenementId: string }> }) {
  const { evenementId } = await params;
  const utilisateur = await exigerUtilisateur();
  const evenement = await evenementDeLOrganisation(utilisateur.organisationId, evenementId);
  if (!evenement) notFound();

  const selections = await listerSelections(utilisateur.organisationId, evenementId);

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>{evenement.nom}</div>
          <h1 className={styles.titre}>Sélections</h1>
          <p className={styles.sousTitre}>
            Les tours du concours, dans l&rsquo;ordre. La dernière sélection est la finale.
          </p>
        </div>
      </div>

      <section className={styles.carte}>
        <div className={styles.carteHaut}>
          <div>
            <h2 className={styles.carteTitre}>
              {selections.length} sélection{selections.length > 1 ? "s" : ""}
            </h2>
            <p className={styles.carteTexte}>Changez l&rsquo;ordre avec les flèches.</p>
          </div>
        </div>
        {selections.length === 0 ? (
          <div className={styles.vide} style={{ paddingTop: 8 }}>
            Aucune sélection pour l&rsquo;instant. Ajoutez la première ci-dessous.
          </div>
        ) : (
          <ul className={styles.lignes}>
            {selections.map((selection, index) => {
              const finale = index === selections.length - 1 && selections.length > 1;
              return (
                <li key={selection.id} className={styles.ligne}>
                  <span className={styles.ligneRang}>{selection.rang}</span>
                  <div className={styles.ligneTexte}>
                    <Link href={`/espace/e/${evenementId}/selections/${selection.id}`}>{selection.libelle}</Link>
                    <div className={styles.ligneMeta}>
                      {finale ? <span>Finale</span> : null}
                      {selection.lieu ? (
                        <span>
                          <Icone nom="lieu" taille={14} />
                          {selection.lieu}
                        </span>
                      ) : null}
                      {selection.debut ? (
                        <span>
                          <Icone nom="horloge" taille={14} />
                          {dateHeure(selection.debut)}
                        </span>
                      ) : null}
                      <span>
                        <Icone nom="personnes" taille={14} />
                        {selection._count.participations} candidat{selection._count.participations > 1 ? "s" : ""}
                      </span>
                      {selection.nbQualifies > 0 ? <span>{selection.nbQualifies} qualifiés</span> : null}
                    </div>
                  </div>
                  <span className={`${styles.etat} ${styles[`etat${selection.etat}`]}`}>
                    {LIBELLES_ETAT[selection.etat as EtatSelection]}
                  </span>
                  <div className={styles.ligneActions}>
                    <DeplacerSelection
                      evenementId={evenementId}
                      selectionId={selection.id}
                      premiere={index === 0}
                      derniere={index === selections.length - 1}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.carte}>
        <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
          <div>
            <h2 className={styles.carteTitre}>Ajouter une sélection</h2>
            <p className={styles.carteTexte}>Elle prendra place après la dernière.</p>
          </div>
        </div>
        <FormulaireSelection evenementId={evenementId} />
      </section>
    </>
  );
}
