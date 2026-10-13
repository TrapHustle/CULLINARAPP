"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/app/accueil.module.css";
import { Icone } from "@/components/espace/icone";
import { Marque } from "./marque";

const c = (...noms: string[]) => noms.map((n) => styles[n]).join(" ");

const RUBRIQUES = [
  ["#solution", "Solution"],
  ["#fonctionnement", "Fonctionnement"],
  ["#securite", "Sécurité"],
  ["#tarifs", "Tarifs"],
] as const;

/** Barre de navigation de l'accueil, avec le menu déroulant des petits écrans. */
export function Navigation() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <header className={c("nav-wrap")}>
      <nav className={c("nav")}>
        <Marque />
        <div className={`${c("nav-links")} ${ouvert ? c("open") : ""}`}>
          {RUBRIQUES.map(([ancre, libelle]) => (
            <a key={ancre} href={ancre} onClick={() => setOuvert(false)}>
              {libelle}
            </a>
          ))}
        </div>
        <div className={c("nav-actions")}>
          <Link href="/connexion" className={c("button", "button-text")}>
            Se connecter
          </Link>
          <Link href="/inscription" className={c("button", "button-primary")}>
            Créer un compte <Icone nom="fleche" taille={16} />
          </Link>
        </div>
        <button
          className={c("menu-button")}
          onClick={() => setOuvert(!ouvert)}
          type="button"
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={ouvert}
        >
          <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
            <g stroke="currentColor" strokeLinecap="round" strokeWidth="1.8">
              <path d="M4 8h16" />
              <path d="M4 16h16" />
            </g>
          </svg>
        </button>
      </nav>
    </header>
  );
}
