import type { Metadata } from "next";
import Link from "next/link";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { dateHeure, nombre } from "@/lib/format-espace";
import { listerPaiementsPlateforme } from "@/lib/plateforme";
import { verifierPaiementsAction } from "@/lib/plateforme-actions";

export const metadata: Metadata = { title: "Paiements — Plateforme DIGITALYX-VOTE" };

const FILTRES = [
  { cle: "", libelle: "Tous" },
  { cle: "reels", libelle: "Réels confirmés" },
  { cle: "attente", libelle: "En attente" },
  { cle: "echoues", libelle: "Échoués" },
  { cle: "simules", libelle: "Simulés" },
];

const STATUTS: Record<string, string> = { CONFIRMED: "Confirmé", PENDING: "En attente", FAILED: "Échoué" };

export default async function PagePaiementsPlateforme({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await exigerSuperAdmin();
  const f = (await searchParams).f ?? "";
  const filtre =
    f === "reels"
      ? { statut: "CONFIRMED", simule: false }
      : f === "attente"
        ? { statut: "PENDING" }
        : f === "echoues"
          ? { statut: "FAILED" }
          : f === "simules"
            ? { simule: true }
            : {};
  const paiements = await listerPaiementsPlateforme(filtre);

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Toute la plateforme</div>
          <h1 className={styles.titre}>
            Les <em>paiements</em>
          </h1>
          <p className={styles.sousTitre}>Les 200 derniers. Un paiement en attente compte dès que la passerelle le confirme.</p>
        </div>
        <FormulaireAction action={verifierPaiementsAction} bouton="Vérifier les paiements en attente" variante="secondaire" />
      </div>

      <nav className={styles.onglets} aria-label="Filtres">
        {FILTRES.map((x) => (
          <Link
            key={x.cle}
            href={x.cle ? `/plateforme/paiements?f=${x.cle}` : "/plateforme/paiements"}
            className={`${styles.onglet} ${f === x.cle ? styles.ongletActif : ""}`}
          >
            {x.libelle}
          </Link>
        ))}
      </nav>

      <section className={styles.carte}>
        {paiements.length === 0 ? (
          <div className={styles.vide}>Aucun paiement.</div>
        ) : (
          <div className={styles.tableauBoite}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Référence</th>
                  <th>Organisation</th>
                  <th>Sélection · candidat</th>
                  <th>Moyen</th>
                  <th className={styles.nombre}>Voix</th>
                  <th className={styles.nombre}>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((p) => (
                  <tr key={p.id}>
                    <td>{dateHeure(p.creeLe)}</td>
                    <td>
                      {p.reference}
                      {p.refPrestataire ? <div style={{ color: "var(--gris)", fontSize: 12 }}>{p.refPrestataire}</div> : null}
                    </td>
                    <td>{p.organisation.nom}</td>
                    <td>
                      {p.selection?.libelle ?? "—"} · <span className={styles.fort}>{p.candidatNom}</span>
                    </td>
                    <td>
                      {p.moyen} · {p.telephone ?? "—"}
                    </td>
                    <td className={styles.nombre}>{nombre(p.voix)}</td>
                    <td className={`${styles.nombre} ${styles.fort}`}>{nombre(p.montant)} FCFA</td>
                    <td>
                      <span
                        className={`${styles.pastille} ${p.statut === "CONFIRMED" ? styles.pastilleVerte : p.statut === "FAILED" ? styles.pastilleRouge : ""}`}
                      >
                        {p.simule ? "Simulé" : (STATUTS[p.statut] ?? p.statut)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
