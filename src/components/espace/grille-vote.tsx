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
import { BAREME_MAX, LIBELLES_ACCES, LIBELLES_CANAL, problemesGrille, sommeDesParts, type Acces, type Canal } from "@/lib/grille-core";
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
}

const nf = (n: number) => n.toLocaleString("fr-FR");

/** Grille de vote : types, parts et critères, modifiables ou en lecture. */
export function GrilleVote({ evenementId, selectionId, types, modifiable }: Props) {
  const somme = sommeDesParts(types);
  const problemes = problemesGrille(types);

  return (
    <>
      <div className={`${styles.bandeau} ${problemes.length === 0 ? styles.bandeauOk : styles.bandeauAlerte}`}>
        <Icone nom={problemes.length === 0 ? "coche" : "bouclier"} taille={18} />
        <div>
          <strong>
            {types.length} type{types.length > 1 ? "s" : ""} de vote · parts : {nf(somme)} %
          </strong>
          {problemes.length === 0 ? (
            <span>La grille est complète. Chaque type est ramené sur 100, puis pondéré par sa part (RG 8.6).</span>
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
        return (
          <section key={type.id} className={styles.carte}>
            <div className={styles.carteHaut}>
              <div>
                <h2 className={styles.carteTitre}>{type.libelle}</h2>
                <div className={styles.pastilles}>
                  <span className={styles.pastille}>{LIBELLES_CANAL[type.canal as Canal] ?? type.canal}</span>
                  <span className={styles.pastille}>
                    {type.avecCriteres
                      ? `Notes sur ${nf(baremeTotal)} pts`
                      : type.payant
                        ? "Voix payantes"
                        : type.canal === "QR"
                          ? "Une voix par personne"
                          : "Voix"}
                  </span>
                  {type.canal === "QR" ? (
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

            {modifiable ? (
              <FormulaireAction
                action={modifierTypeAction.bind(null, evenementId, selectionId, type.id)}
                className={styles.formulaire}
                bouton="Enregistrer"
                variante="secondaire"
                discret
              >
                <ChampsType libelle={type.libelle} canal={type.canal} avecCriteres={type.avecCriteres} acces={type.acces} part={type.part} />
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
                        {modifiable ? (
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
                {modifiable ? (
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
                <p className={styles.carteTexte}>
                  {type.canal === "EN_LIGNE"
                    ? "Compte les voix du public sur la page de vote. Le prix, la voix gratuite et le mode de calcul se règlent dans l’onglet « Vote en ligne » de chaque sélection."
                    : type.canal === "QR"
                      ? type.acces === "RESTREINT"
                        ? "On scanne le QR code, on tape son numéro, on choisit un candidat. Seuls les numéros de la liste autorisée votent, une seule fois. Le lien, le QR code et la liste sont dans l’onglet « Liens & QR codes » de chaque sélection."
                        : "On scanne le QR code, on tape son numéro, on choisit un candidat. Tout le monde peut voter, une seule fois par numéro. Le lien et le QR code sont dans l’onglet « Liens & QR codes » de chaque sélection."
                      : "Compte des voix, sans critère (une voix par votant)."}
                </p>
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
              <p className={styles.carteTexte}>Par exemple un jury spécial, un vote de la salle sans critère, ou un vote des invités par QR code.</p>
            </div>
          </div>
          <FormulaireAction
            action={ajouterTypeAction.bind(null, evenementId, selectionId)}
            className={styles.formulaire}
            bouton="Ajouter le type"
            vider
          >
            <ChampsType libelle="" canal="SALLE" avecCriteres acces="OUVERT" part={0} />
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
  avecCriteres,
  acces,
  part,
}: {
  libelle: string;
  canal: string;
  avecCriteres: boolean;
  acces: string;
  part: number;
}) {
  return (
    <>
      <label className={styles.champ}>
        <span>Nom</span>
        <input name="libelle" defaultValue={libelle} maxLength={60} required placeholder="Jury spécial" />
      </label>
      <label className={styles.champ}>
        <span>Canal</span>
        <select name="canal" defaultValue={canal}>
          <option value="SALLE">En salle (jury, public présent)</option>
          <option value="EN_LIGNE">En ligne (page publique, voix payantes)</option>
          <option value="QR">Par QR code (une voix par personne)</option>
        </select>
      </label>
      <label className={styles.champ}>
        <span>Qui peut voter ? (QR code)</span>
        <select name="acces" defaultValue={acces}>
          <option value="OUVERT">Normal : tout le monde, une fois par numéro</option>
          <option value="RESTREINT">Restreint : seulement les numéros autorisés</option>
        </select>
      </label>
      <label className={styles.champ}>
        <span>Part dans la note finale (%)</span>
        <input name="part" defaultValue={part ? String(part).replace(".", ",") : ""} inputMode="decimal" required placeholder="40" />
      </label>
      <label className={styles.caseACocher}>
        <input type="checkbox" name="avecCriteres" defaultChecked={avecCriteres} />
        <span>
          Noter sur des critères
          <small>Sinon, on compte des voix. Toujours des voix en ligne et par QR code.</small>
        </span>
      </label>
    </>
  );
}
