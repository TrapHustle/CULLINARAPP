import Link from "next/link";
import styles from "@/app/accueil.module.css";
import { Icone } from "@/components/espace/icone";

export function Marque() {
  return (
    <Link href="/" className={styles.brand} aria-label="DIGITALYX-VOTE, accueil">
      <span className={styles["brand-mark"]}>
        <Icone nom="coche" taille={17} />
      </span>
      <span>DIGITALYX-VOTE</span>
    </Link>
  );
}
