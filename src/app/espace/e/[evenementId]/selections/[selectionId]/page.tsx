import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormulaireSelection, SupprimerSelection } from "@/components/espace/formulaires-evenement";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { arrondi2 } from "@/lib/calcul";
import { exigerUtilisateur } from "@/lib/espace";
import { versChampDateHeure } from "@/lib/evenements-core";
import { dateHeure } from "@/lib/format-espace";
import { controlesDe, lireSelectionPilotage, selectionSuivante } from "@/lib/pilotage";
import {
  basculerEnLigneAction,
  basculerSalleAction,
  cloturerAction,
  ouvrirAction,
  qualifiesAction,
  reporterAction,
} from "@/lib/pilotage-actions";
import { peutOuvrir, qualifiesProposes } from "@/lib/pilotage-core";
import { vueResultats, type LigneVue } from "@/lib/resultats-vue";

export const metadata: Metadata = { title: "Pilotage de la sélection — DIGITALYX-VOTE" };

const note = (n: number | null) => (n === null ? "non noté" : `${arrondi2(n).toLocaleString("fr-FR")} / 100`);

export default async function PagePilotage({
  params,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const selection = await lireSelectionPilotage(utilisateur.organisationId, selectionId);
  if (!selection || selection.evenementId !== evenementId) notFound();

  const controles = controlesDe(selection);
  const pret = peutOuvrir(controles);
  const enLigne = selection.typesVote.some((t) => t.canal === "EN_LIGNE");
  // Ouverte : classement en direct ; clôturée : classement figé de l'archive.
  const resultats = selection.etat === "PREPAREE" ? null : await vueResultats(utilisateur.organisationId, selectionId);
  const suivante = selection.etat === "CLOTUREE" ? await selectionSuivante(evenementId, selection.rang) : null;
  const proposes = resultats ? qualifiesProposes(resultats.lignes, selection.nbQualifies) : new Set<string>();
  const base = `/espace/e/${evenementId}/selections/${selectionId}`;

  return (
    <>
      {selection.etat === "PREPAREE" ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <div>
              <div className={styles.surtitre}>Étape 1 sur 3 · Préparation</div>
              <h2 className={styles.carteTitre} style={{ marginTop: 6 }}>
                Contrôle avant ouverture
              </h2>
              <p className={styles.carteTexte}>
                Une fois ouverte, la sélection accepte les votes et sa grille comme son mode de calcul sont figés.
              </p>
            </div>
            {pret ? (
              <FormulaireAction
                action={ouvrirAction.bind(null, selectionId)}
                bouton="Ouvrir le vote"
                boutonEnvoi="Ouverture…"
                confirmer="Ouvrir la sélection au vote ? La grille et le mode de calcul seront figés."
              />
            ) : null}
          </div>
          <ul className={styles.controles}>
            {controles.map((c) => (
              <li key={c.libelle}>
                <span className={c.ok ? styles.controleOk : styles.controleKo}>
                  <Icone nom={c.ok ? "coche" : "bouclier"} taille={18} />
                </span>
                <span>
                  <strong style={{ display: "block" }}>{c.libelle}</strong>
                  {c.ok ? null : <span style={{ color: "var(--gris)" }}>{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selection.etat === "OUVERTE" ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <div>
              <div className={styles.direct}>
                <span className={styles.pulsation} /> Étape 2 sur 3 · Vote en cours
              </div>
              <h2 className={styles.carteTitre} style={{ marginTop: 10 }}>
                Ouverte {selection.debut ? `depuis le ${dateHeure(selection.debut)}` : ""}
              </h2>
              <p className={styles.carteTexte}>
                Suivez le classement dans l&rsquo;onglet <Link href={`${base}/resultats`}>Résultats</Link>, saisissez les fiches
                du jury dans <Link href={`${base}/notes`}>Notes du jury</Link>.
              </p>
            </div>
            <a href={`/projection/${selectionId}`} target="_blank" rel="noreferrer" className={`${styles.bouton} ${styles.boutonSecondaire}`}>
              <Icone nom="lecture" taille={16} /> Écran de proclamation
            </a>
          </div>
          {enLigne ? (
            <div className={styles.interrupteur}>
              <div>
                <strong>Vote en ligne {selection.voteEnLigneOuvert ? "ouvert" : "suspendu"}</strong>
                <span>
                  Page publique : <a href={`/v/${selection.slug}`} target="_blank" rel="noreferrer">/v/{selection.slug}</a>
                  {selection.fin ? ` · se ferme seul le ${dateHeure(selection.fin)}` : ""}
                </span>
              </div>
              <FormulaireAction
                action={basculerEnLigneAction.bind(null, selectionId, !selection.voteEnLigneOuvert)}
                bouton={selection.voteEnLigneOuvert ? "Suspendre" : "Reprendre"}
                variante="secondaire"
                discret
              />
            </div>
          ) : null}
          <div className={styles.interrupteur}>
            <div>
              <strong>Vote en salle {selection.voteSalleOuvert ? "ouvert" : "suspendu"}</strong>
              <span>Notes du jury et voix de la salle.</span>
            </div>
            <FormulaireAction
              action={basculerSalleAction.bind(null, selectionId, !selection.voteSalleOuvert)}
              bouton={selection.voteSalleOuvert ? "Suspendre" : "Reprendre"}
              variante="secondaire"
              discret
            />
          </div>
        </section>
      ) : null}

      {selection.etat === "OUVERTE" && resultats ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <div>
              <div className={styles.surtitre}>Étape 3 sur 3 · Clôture</div>
              <h2 className={styles.carteTitre} style={{ marginTop: 6 }}>
                Clôturer et désigner les qualifiés
              </h2>
              <p className={styles.carteTexte}>
                La clôture arrête tous les votes et fige le classement officiel (sans les paiements simulés). Les{" "}
                {selection.nbQualifies} premiers sont proposés ; en cas d&rsquo;égalité, c&rsquo;est vous qui tranchez.
              </p>
            </div>
          </div>
          <FormulaireAction
            action={cloturerAction.bind(null, selectionId)}
            bouton="Clôturer définitivement"
            boutonEnvoi="Clôture…"
            variante="danger"
            confirmer="Clôturer la sélection ? Plus aucun vote ne sera accepté."
            style={{ padding: "0 24px 22px" }}
          >
            <ChoixQualifies lignes={resultats.lignes} coches={proposes} />
            <label className={styles.champ} style={{ maxWidth: 360, margin: "16px 0" }}>
              <span>Pour confirmer, tapez CLOTURER</span>
              <input name="confirmation" autoComplete="off" required />
            </label>
          </FormulaireAction>
        </section>
      ) : null}

      {selection.etat === "CLOTUREE" && resultats ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <div>
              <div className={styles.surtitre}>Sélection clôturée</div>
              <h2 className={styles.carteTitre} style={{ marginTop: 6 }}>
                Qualifiés
              </h2>
              <p className={styles.carteTexte}>
                Résultats figés le {selection.archives[0] ? dateHeure(selection.archives[0].clotureLe) : "—"} (onglet{" "}
                <Link href={`${base}/resultats`}>Résultats</Link>). Vous pouvez encore corriger la liste des qualifiés.
              </p>
            </div>
            {suivante ? (
              <FormulaireAction
                action={reporterAction.bind(null, selectionId)}
                bouton={`Inscrire les qualifiés à « ${suivante.libelle} »`}
                confirmer={`Inscrire les qualifiés à « ${suivante.libelle} » ? Leurs votes repartent de zéro.`}
              />
            ) : (
              <span className={`${styles.pastille} ${styles.pastilleBleue}`}>Dernière sélection : finale</span>
            )}
          </div>
          <FormulaireAction
            action={qualifiesAction.bind(null, selectionId)}
            bouton="Enregistrer les qualifiés"
            variante="secondaire"
            style={{ padding: "0 24px 22px" }}
          >
            <ChoixQualifies
              lignes={resultats.lignes}
              coches={new Set(selection.participations.filter((p) => p.qualifie).map((p) => p.id))}
            />
            <div style={{ height: 14 }} />
          </FormulaireAction>
        </section>
      ) : null}

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

function ChoixQualifies({
  lignes,
  coches,
}: {
  lignes: LigneVue[];
  coches: Set<string>;
}) {
  return (
    <div className={styles.tableauBoite} style={{ border: "1px solid var(--filet)", borderRadius: 12 }}>
      <table className={styles.tableau}>
        <thead>
          <tr>
            <th>Qualifié</th>
            <th>Rang</th>
            <th>Candidat</th>
            <th className={styles.nombre}>Note finale</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.participationId}>
              <td>
                <input
                  type="checkbox"
                  name="qualifie"
                  value={l.participationId}
                  defaultChecked={coches.has(l.participationId)}
                  aria-label={`Qualifier ${l.nom}`}
                  style={{ width: 18, height: 18, accentColor: "var(--bleu)" }}
                />
              </td>
              <td>{l.rang ?? "—"}</td>
              <td className={styles.fort}>
                {l.nom}
                {l.egalite ? (
                  <span className={`${styles.pastille} ${styles.pastilleRouge}`} style={{ marginLeft: 8 }}>
                    égalité
                  </span>
                ) : null}
              </td>
              <td className={`${styles.nombre} ${styles.fort}`}>{note(l.note)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
