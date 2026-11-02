import {
  ajouterCritereAction,
  ajouterTypeAction,
  deplacerCritereAction,
  modifierCritereAction,
  modifierTypeAction,
  supprimerCritereAction,
  supprimerTypeAction,
} from "@/lib/grille-actions";
import type { GrilleLue } from "@/lib/grille";
import {
  BAREME_MAX,
  CANAUX_A_ACCES,
  LIBELLES_ACCES,
  LIBELLES_CANAL,
  problemesGrille,
  sommeDesParts,
  typesActifs,
  type Acces,
  type Canal,
} from "@/lib/grille-core";
import { BoutonEnvoi, FormulaireAction } from "./formulaire-action";
import { Icone } from "./icone";
import styles from "./panel.module.css";

interface Props {
  evenementId: string;
  /** `null` : grille de référence de l'événement. */
  selectionId: string | null;
  types: GrilleLue;
  /** Faux une fois la sélection ouverte : la grille s'affiche sans formulaires. */
  modifiable: boolean;
  /** Sélection ouverte : les types sans vote, qu'on peut encore compléter (nom, critères). */
  completables?: string[];
}

const nf = (n: number) => n.toLocaleString("fr-FR");

/** Couleur de l'étiquette du canal, la même que sur les cartes « Mes événements ». */
const COULEUR_CANAL: Record<string, string> = {
  SALLE: styles.pastilleBleue,
  EN_LIGNE: styles.pastilleOrange,
  GRATUIT: styles.pastilleVerte,
  UNIQUE: styles.pastilleViolette,
  QR: styles.pastilleVerte,
};

/** Ce que fait un type qui compte des voix, selon son canal et son accès. */
function texteVoix(type: { canal: string; acces: string }): string {
  const liste = type.acces === "RESTREINT";
  switch (type.canal) {
    case "EN_LIGNE":
      return "Compte les voix payées du public sur la page de vote. Le prix, la voix gratuite et le mode de calcul se règlent dans l’onglet « Vote en ligne » de chaque sélection.";
    case "GRATUIT":
      return `Page publique sans paiement : on tape son numéro, on choisit un candidat. Une seule voix par numéro pour tout le concours${liste ? ", et seulement pour les numéros autorisés" : ""}. Le lien et le QR code sont dans l’onglet « Liens & QR codes » de chaque sélection.`;
    case "UNIQUE":
    case "QR":
      return liste
        ? "On scanne le QR code, on tape son numéro, on choisit un candidat. Seuls les numéros de la liste autorisée votent, une seule fois. Le lien, le QR code et la liste sont dans l’onglet « Liens & QR codes » de chaque sélection."
        : "On scanne le QR code, on tape son numéro, on choisit un candidat. Tout le monde peut voter, une seule fois par numéro. Le lien et le QR code sont dans l’onglet « Liens & QR codes » de chaque sélection.";
    default:
      return "Compte des voix, sans critère (une voix par votant).";
  }
}

/** Grille de vote : types, parts et critères, modifiables ou en lecture. */
export function GrilleVote({ evenementId, selectionId, types, modifiable, completables = [] }: Props) {
  // Copie : la grille est un tableau de types modèles ou de types de sélection.
  const actifs = typesActifs([...types]);
  const somme = sommeDesParts(actifs);
  const nbActifs = actifs.length;
  const problemes = problemesGrille(types);

  return (
    <>
      <div className={`${styles.bandeau} ${problemes.length === 0 ? styles.bandeauOk : styles.bandeauAlerte}`}>
        <Icone nom={problemes.length === 0 ? "coche" : "bouclier"} taille={18} />
        <div>
          <strong>
            {nbActifs} type{nbActifs > 1 ? "s" : ""} de vote activé{nbActifs > 1 ? "s" : ""} · parts : {nf(somme)} %
          </strong>
          {problemes.length === 0 ? (
            <span>La grille est complète. Seuls les types activés comptent : chacun est ramené sur 100, puis pondéré par sa part (RG 8.6).</span>
          ) : (
            <ul>
              {problemes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {types.map((type) => {
        const baremeTotal = type.criteres.reduce((s, c) => s + c.bareme, 0);
        const editable = modifiable || completables.includes(type.id);
        return (
          <section key={type.id} className={styles.carte} style={type.actif ? undefined : { opacity: 0.6 }}>
            <div className={styles.carteHaut}>
              <div>
                <h2 className={styles.carteTitre}>{type.libelle}</h2>
                <div className={styles.pastilles}>
                  <span className={`${styles.pastille} ${COULEUR_CANAL[type.canal] ?? ""}`}>{LIBELLES_CANAL[type.canal as Canal] ?? type.canal}</span>
                  {type.actif ? null : <span className={styles.pastille}>Désactivé · ne compte pas</span>}
                  <span className={styles.pastille}>
                    {type.avecCriteres
                      ? `Notes sur ${nf(baremeTotal)} pts`
                      : type.payant
                        ? "Voix payantes"
                        : type.canal === "QR" || type.canal === "UNIQUE" || type.canal === "GRATUIT"
                          ? "Une voix par personne"
                          : "Voix"}
                  </span>
                  {CANAUX_A_ACCES.includes(type.canal) && type.canal !== "SALLE" ? (
                    <span className={`${styles.pastille} ${type.acces === "RESTREINT" ? styles.pastilleOrange : styles.pastilleVerte}`}>
                      {LIBELLES_ACCES[type.acces as Acces] ?? type.acces}
                    </span>
                  ) : null}
                  <span className={`${styles.pastille} ${styles.pastilleBleue}`}>Part {nf(type.part)} %</span>
                </div>
              </div>
              {modifiable ? (
                <FormulaireAction
                  action={supprimerTypeAction.bind(null, evenementId, selectionId, type.id)}
                  confirmer={`Supprimer le type « ${type.libelle} » et ses critères ?`}
                  discret
                >
                  <BoutonEnvoi className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonIcone}`} titre="Supprimer ce type">
                    <Icone nom="corbeille" taille={16} />
                  </BoutonEnvoi>
                </FormulaireAction>
              ) : null}
            </div>

            {editable ? (
              <FormulaireAction
                action={modifierTypeAction.bind(null, evenementId, selectionId, type.id)}
                className={styles.formulaire}
                bouton="Enregistrer"
                variante="secondaire"
                discret
              >
                <ChampsType
                  libelle={type.libelle}
                  canal={type.canal}
                  actif={type.actif}
                  avecCriteres={type.avecCriteres}
                  acces={type.acces}
                  part={type.part}
                  figes={!modifiable}
                />
              </FormulaireAction>
            ) : null}

            {type.avecCriteres ? (
              <div className={styles.carteCorps}>
                <div className={styles.sousTitreCarte}>Critères · barème total {nf(baremeTotal)} points</div>
                {type.criteres.length === 0 ? (
                  <p className={styles.carteTexte}>Aucun critère pour l&rsquo;instant.</p>
                ) : (
                  <ul className={styles.criteres}>
                    {type.criteres.map((c, i) => (
                      <li key={c.id} className={styles.critere}>
                        {editable ? (
                          <>
                            <FormulaireAction
                              action={modifierCritereAction.bind(null, evenementId, selectionId, type.id, c.id)}
                              className={styles.formLigne}
                              discret
                            >
                              <input name="libelle" defaultValue={c.libelle} maxLength={60} required aria-label="Critère" />
                              <span className={styles.sur}>sur</span>
                              <input
                                name="bareme"
                                defaultValue={c.bareme}
                                inputMode="numeric"
                                className={styles.champCourt}
                                required
                                aria-label="Barème"
                              />
                              <BoutonEnvoi className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`} titre="Enregistrer le critère">
                                <Icone nom="coche" taille={15} />
                              </BoutonEnvoi>
                            </FormulaireAction>
                            <FormulaireAction action={deplacerCritereAction.bind(null, evenementId, selectionId, type.id, c.id, "haut")} discret>
                              <BoutonEnvoi className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`} titre="Monter">
                                <Icone nom="haut" taille={15} />
                              </BoutonEnvoi>
                            </FormulaireAction>
                            <FormulaireAction action={deplacerCritereAction.bind(null, evenementId, selectionId, type.id, c.id, "bas")} discret>
                              <BoutonEnvoi className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`} titre="Descendre">
                                <Icone nom="bas" taille={15} />
                              </BoutonEnvoi>
                            </FormulaireAction>
                            <FormulaireAction
                              action={supprimerCritereAction.bind(null, evenementId, selectionId, type.id, c.id)}
                              confirmer={`Supprimer le critère « ${c.libelle} » ?`}
                              discret
                            >
                              <BoutonEnvoi className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`} titre="Supprimer le critère">
                                <Icone nom="corbeille" taille={15} />
                              </BoutonEnvoi>
                            </FormulaireAction>
                          </>
                        ) : (
                          <>
                            <span className={styles.critereNom}>
                              {i + 1}. {c.libelle}
                            </span>
                            <strong>sur {c.bareme}</strong>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {editable ? (
                  <FormulaireAction
                    action={ajouterCritereAction.bind(null, evenementId, selectionId, type.id)}
                    className={styles.formLigne}
                    vider
                    discret
                    ariaLabel={`Ajouter un critère à ${type.libelle}`}
                  >
                    <input name="libelle" placeholder="Nouveau critère, ex. Créativité" maxLength={60} required aria-label="Nouveau critère" />
                    <span className={styles.sur}>sur</span>
                    <input name="bareme" placeholder="10" inputMode="numeric" className={styles.champCourt} required aria-label="Barème" />
                    <BoutonEnvoi className={`${styles.bouton} ${styles.boutonPrincipal} ${styles.boutonPetit}`}>
                      <Icone nom="plus" taille={15} /> Ajouter
                    </BoutonEnvoi>
                  </FormulaireAction>
                ) : null}
              </div>
            ) : (
              <div className={styles.carteCorps}>
                <p className={styles.carteTexte}>{texteVoix(type)}</p>
              </div>
            )}
          </section>
        );
      })}

      {modifiable ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
            <div>
              <h2 className={styles.carteTitre}>Ajouter un type de vote</h2>
              <p className={styles.carteTexte}>
                Par exemple un jury spécial, un vote de la salle sans critère, un vote en ligne gratuit, ou un vote unique pour un but
                précis (ou pour dépanner si les tablettes tombent en panne).
              </p>
            </div>
          </div>
          <FormulaireAction
            action={ajouterTypeAction.bind(null, evenementId, selectionId)}
            className={styles.formulaire}
            bouton="Ajouter le type"
            vider
          >
            <ChampsType libelle="" canal="SALLE" actif avecCriteres acces="OUVERT" part={0} />
          </FormulaireAction>
        </section>
      ) : null}

      <p className={styles.noteBas}>Barème : note maximale d&rsquo;un critère, de 1 à {BAREME_MAX}.</p>
    </>
  );
}

function ChampsType({
  libelle,
  canal,
  actif,
  avecCriteres,
  acces,
  part,
  figes = false,
}: {
  libelle: string;
  canal: string;
  actif: boolean;
  avecCriteres: boolean;
  acces: string;
  part: number;
  /** Sélection ouverte : canal, accès et part ne changent plus, ils repartent tels quels. */
  figes?: boolean;
}) {
  const valeurPart = part ? String(part).replace(".", ",") : "";
  if (figes) {
    return (
      <>
        <label className={styles.champ}>
          <span>Nom</span>
          <input name="libelle" defaultValue={libelle} maxLength={60} required />
        </label>
        <input type="hidden" name="canal" value={canal} />
        <input type="hidden" name="acces" value={acces} />
        <input type="hidden" name="part" value={valeurPart} />
        {actif ? <input type="hidden" name="actif" value="on" /> : null}
        {canal === "SALLE" || canal === "UNIQUE" ? (
          <label className={styles.caseACocher}>
            <input type="checkbox" name="avecCriteres" defaultChecked={avecCriteres} />
            <span>
              Noter sur des critères
              <small>Sinon, on compte des voix. Possible tant que ce type n&rsquo;a reçu aucun vote.</small>
            </span>
          </label>
        ) : null}
      </>
    );
  }
  return (
    <>
      <label className={styles.caseACocher}>
        <input type="checkbox" name="actif" defaultChecked={actif} />
        <span>
          Activer ce type de vote
          <small>Seuls les types activés reçoivent des votes et comptent dans la note finale. Leurs parts doivent faire 100 %.</small>
        </span>
      </label>
      <label className={styles.champ}>
        <span>Nom</span>
        <input name="libelle" defaultValue={libelle} maxLength={60} required placeholder="Jury spécial" />
      </label>
      <label className={styles.champ}>
        <span>Canal</span>
        <select name="canal" defaultValue={canal}>
          <option value="SALLE">En salle (jury, public présent)</option>
          <option value="EN_LIGNE">En ligne payant (page publique, voix payantes)</option>
          <option value="GRATUIT">En ligne gratuit (une voix par numéro pour tout le concours)</option>
          <option value="UNIQUE">Vote unique (lien et QR code, avec ou sans critères)</option>
          <option value="QR">Par QR code (une voix par personne)</option>
        </select>
      </label>
      <label className={styles.champ}>
        <span>Qui peut voter par le lien et le QR code ?</span>
        <select name="acces" defaultValue={acces}>
          <option value="OUVERT">Normal : tout le monde, une fois par numéro</option>
          <option value="RESTREINT">Restreint : seulement les numéros autorisés</option>
        </select>
      </label>
      <label className={styles.champ}>
        <span>Part dans la note finale (%)</span>
        <input name="part" defaultValue={valeurPart} inputMode="decimal" required placeholder="40" />
      </label>
      <label className={styles.caseACocher}>
        <input type="checkbox" name="avecCriteres" defaultChecked={avecCriteres} />
        <span>
          Noter sur des critères
          <small>Sinon, on compte des voix. Possible en salle et pour un vote unique ; toujours des voix en ligne et par QR code.</small>
        </span>
      </label>
    </>
  );
}
