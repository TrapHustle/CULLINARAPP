"use client";

import { useEffect, useRef, useState } from "react";
import { LiveRanking } from "./live-ranking";
import { Proclamation } from "./proclamation";

interface DirectTable {
  id: string;
  name: string;
  special: boolean;
  expectedJurors: number;
  received: number;
  validated: boolean;
}

interface DirectPayload {
  votingOpen: boolean;
  candidate: { name: string; photoUrl: string | null; position: number; total: number } | null;
  expected: number;
  received: number;
  tables: DirectTable[];
  allValidated: boolean;
}

/** Cadence de rafraîchissement, alignée sur celle des tablettes. */
const POLL_MS = 2000;

/**
 * Compteur qui rejoint sa nouvelle valeur au lieu d'y sauter.
 *
 * Les tablettes se synchronisent par lots : le compteur peut rester immobile
 * une minute puis bondir de cinq. Sans transition, l'écran paraît figé, puis
 * bugué. L'animation transforme ce saut en mouvement, qui est précisément ce
 * que le public vient regarder.
 */
function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // Ralentissement en fin de course : le chiffre « se pose » sur sa valeur.
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) frameRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}

export function DirectDisplay({ initial }: { initial: DirectPayload }) {
  const [data, setData] = useState(initial);
  const [full, setFull] = useState(false);
  const shell = useRef<HTMLElement>(null);
  // Une coupure ne doit jamais vider l'écran : on garde le dernier état connu
  // et on le signale discrètement, sans rien effacer.
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      // Certains navigateurs refusent le plein écran : l'écran reste utilisable.
    }
  }

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch("/api/direct", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as DirectPayload;
        if (cancelled) return;
        setData(payload);
        setStale(false);
      } catch {
        if (!cancelled) setStale(true);
      }
    };

    const timer = setInterval(poll, POLL_MS);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const counted = useCountUp(data.received);

  if (!data.candidate) {
    return <Standby stale={stale} full={full} shell={shell} onToggleFull={toggleFull} />;
  }

  const { candidate } = data;
  const progress = data.expected > 0 ? (data.received / data.expected) * 100 : 0;
  const complete = data.allValidated || (data.expected > 0 && data.received >= data.expected);

  return (
    <main
      ref={shell}
      className={`relative flex min-h-screen flex-col overflow-hidden bg-[#0d0b08] text-[#fff] ${
        full ? "h-screen" : ""
      }`}
    >
      {/* Fond en mouvement lent : il occupe le regard quand le compteur, lui,
          n'a rien de neuf à montrer. */}
      <div aria-hidden className="direct-halo pointer-events-none absolute inset-0" />
      <Proclamation />
      <LiveRanking />

      <Header
        stale={stale}
        state={complete ? "complete" : data.votingOpen ? "live" : "closed"}
        full={full}
        onToggleFull={toggleFull}
      />

      <div className="relative grid flex-1 items-center gap-6 px-5 pb-8 sm:px-[4vw] sm:pb-[3vh] lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)] lg:gap-[4vw]">
        {/* Le portrait : c'est lui qui donne un visage à regarder. */}
        <div className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border-2 border-[#d4af37]/50 bg-[#17130e] shadow-[0_0_6vh_rgba(212,175,55,0.18)] sm:max-w-[38vh] sm:rounded-[2vh] lg:max-w-none">
          <div className="aspect-4/5 w-full">
            {candidate.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={candidate.photoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10vh] text-[#d4af37]/30">
                ★
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-[#d4af37] sm:text-[1.6vh] sm:tracking-[0.4em]">
            Candidat {candidate.position} sur {candidate.total}
          </p>

          <h1 className="mt-2 break-words font-serif text-5xl leading-none text-[#fff] sm:mt-[1vh] sm:truncate sm:text-[7vh]">
            {candidate.name}
          </h1>

          <p className="mt-8 text-xs uppercase tracking-[0.25em] text-[#fff]/45 sm:mt-[4vh] sm:text-[1.5vh] sm:tracking-[0.35em]">
            {complete ? "Votes complets" : "Votes reçus"}
          </p>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0 sm:gap-[1.5vw]">
            <span
              className={`font-serif text-[8rem] leading-[0.9] tabular-nums text-[#d4af37] sm:text-[18vh] ${
                data.votingOpen && !complete ? "direct-breathe" : ""
              }`}
              style={{ textShadow: "0 0 6vh rgba(212,175,55,0.35)" }}
            >
              {counted}
            </span>
            <span className="text-lg text-[#fff]/50 sm:text-[2.4vh]">sur {data.expected} attendus</span>
          </div>

          {/* La jauge : c'est elle qui porte la tension, bien plus qu'un
              compteur de deux chiffres qui ne « défile » jamais vraiment. */}
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[#fff]/10 sm:mt-[3vh] sm:h-[1.4vh]">
            <div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#b8932e] via-[#d4af37] to-[#e8cd72] transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(100, progress)}%` }}
            >
              {/* Le reflet ne balaie que pendant le vote : une fois clos, la
                  jauge doit se taire comme le reste. */}
              {data.votingOpen && !complete ? (
                <span aria-hidden className="direct-sweep absolute inset-y-0 w-1/3" />
              ) : null}
            </div>
          </div>

          <ul className="mt-6 flex flex-wrap gap-2 sm:mt-[3.5vh] sm:gap-[1vw]">
            {data.tables.map((table) => (
              <li
                key={table.id}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors duration-500 sm:gap-[0.7vw] sm:px-[1.4vw] sm:py-[1vh] sm:text-[1.9vh] ${
                  table.validated
                    ? "border-[#d4af37] bg-[#d4af37]/15 text-[#e8cd72]"
                    : "border-[#fff]/15 bg-[#fff]/5 text-[#fff]/45"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full sm:h-[1.1vh] sm:w-[1.1vh] ${
                    table.validated ? "bg-[#d4af37]" : "bg-[#fff]/25"
                  }`}
                />
                {table.name}
                {table.special ? <span className="text-[#d4af37]">×2</span> : null}
                <span className="tabular-nums opacity-70">
                  {table.received}/{table.expectedJurors}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

/** Bandeau supérieur : le titre, et l'état du scrutin en un coup d'œil. */
function Header({
  state,
  stale,
  full,
  onToggleFull,
}: {
  state: "live" | "closed" | "complete";
  stale: boolean;
  full: boolean;
  onToggleFull: () => void;
}) {
  const badge =
    state === "live"
      ? { label: "Vote en cours", tone: "text-[#ff6b6b] border-[#ff6b6b]/40 bg-[#ff6b6b]/10" }
      : state === "complete"
        ? { label: "Votes complets", tone: "text-[#7ee08a] border-[#7ee08a]/40 bg-[#7ee08a]/10" }
        : { label: "Votes clos", tone: "text-[#fff]/60 border-[#fff]/20 bg-[#fff]/5" };

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-5 sm:flex sm:justify-between sm:px-[4vw] sm:py-[3vh]">
      <span className="font-serif text-2xl leading-tight text-[#d4af37] sm:text-[3vh]">Concours culinaire</span>

      <div className="flex items-center gap-2 sm:gap-[1.5vw]">
        {stale ? (
          <span className="text-[1.6vh] text-[#fff]/35">reconnexion…</span>
        ) : null}
        <span
          className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.12em] sm:gap-[0.8vw] sm:px-[1.6vw] sm:py-[1vh] sm:text-[1.7vh] sm:tracking-[0.25em] ${badge.tone}`}
        >
          {state === "live" ? (
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff6b6b] sm:h-[1.1vh] sm:w-[1.1vh]" />
          ) : null}
          {badge.label}
        </span>
        <button
          type="button"
          onClick={onToggleFull}
          title={full ? "Quitter le plein écran" : "Passer en plein écran"}
          aria-label={full ? "Quitter le plein écran" : "Passer en plein écran"}
          className="rounded-full border border-[#d4af37]/40 p-2.5 text-[#e8cd72] transition hover:border-[#d4af37] hover:bg-[#d4af37]/10 sm:p-[1vh]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 sm:h-[2.2vh] sm:w-[2.2vh]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
          >
            {full ? (
              <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
            ) : (
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}

/** Écran d'attente : aucun candidat n'est ouvert au vote. */
function Standby({
  stale,
  full,
  shell,
  onToggleFull,
}: {
  stale: boolean;
  full: boolean;
  shell: React.RefObject<HTMLElement | null>;
  onToggleFull: () => void;
}) {
  return (
    <main
      ref={shell}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0d0b08] px-[6vw] text-center text-[#fff]"
    >
      <div aria-hidden className="direct-halo pointer-events-none absolute inset-0" />
      <Proclamation />
      <LiveRanking />

      <button
        type="button"
        onClick={onToggleFull}
        title={full ? "Quitter le plein écran" : "Passer en plein écran"}
        aria-label={full ? "Quitter le plein écran" : "Passer en plein écran"}
        className="absolute right-[4vw] top-[3vh] z-10 rounded-full border border-[#d4af37]/40 p-[1vh] text-[#e8cd72] transition hover:border-[#d4af37] hover:bg-[#d4af37]/10"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[2.2vh] w-[2.2vh]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
        >
          {full ? (
            <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
          ) : (
            <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
          )}
        </svg>
      </button>

      <p className="relative text-[1.8vh] uppercase tracking-[0.5em] text-[#d4af37]">Soirée</p>
      <h1 className="relative mt-[2vh] font-serif text-[10vh] leading-none text-[#d4af37]">
        Concours culinaire
      </h1>
      <p className="relative mt-[3vh] text-[2.6vh] text-[#fff]/50">
        La dégustation va commencer.
      </p>
      {stale ? (
        <p className="mt-[4vh] text-[1.6vh] text-[#fff]/25">reconnexion au serveur…</p>
      ) : null}
    </main>
  );
}
