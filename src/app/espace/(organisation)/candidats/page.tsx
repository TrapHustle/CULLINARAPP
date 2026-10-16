import type { Metadata } from "next";
import { ChampsCandidat, Portrait } from "@/components/espace/candidat";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { listerCandidats } from "@/lib/candidats";
import { creerCandidatAction, modifierCandidatAction, supprimerCandidatAction } from "@/lib/candidats-actions";
import { exigerUtilisateur } from "@/lib/espace";

export const metadata: Metadata = { title: "Candidats — DIGITALYX-VOTE" };

export default async function PageCandidats() {
  const utilisateur = await exigerUtilisateur();
  const candidats = await listerCandidats(utilisateur.organisationId);

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>{utilisateur.organisation.nom}</div>
          <h1 className={styles.titre}>
            Vos <em>candidats</em>
          </h1>
          <p className={styles.sousTitre}>
            Un candidat est créé une fois, puis inscrit aux sélections de vos événements, d&rsquo;une édition à l&rsquo;autre.
          </p>
        </div>
      </div>

      <section className={styles.carte}>
        <div className={styles.carteHaut}>
          <div>
            <h2 className={styles.carteTitre}>
              {candidats.length} candidat{candidats.length > 1 ? "s" : ""}
            </h2>
            <p className={styles.carteTexte}>Cliquez sur un candidat pour modifier son nom, sa ville ou sa photo.</p>
          </div>
        </div>
        {candidats.length === 0 ? (
          <div className={styles.vide} style={{ paddingTop: 8 }}>
            Aucun candidat pour l&rsquo;instant. Ajoutez le premier ci-dessous, ou directement depuis une sélection.
          </div>
        ) : (
          <ul className={styles.lignes}>
            {candidats.map((c) => (
              <li key={c.id} className={styles.ligne} style={{ alignItems: "flex-start" }}>
                <Portrait nom={c.nom} photoUrl={c.photoUrl} />
                <details className={styles.ligneTexte}>
                  <summary style={{ cursor: "pointer", listStyle: "none" }}>
                    <span className={styles.ligneTitre}>{c.nom}</span>
                    <div className={styles.ligneMeta}>
                      {c.ville ? (
                        <span>
                          <Icone nom="lieu" taille={14} />
                          {c.ville}
                        </span>
                      ) : null}
                      <span>
                        {c.participations.length === 0
                          ? "Inscrit nulle part"
                          : c.participations.map((p) => `${p.selection.evenement.nom} · ${p.selection.libelle}`).join(" — ")}
                      </span>
                    </div>
                  </summary>
                  <FormulaireAction
                    action={modifierCandidatAction.bind(null, c.id)}
                    className={styles.formulaire}
                    style={{ padding: "16px 0 4px" }}
                    bouton="Enregistrer"
                    discret
                  >
                    <ChampsCandidat nom={c.nom} ville={c.ville ?? ""} />
                  </FormulaireAction>
                </details>
                {c.participations.length === 0 ? (
                  <FormulaireAction
                    action={supprimerCandidatAction.bind(null, c.id)}
                    confirmer={`Supprimer ${c.nom} de vos candidats ?`}
                    discret
                  >
                    <button
                      type="submit"
                      className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonIcone}`}
                      title="Supprimer"
                      aria-label={`Supprimer ${c.nom}`}
                    >
                      <Icone nom="corbeille" taille={16} />
                    </button>
                  </FormulaireAction>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.carte}>
        <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
          <div>
            <h2 className={styles.carteTitre}>Ajouter un candidat</h2>
          </div>
        </div>
        <FormulaireAction action={creerCandidatAction} className={styles.formulaire} bouton="Ajouter le candidat" vider>
          <ChampsCandidat />
        </FormulaireAction>
      </section>
    </>
  );
}
