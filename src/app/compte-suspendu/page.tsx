import type { Metadata } from "next";
import styles from "@/components/espace/compte.module.css";
import { CadrePublic } from "@/components/espace/cadre-public";
import { deconnecterAction } from "@/lib/comptes-actions";

export const metadata: Metadata = { title: "Compte suspendu — DIGITALYX-VOTE" };

/** Organisation suspendue par la plateforme : l'espace et les votes publics sont fermés. */
export default function CompteSuspendu() {
  return (
    <CadrePublic>
      <div className={styles.carte} style={{ textAlign: "center" }}>
        <div className={styles.surtitre}>Accès suspendu</div>
        <h1>Votre compte est suspendu.</h1>
        <p className={styles.sousTitre}>
          Vos données sont conservées, mais votre espace et vos pages de vote sont fermés. Contactez Inovyx Tech pour
          réactiver votre compte.
        </p>
        <form action={deconnecterAction}>
          <button type="submit" className={styles.bouton}>
            Se déconnecter
          </button>
        </form>
      </div>
    </CadrePublic>
  );
}
