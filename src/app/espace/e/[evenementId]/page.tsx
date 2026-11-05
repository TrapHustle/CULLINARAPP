import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { arrondi2 } from "@/lib/calcul";
import { exigerUtilisateur } from "@/lib/espace";
import { chiffresEvenement, evenementDeLOrganisation } from "@/lib/evenements";
import { LIBELLES_ETAT, type EtatSelection } from "@/lib/evenements-core";
import { dateHeure, nombre, salutation } from "@/lib/format-espace";
import { basculerEnLigneAction, basculerSalleAction, basculerToutAction } from "@/lib/pilotage-actions";
import { calculerResultats } from "@/lib/resultats-saas";

export const metadata: Metadata = { title: "Vue d’ensemble — DIGITALYX-VOTE" };

/** Nombre de candidats affichés dans la carte du vote en cours. */
const TETE_DE_CLASSEMENT = 5;

interface SelectionVue {
  etat: string;
  fin: Date | null;
  voteEnLigneOuvert: boolean;
  voteSalleOuvert: boolean;
  typesVote: { canal: string; actif?: boolean }[];
}

/**
 * Interrupteurs du vote en ligne et du vote en salle d'une sélection ouverte,
 * les mêmes que sur sa page de pilotage.
 */
function Interrupteurs({ selection, maintenant }: { selection: SelectionVue & { id: string }; maintenant: Date }) {
  const enLigne = selection.typesVote.some((t) => t.canal === "EN_LIGNE" && t.actif !== false);
  const finPassee = selection.fin !== null && selection.fin <= maintenant;
  return (
    <>
      {enLigne ? (
        <div className={styles.interrupteur}>
          <div>
            <strong>Vote en ligne {finPassee ? "terminé" : selection.voteEnLigneOuvert ? "ouvert" : "suspendu"}</strong>
            <span>
              {finPassee
                ? `La date de fin (${dateHeure(selection.fin!)}) est passée : changez-la dans la sélection pour rouvrir.`
                : "Page publique de vote et paiements."}
            </span>
          </div>
          {finPassee && !selection.voteEnLigneOuvert ? null : (
            <FormulaireAction
              action={basculerEnLigneAction.bind(null, selection.id, !selection.voteEnLigneOuvert)}
              bouton={selection.voteEnLigneOuvert ? "Suspendre" : "Reprendre"}
              variante="secondaire"
              discret
            />
          )}
        </div>
      ) : null}
      <div className={styles.interrupteur}>
        <div>
          <strong>Vote en salle {selection.voteSalleOuvert ? "ouvert" : "suspendu"}</strong>
          <span>Notes du jury, tablettes et liens de vote en salle.</span>
        </div>
        <FormulaireAction
          action={basculerSalleAction.bind(null, selection.id, !selection.voteSalleOuvert)}
          bouton={selection.voteSalleOuvert ? "Suspendre" : "Reprendre"}
          variante="secondaire"
          discret
        />
      </div>
    </>
  );
}

/** Pastilles d'état du vote en ligne et du vote en salle d'une sélection ouverte. */
function PastillesVote({ selection, maintenant }: { selection: SelectionVue; maintenant: Date }) {
  if (selection.etat !== "OUVERTE") return null;
  const enLigne = selection.typesVote.some((t) => t.canal === "EN_LIGNE");
  const enSalle = selection.typesVote.some((t) => t.canal === "SALLE");
  const finPassee = selection.fin !== null && selection.fin <= maintenant;
  return (
    <div className={styles.pastilles}>
      {enLigne ? (
        selection.voteEnLigneOuvert && !finPassee ? (
          <span className={`${styles.pastille} ${styles.pastilleVerte}`}>Vote en ligne en cours</span>
        ) : (
          <span className={`${styles.pastille} ${styles.pastilleOrange}`}>
            Vote en ligne {finPassee ? "terminé" : "suspendu"}
          </span>
        )
      ) : null}
      {enSalle ? (
        <span className={`${styles.pastille} ${selection.voteSalleOuvert ? styles.pastilleBleue : styles.pastilleOrange}`}>
          Vote en salle {selection.voteSalleOuvert ? "ouvert" : "suspendu"}
        </span>
      ) : null}
    </div>
  );
}

export default async function PageVueEnsemble({ params }: { params: Promise<{ evenementId: string }> }) {
  const { evenementId } = await params;
  const utilisateur = await exigerUtilisateur();
  const evenement = await evenementDeLOrganisation(utilisateur.organisationId, evenementId);
  if (!evenement) notFound();

  const { selections, participations, voix, voixParSelection } = await chiffresEvenement(utilisateur.organisationId, evenementId);
  // Plusieurs sélections peuvent être ouvertes en même temps : chacune a sa carte.
  const ouvertes = selections.filter((s) => s.etat === "OUVERTE");
  const prochaine = selections.find((s) => s.etat === "PREPAREE") ?? null;
  const tetes = await Promise.all(
    ouvertes.map(async (s) =>
      (await calculerResultats(s.id)).classement.filter((l) => l.note !== null).slice(0, TETE_DE_CLASSEMENT),
    ),
  );
  const toutOuvert = ouvertes.every(
    (s) => s.voteSalleOuvert && (s.voteEnLigneOuvert || !s.typesVote.some((t) => t.canal === "EN_LIGNE" && t.actif)),
  );

  const base = `/espace/e/${evenementId}`;
  const maintenant = new Date();

  return (
    <>
      {evenement.afficheUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={evenement.afficheUrl} alt={evenement.nom} className={styles.banniere} />
      ) : null}
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Tableau de bord</div>
          <h1 className={styles.titre}>
            {salutation()}, <em>{utilisateur.organisation.nom}</em>
          </h1>
          <p className={styles.sousTitre}>
            {ouvertes.length === 0
              ? `${evenement.nom} — aucune sélection n’est ouverte au vote.`
              : ouvertes.length === 1
                ? `${evenement.nom} — « ${ouvertes[0].libelle} » est ouverte au vote.`
                : `${evenement.nom} — ${ouvertes.length} sélections sont ouvertes au vote.`}
          </p>
        </div>
        <Link href={`${base}/selections`} className={`${styles.bouton} ${styles.boutonSecondaire}`}>
          <Icone nom="calendrier" taille={16} />
          Gérer les sélections
        </Link>
      </div>

      <div className={styles.chiffres}>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.bleu}`}>
            <Icone nom="calendrier" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Sélections</span>
          <strong className={styles.chiffreValeur}>{selections.length}</strong>
          <span className={`${styles.chiffreDetail} ${ouvertes.length > 0 ? styles.positif : ""}`}>
            {ouvertes.length > 0
              ? `${ouvertes.length} ouverte${ouvertes.length > 1 ? "s" : ""} au vote`
              : selections.length === 0
                ? "Aucune pour l’instant"
                : "Aucune ouverte"}
          </span>
        </div>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.violet}`}>
            <Icone nom="personnes" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Candidats inscrits</span>
          <strong className={styles.chiffreValeur}>{nombre(participations)}</strong>
          <span className={styles.chiffreDetail}>Toutes sélections confondues</span>
        </div>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.vert}`}>
            <Icone nom="urne" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Voix reçues</span>
          <strong className={styles.chiffreValeur}>{nombre(voix)}</strong>
          <span className={styles.chiffreDetail}>En ligne et en salle</span>
        </div>
      </div>

      {ouvertes.length > 0 ? (
        <div className={styles.interrupteur} style={{ borderTop: 0, paddingInline: 0 }}>
          <div>
            <strong>
              {ouvertes.length > 1 ? `${ouvertes.length} sélections ouvertes` : "1 sélection ouverte"}
            </strong>
            <span>Reprend ou suspend d&rsquo;un coup le vote en ligne et le vote en salle de toutes les sélections ouvertes.</span>
          </div>
          <div className={styles.ligneActions}>
            <FormulaireAction
              action={basculerToutAction.bind(null, evenementId, true)}
              bouton="Tout reprendre"
              variante={toutOuvert ? "secondaire" : undefined}
            />
            <FormulaireAction
              action={basculerToutAction.bind(null, evenementId, false)}
              bouton="Tout suspendre"
              variante="secondaire"
              confirmer="Suspendre le vote en ligne et le vote en salle de toutes les sélections ouvertes ?"
            />
          </div>
        </div>
      ) : null}

      {ouvertes.map((ouverte, i) => {
        const tete = tetes[i];
        return (
          <section key={ouverte.id} className={styles.carte}>
            <div className={styles.carteHaut}>
              <div>
                <div className={styles.direct}>
                  <span className={styles.pulsation} /> Vote en cours
                </div>
                <h2 className={styles.carteTitre} style={{ marginTop: 10 }}>
                  {ouverte.libelle}
                </h2>
                <p className={styles.carteTexte}>
                  {[ouverte.lieu, ouverte.fin ? `fin du vote en ligne le ${dateHeure(ouverte.fin)}` : null]
                    .filter(Boolean)
                    .join(" · ") || "Classement provisoire"}
                </p>
                <PastillesVote selection={ouverte} maintenant={maintenant} />
              </div>
              <Link href={`${base}/selections/${ouverte.id}`} className={`${styles.bouton} ${styles.boutonSecondaire}`}>
                Voir la sélection
              </Link>
            </div>
            <div className={styles.carteCorps}>
              {tete.length === 0 ? (
                <p className={styles.carteTexte}>Aucun vote reçu pour l&rsquo;instant.</p>
              ) : (
                <div className={styles.resultats}>
                  {tete.map((ligne) => (
                    <div key={ligne.candidat.participationId}>
                      <div className={styles.resultatMeta}>
                        <span>
                          {ligne.rang}. {ligne.candidat.nom}
                          {ligne.egalite ? " · égalité" : ""}
                        </span>
                        <strong>{arrondi2(ligne.note ?? 0).toLocaleString("fr-FR")} / 100</strong>
                      </div>
                      <div className={styles.piste}>
                        <span
                          className={`${styles.jauge} ${ligne.rang === 1 ? styles.barreBleue : styles.barreMarine}`}
                          style={{ width: `${Math.max(1, Math.min(100, ligne.note ?? 0))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Interrupteurs selection={ouverte} maintenant={maintenant} />
            <div className={styles.cartePied}>
              <span>
                <Icone nom="cadenas" taille={15} /> Classement sur 100, recalculé à chaque vote
              </span>
              <strong>
                {nombre(ouverte._count.participations)} candidat{ouverte._count.participations > 1 ? "s" : ""}
              </strong>
            </div>
          </section>
        );
      })}

      {ouvertes.length > 0 ? null : (
        <section className={styles.carte}>
          {prochaine ? (
            <div className={styles.carteHaut}>
              <div>
                <div className={styles.surtitre}>Prochaine sélection</div>
                <h2 className={styles.carteTitre} style={{ marginTop: 8 }}>
                  {prochaine.libelle}
                </h2>
                <p className={styles.carteTexte}>
                  {[prochaine.lieu, prochaine.debut ? dateHeure(prochaine.debut) : null].filter(Boolean).join(" · ") ||
                    LIBELLES_ETAT[prochaine.etat as EtatSelection]}
                </p>
              </div>
              <Link href={`${base}/selections/${prochaine.id}`} className={`${styles.bouton} ${styles.boutonSecondaire}`}>
                Préparer
              </Link>
            </div>
          ) : (
            <div className={styles.vide}>
              <strong>{selections.length === 0 ? "Ajoutez votre première sélection" : "Toutes les sélections sont clôturées"}</strong>
              {selections.length === 0
                ? "Une sélection est un tour du concours : 1ʳᵉ sélection, demi-finale, finale…"
                : "L’événement est terminé."}
              {selections.length === 0 ? (
                <div>
                  <Link href={`${base}/selections`} className={`${styles.bouton} ${styles.boutonPrincipal}`}>
                    <Icone nom="plus" taille={16} />
                    Ajouter une sélection
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}

      {selections.length > 0 ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut}>
            <div>
              <h2 className={styles.carteTitre}>Toutes les sélections</h2>
              <p className={styles.carteTexte}>Dans l&rsquo;ordre du concours. La dernière est la finale.</p>
            </div>
          </div>
          <ul className={styles.lignes}>
            {selections.map((s) => (
              <li key={s.id} className={styles.ligne}>
                <span className={styles.ligneRang}>{s.rang}</span>
                <div className={styles.ligneTexte}>
                  <Link href={`${base}/selections/${s.id}`}>{s.libelle}</Link>
                  <div className={styles.ligneMeta}>
                    {s.lieu ? (
                      <span>
                        <Icone nom="lieu" taille={14} />
                        {s.lieu}
                      </span>
                    ) : null}
                    {s.fin ? (
                      <span>
                        <Icone nom="horloge" taille={14} />
                        fin du vote en ligne le {dateHeure(s.fin)}
                      </span>
                    ) : null}
                    <span>
                      <Icone nom="personnes" taille={14} />
                      {nombre(s._count.participations)} candidat{s._count.participations > 1 ? "s" : ""}
                    </span>
                    <span>
                      <Icone nom="urne" taille={14} />
                      {nombre(voixParSelection.get(s.id) ?? 0)} voix
                    </span>
                  </div>
                  <PastillesVote selection={s} maintenant={maintenant} />
                </div>
                <span className={`${styles.etat} ${styles[`etat${s.etat}`]}`}>{LIBELLES_ETAT[s.etat as EtatSelection]}</span>
                <div className={styles.ligneActions}>
                  <Link href={`${base}/selections/${s.id}`} className={`${styles.bouton} ${styles.boutonSecondaire}`}>
                    Voir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
