import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChampsCandidat, Portrait } from "@/components/espace/candidat";
import { BoutonEnvoi, FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { listerParticipations } from "@/lib/candidats";
import {
  creerEtInscrireAction,
  deplacerParticipationAction,
  disponibiliteAction,
  inscrireAction,
  retirerAction,
} from "@/lib/candidats-actions";
import { exigerUtilisateur } from "@/lib/espace";
import { selectionDeLOrganisation } from "@/lib/evenements";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Candidats de la sélection — DIGITALYX-VOTE" };

export default async function PageCandidatsSelection({
  params,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const selection = await selectionDeLOrganisation(utilisateur.organisationId, selectionId);
  if (!selection || selection.evenementId !== evenementId) notFound();

  const participations = await listerParticipations(utilisateur.organisationId, selectionId);
  const disponibles = await prisma.candidat.findMany({
    where: { organisationId: utilisateur.organisationId, participations: { none: { selectionId } } },
    orderBy: { nom: "asc" },
  });
  const modifiable = selection.etat !== "CLOTUREE";
  const petit = `${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonIcone}`;

  return (
    <>
      <section className={styles.carte}>
        <div className={styles.carteHaut}>
          <div>
            <h2 className={styles.carteTitre}>
              {participations.length} candidat{participations.length > 1 ? "s" : ""} en lice
            </h2>
            <p className={styles.carteTexte}>
              Dans l&rsquo;ordre de passage. Un candidat indisponible n&rsquo;est plus proposé au vote, ses voix restent
              acquises.
            </p>
          </div>
        </div>
        {participations.length === 0 ? (
          <div className={styles.vide} style={{ paddingTop: 8 }}>
            Aucun candidat inscrit. Ajoutez-en ci-dessous.
          </div>
        ) : (
          <ul className={styles.lignes}>
            {participations.map((p, i) => (
              <li key={p.id} className={styles.ligne}>
                <span className={styles.ligneRang}>{i + 1}</span>
                <Portrait nom={p.candidat.nom} photoUrl={p.candidat.photoUrl} />
                <div className={styles.ligneTexte}>
                  <span className={styles.ligneTitre}>{p.candidat.nom}</span>
                  <div className={styles.ligneMeta}>
                    {p.candidat.ville ? <span>{p.candidat.ville}</span> : null}
                    <span>
                      {p._count.suffrages} vote{p._count.suffrages > 1 ? "s" : ""}
                    </span>
                    {p.qualifie ? <span className={`${styles.pastille} ${styles.pastilleVerte}`}>Qualifié</span> : null}
                  </div>
                </div>
                <span className={`${styles.pastille} ${p.disponible ? styles.pastilleVerte : styles.pastilleRouge}`}>
                  {p.disponible ? "Disponible" : "Indisponible"}
                </span>
                {modifiable ? (
                  <div className={styles.ligneActions}>
                    <FormulaireAction action={disponibiliteAction.bind(null, p.id, !p.disponible)} discret>
                      <BoutonEnvoi className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`}>
                        {p.disponible ? "Suspendre" : "Rendre disponible"}
                      </BoutonEnvoi>
                    </FormulaireAction>
                    <FormulaireAction action={deplacerParticipationAction.bind(null, p.id, "haut")} discret>
                      <BoutonEnvoi className={petit} titre="Monter">
                        <Icone nom="haut" taille={16} />
                      </BoutonEnvoi>
                    </FormulaireAction>
                    <FormulaireAction action={deplacerParticipationAction.bind(null, p.id, "bas")} discret>
                      <BoutonEnvoi className={petit} titre="Descendre">
                        <Icone nom="bas" taille={16} />
                      </BoutonEnvoi>
                    </FormulaireAction>
                    {p._count.suffrages + p._count.paiements === 0 ? (
                      <FormulaireAction
                        action={retirerAction.bind(null, p.id)}
                        confirmer={`Retirer ${p.candidat.nom} de cette sélection ?`}
                        discret
                      >
                        <BoutonEnvoi className={petit} titre="Retirer de la sélection">
                          <Icone nom="corbeille" taille={16} />
                        </BoutonEnvoi>
                      </FormulaireAction>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {modifiable ? (
        <>
          <section className={styles.carte}>
            <div className={styles.carteHaut} style={{ paddingBottom: 6 }}>
              <div>
                <h2 className={styles.carteTitre}>Inscrire des candidats existants</h2>
                <p className={styles.carteTexte}>
                  Depuis <Link href="/espace/candidats">vos candidats</Link> : ceux d&rsquo;une sélection précédente, par
                  exemple.
                </p>
              </div>
            </div>
            {disponibles.length === 0 ? (
              <p className={styles.carteTexte} style={{ padding: "0 24px 22px" }}>
                Tous vos candidats sont déjà inscrits.
              </p>
            ) : (
              <FormulaireAction
                action={inscrireAction.bind(null, selectionId)}
                bouton="Inscrire les candidats cochés"
                style={{ padding: "0 24px 22px" }}
                vider
              >
                <div className={styles.grilleCases} style={{ padding: "4px 0 8px" }}>
                  {disponibles.map((c) => (
                    <label key={c.id} className={styles.choixCarte} style={{ alignItems: "center" }}>
                      <input type="checkbox" name="candidatId" value={c.id} />
                      <Portrait nom={c.nom} photoUrl={c.photoUrl} taille={36} />
                      <span>
                        <strong>{c.nom}</strong>
                        {c.ville ? <small>{c.ville}</small> : null}
                      </span>
                    </label>
                  ))}
                </div>
                <div style={{ height: 8 }} />
              </FormulaireAction>
            )}
          </section>

          <section className={styles.carte}>
            <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
              <div>
                <h2 className={styles.carteTitre}>Nouveau candidat</h2>
                <p className={styles.carteTexte}>Ajouté à vos candidats et inscrit à cette sélection.</p>
              </div>
            </div>
            <FormulaireAction
              action={creerEtInscrireAction.bind(null, selectionId)}
              className={styles.formulaire}
              bouton="Ajouter et inscrire"
              vider
            >
              <ChampsCandidat />
            </FormulaireAction>
          </section>
        </>
      ) : null}
    </>
  );
}
