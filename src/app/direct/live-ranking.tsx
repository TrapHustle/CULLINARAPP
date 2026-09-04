"use client";

import { useState } from "react";
import { LiveChart, type TimelinePayload } from "../temps-reel/live-chart";

/**
 * Accès au classement en temps réel depuis l'écran projeté.
 *
 * La machine du vidéoprojecteur n'a pas de session : elle passe par
 * `/api/direct/timeline`, gardé par le même code que la proclamation. C'est ce
 * qui permet d'ouvrir la courbe en salle sans y laisser le dashboard entier
 * accessible.
 *
 * Le code n'est pas vérifié ici — il est envoyé au serveur, qui ne rend la
 * série qu'en échange. Un contrôle dans le navigateur laisserait la route
 * ouverte, et un classement intermédiaire renseigne autant qu'un final.
 *
 * La courbe recouvre l'écran de vote puis le libère : on y jette un œil entre
 * deux candidats, on n'y reste pas.
 */
export function LiveRanking() {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState("");
  const [pin, setPin] = useState<string | null>(null);
  const [data, setData] = useState<TimelinePayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(code: string) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/direct/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });

      if (response.status === 401) {
        setEntry("");
        setError("Code incorrect");
        return;
      }
      if (!response.ok) {
        setEntry("");
        setError("Le serveur n'a pas répondu.");
        return;
      }

      const payload = (await response.json()) as TimelinePayload;
      if (payload.totalVotes === 0) {
        setEntry("");
        setError("Aucun vote pour l'instant : il n'y a pas encore de course.");
        return;
      }

      setData(payload);
      setPin(code);
      setEntry("");
    } catch {
      setEntry("");
      setError("Serveur injoignable.");
    } finally {
      setBusy(false);
    }
  }

  function press(value: string) {
    if (busy) return;
    if (value === "del") {
      setEntry((current) => current.slice(0, -1));
      return;
    }
    if (entry.length >= 4) return;

    const next = entry + value;
    setEntry(next);
    if (next.length === 4) void submit(next);
  }

  function close() {
    setOpen(false);
    setEntry("");
    setError("");
    setData(null);
    setPin(null);
  }

  /* ---------- Appel discret sur l'écran de vote ---------- */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-[2vw] top-[2.4vh] z-30 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/[0.07] px-[1.6vw] py-[0.9vh] text-[1.2vh] uppercase tracking-[0.18em] text-[#e8cd72] opacity-40 transition hover:border-[#d4af37] hover:bg-[#d4af37]/20 hover:text-[#f2ca50] hover:opacity-100 focus-visible:opacity-100"
      >
        Temps réel
      </button>
    );
  }

  /* ---------- La courbe, une fois le code accepté ---------- */
  if (data && pin) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-[#0d0b08] p-[2vw]">
        <button
          type="button"
          onClick={close}
          className="absolute right-[2vw] top-[2vh] z-10 rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/60 transition hover:border-[#d4af37] hover:text-[#f2ca50]"
        >
          Fermer
        </button>
        <LiveChart initial={data} pin={pin} />
      </div>
    );
  }

  /* ---------- Saisie du code ---------- */
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#05040288] backdrop-blur-sm">
      <div className="w-[min(90vw,34vh)] rounded-lg border border-[#d4af37]/45 bg-gradient-to-b from-[#241a0e] to-[#17120c] p-[3.4vh] text-center shadow-[0_24px_70px_rgba(0,0,0,.7)]">
        <h2 className="font-serif text-[3.1vh] text-white">Temps réel</h2>
        <p className="mt-1 text-[1.3vh] text-white/45">Code de l&apos;organisateur</p>

        <div className="my-[2.6vh] flex justify-center gap-[1.3vh]">
          {[0, 1, 2, 3].map((slot) => (
            <span
              key={slot}
              className={`grid h-[3.4vh] w-[2.6vh] place-items-center rounded border bg-black/35 font-serif text-[2.4vh] text-[#f2ca50] ${
                slot === entry.length ? "border-[#d4af37]" : "border-[#d4af37]/45"
              }`}
            >
              {slot < entry.length ? "•" : ""}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-[0.9vh]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "esc", "0", "del"].map((key) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => (key === "esc" ? close() : press(key))}
              className={`rounded border border-[#d4af37]/20 bg-[#d4af37]/5 py-[1.15vh] transition hover:border-[#d4af37] hover:bg-[#d4af37]/15 disabled:opacity-40 ${
                key === "esc" || key === "del"
                  ? "text-[1.3vh] tracking-wider text-white/45"
                  : "text-[2vh] font-light text-white"
              }`}
            >
              {key === "esc" ? "Annuler" : key === "del" ? "Effacer" : key}
            </button>
          ))}
        </div>

        <p className="mt-[1.8vh] min-h-[1.6vh] text-[1.2vh] text-[#e0796b]" role="alert">
          {error}
        </p>
      </div>
    </div>
  );
}
