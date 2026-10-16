import type { Metadata } from "next";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { dateLongue, nombre } from "@/lib/format-espace";
import { listerOrganisations } from "@/lib/plateforme";
import { reglerOrganisationAction, supprimerOrganisationAction } from "@/lib/plateforme-actions";

export const metadata: Metadata = { title: "Organisations — Plateforme DIGITALYX-VOTE" };

export default async function PageOrganisations() {
  await exigerSuperAdmin();
  const organisations = await listerOrganisations();
  const serveurReel = process.env.PAIEMENT_MODE === "sirap";

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Clients de la plateforme</div>
          <h1 className={styles.titre}>
            Les <em>organisations</em>
          </h1>
          <p className={styles.sousTitre}>
            Une organisation s&rsquo;inscrit seule sur /inscription. Ici : part reversée, paiements réels, suspension.
          </p>
        </div>
      </div>

      {!serveurReel ? (
        <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
          <div>
            <strong>Serveur en simulation</strong>
            <span>
              PAIEMENT_MODE n&rsquo;est pas « sirap » sur ce serveur : même une organisation réglée en paiements réels
              reste en simulation.
            </span>
          </div>
        </div>
      ) : null}

      {organisations.length === 0 ? (
        <section className={styles.carte}>
          <div className={styles.vide}>
            <strong>Aucune organisation cliente</strong>
            Elles apparaîtront ici dès leur inscription.
          </div>
        </section>
      ) : null}

      {organisations.map((o) => {
        const proprietaire = o.utilisateurs.find((u) => u.role === "PROPRIETAIRE") ?? o.utilisateurs[0];
        return (
          <section key={o.id} className={styles.carte}>
            <div className={styles.carteHaut}>
              <div>
                <h2 className={styles.carteTitre} style={{ fontWeight: 800, fontStyle: "italic" }}>
                  {o.nom}
                </h2>
                <div className={styles.pastilles}>
                  <span className={`${styles.pastille} ${o.actif ? styles.pastilleVerte : styles.pastilleRouge}`}>
                    {o.actif ? "Active" : "Suspendue"}
                  </span>
                  <span className={`${styles.pastille} ${o.mode === "sirap" ? styles.pastilleBleue : ""}`}>
                    {o.mode === "sirap" ? "Paiements réels" : "Simulation"}
                  </span>
                  <span className={styles.pastille}>{proprietaire?.email ?? "sans compte"}</span>
                  <span className={styles.pastille}>
                    {o._count.evenements} événement{o._count.evenements > 1 ? "s" : ""} · {o._count.candidats} candidat
                    {o._count.candidats > 1 ? "s" : ""}
                  </span>
                  <span className={styles.pastille}>Encaissé {nombre(o.brut)} FCFA</span>
                  <span className={styles.pastille}>Inscrite le {dateLongue(o.creeLe)}</span>
                </div>
              </div>
              <FormulaireAction
                action={supprimerOrganisationAction.bind(null, o.id)}
                bouton="Supprimer"
                variante="danger"
                confirmer={`Supprimer définitivement « ${o.nom} » et ses données ?`}
              />
            </div>
            <FormulaireAction
              action={reglerOrganisationAction.bind(null, o.id)}
              className={styles.formulaire}
              bouton="Enregistrer"
              variante="secondaire"
              style={{ paddingTop: 0 }}
            >
              <label className={styles.champ}>
                <span>Part reversée à l&rsquo;organisation (%)</span>
                <input name="partOrganisateur" defaultValue={String(o.partOrganisateur).replace(".", ",")} inputMode="decimal" required />
                <small>La plateforme garde le reste en commission.</small>
              </label>
              <label className={styles.champ}>
                <span>Paiements</span>
                <select name="mode" defaultValue={o.mode}>
                  <option value="simulation">Simulation (rien n&rsquo;est prélevé)</option>
                  <option value="sirap">Réels (passerelle SIRAP)</option>
                </select>
              </label>
              <label className={styles.caseACocher}>
                <input type="checkbox" name="actif" defaultChecked={o.actif} />
                <span>
                  Organisation active
                  <small>Décochée : plus d&rsquo;accès à l&rsquo;espace, pages de vote fermées. Les données restent.</small>
                </span>
              </label>
            </FormulaireAction>
          </section>
        );
      })}
    </>
  );
}
