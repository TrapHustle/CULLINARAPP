import type { ReactNode } from "react";

/** Icônes au trait du design de l'espace (24 × 24, trait 1,8). */
export type NomIcone =
  | "fleche"
  | "coche"
  | "chevron"
  | "horloge"
  | "cadenas"
  | "personnes"
  | "lecture"
  | "bouclier"
  | "etincelle"
  | "urne"
  | "calendrier"
  | "reglages"
  | "plus"
  | "haut"
  | "bas"
  | "corbeille"
  | "lieu"
  | "trophee"
  | "image"
  | "lune"
  | "soleil"
  | "sortie"
  | "personne"
  | "oeil"
  | "oeilBarre";

const TRACES: Record<NomIcone, ReactNode> = {
  fleche: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
  coche: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  horloge: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  cadenas: <><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  personnes: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  lecture: <path d="m9 7 7 5-7 5Z" />,
  bouclier: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  etincelle: <path d="m12 3-1.3 4.2A5 5 0 0 1 7.5 10L3 12l4.5 2a5 5 0 0 1 3.2 2.8L12 21l1.3-4.2a5 5 0 0 1 3.2-2.8l4.5-2-4.5-2a5 5 0 0 1-3.2-2.8Z" />,
  urne: <><path d="m8 3 8 5-5 7-7-5Z" /><path d="M6 14H3v7h18v-7h-5" /><path d="M3 18h18" /></>,
  calendrier: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  reglages: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  haut: <path d="m6 15 6-6 6 6" />,
  bas: <path d="m6 9 6 6 6-6" />,
  corbeille: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  lieu: <><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  trophee: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>,
  lune: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  personne: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  oeil: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  oeilBarre: <><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></>,
  sortie: <><path d="M12 3v8" /><path d="M7.2 6.5a7 7 0 1 0 9.6 0" /></>,
  soleil: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};

export function Icone({ nom, taille = 20 }: { nom: NomIcone; taille?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={taille} viewBox="0 0 24 24" width={taille}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {TRACES[nom]}
      </g>
    </svg>
  );
}
