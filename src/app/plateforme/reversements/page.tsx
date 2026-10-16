import type { Metadata } from "next";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { dateHeure, nombre } from "@/lib/format-espace";
import { listerRetraitsPlateforme } from "@/lib/plateforme";
import { traiterRetraitAction } from "@/lib/plateforme-actions";
import { WITHDRAWAL_STATUS_LABELS, type WithdrawalStatus } from "@/lib/withdrawal-core";

export const metadata: Metadata = { title: "Reversements — Plateforme DIGITALYX-VOTE" };

export default async function PageReversements() {
  await exigerSuperAdmin();
  const retraits = await listerRetraitsPlateforme();
  const enAttente = retraits.filter((r) => r.statut === "PENDING");
  const traites = retraits.filter((r) => r.statut !== "PENDING");

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Toute la plateforme</div>
          <h1 className={styles.titre}>
            Les <em>reversements</em>
          </h1>
          <p className={styles.sousTitre}>Faites le virement, puis marquez la demande payée : l&rsquo;organisation le voit aussitôt.</p>
        </div>
      </div>

      {enAttente.length === 0 ? (
        <section className={styles.carte}>
          <div className={styles.vide}>
            <strong>Rien à traiter</strong>
            Aucune demande de retrait en attente.
          </div>
        </section>
      ) : null}

      {enAttente.map((r) => (
        <section key={r.id} className={styles.carte}>
          <div className={styles.carteHaut}>
            <div>
              <div className={styles.surtitre}>Demandé le {dateHeure(r.creeLe)}</div>
              <h2 className={styles.carteTitre} style={{ marginTop: 6, fontWeight: 800 }}>
                {nombre(r.montant)} FCFA → {r.organisation.nom}
              </h2>
              <p className={styles.carteTexte}>
                {r.moyen} · <strong>{r.telephone}</strong>
                {r.note ? ` · « ${r.note} »` : ""}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "0 24px 22px" }}>
            <FormulaireAction
              action={traiterRetraitAction.bind(null, r.id, "PAID")}
              className={styles.formLigne}
              confirmer={`Le virement de ${nombre(r.montant)} FCFA est-il fait ?`}
            >
              <input name="note" placeholder="Référence du virement (facultatif)" maxLength={400} aria-label="Note" />
              <button type="submit" className={`${styles.bouton} ${styles.boutonPrincipal} ${styles.boutonPetit}`}>
                Marquer payée
              </button>
            </FormulaireAction>
            <FormulaireAction
              action={traiterRetraitAction.bind(null, r.id, "REJECTED")}
              className={styles.formLigne}
              confirmer="Refuser cette demande ?"
            >
              <input name="note" placeholder="Motif du refus" maxLength={400} aria-label="Motif" required />
              <button type="submit" className={`${styles.bouton} ${styles.boutonDanger} ${styles.boutonPetit}`}>
                Refuser
              </button>
            </FormulaireAction>
          </div>
        </section>
      ))}

      {traites.length > 0 ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <h2 className={styles.carteTitre}>Historique</h2>
          </div>
          <div className={styles.tableauBoite}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Demandé le</th>
                  <th>Organisation</th>
                  <th className={styles.nombre}>Montant</th>
                  <th>Vers</th>
                  <th>Statut</th>
                  <th>Traité le</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {traites.map((r) => (
                  <tr key={r.id}>
                    <td>{dateHeure(r.creeLe)}</td>
                    <td className={styles.fort}>{r.organisation.nom}</td>
                    <td className={`${styles.nombre} ${styles.fort}`}>{nombre(r.montant)} FCFA</td>
                    <td>
                      {r.moyen} · {r.telephone}
                    </td>
                    <td>
                      <span className={`${styles.pastille} ${r.statut === "PAID" ? styles.pastilleVerte : styles.pastilleRouge}`}>
                        {WITHDRAWAL_STATUS_LABELS[r.statut as WithdrawalStatus] ?? r.statut}
                      </span>
                    </td>
                    <td>{r.traiteeLe ? dateHeure(r.traiteeLe) : "—"}</td>
                    <td>{r.noteAdmin ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
