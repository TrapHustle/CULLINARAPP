import type { Metadata } from "next";
import { cache } from "react";
import { getPublicVoteView } from "@/lib/public-vote";
import { PUBLIC_THEME_KEY } from "@/lib/public-vote-core";
import { PublicVotePage } from "./public-vote-page";

export const dynamic = "force-dynamic";

// Une seule lecture de la base par requête, partagée par le titre de l'onglet
// et la page.
const loadView = cache(getPublicVoteView);

export async function generateMetadata(): Promise<Metadata> {
  const view = await loadView();
  return {
    title: `${view.eventName} — Vote du public`,
    description: `Votez pour votre candidat préféré : ${view.price} FCFA le vote.`,
  };
}

/**
 * Page de vote du public.
 *
 * Volontairement **hors du groupe `(admin)`**, donc sans mot de passe : c'est
 * la page que le public ouvre depuis son téléphone. Elle n'affiche que ce que
 * l'organisateur a choisi de montrer (compteurs masqués : ni votes ni rangs
 * ne quittent le serveur), et chaque paiement est revérifié côté serveur.
 *
 * `?style=cartes` ou `?style=menu` affiche un style sans toucher au réglage :
 * de quoi présenter les deux présentations sans changer ce que voit le public.
 */
export default async function VoterPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string | string[] }>;
}) {
  const { style } = await searchParams;
  const view = await loadView();
  const preview = style === "menu" ? "MENU" : style === "cartes" ? "CARTES" : null;

  return (
    <>
      {/* Mode nuit par défaut, avant le premier affichage : seul un choix
          « clair » mémorisé par le visiteur le remplace. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem(${JSON.stringify(PUBLIC_THEME_KEY)});document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
        }}
      />
      <PublicVotePage view={view} style={preview ?? view.style} />
    </>
  );
}
