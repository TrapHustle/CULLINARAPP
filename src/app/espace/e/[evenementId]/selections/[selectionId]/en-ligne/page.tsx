import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { prisma } from "@/lib/prisma";
import { reglerEnLigneAction } from "@/lib/grille-actions";
import { LIBELLES_MODE, LIBELLES_MOYEN, MODES_EN_LIGNE, MOYENS } from "@/lib/grille-core";
import { MAX_VOTE_PRICE, MIN_VOTE_PRICE } from "@/lib/public-vote-core";

export const metadata: Metadata = { title: "Vote en ligne — DIGITALYX-VOTE" };

/** Lignes de paliers proposées à la saisie (les vides sont ignorées). */
const LIGNES_PALIERS = 6;

/** Exemple du document Inovyx, proposé quand aucun palier n'est encore réglé. */
const PALIERS_EXEMPLE = [
  { voixMax: 250, points: 15 },
  { voixMax: 750, points: 40 },
  { voixMax: 2000, points: 70 },
  { voixMax: 4000, points: 100 },
];

export default async function PageEnLigne({
  params,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, evenementId, evenement: { organisationId: utilisateur.organisationId } },
    include: {
      paliers: { orderBy: { voixMax: "asc" } },
      typesVote: { where: { canal: "EN_LIGNE" }, select: { libelle: true, part: true } },
    },
  });
  if (!selection) notFound();

  const enLigne = selection.typesVote[0] ?? null;
  const preparee = selection.etat === "PREPAREE";
  const cloturee = selection.etat === "CLOTUREE";
  const paliers = selection.paliers.length > 0 ? selection.paliers : selection.modeEnLigne === "B" ? [] : PALIERS_EXEMPLE;

  return (
    <>
      {!enLigne ? (
        <div className={`${styles.bandeau} ${styles.bandeauAlerte}`}>
          <Icone nom="bouclier" taille={18} />
          <div>
            <strong>Pas de vote en ligne dans cette sélection</strong>
            <span>Ajoutez un type « En ligne » dans l&rsquo;onglet Grille de vote pour ouvrir une page publique.</span>
          </div>
        </div>
      ) : (
        <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
          <Icone nom="urne" taille={18} />
          <div>
            <strong>
              « {enLigne.libelle} » · part {enLigne.part.toLocaleString("fr-FR")} % de la note finale
            </strong>
            <span>
              Page publique : <a href={`/v/${selection.slug}`} target="_blank" rel="noreferrer">/v/{selection.slug}</a>
              {selection.etat === "OUVERTE" ? "" : " — active à l’ouverture de la sélection."}
            </span>
          </div>
        </div>
      )}

      <section className={styles.carte}>
        <FormulaireAction
          action={reglerEnLigneAction.bind(null, evenementId, selectionId)}
          className={styles.formulaire}
          bouton={cloturee ? undefined : "Enregistrer les réglages"}
        >
          <fieldset disabled={cloturee} style={{ display: "contents" }}>
            <label className={styles.champ}>
              <span>Prix d&rsquo;une voix (FCFA)</span>
              <input name="prixVote" inputMode="numeric" defaultValue={selection.prixVote} required />
              <small>
                De {MIN_VOTE_PRICE} à {MAX_VOTE_PRICE.toLocaleString("fr-FR")} FCFA. Le montant est toujours recalculé
                par le serveur.
              </small>
            </label>

            <div className={styles.champ}>
              <span>Page publique</span>
              <label className={styles.caseACocher}>
                <input type="checkbox" name="voixGratuite" defaultChecked={selection.voixGratuite} />
                <span>
                  Une voix gratuite par personne
                  <small>Le votant donne son numéro de téléphone ; pour voter encore, il paie.</small>
                </span>
              </label>
              <label className={styles.caseACocher}>
                <input type="checkbox" name="compteursVisibles" defaultChecked={selection.compteursVisibles} />
                <span>
                  Afficher les compteurs de voix
                  <small>Décoché, le public vote sans voir les scores.</small>
                </span>
              </label>
            </div>

            <div className={`${styles.champ} ${styles.champLarge}`}>
              <span>Moyens de paiement proposés</span>
              <div className={styles.choix}>
                {MOYENS.map((m) => (
                  <label key={m} className={styles.choixCarte}>
                    <input type="checkbox" name="moyensPaiement" value={m} defaultChecked={selection.moyensPaiement.includes(m)} />
                    <strong>{LIBELLES_MOYEN[m]}</strong>
                  </label>
                ))}
              </div>
            </div>

            <div className={`${styles.champ} ${styles.champLarge}`}>
              <span>Mode de calcul de la note en ligne (RG 8.3)</span>
              {!preparee ? (
                <small>Le mode ne change plus une fois la sélection ouverte (RG 8.7).</small>
              ) : null}
              <div className={styles.choix}>
                {MODES_EN_LIGNE.map((m) => (
                  <label key={m} className={styles.choixCarte}>
                    <input
                      type="radio"
                      name="modeEnLigne"
                      value={m}
                      defaultChecked={selection.modeEnLigne === m}
                      // Une case désactivée n'est pas envoyée : le mode actuel
                      // reste coché et envoyé, les autres sont grisés.
                      disabled={!preparee && selection.modeEnLigne !== m}
                    />
                    <span>
                      <strong>{LIBELLES_MODE[m].titre}</strong>
                      <small>{LIBELLES_MODE[m].detail}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className={`${styles.champ} ${styles.champLarge}`}>
              <span>Paliers du mode B</span>
              <small>
                Ignorés en modes A et C. Points sur 100 atteints au plafond ; entre deux plafonds, règle de trois ; au-delà
                du dernier, la note reste à ses points.
              </small>
              <fieldset disabled={!preparee} className={styles.paliers} style={{ border: 0, padding: 0, margin: "6px 0 0" }}>
                <span />
                <span>Plafond (voix)</span>
                <span>Points sur 100</span>
                {Array.from({ length: LIGNES_PALIERS }, (_, i) => (
                  <PalierLigne key={i} numero={i + 1} palier={paliers[i]} />
                ))}
              </fieldset>
            </div>
          </fieldset>
        </FormulaireAction>
      </section>
    </>
  );
}

function PalierLigne({ numero, palier }: { numero: number; palier?: { voixMax: number; points: number } }) {
  return (
    <>
      <span className={styles.paliersNumero}>{numero}</span>
      <input name="voixMax" inputMode="numeric" defaultValue={palier?.voixMax ?? ""} aria-label={`Plafond du palier ${numero}`} />
      <input
        name="points"
        inputMode="decimal"
        defaultValue={palier ? String(palier.points).replace(".", ",") : ""}
        aria-label={`Points du palier ${numero}`}
      />
    </>
  );
}
