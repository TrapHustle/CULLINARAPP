/**
 * Icônes du design system, en SVG inline.
 *
 * La maquette Stitch s'appuie sur Material Symbols, servi par Google Fonts :
 * inutilisable ici, le serveur devant fonctionner sans internet en mode réseau
 * local (§10.3). Ces tracés reprennent le même parti — trait fin, monochrome,
 * `currentColor` — avec l'iconographie culinaire du design system (toque pour
 * les candidats, cloche pour les tables).
 */
type IconProps = {
  className?: string;
};

function Svg({ className = "h-5 w-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Toque de chef — les candidats. */
export function ChefHatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 18h12v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2Z" />
      <path d="M6 18v-4.2A3.8 3.8 0 0 1 4 10.5a3.5 3.5 0 0 1 4.6-3.3 4 4 0 0 1 6.8 0A3.5 3.5 0 0 1 20 10.5a3.8 3.8 0 0 1-2 3.3V18" />
    </Svg>
  );
}

/** Cloche de service — les tables de jury. */
export function ClocheIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 18h18" />
      <path d="M4.5 15a7.5 7.5 0 0 1 15 0Z" />
      <path d="M12 7.5V6" />
    </Svg>
  );
}

/** Curseurs — les critères d'évaluation. */
export function SlidersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </Svg>
  );
}

/** Bulletin glissé dans l'urne — ouverture des votes. */
export function VoteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
      <path d="M4 14h5l1 2h4l1-2h5" />
      <path d="M8 10V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v5" />
      <path d="M10 7h4" />
    </Svg>
  );
}

/** Chronomètre. */
export function TimerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </Svg>
  );
}

/** Coupe — le palmarès. */
export function TrophyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.5a2.5 2.5 0 0 0 2.5 4M16 6h2.5a2.5 2.5 0 0 1-2.5 4" />
      <path d="M12 13v4M9 20h6M10 17h4" />
    </Svg>
  );
}

/** Coche entourée — table validée. */
export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5L15.5 10" />
    </Svg>
  );
}

/** Sablier — table en attente. */
export function HourglassIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3h10M7 21h10" />
      <path d="M7 3v3.5L12 12l-5 5.5V21M17 3v3.5L12 12l5 5.5V21" />
    </Svg>
  );
}

/** Flèche vers le bas dans un plateau — export de fichier. */
export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10M8 11l4 3 4-3" />
      <path d="M5 18h14" />
    </Svg>
  );
}

/** Imprimante — export PDF. */
export function PrintIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 9V4h10v5" />
      <path d="M5 9h14a1 1 0 0 1 1 1v6h-4M8 16H4a1 1 0 0 1-1-1v-5" />
      <rect height="6" rx="1" width="10" x="7" y="14" />
    </Svg>
  );
}

/** Antenne — la découverte réseau des tablettes. */
export function WifiIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.5 16a6 6 0 0 1 7 0" />
      <circle cx="12" cy="19.5" fill="currentColor" r="1" stroke="none" />
    </Svg>
  );
}

/** Silhouette — champ identifiant. */
export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  );
}

/** Cadenas — champ mot de passe. */
export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="10" rx="1.5" width="14" x="5" y="11" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </Svg>
  );
}

/** Flèche vers la droite — validation, passage au suivant. */
export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

/** Croix entourée — fermeture des votes. */
export function StopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h6v6H9z" />
    </Svg>
  );
}

/** Point plein — pastille « direct », animée par l'appelant. */
export function DotIcon({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

/** Corbeille — suppression en configuration. */
export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

/** Plus — ajout d'un élément. */
export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** Crayon — modification d'un élément existant. */
export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 7.5 16.5 9.5" />
    </Svg>
  );
}

/** Croix — abandon d'une modification en cours. */
export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

/** Cadenas ouvert — dévalidation d'une table. */
export function UnlockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.9-.8" />
    </Svg>
  );
}

/** Triangle d'alerte — les opérations irréversibles. */
export function WarningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Svg>
  );
}

/** Écran de projection — la page suivie par la salle. */
export function ScreenIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </Svg>
  );
}

/** Courbe ascendante — classement en temps réel. */
export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5v14h16" />
      <path d="M7 15l4-5 3 3 5-6" />
    </Svg>
  );
}
