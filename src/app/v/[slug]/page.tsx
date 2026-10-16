import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { outfit } from "@/lib/police";
import { lirePagePublique } from "@/lib/vote-public-saas";
import { VotePublic } from "./vote-public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await lirePagePublique(slug);
  if (!page) return { title: "Vote introuvable — DIGITALYX-VOTE" };
  return {
    title: `Votez — ${page.selection.evenement.nom} · ${page.selection.libelle}`,
    description: `Soutenez votre candidat pour ${page.selection.evenement.nom}.`,
  };
}

/** Page publique de vote d'une sélection (RG 7.1). */
export default async function PageVote({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await lirePagePublique(slug);
  if (!page) notFound();

  const { selection } = page;
  return (
    <div className={outfit.className}>
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
          etat: selection.etat,
          prixVote: selection.prixVote,
          voixGratuite: selection.voixGratuite,
          compteursVisibles: selection.compteursVisibles,
          moyens: selection.moyensPaiement,
        }}
        ouvert={page.ouvert}
        simulation={page.mode === "simulation"}
        // Compteurs masqués (RG 7.3) : les chiffres ne partent même pas vers le navigateur.
        candidats={page.candidats.map((c) => ({ ...c, voix: selection.compteursVisibles ? c.voix : null }))}
      />
    </div>
  );
}
