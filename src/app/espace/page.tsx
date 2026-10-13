import type { Metadata } from "next";
import styles from "@/components/espace/espace.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mon espace — DIGITALYX-VOTE" };

const dateCourte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Abidjan" });

export default async function PageEspace() {
  const utilisateur = await exigerUtilisateur();

  // Bornée à l'organisation de l'utilisateur (RG 0.2).
  const evenements = await prisma.evenement.findMany({
    where: { organisationId: utilisateur.organisationId },
    orderBy: { creeLe: "desc" },
    include: { _count: { select: { selections: true } } },
  });

  return (
    <>
      <h1 className={styles.titre}>{utilisateur.organisation.nom}</h1>
      <p className={styles.muet}>Espace de votre organisation</p>

      <section className={styles.bloc}>
        <h2>Vos événements</h2>
        {evenements.length === 0 ? (
          <p className={styles.vide}>Aucun événement pour l&rsquo;instant.</p>
        ) : (
          <ul className={styles.liste}>
            {evenements.map((evenement) => (
              <li key={evenement.id}>
                <strong>{evenement.nom}</strong>
                <span className={styles.muet}>
                  {evenement._count.selections} sélection{evenement._count.selections > 1 ? "s" : ""}
                  {evenement.date ? ` · ${dateCourte.format(evenement.date)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
