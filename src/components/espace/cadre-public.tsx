import Link from "next/link";
import { plex } from "@/lib/police";
import styles from "./espace.module.css";

/** Habillage des pages de compte (connexion, inscription). */
export function CadrePublic({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${plex.className} ${styles.page}`}>
      <header className={styles.entete}>
        <div className={styles.cadre}>
          <Link href="/" className={styles.marque}>
            DIGITALYX-VOTE
          </Link>
        </div>
      </header>
      <main className={styles.centre}>{children}</main>
    </div>
  );
}
