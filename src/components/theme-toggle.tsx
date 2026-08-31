"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Bascule clair / sombre.
 *
 * Le thème réel est déjà posé sur `<html data-theme>` par le script inline du
 * layout (avant le premier rendu, pour éviter le clignotement). Ce bouton se
 * contente de lire l'état courant, de le basculer et de le mémoriser.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Stockage indisponible (navigation privée…) : le choix ne survivra pas
      // au rechargement, mais la bascule fonctionne pour la session en cours.
    }
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
      className="rounded-lg border border-[color:var(--c-line)] px-2.5 py-1.5 text-base leading-none text-[color:var(--gold-soft)] transition hover:text-[color:var(--gold)]"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
