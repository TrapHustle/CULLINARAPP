import type { Metadata } from "next";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { nombre } from "@/lib/format-espace";
import { commissionsParOrganisation } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Commissions — Plateforme DIGITALYX-VOTE" };

const fcfa = (n: number) => `${nombre(n)} FCFA`;

export default async function PageCommissions() {
  await exigerSuperAdmin();
  const lignes = await commissionsParOrganisation();
  const total = lignes.reduce(
    (t, l) => ({
      brut: t.brut + l.brut,
      part: t.part + l.part,
      commission: t.commission + l.commission,
      reverse: t.reverse + l.reverse,
      resteDu: t.resteDu + l.resteDu,
    }),
    { brut: 0, part: 0, commission: 0, reverse: 0, resteDu: 0 },
  );

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Toute la plateforme</div>
          <h1 className={styles.titre}>
            Les <em>commissions</em>
          </h1>
          <p className={styles.sousTitre}>Sur les seuls paiements réels confirmés. Les simulations ne rapportent rien.</p>
        </div>
      </div>

      <section className={styles.carte}>
        <div className={styles.tableauBoite}>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>Organisation</th>
                <th className={styles.nombre}>Encaissé</th>
                <th className={styles.nombre}>Part client</th>
                <th className={styles.nombre}>Commission</th>
                <th className={styles.nombre}>Reversé</th>
                <th className={styles.nombre}>En cours</th>
                <th className={styles.nombre}>Reste dû</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td className={styles.fort}>{l.nom}</td>
                  <td className={styles.nombre}>{fcfa(l.brut)}</td>
                  <td className={styles.nombre}>
                    {fcfa(l.part)} <span style={{ color: "var(--gris)" }}>({l.taux.toLocaleString("fr-FR")} %)</span>
                  </td>
                  <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(l.commission)}</td>
                  <td className={styles.nombre}>{fcfa(l.reverse)}</td>
                  <td className={styles.nombre}>{fcfa(l.enCours)}</td>
                  <td className={styles.nombre}>{fcfa(l.resteDu)}</td>
                </tr>
              ))}
              <tr>
                <td className={styles.fort}>Total</td>
                <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(total.brut)}</td>
                <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(total.part)}</td>
                <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(total.commission)}</td>
                <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(total.reverse)}</td>
                <td />
                <td className={`${styles.nombre} ${styles.fort}`}>{fcfa(total.resteDu)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
