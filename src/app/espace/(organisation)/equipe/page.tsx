import type { Metadata } from "next";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { LIBELLES_ROLE, listerEquipe, ROLES_EQUIPE } from "@/lib/equipe";
import { dateLongue } from "@/lib/format-espace";
import { ajouterMembreAction, changerRoleAction, retirerMembreAction } from "@/lib/organisation-actions";

export const metadata: Metadata = { title: "Équipe — DIGITALYX-VOTE" };

export default async function PageEquipe() {
  const utilisateur = await exigerUtilisateur();
  const equipe = await listerEquipe(utilisateur.organisationId);
  const proprietaire = utilisateur.role === "PROPRIETAIRE";

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>{utilisateur.organisation.nom}</div>
          <h1 className={styles.titre}>
            Votre <em>équipe</em>
          </h1>
          <p className={styles.sousTitre}>Qui peut entrer dans votre espace, et avec quels droits.</p>
        </div>
      </div>

      <section className={styles.carte}>
        <ul className={styles.lignes} style={{ marginTop: -1 }}>
          {equipe.map((m) => (
            <li key={m.id} className={styles.ligne}>
              <div className={styles.ligneTexte}>
                <span className={styles.ligneTitre}>{m.email}</span>
                <div className={styles.ligneMeta}>
                  <span>{LIBELLES_ROLE[m.role]?.detail}</span>
                  <span>depuis le {dateLongue(m.creeLe)}</span>
                  {m.id === utilisateur.id ? <span className={`${styles.pastille} ${styles.pastilleBleue}`}>vous</span> : null}
                </div>
              </div>
              {proprietaire && m.id !== utilisateur.id && m.role !== "SUPERADMIN" ? (
                <div className={styles.ligneActions}>
                  <FormulaireAction action={changerRoleAction.bind(null, m.id)} className={styles.formLigne} style={{ minWidth: 0 }} discret>
                    <select name="role" defaultValue={m.role} aria-label={`Rôle de ${m.email}`}>
                      {ROLES_EQUIPE.map((r) => (
                        <option key={r} value={r}>
                          {LIBELLES_ROLE[r].nom}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`}>
                      OK
                    </button>
                  </FormulaireAction>
                  <FormulaireAction
                    action={retirerMembreAction.bind(null, m.id)}
                    bouton="Retirer"
                    variante="danger"
                    confirmer={`Retirer l'accès de ${m.email} ?`}
                    discret
                  />
                </div>
              ) : (
                <span className={styles.pastille}>{LIBELLES_ROLE[m.role]?.nom ?? m.role}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {proprietaire ? (
        <section className={styles.carte}>
          <div className={styles.carteHaut} style={{ paddingBottom: 0 }}>
            <div>
              <h2 className={styles.carteTitre}>Ajouter un membre</h2>
              <p className={styles.carteTexte}>
                Choisissez son mot de passe et transmettez-le lui : il pourra le changer dans « Mon compte ».
              </p>
            </div>
          </div>
          <FormulaireAction action={ajouterMembreAction} className={styles.formulaire} bouton="Ajouter le membre" vider>
            <label className={styles.champ}>
              <span>Adresse e-mail</span>
              <input name="email" type="email" required autoComplete="off" />
            </label>
            <label className={styles.champ}>
              <span>Rôle</span>
              <select name="role" defaultValue="ORGANISATEUR">
                {ROLES_EQUIPE.map((r) => (
                  <option key={r} value={r}>
                    {LIBELLES_ROLE[r].nom} — {LIBELLES_ROLE[r].detail}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.champ}>
              <span>Mot de passe provisoire</span>
              <input name="motDePasse" type="text" required minLength={10} autoComplete="new-password" />
              <small>10 caractères au moins.</small>
            </label>
          </FormulaireAction>
        </section>
      ) : null}
    </>
  );
}
