import type { Metadata } from "next";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { changerMotDePasseAction } from "@/lib/organisation-actions";

export const metadata: Metadata = { title: "Mon compte — Plateforme DIGITALYX-VOTE" };

export default async function PageComptePlateforme() {
  const utilisateur = await exigerSuperAdmin();
  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Plateforme</div>
          <h1 className={styles.titre}>
            Mon <em>compte</em>
          </h1>
          <p className={styles.sousTitre}>{utilisateur.email} · super-admin</p>
        </div>
      </div>
      <section className={styles.carte}>
        <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
          <h2 className={styles.carteTitre}>Changer de mot de passe</h2>
        </div>
        <FormulaireAction action={changerMotDePasseAction} className={styles.formulaire} bouton="Changer le mot de passe" vider>
          <label className={styles.champ}>
            <span>Mot de passe actuel</span>
            <input name="actuel" type="password" required autoComplete="current-password" />
          </label>
          <label className={styles.champ}>
            <span>Nouveau mot de passe</span>
            <input name="nouveau" type="password" required minLength={10} autoComplete="new-password" />
          </label>
          <label className={styles.champ}>
            <span>Confirmation</span>
            <input name="confirmation" type="password" required autoComplete="new-password" />
          </label>
        </FormulaireAction>
      </section>
    </>
  );
}
