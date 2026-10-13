import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { listerEvenements } from "@/lib/evenements";
import { dateLongue } from "@/lib/format-espace";

export const metadata: Metadata = { title: "Mes événements — DIGITALYX-VOTE" };

export default async function PageEvenements() {
  const utilisateur = await exigerUtilisateur();
  const evenements = await listerEvenements(utilisateur.organisationId);

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Organisation</div>
          <h1 className={styles.titre}>Mes événements</h1>
          <p className={styles.sousTitre}>{utilisateur.organisation.nom}</p>
        </div>
        <Link href="/espace/evenements/nouveau" className={`${styles.bouton} ${styles.boutonPrincipal}`}>
          <Icone nom="plus" taille={16} />
          Nouvel événement
        </Link>
      </div>

      <section className={styles.carte}>
        {evenements.length === 0 ? (
          <div className={styles.vide}>
            <strong>Aucun événement pour l’instant</strong>
            Créez votre premier concours pour commencer.
            <div>
              <Link href="/espace/evenements/nouveau" className={`${styles.bouton} ${styles.boutonPrincipal}`}>
                Créer un événement
              </Link>
            </div>
          </div>
        ) : (
          <ul className={styles.lignes} style={{ marginTop: -1 }}>
            {evenements.map((evenement) => {
              const ouvertes = evenement.selections.filter((s) => s.etat === "OUVERTE").length;
              return (
                <li key={evenement.id} className={styles.ligne}>
                  <span className={`${styles.chiffreIcone} ${styles.bleu}`} style={{ position: "static" }}>
                    <Icone nom="trophee" taille={20} />
                  </span>
                  <div className={styles.ligneTexte}>
                    <Link href={`/espace/e/${evenement.id}`}>{evenement.nom}</Link>
                    <div className={styles.ligneMeta}>
                      <span>
                        {evenement.selections.length} sélection{evenement.selections.length > 1 ? "s" : ""}
                      </span>
                      {evenement.date ? <span>{dateLongue(evenement.date)}</span> : null}
                    </div>
                  </div>
                  {ouvertes > 0 ? <span className={`${styles.etat} ${styles.etatOUVERTE}`}>En direct</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
