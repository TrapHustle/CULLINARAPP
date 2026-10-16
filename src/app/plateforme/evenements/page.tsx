import type { Metadata } from "next";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { LIBELLES_ETAT, type EtatSelection } from "@/lib/evenements-core";
import { dateLongue } from "@/lib/format-espace";
import { listerEvenementsPlateforme } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Événements — Plateforme DIGITALYX-VOTE" };

export default async function PageEvenementsPlateforme() {
  await exigerSuperAdmin();
  const evenements = await listerEvenementsPlateforme();

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Toute la plateforme</div>
          <h1 className={styles.titre}>
            Les <em>événements</em>
          </h1>
          <p className={styles.sousTitre}>Les 200 derniers, toutes organisations confondues.</p>
        </div>
      </div>

      <section className={styles.carte}>
        {evenements.length === 0 ? (
          <div className={styles.vide}>Aucun événement.</div>
        ) : (
          <div className={styles.tableauBoite}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Événement</th>
                  <th>Organisation</th>
                  <th>Créé le</th>
                  <th>Sélections</th>
                </tr>
              </thead>
              <tbody>
                {evenements.map((e) => (
                  <tr key={e.id}>
                    <td className={styles.fort}>{e.nom}</td>
                    <td>
                      {e.organisation.nom}
                      {!e.organisation.actif ? (
                        <span className={`${styles.pastille} ${styles.pastilleRouge}`} style={{ marginLeft: 6 }}>
                          suspendue
                        </span>
                      ) : null}
                    </td>
                    <td>{dateLongue(e.creeLe)}</td>
                    <td>
                      <div className={styles.pastilles} style={{ marginTop: 0 }}>
                        {e.selections.length === 0 ? "—" : null}
                        {e.selections.map((s) => (
                          <a
                            key={s.id}
                            href={`/v/${s.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`${styles.pastille} ${s.etat === "OUVERTE" ? styles.pastilleVerte : ""}`}
                            style={{ textDecoration: "none" }}
                          >
                            {s.libelle} · {LIBELLES_ETAT[s.etat as EtatSelection]} · {s._count.participations} cand.
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
