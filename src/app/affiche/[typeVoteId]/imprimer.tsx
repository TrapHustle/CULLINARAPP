"use client";

import styles from "./affiche.module.css";

export function BoutonImprimer() {
  return (
    <button type="button" className={styles.imprimer} onClick={() => window.print()}>
      Imprimer l&rsquo;affiche
    </button>
  );
}
