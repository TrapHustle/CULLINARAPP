import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/espace/candidat";
import { BoutonEnvoi, FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { dateHeure } from "@/lib/format-espace";
import { listerSaisies } from "@/lib/notes";
import { annulerSaisieAction, saisirFicheAction, saisirVoixAction } from "@/lib/pilotage-actions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Notes du jury — DIGITALYX-VOTE" };

export default async function PageNotes({
  params,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, evenementId, evenement: { organisationId: utilisateur.organisationId } },
    include: {
      typesVote: {
        where: { canal: "SALLE" },
        orderBy: { ordre: "asc" },
        include: { criteres: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
      },
      participations: {
        where: { disponible: true },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
        include: { candidat: true },
      },
    },
  });
  if (!selection) notFound();

  const saisies = await listerSaisies(utilisateur.organisationId, selectionId);
  const ouverte = selection.etat === "OUVERTE" && selection.voteSalleOuvert;
  const base = `/espace/e/${evenementId}/selections/${selectionId}`;

  return (
    <>
      {!ouverte ? (
        <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
          <Icone nom="cadenas" taille={18} />
          <div>
            <strong>
              {selection.etat === "PREPAREE"
                ? "La saisie s’ouvrira avec la sélection"
                : selection.etat === "CLOTUREE"
                  ? "Sélection clôturée : les notes sont figées"
                  : "Vote en salle suspendu"}
            </strong>
            <span>
              {selection.etat === "OUVERTE" ? (
                <>
                  Reprenez-le dans l&rsquo;onglet <Link href={base}>Pilotage</Link>.
                </>
              ) : (
                "Les fiches du jury se recopient ici pendant que la sélection est ouverte."
              )}
            </span>
          </div>
        </div>
      ) : null}

      {selection.typesVote.length === 0 ? (
        <section className={styles.carte}>
          <div className={styles.vide}>
            <strong>Pas de vote en salle</strong>
            Cette sélection n&rsquo;a que du vote en ligne.
          </div>
        </section>
      ) : null}

      {ouverte
        ? selection.typesVote.map((type) =>
            type.avecCriteres ? (
              <section key={type.id} className={styles.carte}>
                <div className={styles.carteHaut} style={{ paddingBottom: 8 }}>
                  <div>
                    <h2 className={styles.carteTitre}>Fiche « {type.libelle} »</h2>
                    <p className={styles.carteTexte}>
                      Recopiez la fiche d&rsquo;un juré : une ligne par candidat noté. Les lignes vides sont ignorées.
                    </p>
                  </div>
                </div>
                <FormulaireAction
                  action={saisirFicheAction.bind(null, selectionId, type.id)}
                  bouton="Enregistrer la fiche"
                  boutonEnvoi="Enregistrement…"
                  vider
                  style={{ padding: "0 24px 22px" }}
                >
                  <label className={styles.champ} style={{ maxWidth: 200, marginBottom: 14 }}>
                    <span>Juré n°</span>
                    <input name="jure" inputMode="numeric" required placeholder="1" />
                  </label>
                  <div className={styles.tableauBoite} style={{ border: "1px solid var(--filet)", borderRadius: 12, marginBottom: 16 }}>
                    <table className={styles.tableau}>
                      <thead>
                        <tr>
                          <th>Candidat</th>
                          {type.criteres.map((c) => (
                            <th key={c.id} className={styles.nombre}>
                              {c.libelle} / {c.bareme}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selection.participations.map((p) => (
                          <tr key={p.id}>
                            <td className={styles.fort}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                                <Portrait nom={p.candidat.nom} photoUrl={p.candidat.photoUrl} taille={32} />
                                {p.candidat.nom}
                              </span>
                            </td>
                            {type.criteres.map((c) => (
                              <td key={c.id} className={styles.nombre}>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  name={`v_${p.id}_${c.id}`}
                                  aria-label={`${p.candidat.nom}, ${c.libelle} sur ${c.bareme}`}
                                  maxLength={3}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </FormulaireAction>
              </section>
            ) : (
              <section key={type.id} className={styles.carte}>
                <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
                  <div>
                    <h2 className={styles.carteTitre}>Voix « {type.libelle} »</h2>
                    <p className={styles.carteTexte}>Ajoutez les voix comptées dans la salle pour un candidat.</p>
                  </div>
                </div>
                <FormulaireAction
                  action={saisirVoixAction.bind(null, selectionId, type.id)}
                  className={styles.formulaire}
                  bouton="Ajouter les voix"
                  vider
                >
                  <label className={styles.champ}>
                    <span>Candidat</span>
                    <select name="participationId" required>
                      {selection.participations.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.candidat.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.champ}>
                    <span>Nombre de voix</span>
                    <input name="voix" inputMode="numeric" required placeholder="12" />
                  </label>
                </FormulaireAction>
              </section>
            ),
          )
        : null}

      <section className={styles.carte}>
        <div className={styles.carteHaut}>
          <div>
            <h2 className={styles.carteTitre}>Votes en salle enregistrés</h2>
            <p className={styles.carteTexte}>Un vote ne se modifie pas : annulez-le puis ressaisissez la fiche (RG 5.7).</p>
          </div>
        </div>
        {saisies.length === 0 ? (
          <div className={styles.vide} style={{ paddingTop: 0 }}>
            Aucun vote en salle pour l&rsquo;instant.
          </div>
        ) : (
          <div className={styles.tableauBoite}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Type</th>
                  <th>Juré</th>
                  <th>Candidat</th>
                  <th>Détail</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {saisies.map((s) => (
                  <tr key={s.id} className={s.annuleLe ? styles.ligneAnnulee : undefined}>
                    <td>{dateHeure(s.creeLe)}</td>
                    <td>{s.typeVote.libelle}</td>
                    <td>{s.jureIndex ?? "—"}</td>
                    <td className={styles.fort}>{s.participation.candidat.nom}</td>
                    <td>
                      {s.typeVote.avecCriteres
                        ? [...s.valeurs]
                            .sort((a, b) => a.critere.ordre - b.critere.ordre)
                            .map((v) => `${v.critere.libelle} ${v.valeur}/${v.critere.bareme}`)
                            .join(" · ")
                        : `${s.poids} voix`}
                    </td>
                    <td>
                      {!s.annuleLe && selection.etat === "OUVERTE" ? (
                        <FormulaireAction
                          action={annulerSaisieAction.bind(null, s.id)}
                          confirmer="Annuler ce vote ?"
                          discret
                        >
                          <BoutonEnvoi className={styles.boutonLien}>Annuler</BoutonEnvoi>
                        </FormulaireAction>
                      ) : s.annuleLe ? (
                        "annulé"
                      ) : null}
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
