"use client";

import { useEffect } from "react";

/**
 * Ouvre la boîte de dialogue d'impression dès l'affichage de la page.
 * L'organisateur choisit alors « Enregistrer au format PDF ».
 */
export function PrintTrigger() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mb-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white print:hidden"
    >
      Imprimer / Enregistrer en PDF
    </button>
  );
}
