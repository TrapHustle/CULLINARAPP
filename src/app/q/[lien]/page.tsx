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
  return { title, description: `Votez pour votre candidat préféré · ${type.selection.libelle}`, robots: { index: false } };
}

/** Page ouverte par le QR code d'un type de vote : une voix par numéro, sans critère. */
export default async function PageVoteQr({ params }: { params: Promise<{ lien: string }> }) {
  const { lien } = await params;
  const type = await lirePageQr(lien);
  if (!type) notFound();
  // Le lien du vote en ligne mène à sa page publique.
  if (type.canal === "EN_LIGNE") redirect(`/v/${type.selection.slug}`);
  if (type.canal !== "QR") notFound();

  const { selection } = type;
  return (
    <div className={outfit.className}>
      <VoteQr
        lien={lien}
        titre={type.libelle}
        selection={selection.libelle}
        evenement={selection.evenement.nom}
        restreint={type.acces === "RESTREINT"}
        ouvert={voteQrOuvert(type)}
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
