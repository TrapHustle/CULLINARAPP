"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Pilotage" },
  { href: "/configuration", label: "Configuration" },
  { href: "/appairage", label: "Connexion" },
  { href: "/resultats", label: "Résultats" },
];

/**
 * Navigation principale.
 *
 * La page courante est soulignée d'un trait doré : en plein événement,
 * l'organisateur doit voir d'un coup d'œil où il se trouve sans relire les
 * quatre libellés.
 */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="grid w-full grid-cols-2 gap-x-3 gap-y-1 sm:flex sm:w-auto sm:flex-wrap sm:gap-6">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "min-h-touch border-b-2 border-primary py-2 text-center text-label-lg text-primary transition-colors sm:min-h-0 sm:pb-1 sm:pt-0 sm:text-left"
                : "min-h-touch border-b-2 border-transparent py-2 text-center text-label-lg text-on-surface-variant transition-colors hover:text-primary sm:min-h-0 sm:pb-1 sm:pt-0 sm:text-left"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
