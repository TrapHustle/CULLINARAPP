"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Un palier de la révélation, tel que le serveur le compose. */
interface RevealStep {
  rank: number;
  note: string;
  people: { name: string; photoUrl: string | null }[];
}

/** Étapes de la cérémonie, dans l'ordre où elles s'enchaînent. */
type Phase = "idle" | "pin" | "countdown" | "reveal";

/** Durée du compte à rebours, en secondes. */
const COUNTDOWN = 5;

/** Le temps que met le rideau à s'écarter, bouton verrouillé pendant ce délai. */
const CURTAIN_MS = 1400;

/** Verrouillage après trois codes faux, en secondes. */
const LOCKOUT_S = 30;

/** Reprise après un rechargement en pleine cérémonie. */
const STORAGE_KEY = "proclamation-step";

/**
 * Proclamation du classement, en surcouche de l'écran projeté.
 *
 * Elle recouvre l'écran de vote puis le libère : `/direct` reste ce qu'il est,
 * la cérémonie n'est qu'un moment.
 *
 * Le code n'est **pas** vérifié ici mais par `/api/direct/proclamation`, qui ne
 * rend le classement qu'en échange. Un code contrôlé dans le navigateur serait
 * lisible dans le JavaScript de la page, et le classement fuiterait avant la
 * proclamation — ce que toute l'application s'emploie à empêcher.
 */
export function Proclamation() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<RevealStep[]>([]);
  // 15 par défaut (3 critères × 5) : corrigé dès la réponse du serveur, seul à
  // connaître le nombre réel de critères configurés.
  const [maxTotal, setMaxTotal] = useState(15);
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(COUNTDOWN);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [locked, setLocked] = useState(0);
  const fails = useRef(0);

  const current = steps[index];
  const isWinner = current?.rank === 1;

  /* ---------- Reprise après un rechargement ---------- */
  // Un F5 malencontreux ne doit pas relancer la cérémonie depuis le rideau
  // devant la salle : on reprend exactement où l'on en était.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!saved) return;

    let parsed: { steps: RevealStep[]; index: number; maxTotal?: number };
    try {
      parsed = JSON.parse(saved) as { steps: RevealStep[]; index: number; maxTotal?: number };
    } catch {
      return; /* mémoire illisible : on repart de l'écran de vote, sans bruit. */
    }
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) return;

    // Repris après le premier rendu : lire le stockage pendant le rendu ferait
    // diverger le serveur et le navigateur, qui ne voient pas la même mémoire.
    const restore = setTimeout(() => {
      setSteps(parsed.steps);
      if (parsed.maxTotal) setMaxTotal(parsed.maxTotal);
      setIndex(Math.min(parsed.index, parsed.steps.length - 1));
      setPhase("reveal");
      setCurtainOpen(true);
    }, 0);

    return () => clearTimeout(restore);
  }, []);

  const remember = useCallback(
    (nextSteps: RevealStep[], nextIndex: number, nextMaxTotal: number) => {
      try {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ steps: nextSteps, index: nextIndex, maxTotal: nextMaxTotal }),
        );
      } catch {
        /* Navigation privée ou stockage refusé : la cérémonie marche quand même. */
      }
    },
    [],
  );

  /* ---------- Verrouillage après trois essais ---------- */
  useEffect(() => {
    if (locked <= 0) return;
    const timer = setTimeout(() => setLocked((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [locked]);

  /* ---------- Compte à rebours, puis rideau ---------- */
  useEffect(() => {
    if (phase !== "countdown") return;

    // Tout se joue dans le minuteur : le dernier chiffre reste affiché sa
    // seconde entière avant que le rideau ne parte.
    const timer = setTimeout(() => {
      if (tick > 1) {
        setTick(tick - 1);
        return;
      }
      setPhase("reveal");
      setCurtainOpen(false);
      // Le rideau part au cycle suivant : sans état de départ, la transition
      // n'aurait rien à animer et les pans seraient déjà écartés.
      requestAnimationFrame(() => setCurtainOpen(true));
      setTimeout(() => setBusy(false), CURTAIN_MS);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, tick]);

  /* ---------- Saisie du code ---------- */
  async function submit(code: string) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/direct/proclamation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });

      if (response.status === 401) {
        fails.current += 1;
        setEntry("");
        if (fails.current >= 3) {
          fails.current = 0;
          setLocked(LOCKOUT_S);
          setError("Trop d'essais.");
        } else {
          setError("Code incorrect");
        }
        return;
      }

      if (!response.ok) {
        setEntry("");
        setError("Le serveur n'a pas répondu. Réessayez.");
        return;
      }

      const payload = (await response.json()) as {
        steps: RevealStep[];
        maxTotal: number;
      };
      if (payload.steps.length === 0) {
        setEntry("");
        setError("Aucun candidat noté : il n'y a rien à proclamer.");
        return;
      }

      fails.current = 0;
      setSteps(payload.steps);
      setMaxTotal(payload.maxTotal);
      setIndex(0);
      remember(payload.steps, 0, payload.maxTotal);
      setEntry("");
      setTick(COUNTDOWN);
      setPhase("countdown");
    } catch {
      setEntry("");
      setError("Serveur injoignable.");
    } finally {
      setBusy(false);
    }
  }

  function press(value: string) {
    if (locked > 0 || busy) return;

    if (value === "del") {
      setEntry((current) => current.slice(0, -1));
      return;
    }
    if (entry.length >= 4) return;

    const next = entry + value;
    setEntry(next);
    if (next.length === 4) void submit(next);
  }

  function next() {
    if (busy || index >= steps.length - 1) return;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    remember(steps, nextIndex, maxTotal);
    // Le bouton reste inerte le temps de l'animation : un double-clic brûlerait
    // deux rangs d'un coup, ce qui est irrattrapable en public.
    setBusy(true);
    setTimeout(() => setBusy(false), 900);
  }

  function quit() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* rien à nettoyer */
    }
    setPhase("idle");
    setSteps([]);
    setIndex(0);
    setCurtainOpen(false);
  }

  /* ---------- Écran de vote : simple appel discret ---------- */
  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => {
          setEntry("");
          setError("");
          setPhase("pin");
        }}
        className="absolute left-1/2 top-[2.4vh] z-30 flex -translate-x-1/2 items-center gap-[0.8vw] rounded-full border border-[#d4af37]/40 bg-[#d4af37]/[0.07] px-[2vw] py-[0.9vh] text-[1.3vh] uppercase tracking-[0.18em] text-[#e8cd72] opacity-40 transition hover:border-[#d4af37] hover:bg-[#d4af37]/20 hover:text-[#f2ca50] hover:opacity-100 focus-visible:opacity-100"
      >
        Classement final
      </button>
    );
  }

  /* ---------- Saisie du code ---------- */
  if (phase === "pin") {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#05040288] backdrop-blur-sm">
        <div className="w-[min(90vw,34vh)] rounded-lg border border-[#d4af37]/45 bg-gradient-to-b from-[#241a0e] to-[#17120c] p-[3.4vh] text-center shadow-[0_24px_70px_rgba(0,0,0,.7)]">
          <h2 className="font-serif text-[3.1vh] text-[#fff]">Proclamation</h2>
          <p className="mt-1 text-[1.3vh] text-[#fff]/45">Code de l&apos;organisateur</p>

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
                disabled={locked > 0 || busy}
                onClick={() => (key === "esc" ? quit() : press(key))}
                className={`rounded border border-[#d4af37]/20 bg-[#d4af37]/5 py-[1.15vh] transition hover:border-[#d4af37] hover:bg-[#d4af37]/15 disabled:opacity-40 ${
                  key === "esc" || key === "del"
                    ? "text-[1.3vh] tracking-wider text-[#fff]/45"
                    : "text-[2vh] font-light text-[#fff]"
                }`}
              >
                {key === "esc" ? "Annuler" : key === "del" ? "Effacer" : key}
              </button>
            ))}
          </div>

          <p className="mt-[1.8vh] min-h-[1.6vh] text-[1.2vh] text-[#e0796b]" role="alert">
            {locked > 0 ? `Trop d'essais — patientez ${locked} s` : error}
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Compte à rebours ---------- */
  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#040302f0]">
        <div className="text-center">
          <p
            key={tick}
            className="font-serif text-[26vh] leading-none text-[#f2ca50] proclamation-beat"
          >
            {tick}
          </p>
          <p className="mt-[3vh] text-[1.3vh] uppercase tracking-[0.32em] text-[#b8932e]">
            Le classement va être révélé
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Révélation ---------- */
  return (
    <div className="fixed inset-0 z-50 flex bg-[#0d0b08]">
      {/* Rideau : deux pans de velours qui s'écartent, puis disparaissent. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <div
          className={`proclamation-panel absolute inset-y-0 left-0 w-1/2 ${
            curtainOpen ? "-translate-x-full" : ""
          }`}
        />
        <div
          className={`proclamation-panel absolute inset-y-0 right-0 w-1/2 ${
            curtainOpen ? "translate-x-full" : ""
          }`}
        />
      </div>

      {/* Carte du palier en cours */}
      <div className="flex flex-1 flex-col justify-center gap-[1.6vh] px-[5vw] pb-[10vh]">
        <div className="flex items-center gap-[2.6vw]">
          <p
            key={`rank-${index}`}
            className="proclamation-pop font-serif text-[16vh] font-bold leading-[0.85] text-transparent [-webkit-text-stroke:1px_#b8932e]"
          >
            {current?.rank}
            <sup className="text-[0.34em]">{current?.rank === 1 ? "er" : "e"}</sup>
          </p>

          <div className="flex gap-[1.4vw]">
            {current?.people.map((person) => (
              <div
                key={person.name}
                className={`proclamation-slide grid overflow-hidden rounded-full border border-[#d4af37]/45 bg-[radial-gradient(circle_at_34%_28%,#3b2c15,#160f07)] shadow-[0_0_0_0.4vh_rgba(212,175,55,.09)] ${
                  isWinner ? "h-[30vh] w-[30vh]" : "h-[18vh] w-[18vh]"
                }`}
              >
                {person.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={person.photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center font-serif text-[6vh] text-[#e8cd72]">
                    {person.name
                      .split(" ")
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[0.5vh]">
          {current && current.people.length > 1 ? (
            <span className="self-start rounded-full border border-[#d4af37]/45 px-[1.3vw] py-[0.45vh] text-[1.1vh] uppercase tracking-[0.24em] text-[#d4af37]">
              Ex æquo
            </span>
          ) : null}

          {isWinner ? (
            <p className="text-[1.35vh] uppercase tracking-[0.44em] text-[#d4af37]">
              Vainqueur du concours
            </p>
          ) : null}

          {current?.people.map((person) => (
            <h2
              key={person.name}
              className={`font-serif font-semibold leading-tight text-[#fff] ${
                isWinner ? "text-[9vh]" : "text-[6vh]"
              }`}
            >
              {person.name}
            </h2>
          ))}

          <p className="mt-[0.4vh] font-light tabular-nums text-[#e8cd72]">
            <b className={`font-medium text-[#f2ca50] ${isWinner ? "text-[4.4vh]" : "text-[3.4vh]"}`}>
              {current?.note}
            </b>
            <span className="text-[2.5vh]"> / {maxTotal}</span>
          </p>
        </div>
      </div>

      {/* Rail : le classement se remplit du bas vers le haut, si bien que le
          podium reste vide jusqu'au dernier instant. */}
      <aside className="flex w-[31vw] max-w-[420px] flex-none flex-col border-l border-[#d4af37]/20 bg-black/25 px-[2.2vw] pb-[9vh] pt-[2.4vh]">
        <h3 className="mb-[1vh] text-[1.05vh] uppercase tracking-[0.3em] text-[#b8932e]">
          Classement
        </h3>

        <div className="mt-auto flex flex-col gap-[0.7vh]">
          {[...steps].reverse().map((step) => {
            const position = steps.indexOf(step);
            const shown = position <= index;
            const fresh = position === index;

            return (
              <div
                key={step.rank}
                className={`flex items-center gap-[1.2vw] rounded border px-[1.1vw] py-[0.85vh] transition-all duration-500 ${
                  shown ? "opacity-100" : "translate-y-2 opacity-0"
                } ${
                  fresh
                    ? "border-[#d4af37]/45 bg-[#d4af37]/15"
                    : "border-transparent bg-[#d4af37]/5"
                }`}
              >
                <span
                  className={`w-[2.6vw] text-right font-serif text-[2.1vh] tabular-nums ${
                    step.rank === 1 ? "text-[#f2ca50]" : "text-[#d4af37]"
                  }`}
                >
                  {step.rank}
                </span>
                <span
                  className={`flex-1 truncate text-[1.5vh] font-light ${
                    step.rank === 1 ? "text-[#f2ca50]" : "text-[#fff]"
                  }`}
                >
                  {step.people.map((person) => person.name).join(" · ")}
                </span>
                <span className="text-[1.4vh] tabular-nums text-[#fff]/40">{step.note}</span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Barre de commande */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-[2vw] px-[3vw] py-[1.8vh]">
        <div className="flex gap-[0.8vw]">
          {steps.map((step, position) => (
            <i
              key={step.rank}
              className={`h-[0.75vh] w-[0.75vh] rounded-full transition-colors ${
                position <= index ? "bg-[#d4af37]" : "bg-[#d4af37]/25"
              }`}
            />
          ))}
        </div>

        {index < steps.length - 1 ? (
          <button
            type="button"
            onClick={next}
            disabled={busy}
            className="gold-gradient rounded-full px-[2.6vw] py-[1.05vh] text-[1.35vh] font-semibold uppercase tracking-[0.16em] text-[#241a00] transition hover:brightness-110 disabled:opacity-30"
          >
            {index === steps.length - 2 ? "Révéler le vainqueur →" : "Suivant →"}
          </button>
        ) : (
          <button
            type="button"
            onClick={quit}
            className="rounded-full border border-[#d4af37]/30 px-[2vw] py-[1vh] text-[1.1vh] uppercase tracking-[0.2em] text-[#b8932e] transition hover:border-[#d4af37] hover:text-[#f2ca50]"
          >
            Revenir à l&apos;écran de vote
          </button>
        )}
      </div>
    </div>
  );
}
