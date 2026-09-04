"use client";

import { useState } from "react";
import { LiveChart, type TimelinePayload } from "../temps-reel/live-chart";

/**
 * Accès à la course des candidats depuis l'écran projeté.
 *
 * Ouvert sans code : la courbe se montre à la salle entre deux candidats, et
 * faire saisir quatre chiffres devant l'assemblée à chaque fois n'avait pas de
 * sens. Seule la proclamation garde son code.
 *
 * Le classement détaillé démarre **masqué** ici : en salle on veut les visages
 * et les barres, pas une liste à déchiffrer de loin. Il reste rappelable depuis
 * la surcouche elle-même.
 */
export function LiveRanking() {
  const [data, setData] = useState<TimelinePayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/direct/timeline", { cache: "no-store" });
      if (!response.ok) {
        setError("Le serveur n'a pas répondu.");
        return;
      }

      const payload = (await response.json()) as TimelinePayload;
      if (payload.totalVotes === 0) {
        setError("Aucun vote : la course n'a pas commencé.");
        return;
      }
      setData(payload);
    } catch {
      setError("Serveur injoignable.");
    } finally {
      setBusy(false);
    }
  }

  if (data) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-[#0d0b08] p-[2vw]">
        <button
          type="button"
          onClick={() => setData(null)}
          className="absolute right-[2vw] top-[2vh] z-10 rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/60 transition hover:border-[#d4af37] hover:text-[#f2ca50]"
        >
          Fermer
        </button>
        <LiveChart initial={data} placement="non" />
      </div>
    );
  }

  // Rangé avec « Classement final » : les deux commandes de cérémonie se
  // trouvent au même endroit, discrètes tant qu'on ne les cherche pas.
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      title={error || undefined}
      className="absolute left-1/2 top-[2.4vh] z-30 translate-x-[6vw] rounded-full border border-[#d4af37]/40 bg-[#d4af37]/[0.07] px-[1.6vw] py-[0.9vh] text-[1.2vh] uppercase tracking-[0.18em] text-[#e8cd72] opacity-40 transition hover:border-[#d4af37] hover:bg-[#d4af37]/20 hover:text-[#f2ca50] hover:opacity-100 focus-visible:opacity-100 disabled:opacity-20"
    >
      {busy ? "Chargement…" : error ? "Temps réel indisponible" : "Temps réel"}
    </button>
  );
}
