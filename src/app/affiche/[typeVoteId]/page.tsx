import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/espace";
import { adresseBase, cheminVote, imageQr } from "@/lib/liens-publics";
import { outfit } from "@/lib/police";
import { prisma } from "@/lib/prisma";
import styles from "./affiche.module.css";
import { BoutonImprimer } from "./imprimer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Affiche du vote — DIGITALYX-VOTE" };

/** Affiche à imprimer : le QR code d'un type de vote et les trois gestes pour voter. */
export default async function PageAffiche({ params }: { params: Promise<{ typeVoteId: string }> }) {
  const utilisateur = await exigerUtilisateur();
  const { typeVoteId } = await params;
  const type = await prisma.typeVote.findFirst({
    where: { id: typeVoteId, selection: { evenement: { organisationId: utilisateur.organisationId } } },
    include: { selection: { include: { evenement: { select: { nom: true } } } } },
  });
  const chemin = type ? cheminVote(type, type.selection.slug) : null;
  if (!type || !chemin) notFound();

  const url = `${await adresseBase()}${chemin}`;
  const qr = await imageQr(url, 900);
  const restreint = type.canal === "QR" && type.acces === "RESTREINT";
  const etapes =
    type.canal === "QR"
      ? ["Scannez le QR code", "Tapez votre numéro de téléphone", "Choisissez votre candidat"]
      : ["Scannez le QR code", "Choisissez votre candidat", "Votez gratuitement ou achetez des voix"];

  return (
    <div className={`${outfit.className} ${styles.page}`}>
      <BoutonImprimer />
      <article className={styles.affiche}>
        <header className={styles.haut}>
          <small>
            {type.selection.evenement.nom} · {type.selection.libelle}
          </small>
          <h1>
            Votez <em>ici</em>
          </h1>
        </header>
        <div className={styles.qr}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code du vote « ${type.libelle} »`} />
        </div>
        <div className={styles.libelle}>{type.libelle}</div>
        <p className={styles.public}>
          {restreint
            ? "Réservé aux personnes inscrites · une voix par personne"
            : type.canal === "QR"
              ? "Ouvert à tous · une voix par numéro de téléphone"
              : "Ouvert à tous"}
        </p>
        <ol className={styles.etapes}>
          {etapes.map((e, i) => (
            <li key={e}>
              <b>{i + 1}</b>
              {e}
            </li>
          ))}
        </ol>
        <footer className={styles.pied}>{url.replace(/^https?:\/\//, "")}</footer>
      </article>
    </div>
  );
}
