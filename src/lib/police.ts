import { DM_Sans, IBM_Plex_Sans, Outfit } from "next/font/google";

/** Police de la page d'accueil provisoire. */
export const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

/** Police de l'espace des organisations et des pages de compte (design de la refonte). */
export const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

/** Police du panneau organisateur : géométrique, dans l'esprit des tableaux de bord Inovyx. */
export const outfit = Outfit({ subsets: ["latin"] });
