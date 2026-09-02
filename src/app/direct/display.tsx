"use client";

import { useEffect, useRef, useState } from "react";

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
  // Une coupure ne doit jamais vider l'écran : on garde le dernier état connu
  // et on le signale discrètement, sans rien effacer.
  const [stale, setStale] = useState(false);

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
    return <Standby stale={stale} />;
  }

  const { candidate } = data;
  const progress = data.expected > 0 ? (data.received / data.expected) * 100 : 0;
  const complete = data.allValidated || (data.expected > 0 && data.received >= data.expected);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d0b08] text-white">
      {/* Fond en mouvement lent : il occupe le regard quand le compteur, lui,
          n'a rien de neuf à montrer. */}
      <div aria-hidden className="direct-halo pointer-events-none absolute inset-0" />

      <Header
        stale={stale}
        state={complete ? "complete" : data.votingOpen ? "live" : "closed"}
      />

      <div className="relative grid flex-1 items-center gap-[4vw] px-[4vw] pb-[3vh] lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)]">
        {/* Le portrait : c'est lui qui donne un visage à regarder. */}
        <div className="relative mx-auto w-full max-w-[38vh] overflow-hidden rounded-[2vh] border-2 border-[#d4af37]/50 bg-[#17130e] shadow-[0_0_6vh_rgba(212,175,55,0.18)] lg:max-w-none">
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
          <p className="text-[1.6vh] uppercase tracking-[0.4em] text-[#d4af37]">
            Candidat {candidate.position} sur {candidate.total}
          </p>

          <h1 className="mt-[1vh] truncate font-serif text-[7vh] leading-none text-white">
            {candidate.name}
          </h1>

          <p className="mt-[4vh] text-[1.5vh] uppercase tracking-[0.35em] text-white/45">
            {complete ? "Votes complets" : "Votes reçus"}
          </p>

          <div className="flex items-baseline gap-[1.5vw]">
            <span
              className={`font-serif text-[18vh] leading-[0.9] tabular-nums text-[#d4af37] ${
                data.votingOpen && !complete ? "direct-breathe" : ""
              }`}
              style={{ textShadow: "0 0 6vh rgba(212,175,55,0.35)" }}
            >
              {counted}
            </span>
            <span className="text-[2.4vh] text-white/50">sur {data.expected} attendus</span>
          </div>

          {/* La jauge : c'est elle qui porte la tension, bien plus qu'un
              compteur de deux chiffres qui ne « défile » jamais vraiment. */}
          <div className="mt-[3vh] h-[1.4vh] w-full overflow-hidden rounded-full bg-white/10">
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

          <ul className="mt-[3.5vh] flex flex-wrap gap-[1vw]">
            {data.tables.map((table) => (
              <li
                key={table.id}
                className={`flex items-center gap-[0.7vw] rounded-full border px-[1.4vw] py-[1vh] text-[1.9vh] transition-colors duration-500 ${
                  table.validated
                    ? "border-[#d4af37] bg-[#d4af37]/15 text-[#e8cd72]"
                    : "border-white/15 bg-white/5 text-white/45"
                }`}
              >
                <span
                  className={`inline-block h-[1.1vh] w-[1.1vh] rounded-full ${
                    table.validated ? "bg-[#d4af37]" : "bg-white/25"
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
function Header({ state, stale }: { state: "live" | "closed" | "complete"; stale: boolean }) {
  const badge =
    state === "live"
      ? { label: "Vote en cours", tone: "text-[#ff6b6b] border-[#ff6b6b]/40 bg-[#ff6b6b]/10" }
      : state === "complete"
        ? { label: "Votes complets", tone: "text-[#7ee08a] border-[#7ee08a]/40 bg-[#7ee08a]/10" }
        : { label: "Votes clos", tone: "text-white/60 border-white/20 bg-white/5" };

  return (
    <header className="flex items-center justify-between px-[4vw] py-[3vh]">
      <span className="font-serif text-[3vh] text-[#d4af37]">Concours culinaire</span>

      <div className="flex items-center gap-[1.5vw]">
        {stale ? (
          <span className="text-[1.6vh] text-white/35">reconnexion…</span>
        ) : null}
        <span
          className={`flex items-center gap-[0.8vw] rounded-full border px-[1.6vw] py-[1vh] text-[1.7vh] uppercase tracking-[0.25em] ${badge.tone}`}
        >
          {state === "live" ? (
            <span className="inline-block h-[1.1vh] w-[1.1vh] animate-pulse rounded-full bg-[#ff6b6b]" />
          ) : null}
          {badge.label}
        </span>
      </div>
    </header>
  );
}

/** Écran d'attente : aucun candidat n'est ouvert au vote. */
function Standby({ stale }: { stale: boolean }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0d0b08] px-[6vw] text-center text-white">
      <div aria-hidden className="direct-halo pointer-events-none absolute inset-0" />

      <p className="relative text-[1.8vh] uppercase tracking-[0.5em] text-[#d4af37]">Soirée</p>
      <h1 className="relative mt-[2vh] font-serif text-[10vh] leading-none text-[#d4af37]">
        Concours culinaire
      </h1>
      <p className="relative mt-[3vh] text-[2.6vh] text-white/50">
        La dégustation va commencer.
      </p>
      {stale ? (
        <p className="mt-[4vh] text-[1.6vh] text-white/25">reconnexion au serveur…</p>
      ) : null}
    </main>
  );
}
