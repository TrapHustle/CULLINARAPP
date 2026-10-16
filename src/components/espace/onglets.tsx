"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./panel.module.css";

/** Barre d'onglets : l'onglet actif suit l'adresse. Le premier n'est actif que sur son adresse exacte. */
export function Onglets({ onglets }: { onglets: { href: string; libelle: string }[] }) {
  const chemin = usePathname();
  return (
    <nav className={styles.onglets} aria-label="Sections">
      {onglets.map((o, i) => {
        const actif = i === 0 ? chemin === o.href : chemin === o.href || chemin.startsWith(`${o.href}/`);
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={actif ? "page" : undefined}
            className={`${styles.onglet} ${actif ? styles.ongletActif : ""}`}
          >
            {o.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
