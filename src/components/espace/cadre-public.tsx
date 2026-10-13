import Link from "next/link";
import { dmSans } from "@/lib/police";
import styles from "./compte.module.css";
import { Icone } from "./icone";

/** Habillage des pages de compte (connexion, inscription). */
export function CadrePublic({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dmSans.className} ${styles.page}`}>
      <header className={styles.entete}>
        <div className={styles.cadre}>
          <Link href="/" className={styles.marque}>
            <span className={styles.marqueSigne}>
              <Icone nom="coche" taille={17} />
            </span>
            DIGITALYX-VOTE
          </Link>
          <Link href="/" className={styles.retour}>
            ← Retour à l&rsquo;accueil
          </Link>
        </div>
      </header>
      <main className={styles.centre}>{children}</main>
    </div>
  );
}
