import Link from "next/link";
import { notFound } from "next/navigation";
import { Onglets } from "@/components/espace/onglets";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { selectionDeLOrganisation } from "@/lib/evenements";
import { LIBELLES_ETAT, type EtatSelection } from "@/lib/evenements-core";

/** En-tête commun d'une sélection et ses onglets. */
export default async function LayoutSelection({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const selection = await selectionDeLOrganisation(utilisateur.organisationId, selectionId);
  if (!selection || selection.evenementId !== evenementId) notFound();

  const base = `/espace/e/${evenementId}/selections/${selectionId}`;

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>
            <Link href={`/espace/e/${evenementId}/selections`} style={{ color: "inherit" }}>
              Sélections
            </Link>{" "}
            · n° {selection.rang} · {selection.evenement.nom}
          </div>
          <h1 className={styles.titre}>{selection.libelle}</h1>
          <p className={styles.sousTitre}>
            {[selection.lieu, selection.voteEnLigneOuvert ? "vote en ligne ouvert" : null].filter(Boolean).join(" · ") ||
              "Préparez la grille, inscrivez les candidats, puis ouvrez le vote."}
          </p>
        </div>
        <span className={`${styles.etat} ${styles[`etat${selection.etat}`]}`}>
          {LIBELLES_ETAT[selection.etat as EtatSelection]}
        </span>
      </div>

      <Onglets
        onglets={[
          { href: base, libelle: "Pilotage" },
          { href: `${base}/grille`, libelle: "Grille de vote" },
          { href: `${base}/candidats`, libelle: "Candidats" },
          { href: `${base}/en-ligne`, libelle: "Vote en ligne" },
          { href: `${base}/notes`, libelle: "Notes du jury" },
          { href: `${base}/resultats`, libelle: "Résultats" },
        ]}
      />

      {children}
    </>
  );
}
