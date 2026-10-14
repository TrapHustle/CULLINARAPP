import Link from "next/link";
import { outfit } from "@/lib/police";
import styles from "./compte.module.css";
import { Icone } from "./icone";

/**
 * Habillage des pages de compte (connexion, inscription, 404) : écran partagé,
 * panneau bleu nuit de présentation à gauche, formulaire à droite.
 */
export function CadrePublic({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${outfit.className} ${styles.page}`}>
      <aside className={styles.vitrine}>
        <Link href="/" className={styles.marque}>
          <span className={styles.marqueSigne}>
            <Icone nom="coche" taille={20} />
          </span>
          <span>
            DIGITALYX<em>-VOTE</em>
          </span>
        </Link>

        <div className={styles.accroche}>
          <span className={styles.badge}>
            <Icone nom="bouclier" taille={15} />
            Espace organisateur sécurisé
          </span>
          <h2 className={styles.slogan}>
            Le vote de vos concours,
            <br />
            <em>en direct.</em>
          </h2>
          <p className={styles.pitch}>
            Jury, salle et public : préparez vos sélections, suivez le classement sur 100 et proclamez les résultats
            depuis une seule console.
          </p>
        </div>

        <div className={styles.piedVitrine}>
          <span>Console DIGITALYX-VOTE v1.0</span>
          <span>
            Powered by <b>Inovyx Tech</b>
          </span>
        </div>
      </aside>

      <main className={styles.cote}>
        <Link href="/" className={styles.retour}>
          ← Retour à l&rsquo;accueil
        </Link>
        <div className={styles.centre}>{children}</div>
      </main>
    </div>
  );
}
