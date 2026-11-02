"use client";

import Link from "next/link";
import { useRef } from "react";
import { Icone } from "./icone";
import styles from "./panel.module.css";

interface Manque {
  libelle: string;
  points: string[];
  /** Onglet de la sélection où corriger, "" pour la page de pilotage. */
  onglet: string;
}

const NOM_ONGLET: Record<string, string> = {
  grille: "Corriger la grille de vote",
  candidats: "Inscrire des candidats",
  "en-ligne": "Régler le vote en ligne",
  "": "Modifier les informations",
};

/**
 * « Ouvrir le vote » quand la sélection n'est pas prête : le bouton reste
 * affiché, et un clic liste ce qui manque, avec un lien vers l'endroit où le
 * corriger.
 */
export function BoutonOuvrir({ base, manques }: { base: string; manques: Manque[] }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const fermer = () => dialogue.current?.close();

  return (
    <>
      <button type="button" className={`${styles.bouton} ${styles.boutonPrincipal}`} onClick={() => dialogue.current?.showModal()}>
        Ouvrir le vote
      </button>
      <dialog
        ref={dialogue}
        className={styles.dialogue}
        onClick={(e) => {
          // Un clic sur le fond ferme la popup, comme la touche Échap.
          if (e.target === dialogue.current) fermer();
        }}
      >
        <div className={styles.dialogueCorps}>
          <h2 className={styles.carteTitre}>Il manque encore quelque chose</h2>
          <p className={styles.carteTexte}>Corrigez ces points, puis ouvrez le vote.</p>
          <ol className={styles.dialogueListe}>
            {manques.map((m) => (
              <li key={m.libelle}>
                <strong style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={styles.controleKo}>
                    <Icone nom="bouclier" taille={16} />
                  </span>
                  {m.libelle}
                </strong>
                <ul>
                  {m.points.filter(Boolean).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {m.onglet ? (
                  <Link href={`${base}/${m.onglet}`} onClick={fermer}>
                    {NOM_ONGLET[m.onglet] ?? "Corriger"} →
                  </Link>
                ) : (
                  <a href="#informations" onClick={fermer}>
                    {NOM_ONGLET[""]} →
                  </a>
                )}
              </li>
            ))}
          </ol>
          <div className={styles.dialogueBas}>
            <button type="button" className={`${styles.bouton} ${styles.boutonSecondaire}`} onClick={fermer}>
              Fermer
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
