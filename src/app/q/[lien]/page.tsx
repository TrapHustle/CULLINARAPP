import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { outfit } from "@/lib/police";
import { lirePageQr, voteQrOuvert } from "@/lib/vote-qr";
import { VoteQr } from "./vote-qr";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lien: string }> }): Promise<Metadata> {
  const { lien } = await params;
  const type = await lirePageQr(lien);
  if (!type) return { title: "Vote introuvable" };
  const title = `${type.libelle} · ${type.selection.evenement.nom}`;
  const action = type.canal === "SALLE" && type.avecCriteres ? "Notez les candidats" : "Votez pour votre candidat préféré";
  return { title, description: `${action} · ${type.selection.libelle}`, robots: { index: false } };
}

/**
 * Page ouverte par le lien ou le QR code d'un type de vote : vote "QR" ou en
 * salle, sur une tablette de la salle ou sur le téléphone du votant. Par voix
 * (un candidat par numéro) ou, pour un vote en salle avec critères, une note
 * par candidat.
 */
export default async function PageVoteQr({ params }: { params: Promise<{ lien: string }> }) {
  const { lien } = await params;
  const type = await lirePageQr(lien);
  if (!type) notFound();
  // Le lien du vote en ligne mène à sa page publique.
  if (type.canal === "EN_LIGNE") redirect(`/v/${type.selection.slug}`);
  if (type.canal !== "QR" && type.canal !== "SALLE") notFound();

  const { selection } = type;
  const avecNotes = type.canal === "SALLE" && type.avecCriteres;
  return (
    <div className={outfit.className}>
      <VoteQr
        lien={lien}
        titre={type.libelle}
        selection={selection.libelle}
        evenement={selection.evenement.nom}
        restreint={type.acces === "RESTREINT"}
        ouvert={voteQrOuvert(type)}
        criteres={avecNotes ? type.criteres.map((c) => ({ id: c.id, libelle: c.libelle, bareme: c.bareme })) : null}
        candidats={selection.participations.map((p) => ({
          id: p.id,
          nom: p.candidat.nom,
          ville: p.candidat.ville,
          photoUrl: p.candidat.photoUrl,
        }))}
      />
    </div>
  );
}
