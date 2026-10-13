import Link from "next/link";
import styles from "@/components/espace/espace.module.css";
import { deconnecterAction } from "@/lib/comptes-actions";
import { exigerUtilisateur } from "@/lib/espace";
import { plex } from "@/lib/police";

/** Garde d'accès unique de l'espace des organisations. */
export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  const utilisateur = await exigerUtilisateur();

  return (
    <div className={`${plex.className} ${styles.page}`}>
      <header className={styles.entete}>
        <div className={styles.cadre}>
          <Link href="/espace" className={styles.marque}>
            DIGITALYX-VOTE
          </Link>
          <div className={styles.compte}>
            <span>
              {utilisateur.organisation.nom} · {utilisateur.email}
            </span>
            <form action={deconnecterAction}>
              <button type="submit" className={styles.boutonEntete}>
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className={styles.contenu}>
        <div className={styles.cadre}>{children}</div>
      </main>
    </div>
  );
}
