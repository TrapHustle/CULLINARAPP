import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { arrondi2 } from "@/lib/calcul";
import { detailVotes } from "@/lib/detail-votes";
import { exigerUtilisateur } from "@/lib/espace";
import { dateHeure } from "@/lib/format-espace";
import { outfit } from "@/lib/police";
import { vueResultats } from "@/lib/resultats-vue";
import { Imprimer } from "./imprimer";
import styles from "./proces-verbal.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Procès-verbal — DIGITALYX-VOTE" };

const sur100 = (n: number | null) => (n === null ? "—" : arrondi2(n).toLocaleString("fr-FR"));

/**
 * Procès-verbal des résultats d'une sélection : le classement, la façon dont
 * il est calculé, le détail des votes et la place des signatures. Une page à
 * imprimer, ou à enregistrer en PDF depuis la fenêtre d'impression.
 */
export default async function PageProcesVerbal({
  params,
  searchParams,
}: {
  params: Promise<{ selectionId: string }>;
  searchParams: Promise<{ essai?: string }>;
}) {
  const utilisateur = await exigerUtilisateur();
  const { selectionId } = await params;
  const essai = (await searchParams).essai === "1";
  const [vue, detail] = await Promise.all([
    vueResultats(utilisateur.organisationId, selectionId, { inclureSimules: essai }),
    detailVotes(utilisateur.organisationId, selectionId, { inclureSimules: essai }),
  ]);
  if (!vue || !detail) notFound();

  const nomCandidat = new Map(vue.lignes.map((l) => [l.participationId, l.nom]));
  const ordre = new Map(vue.lignes.map((l, i) => [l.participationId, i]));
  const parCandidat = <T extends { participationId: string | null }>(liste: T[]) =>
    [...liste].sort((a, b) => (ordre.get(a.participationId ?? "") ?? 0) - (ordre.get(b.participationId ?? "") ?? 0));

  return (
    <div className={`${outfit.className} ${styles.page}`}>
      <Imprimer />

      <header className={styles.entete}>
        <p className={styles.surtitre}>Procès-verbal des résultats</p>
        <h1>{vue.selection.evenementNom}</h1>
        <p className={styles.selection}>{vue.selection.libelle}</p>
        <p className={styles.etat}>
          {vue.figeLe
            ? `Résultats officiels, figés le ${dateHeure(vue.figeLe)}.`
            : `Classement provisoire au ${dateHeure(new Date())} : le vote n’est pas clôturé.`}
          {vue.inclutSimules ? " Aperçu d’essai : les paiements simulés sont comptés." : ""}
        </p>
      </header>

      <section>
        <h2>Calcul</h2>
        <p>
          Chaque type de vote est ramené sur 100, puis pondéré par sa part :{" "}
          {vue.types.map((t) => `${t.libelle} ${t.part.toLocaleString("fr-FR")} %`).join(", ")}. Un vote avec critères vaut la moyenne des
          totaux des votants rapportée au barème ; un vote par voix, la part des voix. Un type sans aucun vote sort du calcul.
        </p>
      </section>

      <section>
        <h2>Classement</h2>
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Rang</th>
              <th>Candidat</th>
              {vue.types.map((t) => (
                <th key={t.id} className={styles.nombre}>
                  {t.libelle} · {t.part.toLocaleString("fr-FR")} %
                </th>
              ))}
              <th className={styles.nombre}>Note finale / 100</th>
            </tr>
          </thead>
          <tbody>
            {vue.lignes.map((l) => (
              <tr key={l.participationId}>
                <td>{l.rang ?? "—"}</td>
                <td>
                  <strong>{l.nom}</strong>
                  {l.ville ? <span className={styles.doux}> · {l.ville}</span> : null}
                  {l.egalite ? <span className={styles.marque}> égalité</span> : null}
                  {l.qualifie ? <span className={styles.marque}> qualifié</span> : null}
                </td>
                {vue.types.map((t) => {
                  const n = l.types.find((x) => x.typeVoteId === t.id);
                  return (
                    <td key={t.id} className={styles.nombre}>
                      {sur100(n?.note ?? null)}
                      <span className={styles.volume}>
                        {(n?.volume ?? 0).toLocaleString("fr-FR")} {t.avecCriteres ? "note(s)" : t.canal === "EN_LIGNE" ? "voix" : "vote(s)"}
                      </span>
                    </td>
                  );
                })}
                <td className={`${styles.nombre} ${styles.finale}`}>{sur100(l.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.signatures}>
        <h2>Signatures</h2>
        <div>
          {["Président(e) du jury", "Organisateur", "Témoin"].map((role) => (
            <div key={role} className={styles.signature}>
              <span>{role}</span>
              <span className={styles.ligneSignature}>Nom :</span>
              <span className={styles.ligneSignature}>Signature :</span>
            </div>
          ))}
        </div>
      </section>

      {detail.types.map((type) => (
        <section key={type.typeVoteId} className={styles.annexe}>
          <h2>
            Annexe · {type.libelle} ({type.part.toLocaleString("fr-FR")} %)
          </h2>
          {type.paiements ? (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Candidat</th>
                  <th>Date</th>
                  <th>Référence</th>
                  <th>Téléphone</th>
                  <th className={styles.nombre}>Voix</th>
                  <th className={styles.nombre}>Montant</th>
                  <th>Compté</th>
                </tr>
              </thead>
              <tbody>
                {parCandidat(type.paiements).map((p) => (
                  <tr key={p.id} className={p.compte ? undefined : styles.annule}>
                    <td>{p.participationId ? nomCandidat.get(p.participationId) : ""}</td>
                    <td>{dateHeure(new Date(p.creeLe))}</td>
                    <td>{p.reference}</td>
                    <td>{p.telephone}</td>
                    <td className={styles.nombre}>{p.voix.toLocaleString("fr-FR")}</td>
                    <td className={styles.nombre}>{p.montant.toLocaleString("fr-FR")} F</td>
                    <td>{p.compte ? "oui" : p.simule ? "non (simulé)" : "non"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : type.votes.length === 0 ? (
            <p className={styles.doux}>Aucun vote.</p>
          ) : (
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Candidat</th>
                  <th>Votant</th>
                  {type.avecCriteres ? (
                    type.criteres.map((c) => (
                      <th key={c.libelle} className={styles.nombre}>
                        {c.libelle} /{c.bareme}
                      </th>
                    ))
                  ) : (
                    <th className={styles.nombre}>Voix</th>
                  )}
                  {type.avecCriteres ? <th className={styles.nombre}>Total /{type.baremeTotal}</th> : null}
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {parCandidat(type.votes).map((v) => (
                  <tr key={v.id} className={v.annuleLe ? styles.annule : undefined}>
                    <td>{nomCandidat.get(v.participationId)}</td>
                    <td>
                      {v.votant}
                      {v.annuleLe ? " (annulé)" : v.correction ? " (correction)" : ""}
                    </td>
                    {type.avecCriteres ? (
                      (v.valeurs ?? []).map((x, i) => (
                        <td key={i} className={styles.nombre}>
                          {x}
                        </td>
                      ))
                    ) : (
                      <td className={styles.nombre}>{v.poids}</td>
                    )}
                    {type.avecCriteres ? <td className={styles.nombre}>{v.total}</td> : null}
                    <td>{dateHeure(new Date(v.creeLe))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
