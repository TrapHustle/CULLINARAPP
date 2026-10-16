import type { Metadata } from "next";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { dateHeure, nombre } from "@/lib/format-espace";
import { LIBELLES_MOYEN } from "@/lib/grille-core";
import { annulerRetraitAction, demanderRetraitAction } from "@/lib/organisation-actions";
import { maskPhone, type PaymentMethod } from "@/lib/public-vote-core";
import { derniersPaiements, recettesOrganisation, recettesParSelection, retraitsOrganisation } from "@/lib/recettes";
import { MIN_WITHDRAWAL_AMOUNT, WITHDRAWAL_METHODS, WITHDRAWAL_STATUS_LABELS, type WithdrawalStatus } from "@/lib/withdrawal-core";

export const metadata: Metadata = { title: "Recettes — DIGITALYX-VOTE" };

const fcfa = (n: number) => `${nombre(n)} FCFA`;
const STATUTS_PAIEMENT: Record<string, string> = { CONFIRMED: "Confirmé", PENDING: "En attente", FAILED: "Échoué" };

export default async function PageRecettes() {
  const utilisateur = await exigerUtilisateur();
  const org = utilisateur.organisationId;
  const [recettes, parSelection, paiements, retraits] = await Promise.all([
    recettesOrganisation(org),
    recettesParSelection(org),
    derniersPaiements(org),
    retraitsOrganisation(org),
  ]);
  const proprietaire = utilisateur.role === "PROPRIETAIRE";
  const enAttente = retraits.find((r) => r.statut === "PENDING");

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>{utilisateur.organisation.nom}</div>
          <h1 className={styles.titre}>
            Recettes &amp; <em>reversements</em>
          </h1>
          <p className={styles.sousTitre}>
            Les votes payés sont encaissés par la plateforme ; vous en recevez {recettes.taux.toLocaleString("fr-FR")} % sur demande de retrait.
          </p>
        </div>
      </div>

      <div className={styles.chiffres}>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.bleu}`}>
            <Icone nom="urne" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Recettes confirmées</span>
          <strong className={styles.chiffreValeur}>{fcfa(recettes.brut)}</strong>
          <span className={styles.chiffreDetail}>
            {nombre(recettes.nbPaiements)} paiement{recettes.nbPaiements > 1 ? "s" : ""} réel{recettes.nbPaiements > 1 ? "s" : ""}
          </span>
        </div>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.violet}`}>
            <Icone nom="personnes" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Votre part ({recettes.taux.toLocaleString("fr-FR")} %)</span>
          <strong className={styles.chiffreValeur}>{fcfa(recettes.partOrganisateur)}</strong>
          <span className={styles.chiffreDetail}>Commission plateforme : {fcfa(recettes.commission)}</span>
        </div>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.vert}`}>
            <Icone nom="coche" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Disponible au retrait</span>
          <strong className={styles.chiffreValeur}>{fcfa(recettes.solde.available)}</strong>
          <span className={styles.chiffreDetail}>
            Déjà reversé {fcfa(recettes.solde.paid)}
            {recettes.solde.pending > 0 ? ` · en cours ${fcfa(recettes.solde.pending)}` : ""}
          </span>
        </div>
      </div>

      {recettes.simules.nb > 0 || recettes.enAttente.nb > 0 ? (
        <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
          <Icone nom="etincelle" taille={18} />
          <div>
            {recettes.simules.nb > 0 ? (
              <strong>
                {nombre(recettes.simules.nb)} paiement{recettes.simules.nb > 1 ? "s" : ""} simulé{recettes.simules.nb > 1 ? "s" : ""} (
                {fcfa(recettes.simules.montant)}) : démonstration, aucun argent reçu, jamais reversable.
              </strong>
            ) : null}
            {recettes.enAttente.nb > 0 ? (
              <span>
                {nombre(recettes.enAttente.nb)} paiement{recettes.enAttente.nb > 1 ? "s" : ""} en attente de confirmation (
                {fcfa(recettes.enAttente.montant)}).
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className={styles.carte}>
        <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
          <div>
            <h2 className={styles.carteTitre}>Demander un retrait</h2>
            <p className={styles.carteTexte}>
              Minimum {fcfa(MIN_WITHDRAWAL_AMOUNT)}. Une demande à la fois ; la plateforme vous vire la somme puis la marque
              « payée ».
            </p>
          </div>
        </div>
        {!proprietaire ? (
          <p className={styles.carteTexte} style={{ padding: "12px 24px 22px" }}>
            Seul le propriétaire du compte peut demander un retrait.
          </p>
        ) : enAttente ? (
          <div className={styles.interrupteur} style={{ borderTop: 0 }}>
            <div>
              <strong>Demande en attente : {fcfa(enAttente.montant)}</strong>
              <span>
                {LIBELLES_MOYEN[enAttente.moyen as PaymentMethod] ?? enAttente.moyen} · {maskPhone(enAttente.telephone)} · le{" "}
                {dateHeure(enAttente.creeLe)}
              </span>
            </div>
            <FormulaireAction
              action={annulerRetraitAction.bind(null, enAttente.id)}
              bouton="Annuler la demande"
              variante="secondaire"
              confirmer="Annuler cette demande de retrait ?"
            />
          </div>
        ) : (
          <FormulaireAction action={demanderRetraitAction} className={styles.formulaire} bouton="Envoyer la demande" vider>
            <label className={styles.champ}>
              <span>Montant (FCFA)</span>
              <input name="montant" inputMode="numeric" required placeholder={String(recettes.solde.available)} />
              <small>Disponible : {fcfa(recettes.solde.available)}</small>
            </label>
            <label className={styles.champ}>
              <span>Recevoir par</span>
              <select name="moyen" defaultValue="WAVE">
                {WITHDRAWAL_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {LIBELLES_MOYEN[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.champ}>
              <span>Numéro qui reçoit</span>
              <input name="telephone" type="tel" required placeholder="07 00 00 00 00" />
            </label>
            <label className={`${styles.champ} ${styles.champLarge}`}>
              <span>Message (facultatif)</span>
              <input name="note" maxLength={400} placeholder="Pour la finale du 20 octobre" />
            </label>
          </FormulaireAction>
        )}
      </section>

      {parSelection.length > 0 ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <h2 className={styles.carteTitre}>Par sélection</h2>
          </div>
          <div className={styles.tableauBoite}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Sélection</th>
                  <th className={styles.nombre}>Paiements</th>
                  <th className={styles.nombre}>Voix</th>
                  <th className={styles.nombre}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {parSelection.map((s) => (
                  <tr key={s.nom}>
                    <td className={styles.fort}>{s.nom}</td>
                    <td className={styles.nombre}>{nombre(s.paiements)}</td>
                    <td className={styles.nombre}>{nombre(s.voix)}</td>
                    <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(s.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className={styles.carte}>
        <div className={styles.carteHaut}>
          <h2 className={styles.carteTitre}>Derniers paiements</h2>
        </div>
        {paiements.length === 0 ? (
          <div className={styles.vide} style={{ paddingTop: 0 }}>
            Aucun paiement pour l&rsquo;instant.
          </div>
        ) : (
          <div className={styles.tableauBoite}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Référence</th>
                  <th>Candidat</th>
                  <th>Sélection</th>
                  <th>Moyen</th>
                  <th className={styles.nombre}>Voix</th>
                  <th className={styles.nombre}>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((p) => (
                  <tr key={p.id}>
                    <td>{dateHeure(p.creeLe)}</td>
                    <td>{p.reference}</td>
                    <td className={styles.fort}>{p.candidatNom}</td>
                    <td>{p.selection?.libelle ?? "—"}</td>
                    <td>
                      {LIBELLES_MOYEN[p.moyen as PaymentMethod] ?? p.moyen} · {maskPhone(p.telephone)}
                    </td>
                    <td className={styles.nombre}>{nombre(p.voix)}</td>
                    <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(p.montant)}</td>
                    <td>
                      <span
                        className={`${styles.pastille} ${p.statut === "CONFIRMED" ? styles.pastilleVerte : p.statut === "FAILED" ? styles.pastilleRouge : ""}`}
                      >
                        {p.simule ? "Simulé" : (STATUTS_PAIEMENT[p.statut] ?? p.statut)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {retraits.length > 0 ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <h2 className={styles.carteTitre}>Historique des retraits</h2>
          </div>
          <div className={styles.tableauBoite}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Demandé le</th>
                  <th className={styles.nombre}>Montant</th>
                  <th>Vers</th>
                  <th>Statut</th>
                  <th>Note de la plateforme</th>
                </tr>
              </thead>
              <tbody>
                {retraits.map((r) => (
                  <tr key={r.id}>
                    <td>{dateHeure(r.creeLe)}</td>
                    <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(r.montant)}</td>
                    <td>
                      {LIBELLES_MOYEN[r.moyen as PaymentMethod] ?? r.moyen} · {maskPhone(r.telephone)}
                    </td>
                    <td>
                      <span
                        className={`${styles.pastille} ${r.statut === "PAID" ? styles.pastilleVerte : r.statut === "REJECTED" ? styles.pastilleRouge : ""}`}
                      >
                        {WITHDRAWAL_STATUS_LABELS[r.statut as WithdrawalStatus] ?? r.statut}
                      </span>
                    </td>
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

