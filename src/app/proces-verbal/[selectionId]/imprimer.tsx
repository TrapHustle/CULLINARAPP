"use client";

import { useEffect } from "react";
import styles from "./proces-verbal.module.css";

/** Ouvre la fenêtre d'impression à l'arrivée (« Enregistrer en PDF » y est proposé), et la garde à portée. */
export function Imprimer() {
  useEffect(() => {
    const minuteur = setTimeout(() => window.print(), 400);
    return () => clearTimeout(minuteur);
  }, []);

  return (
    <button type="button" className={styles.imprimer} onClick={() => window.print()}>
      Imprimer · enregistrer en PDF
    </button>
  );
}
