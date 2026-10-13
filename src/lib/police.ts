import { DM_Sans, IBM_Plex_Sans } from "next/font/google";

/** Police de la page d'accueil provisoire. */
export const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

/** Police de l'espace des organisations et des pages de compte (design de la refonte). */
export const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
