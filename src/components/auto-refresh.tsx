"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchit périodiquement les données de la page serveur.
 *
 * Le dashboard doit refléter en direct les votes qui remontent des tablettes
 * (§4.4). Un simple rafraîchissement suffit ici : contrairement aux tablettes,
 * le navigateur de l'organisateur est toujours connecté au serveur.
 */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
