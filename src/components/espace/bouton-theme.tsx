"use client";

import { useState } from "react";
import { Icone } from "./icone";
import styles from "./panel.module.css";
import { COOKIE_THEME } from "./theme";

/** Bascule jour / nuit du panneau. Le choix est gardé un an sur cet appareil. */
export function BoutonTheme({ sombreInitial }: { sombreInitial: boolean }) {
  const [sombre, setSombre] = useState(sombreInitial);

  function basculer(e: React.MouseEvent<HTMLButtonElement>) {
    const suivant = !sombre;
    setSombre(suivant);
    e.currentTarget.closest(`.${styles.page}`)?.classList.toggle(styles.sombre, suivant);
    document.cookie = `${COOKIE_THEME}=${suivant ? "sombre" : "clair"}; path=/; max-age=31536000; samesite=lax`;
  }

  const libelle = sombre ? "Passer en mode jour" : "Passer en mode nuit";
  return (
    <button type="button" className={styles.boutonTheme} onClick={basculer} aria-label={libelle} title={libelle}>
      <Icone nom={sombre ? "soleil" : "lune"} taille={18} />
    </button>
  );
}
