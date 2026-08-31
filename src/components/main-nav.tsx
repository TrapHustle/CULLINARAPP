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
    <nav className="flex flex-wrap gap-6">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "border-b-2 border-primary pb-1 text-label-lg text-primary transition-colors"
                : "border-b-2 border-transparent pb-1 text-label-lg text-on-surface-variant transition-colors hover:text-primary"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
