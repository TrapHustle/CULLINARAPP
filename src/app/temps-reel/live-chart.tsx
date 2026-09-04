"use client";

import { useEffect, useRef, useState } from "react";

interface TimelineCandidate {
  id: string;
  name: string;
  color: string;
  photoUrl: string | null;
  votes: number;
  byCriterion: { name: string; average: number | null }[];
}

interface TimelinePoint {
  index: number;
  at: string;
  scores: (number | null)[];
  ranks: (number | null)[];
}

export interface TimelinePayload {
  candidates: TimelineCandidate[];
  maxTotal: number;
  points: TimelinePoint[];
  totalVotes: number;
  expectedVotes: number;
}

/** Où loger le classement détaillé. */
export type Placement = "bas" | "cote" | "non";

/**
 * Hauteur réservée au-dessus des barres, en pixels, pour la pastille de tête,
 * le portrait, la note et le compte de votes.
 *
 * Fixe et soustraite de la hauteur disponible : sans elle, la barre du meneur
 * pousserait son propre portrait hors du cadre dès qu'il approche du maximum.
 */
const HEADROOM = 236;

/** Cadence de rafraîchissement : assez court pour voir monter, assez long pour ne pas marteler. */
const REFRESH_MS = 4000;

/** Amorti de la montée des barres. Le même partout, pour que la course se lise d'un bloc. */
const RISE = "900ms cubic-bezier(.34,.9,.3,1)";

function fmt(value: number) {
  return value.toFixed(2).replace(".", ",");
}

/**
 * La course des candidats, en barres qui montent à chaque vote reçu.
 *
 * Le portrait est posé au sommet de sa barre et s'élève avec elle : on suit un
 * visage plutôt qu'un chiffre, ce qui se lit du fond d'une salle. La note, le
 * rang et le nombre de votes l'accompagnent, si bien que les barres se
 * suffisent — le classement détaillé n'est qu'un complément, qu'on peut ranger
 * sur le côté ou retirer.
 */
export function LiveChart({
  initial,
  placement: initialPlacement = "cote",
}: {
  initial: TimelinePayload;
  /**
   * Position de départ du classement détaillé.
   *
   * L'écran projeté et le poste de l'organisateur n'ont pas les mêmes besoins :
   * en salle on veut les visages et les barres, au bureau on veut le détail.
   */
  placement?: Placement;
}) {
  const [data, setData] = useState(initial);
  const [live, setLive] = useState(true);
  const [flash, setFlash] = useState(false);
  const [placement, setPlacement] = useState<Placement>(initialPlacement);
  const [full, setFull] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const previousVotes = useRef(initial.totalVotes);

  // Le plein écran du navigateur, pas une simple surcouche : sur un
  // vidéoprojecteur, la barre d'adresse et les onglets mangent le haut de
  // l'image et trahissent qu'on est dans un navigateur.
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
      // Refusé par le navigateur ou déjà dans cet état : sans conséquence,
      // la page reste lisible telle quelle.
    }
  }

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/direct/timeline", { cache: "no-store" });
        if (!response.ok) {
          setLive(false);
          return;
        }

        const fresh: TimelinePayload = await response.json();
        setLive(true);
        setData(fresh);

        if (fresh.totalVotes !== previousVotes.current) {
          previousVotes.current = fresh.totalVotes;
          setFlash(true);
          setTimeout(() => setFlash(false), 900);
        }
      } catch {
        // Serveur momentanément injoignable : les dernières barres restent à
        // l'écran, ce qui vaut mieux qu'un cadre vide en pleine salle.
        setLive(false);
      }
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  const { candidates, maxTotal, points } = data;
  const last = points[points.length - 1];

  const rows = candidates.map((candidate, position) => ({
    candidate,
    score: last?.scores[position] ?? null,
    rank: last?.ranks[position] ?? null,
  }));

  const rated = rows.filter(
    (row): row is typeof row & { score: number; rank: number } =>
      row.score !== null && row.rank !== null,
  );

  const best = rated.length > 0 ? Math.max(...rated.map((row) => row.score)) : 0;

  // Du meilleur au moins bon, les non notés en fin de liste : ils existent, ils
  // n'ont simplement pas encore de note.
  const ranked = [...rows].sort((a, b) => {
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div
      ref={shell}
      className={`grid items-start gap-4 bg-[#17130d] ${
        full ? "h-screen overflow-auto p-4" : ""
      } ${placement === "cote" ? "lg:grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1"}`}
    >
      <section className="rounded-2xl border border-white/15 bg-[#241f18] px-6 pb-7 pt-5">
        {/* ---- En-tête ---- */}
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-[#d4af37]/35 bg-[#d4af37]/10 p-2 text-[#e8cd72]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </span>

          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Notes en direct</h2>
            <p className="mt-0.5 text-[13px] text-white/60">
              Moyenne pondérée sur {maxTotal} — un vote du jury spécial pèse davantage.
            </p>
          </div>

          <span
            className={`ml-auto flex flex-none items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              live ? "border-emerald-400/40 text-emerald-300" : "border-white/15 text-white/55"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                live ? "bg-emerald-400" : "bg-white/30"
              } ${flash ? "animate-ping" : ""}`}
            />
            {live ? "En direct" : "Reconnexion"}
          </span>

          <button
            type="button"
            onClick={toggleFull}
            title={full ? "Quitter le plein écran" : "Passer en plein écran"}
            className="flex-none rounded-full border border-[#d4af37]/40 p-2 text-[#e8cd72] transition hover:border-[#d4af37] hover:bg-[#d4af37]/10"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
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
            <span className="sr-only">{full ? "Quitter le plein écran" : "Plein écran"}</span>
          </button>
        </div>

        {/* ---- Légende : l'identité ne repose jamais sur la seule couleur ---- */}
        <div className="mb-6 mt-3.5 flex flex-wrap gap-4 pl-[52px]">
          {candidates.map((candidate) => (
            <span
              key={candidate.id}
              className="flex items-center gap-2 text-[12.5px] text-white/60"
            >
              <i
                aria-hidden
                className="block h-2.5 w-2.5 rounded-[3px]"
                style={{ background: candidate.color }}
              />
              {candidate.name}
            </span>
          ))}
        </div>

        {/* ---- Le graphique ---- */}
        {rated.length === 0 ? (
          <p className="py-24 text-center text-white/55">Aucun vote reçu pour l&apos;instant.</p>
        ) : (
          <>
            <div className="relative pl-[46px]">
              {/* Graduations et grille : elles situent, elles ne se lisent pas. */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-[46px]">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute right-2.5 translate-y-1/2 text-[11.5px] tabular-nums text-white/65"
                    style={{ bottom: `${tick * 100}%` }}
                  >
                    {Math.round(tick * maxTotal)}
                  </span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-[46px] right-0">
                {ticks.map((tick) => (
                  <div
                    key={tick}
                    className="absolute inset-x-0 border-t border-white/[0.10]"
                    style={{ bottom: `${tick * 100}%` }}
                  />
                ))}
              </div>

              <div className="relative flex h-[440px] items-end gap-[18px]">
                {rows.map((row) => {
                  const { candidate, score, rank } = row;
                  const unrated = score === null;

                  return (
                    <div
                      key={candidate.id}
                      className={`flex h-full min-w-0 flex-1 flex-col justify-end ${
                        unrated ? "opacity-40" : ""
                      }`}
                    >
                      {/* Réserve sa place même invisible : sinon toutes les
                          barres se décalent dès qu'un candidat prend la tête. */}
                      <span
                        className={`mb-2 self-center whitespace-nowrap rounded-full bg-gradient-to-b from-[#e8cd72] to-[#b8932e] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#241a00] shadow-[0_6px_18px_rgba(212,175,55,.25)] ${
                          rank === 1 ? "" : "invisible"
                        }`}
                      >
                        🏆 En tête
                      </span>

                      <span
                        className="relative mx-auto grid h-[108px] w-[108px] place-items-center rounded-full bg-[#332c22]"
                        style={{
                          boxShadow: `inset 0 0 0 3px ${candidate.color}, 0 0 34px ${candidate.color}55`,
                        }}
                      >
                        {candidate.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={candidate.photoUrl}
                            alt=""
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="font-serif text-[42px] font-bold"
                            style={{ color: candidate.color }}
                          >
                            {candidate.name.trim().charAt(0).toUpperCase()}
                          </span>
                        )}

                        {rank !== null ? (
                          <span
                            className="absolute -bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-[#241f18] text-[13px] font-bold text-white"
                            style={{ background: candidate.color }}
                          >
                            {rank}
                          </span>
                        ) : null}
                      </span>

                      <p className="mx-auto mb-3 mt-3 text-center text-[30px] font-semibold tabular-nums text-white">
                        {unrated ? "—" : fmt(score)}
                      </p>

                      <div
                        className="relative overflow-hidden rounded-t-[10px]"
                        style={{
                          height: unrated
                            ? "6px"
                            : `calc((100% - ${HEADROOM}px) * ${score / maxTotal})`,
                          background: unrated
                            ? "rgba(255,255,255,.07)"
                            : `linear-gradient(180deg, ${candidate.color}ee, ${candidate.color}77)`,
                          transition: `height ${RISE}`,
                        }}
                      >
                        {/* Le détail par critère vit dans la barre : il dit
                            pourquoi un candidat est là où il est, ce que la
                            moyenne seule masque. Masqué si la barre est trop
                            basse pour l'accueillir sans se chevaucher. */}
                        {!unrated && score / maxTotal > 0.34 ? (
                          <div className="absolute inset-x-0 top-0 space-y-1 px-2 pt-2.5">
                            {candidate.byCriterion.map((criterion) => (
                              <div
                                key={criterion.name}
                                className="flex items-baseline justify-between gap-2 text-[11.5px]"
                              >
                                <span className="truncate text-white/70">{criterion.name}</span>
                                <span className="flex-none font-semibold tabular-nums text-white">
                                  {criterion.average === null ? "—" : fmt(criterion.average)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1.5 py-1.5 text-center text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/90">
                          {candidate.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="ml-[46px] border-t border-white/25" />
          </>
        )}

        {/* ---- Classement en bas ---- */}
        {placement === "bas" && rated.length > 0 ? (
          <div className="mt-[18px] grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            {ranked.map((row) => (
              <div
                key={row.candidate.id}
                className={`rounded-2xl border bg-[#2c261d] px-3 py-3.5 text-center ${
                  row.rank === 1 ? "border-[#d4af37]/45" : "border-white/15"
                }`}
              >
                <b className="block font-serif text-lg font-bold text-white">
                  {row.candidate.name}
                </b>
                <span className="mt-1 block text-xs text-white/60">
                  {row.score === null ? "Non noté" : `Rang n° ${row.rank}`}
                </span>
                <span className="mt-1.5 block text-[11.5px] tabular-nums text-white/65">
                  {row.score === null
                    ? "Non noté"
                    : row.rank === 1
                      ? "En tête"
                      : `Écart : −${fmt(best - row.score)} pt`}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* ---- Où loger le classement ---- */}
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px] text-white/65">
          <span className="mr-1 uppercase tracking-[0.14em]">Classement</span>
          {(
            [
              ["bas", "En bas"],
              ["cote", "Sur le côté"],
              ["non", "Masqué"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPlacement(key)}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                placement === key
                  ? "border-[#d4af37] bg-[#d4af37]/20 text-[#f2ca50]"
                  : "border-[#d4af37]/40 text-[#e8cd72] hover:bg-[#d4af37]/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ---- Classement sur le côté ---- */}
      {placement === "cote" ? (
        <aside className="rounded-2xl border border-white/15 bg-[#241f18] p-4">
          <h2 className="mb-3 font-serif text-lg font-bold text-white">Classement</h2>

          <ol className="flex flex-col gap-2.5">
            {ranked.map((row) => (
              <li
                key={row.candidate.id}
                className={`flex items-center gap-3 rounded-xl border bg-white/[0.06] p-2.5 ${
                  row.rank === 1 ? "border-[#d4af37]/45" : "border-white/[0.12]"
                }`}
              >
                <span className="w-[18px] text-center font-serif text-[17px] font-bold tabular-nums text-white/65">
                  {row.rank ?? "—"}
                </span>

                <span
                  className="grid h-[54px] w-[54px] flex-none place-items-center overflow-hidden rounded-xl bg-white/5"
                  style={{ boxShadow: `inset 0 0 0 2px ${row.candidate.color}` }}
                >
                  {row.candidate.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.candidate.photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="font-serif text-lg font-bold"
                      style={{ color: row.candidate.color }}
                    >
                      {row.candidate.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-semibold text-white">
                    {row.candidate.name}
                  </b>
                  <span className="mt-0.5 block truncate text-[11.5px] text-white/60">
                    {row.score === null
                      ? "non noté"
                      : row.candidate.byCriterion
                          .map((c) => (c.average === null ? "—" : fmt(c.average)))
                          .join(" · ")}
                  </span>
                </span>

                <span className="flex-none font-serif text-lg font-bold tabular-nums text-white">
                  {row.score === null ? "—" : fmt(row.score)}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-3.5 px-1 text-[11.5px] leading-relaxed text-white/65">
            Le nombre de votes est indicatif : il n&apos;entre pas dans le classement.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
