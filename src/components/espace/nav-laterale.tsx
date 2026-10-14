"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deconnecterAction } from "@/lib/comptes-actions";
import { Icone, type NomIcone } from "./icone";
import styles from "./panel.module.css";

interface Lien {
  href: string;
  libelle: string;
  icone: NomIcone;
  /** Actif seulement sur l'adresse exacte (la vue d'ensemble englobe tout le reste). */
  exact?: boolean;
}

function Liens({ liens }: { liens: Lien[] }) {
  const chemin = usePathname();
  return liens.map((lien) => {
    const actif = lien.exact ? chemin === lien.href : chemin === lien.href || chemin.startsWith(`${lien.href}/`);
    return (
      <Link
        key={lien.href}
        href={lien.href}
        aria-current={actif ? "page" : undefined}
        className={`${styles.lien} ${actif ? styles.lienActif : ""}`}
      >
        <Icone nom={lien.icone} taille={18} />
        {lien.libelle}
      </Link>
    );
  });
}

export function NavLaterale({ evenementId }: { evenementId: string | null }) {
  const base = evenementId ? `/espace/e/${evenementId}` : null;

  return (
    <aside className={styles.lateral}>
      {base ? (
        <>
          <div className={styles.rubrique}>Événement</div>
          <Liens
            liens={[
              { href: base, libelle: "Vue d’ensemble", icone: "etincelle", exact: true },
              { href: `${base}/selections`, libelle: "Sélections", icone: "calendrier" },
              { href: `${base}/parametres`, libelle: "Paramètres", icone: "reglages" },
            ]}
          />
        </>
      ) : null}

      <div className={styles.rubrique}>Organisation</div>
      <Liens
        liens={[
          { href: "/espace/evenements", libelle: "Mes événements", icone: "urne", exact: true },
          { href: "/espace/evenements/nouveau", libelle: "Nouvel événement", icone: "plus" },
        ]}
      />

      <div className={styles.piedLateral}>
        <span className={styles.version}>
          <small>VER</small>1.0
        </span>
        <span className={styles.produit}>
          <strong>DIGITALYX-VOTE</strong>
          <small>
            Powered by <b>Inovyx Tech</b>
          </small>
        </span>
        <form action={deconnecterAction}>
          <button type="submit" className={styles.boutonSortie} aria-label="Se déconnecter" title="Se déconnecter">
            <Icone nom="sortie" taille={20} />
          </button>
        </form>
      </div>
    </aside>
  );
}
