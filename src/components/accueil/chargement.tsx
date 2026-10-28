import { dmSans } from "@/lib/police";
import styles from "./chargement.module.css";

/**
 * Écran de chargement affiché par-dessus chaque page, à chaque chargement ou
 * rechargement. Placé dans la mise en page racine, il ne revient pas lors des
 * navigations internes, qui ne rechargent pas la page.
 *
 * La page est rendue normalement dessous (rien ne change pour le
 * référencement) et l'écran s'efface seul, en CSS.
 */
export function Chargement() {
  return (
    <div className={`${dmSans.className} ${styles.ecran}`} aria-hidden="true">
      <div className={`${styles.halo} ${styles.haloUn}`} />
      <div className={`${styles.halo} ${styles.haloDeux}`} />
      <div className={styles.centre}>
        <span className={styles.logo}>
          <svg
            width="46"
            height="46"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className={styles.coche} d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div className={styles.texte}>
          <div className={styles.nom}>DIGITALYX-VOTE</div>
          <div className={styles.slogan}>Concours et votes, en direct</div>
        </div>
        <div className={styles.piste}>
          <div className={styles.barre} />
        </div>
      </div>
    </div>
  );
}
