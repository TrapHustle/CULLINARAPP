import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { arrondi2 } from "@/lib/calcul";
import { exigerUtilisateur } from "@/lib/espace";
import { chiffresEvenement, evenementDeLOrganisation } from "@/lib/evenements";
import { LIBELLES_ETAT, type EtatSelection } from "@/lib/evenements-core";
import { dateHeure, nombre, salutation } from "@/lib/format-espace";
import { calculerResultats } from "@/lib/resultats-saas";

export const metadata: Metadata = { title: "Vue d’ensemble — DIGITALYX-VOTE" };

/** Nombre de candidats affichés dans la carte du vote en cours. */
const TETE_DE_CLASSEMENT = 5;

export default async function PageVueEnsemble({ params }: { params: Promise<{ evenementId: string }> }) {
  const { evenementId } = await params;
  const utilisateur = await exigerUtilisateur();
  const evenement = await evenementDeLOrganisation(utilisateur.organisationId, evenementId);
  if (!evenement) notFound();

  const { selections, participations, voix } = await chiffresEvenement(utilisateur.organisationId, evenementId);
  const ouverte = selections.find((s) => s.etat === "OUVERTE") ?? null;
  const prochaine = selections.find((s) => s.etat === "PREPAREE") ?? null;
  const resultats = ouverte ? await calculerResultats(ouverte.id) : null;
  const tete = resultats?.classement.filter((l) => l.note !== null).slice(0, TETE_DE_CLASSEMENT) ?? [];

  const base = `/espace/e/${evenementId}`;

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Tableau de bord</div>
          <h1 className={styles.titre}>
            {salutation()}, {utilisateur.organisation.nom}.
          </h1>
          <p className={styles.sousTitre}>
            {ouverte
              ? `${evenement.nom} — « ${ouverte.libelle} » est ouverte au vote.`
              : `${evenement.nom} — aucune sélection n’est ouverte au vote.`}
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
          <span className={`${styles.chiffreDetail} ${ouverte ? styles.positif : ""}`}>
            {ouverte ? "1 ouverte au vote" : selections.length === 0 ? "Aucune pour l’instant" : "Aucune ouverte"}
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

      <section className={styles.carte}>
        {ouverte ? (
          <>
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
              </div>
              <Link href={`${base}/selections/${ouverte.id}`} className={`${styles.bouton} ${styles.boutonSecondaire}`}>
                Ouvrir
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
            <div className={styles.cartePied}>
              <span>
                <Icone nom="cadenas" taille={15} /> Classement sur 100, recalculé à chaque vote
              </span>
              <strong>
                {nombre(ouverte._count.participations)} candidat{ouverte._count.participations > 1 ? "s" : ""}
              </strong>
            </div>
          </>
        ) : prochaine ? (
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
    </>
  );
}
