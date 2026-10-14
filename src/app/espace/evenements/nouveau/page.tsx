import type { Metadata } from "next";
import { FormulaireEvenement } from "@/components/espace/formulaires-evenement";
import styles from "@/components/espace/panel.module.css";

export const metadata: Metadata = { title: "Nouvel événement — DIGITALYX-VOTE" };

export default function PageNouvelEvenement() {
  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Informations générales du concours</div>
          <h1 className={styles.titre}>Créer un <em>événement</em></h1>
          <p className={styles.sousTitre}>
            Un événement regroupe vos sélections, jusqu&rsquo;à la finale. Vous ajouterez les sélections juste après.
          </p>
        </div>
      </div>
      <section className={styles.carte}>
        <FormulaireEvenement />
      </section>
    </>
  );
}
