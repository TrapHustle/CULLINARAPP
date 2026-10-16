"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deconnecterAction } from "@/lib/comptes-actions";
import { Icone, type NomIcone } from "./icone";
import styles from "./panel.module.css";

export interface Lien {
  href: string;
  libelle: string;
  icone: NomIcone;
  /** Actif seulement sur l'adresse exacte (la vue d'ensemble englobe tout le reste). */
  exact?: boolean;
}

export function Liens({ liens }: { liens: Lien[] }) {
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

/** Menu latéral de l'espace plateforme (super-admin). */
export function NavPlateforme() {
  return (
    <aside className={styles.lateral}>
      <div className={styles.rubrique}>Plateforme</div>
      <Liens
        liens={[
          { href: "/plateforme", libelle: "Vue d’ensemble", icone: "etincelle", exact: true },
          { href: "/plateforme/organisations", libelle: "Organisations", icone: "globe" },
          { href: "/plateforme/evenements", libelle: "Événements", icone: "calendrier" },
          { href: "/plateforme/paiements", libelle: "Paiements", icone: "billet" },
          { href: "/plateforme/reversements", libelle: "Reversements", icone: "fleche" },
          { href: "/plateforme/commissions", libelle: "Commissions", icone: "trophee" },
        ]}
      />
      <div className={styles.rubrique}>Compte</div>
      <Liens liens={[{ href: "/plateforme/compte", libelle: "Mon compte", icone: "personne" }]} />
      <PiedLateral />
    </aside>
  );
}

function PiedLateral() {
  return (
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
  );
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
              { href: `${base}/grille`, libelle: "Grille de vote", icone: "grille" },
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
          { href: "/espace/candidats", libelle: "Candidats", icone: "personnes" },
          { href: "/espace/recettes", libelle: "Recettes", icone: "billet" },
          { href: "/espace/equipe", libelle: "Équipe", icone: "bouclier" },
          { href: "/espace/compte", libelle: "Mon compte", icone: "personne" },
        ]}
      />

      <PiedLateral />
    </aside>
  );
}
