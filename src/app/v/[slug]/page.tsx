import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatClosingDate } from "@/lib/public-vote-core";
import { lirePagePublique, VOIX_MAX_PAR_PAIEMENT } from "@/lib/vote-public-saas";
import { VotePublic } from "./vote-public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await lirePagePublique(slug);
  if (!page) return { title: "Vote introuvable — DIGITALYX-VOTE" };
  const title = `${page.selection.evenement.nom} · ${page.selection.libelle} - Vote en ligne • INOVYX TECH`;
  const description = `Votez pour votre candidat préféré : ${page.selection.prixVote} FCFA le vote.`;
  // Même aperçu partagé (WhatsApp, Facebook…) que l'ancienne page `/voter`.
  const image = "/brand/inovyx-share.png";
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Page publique de vote d'une sélection (RG 7.1), au design « clair » de l'ancienne page `/voter`. */
export default async function PageVote({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await lirePagePublique(slug);
  if (!page) notFound();

  const { selection } = page;
  return (
    <VotePublic
      slug={slug}
      evenement={{
        nom: selection.evenement.nom,
        sousTitre: selection.evenement.sousTitre,
        afficheUrl: selection.evenement.afficheUrl,
        organisation: selection.evenement.organisation.nom,
      }}
      selection={{
        libelle: selection.libelle,
        lieu: selection.lieu,
        fin: selection.fin?.toISOString() ?? null,
        finLibelle: selection.fin ? formatClosingDate(selection.fin) : null,
        etat: selection.etat,
        prixVote: selection.prixVote,
        voixGratuite: selection.voixGratuite,
        compteursVisibles: selection.compteursVisibles,
        moyens: selection.moyensPaiement,
      }}
      ouvert={page.ouvert}
      simulation={page.mode === "simulation"}
      voixMax={VOIX_MAX_PAR_PAIEMENT}
      // Compteurs masqués (RG 7.3) : les chiffres ne partent même pas vers le navigateur.
      candidats={page.candidats.map((c) => ({ ...c, voix: selection.compteursVisibles ? c.voix : null }))}
    />
  );
}
