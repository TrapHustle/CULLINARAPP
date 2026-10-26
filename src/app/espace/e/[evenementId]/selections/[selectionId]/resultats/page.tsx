import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { Portrait } from "@/components/espace/candidat";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import r from "@/components/espace/resultats.module.css";
import { arrondi2 } from "@/lib/calcul";
import { exigerUtilisateur } from "@/lib/espace";
import { dateHeure } from "@/lib/format-espace";
import { vueResultats } from "@/lib/resultats-vue";

export const metadata: Metadata = { title: "Résultats — DIGITALYX-VOTE" };

const sur100 = (n: number | null) => (n === null ? "—" : arrondi2(n).toLocaleString("fr-FR"));

export default async function PageResultats({
  params,
  searchParams,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
  searchParams: Promise<{ essai?: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const essai = (await searchParams).essai === "1";
  const utilisateur = await exigerUtilisateur();
  const vue = await vueResultats(utilisateur.organisationId, selectionId, { inclureSimules: essai });
  if (!vue) notFound();

  const base = `/espace/e/${evenementId}/selections/${selectionId}/resultats`;
  const enDirect = vue.selection.etat === "OUVERTE";
  const notes = vue.lignes.filter((l) => l.note !== null);
  const egalites = notes.some((l) => l.egalite);
  // Un type sans aucun vote sort du calcul (RG 8.4) : barré sur téléphone.
  const sansVote = new Set(
    vue.types.filter((t) => vue.lignes.every((l) => (l.types.find((x) => x.typeVoteId === t.id)?.volume ?? 0) === 0)).map((t) => t.id),
  );

  return (
    <>
      {enDirect ? <AutoRefresh intervalMs={10_000} /> : null}

      <div className={`${styles.bandeau} ${r.bandeau} ${vue.figeLe ? styles.bandeauOk : styles.bandeauInfo}`}>
        <Icone nom={vue.figeLe ? "cadenas" : "etincelle"} taille={18} />
        <div>
          <strong>
            {vue.figeLe
              ? `Résultats officiels figés le ${dateHeure(vue.figeLe)}`
              : enDirect
                ? "Classement provisoire, recalculé toutes les 10 secondes"
                : "Aucun vote tant que la sélection n’est pas ouverte"}
          </strong>
          <span>
            Chaque type est ramené sur 100 puis pondéré par sa part ; un type sans vote sort du calcul (RG 8.4).
            {vue.inclutSimules ? " Aperçu d’essai : les paiements simulés sont comptés." : " Paiements simulés exclus."}
          </span>
        </div>
        <div className={r.actions}>
          {!vue.figeLe ? (
            <Link href={essai ? base : `${base}?essai=1`} className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`}>
              {essai ? "Vue officielle" : "Inclure les simulés"}
            </Link>
          ) : null}
          <a
            href={`/api/espace/resultats/${selectionId}${essai && !vue.figeLe ? "?essai=1" : ""}`}
            className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`}
          >
            Export CSV
          </a>
          <a
            href={`/projection/${selectionId}`}
            target="_blank"
            rel="noreferrer"
            className={`${styles.bouton} ${styles.boutonPrincipal} ${styles.boutonPetit}`}
          >
            Proclamation
          </a>
        </div>
      </div>

      {egalites ? (
        <div className={`${styles.bandeau} ${styles.bandeauAlerte}`}>
          <Icone nom="bouclier" taille={18} />
          <div>
            <strong>Égalité au classement</strong>
            <span>Aucune règle automatique ne départage : c&rsquo;est à vous d&rsquo;arbitrer (RG 8.5).</span>
          </div>
        </div>
      ) : null}

      <section className={`${styles.carte} ${r.bureau}`}>
        <div className={styles.tableauBoite}>
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
              {vue.lignes.length === 0 ? (
                <tr>
                  <td colSpan={vue.types.length + 3}>Aucun candidat inscrit.</td>
                </tr>
              ) : null}
              {vue.lignes.map((l) => (
                <tr key={l.participationId}>
                  <td>
                    {l.rang ? (
                      <span className={`${styles.medaille} ${l.rang <= 3 ? styles[`medaille${l.rang}`] : ""}`}>{l.rang}</span>
                    ) : (
                      <span className={styles.pastille}>non noté</span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <Portrait nom={l.nom} photoUrl={l.photoUrl} taille={36} />
                      <span>
                        <span className={styles.fort}>{l.nom}</span>
                        <span style={{ display: "flex", gap: 6, marginTop: 2 }}>
                          {l.egalite ? <span className={`${styles.pastille} ${styles.pastilleRouge}`}>égalité</span> : null}
                          {l.qualifie ? <span className={`${styles.pastille} ${styles.pastilleVerte}`}>qualifié</span> : null}
                        </span>
                      </span>
                    </span>
                  </td>
                  {vue.types.map((t) => {
                    const n = l.types.find((x) => x.typeVoteId === t.id);
                    return (
                      <td key={t.id} className={styles.nombre}>
                        {sur100(n?.note ?? null)}
                        <div style={{ color: "var(--gris)", fontSize: 12 }}>
                          {(n?.volume ?? 0).toLocaleString("fr-FR")} {t.canal === "EN_LIGNE" ? "voix" : "vote(s)"}
                        </div>
                      </td>
                    );
                  })}
                  <td className={`${styles.nombre} ${styles.fort}`} style={{ fontSize: 17 }}>
                    {sur100(l.note)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={r.cartes}>
        <div className={r.parts}>
          {vue.types.map((t) => (
            <span key={t.id} className={`${r.part} ${sansVote.has(t.id) ? r.partVide : ""}`}>
              {t.libelle} <strong>{t.part.toLocaleString("fr-FR")} %</strong>
            </span>
          ))}
        </div>
        {vue.lignes.length === 0 ? <div className={styles.vide}>Aucun candidat inscrit.</div> : null}
        <ol className={r.cartes}>
          {vue.lignes.map((l) => (
            <li key={l.participationId} className={r.carte}>
              <div className={r.haut}>
                {l.rang ? (
                  <span className={`${styles.medaille} ${l.rang <= 3 ? styles[`medaille${l.rang}`] : ""}`}>{l.rang}</span>
                ) : (
                  <span className={styles.medaille}>–</span>
                )}
                <Portrait nom={l.nom} photoUrl={l.photoUrl} taille={40} />
                <div className={r.nom}>
                  {l.nom}
                  {l.ville ? <small>{l.ville}</small> : null}
                  {l.egalite || l.qualifie ? (
                    <span className={r.pastilles}>
                      {l.egalite ? <span className={`${styles.pastille} ${styles.pastilleRouge}`}>égalité</span> : null}
                      {l.qualifie ? <span className={`${styles.pastille} ${styles.pastilleVerte}`}>qualifié</span> : null}
                    </span>
                  ) : null}
                </div>
                <div className={r.note}>
                  <strong>{sur100(l.note)}</strong>
                  <span>/ 100</span>
                </div>
              </div>
              <div className={r.detail}>
                {vue.types.map((t) => {
                  const n = l.types.find((x) => x.typeVoteId === t.id);
                  const volume = n?.volume ?? 0;
                  return (
                    <div key={t.id} className={r.ligne}>
                      <span className={r.libelle}>
                        {t.libelle}
                        {volume > 0 ? ` · ${volume.toLocaleString("fr-FR")} ${t.canal === "SALLE" ? "vote(s)" : "voix"}` : ""}
                      </span>
                      {n?.note == null ? (
                        <span className={r.valeurVide}>pas encore noté</span>
                      ) : (
                        <>
                          <span className={r.valeur}>{sur100(n.note)}</span>
                          <span className={r.piste}>
                            <i style={{ width: `${Math.min(100, Math.max(0, n.note))}%` }} />
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
