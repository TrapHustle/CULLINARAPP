"use client";

import { useEffect, useRef, useState } from "react";

interface TimelineCandidate {
  id: string;
  name: string;
  color: string;
  photoUrl: string | null;
  votes: number;
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
}

/** Repères du dessin, en unités du `viewBox` — le SVG s'étire, pas ses proportions. */
const W = 1000;
const H = 460;

/** La marge droite loge les portraits et leur étiquette, hors de la zone tracée. */
const PAD = { top: 26, right: 210, bottom: 38, left: 54 };

/** Rayon du portrait posé au bout de chaque courbe. */
const HEAD = 21;

/** Écart minimal entre deux portraits, pour qu'ils ne se recouvrent pas. */
const HEAD_GAP = HEAD * 2 + 6;

/**
 * Cadence de rafraîchissement. Assez courte pour que la salle voie la courbe
 * bouger, assez longue pour ne pas recalculer la série en boucle.
 */
const REFRESH_MS = 4000;

/**
 * Trace une courbe lissée passant par tous les points.
 *
 * Catmull-Rom converti en Bézier : la courbe passe exactement par chaque vote
 * — contrairement à un lissage qui les approcherait — tout en évitant les
 * angles durs d'une ligne brisée, illisibles à distance sur un mur.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function LiveChart({
  initial,
  pin,
}: {
  initial: TimelinePayload;
  /**
   * Code de proclamation, quand le graphique est affiché sur l'écran projeté.
   *
   * Cette machine n'a pas de session : elle passe par la route gardée par le
   * code plutôt que par celle réservée au dashboard.
   */
  pin?: string;
}) {
  const [data, setData] = useState(initial);
  const [live, setLive] = useState(true);
  const [flash, setFlash] = useState(false);
  const previousVotes = useRef(initial.totalVotes);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = pin
          ? await fetch("/api/direct/timeline", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pin }),
              cache: "no-store",
            })
          : await fetch("/api/results/timeline", { cache: "no-store" });

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
        // Serveur momentanément injoignable : la dernière courbe reste à
        // l'écran, ce qui vaut mieux qu'un cadre vide en pleine salle.
        setLive(false);
      }
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [pin]);

  const { candidates, maxTotal, points } = data;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (index: number) =>
    points.length <= 1 ? PAD.left + plotW : PAD.left + (index / (points.length - 1)) * plotW;
  const y = (score: number) => PAD.top + (1 - score / maxTotal) * plotH;

  // Une courbe par candidat, amputée de son début tant qu'il n'a pas de note.
  const series = candidates.map((candidate, position) => {
    const drawn: { x: number; y: number }[] = [];
    points.forEach((point, index) => {
      const score = point.scores[position];
      if (score !== null) drawn.push({ x: x(index), y: y(score) });
    });

    const last = points[points.length - 1];
    return {
      candidate,
      path: smoothPath(drawn),
      end: drawn[drawn.length - 1] ?? null,
      score: last?.scores[position] ?? null,
      rank: last?.ranks[position] ?? null,
    };
  });

  // Portraits écartés verticalement : posés à la note exacte, deux candidats au
  // coude à coude se recouvriraient et l'on ne saurait plus qui est devant.
  const heads = series
    .filter((entry) => entry.end !== null && entry.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const placed: number[] = [];
  heads.forEach((entry, i) => {
    const wanted = entry.end!.y;
    const previous = placed[i - 1];
    placed.push(previous === undefined ? wanted : Math.max(wanted, previous + HEAD_GAP));
  });

  // Des candidats au coude à coude et bas dans l'échelle empilent leurs
  // portraits sous le cadre : on remonte alors toute la pile d'un bloc, en
  // conservant les écarts. Sans ce recadrage, les derniers sortiraient du SVG
  // et disparaîtraient purement et simplement.
  const overflow = (placed[placed.length - 1] ?? 0) - (PAD.top + plotH - HEAD);
  if (overflow > 0) {
    const shift = Math.min(overflow, (placed[0] ?? 0) - (PAD.top + HEAD));
    if (shift > 0) {
      for (let i = 0; i < placed.length; i++) placed[i] -= shift;
    }
  }

  // Classement courant, du meilleur au moins bon.
  const standings = [...series]
    .filter((entry) => entry.score !== null)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ---- La course ---- */}
      <section className="rounded-2xl border border-white/10 bg-[#12100b] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white">La course des candidats</h2>
            <p className="mt-0.5 text-sm text-white/45">
              Chaque point est un vote reçu. La note se recalcule à chacun.
            </p>
          </div>

          <span
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
              live
                ? "border-emerald-400/40 text-emerald-300"
                : "border-white/15 text-white/40"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                live ? "bg-emerald-400" : "bg-white/30"
              } ${flash ? "animate-ping" : ""}`}
            />
            {live ? "En direct" : "Reconnexion…"}
          </span>
        </div>

        {points.length === 0 ? (
          <p className="py-24 text-center text-white/40">
            Aucun vote reçu pour l&apos;instant.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label="Évolution de la note de chaque candidat au fil des votes reçus"
          >
            <defs>
              {series.map((entry) => (
                <clipPath key={entry.candidate.id} id={`head-${entry.candidate.id}`}>
                  <circle cx={0} cy={0} r={HEAD - 3} />
                </clipPath>
              ))}
            </defs>

            {/* Grille : présente pour situer, jamais pour être lue. */}
            {ticks.map((tick) => {
              const value = tick * maxTotal;
              return (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + plotW}
                    y1={y(value)}
                    y2={y(value)}
                    stroke="currentColor"
                    className="text-white/[0.07]"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 12}
                    y={y(value) + 4}
                    textAnchor="end"
                    className="fill-white/35 text-[13px] tabular-nums"
                  >
                    {Math.round(value)}
                  </text>
                </g>
              );
            })}

            {/* Le présent : la verticale où se lisent les notes du moment. */}
            <line
              x1={PAD.left + plotW}
              x2={PAD.left + plotW}
              y1={PAD.top - 6}
              y2={PAD.top + plotH + 6}
              stroke="currentColor"
              className="text-white/20"
              strokeWidth={1}
            />

            {series.map((entry) => (
              <path
                key={entry.candidate.id}
                d={entry.path}
                fill="none"
                stroke={entry.candidate.color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Portraits et étiquettes de fin : l'identité se lit sans légende. */}
            {heads.map((entry, i) => {
              const cy = placed[i];
              const cx = PAD.left + plotW;
              const { candidate } = entry;

              return (
                <g key={candidate.id}>
                  {/* Rattache le portrait à sa courbe quand il a été écarté. */}
                  <line
                    x1={entry.end!.x}
                    y1={entry.end!.y}
                    x2={cx}
                    y2={cy}
                    stroke={candidate.color}
                    strokeWidth={1.5}
                    opacity={0.5}
                  />

                  <circle cx={cx} cy={cy} r={HEAD} fill="#12100b" />
                  <g transform={`translate(${cx} ${cy})`}>
                    {candidate.photoUrl ? (
                      <image
                        href={candidate.photoUrl}
                        x={-(HEAD - 3)}
                        y={-(HEAD - 3)}
                        width={(HEAD - 3) * 2}
                        height={(HEAD - 3) * 2}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#head-${candidate.id})`}
                      />
                    ) : (
                      <text
                        textAnchor="middle"
                        dy={6}
                        fill={candidate.color}
                        className="text-[17px] font-bold"
                      >
                        {candidate.name.trim().charAt(0).toUpperCase()}
                      </text>
                    )}
                  </g>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={HEAD}
                    fill="none"
                    stroke={candidate.color}
                    strokeWidth={2.5}
                  />

                  {/* Rang courant, en pastille sur le portrait. */}
                  <circle cx={cx + HEAD - 4} cy={cy - HEAD + 4} r={9} fill={candidate.color} />
                  <text
                    x={cx + HEAD - 4}
                    y={cy - HEAD + 8}
                    textAnchor="middle"
                    className="fill-white text-[11px] font-bold"
                  >
                    {entry.rank}
                  </text>

                  <text
                    x={cx + HEAD + 12}
                    y={cy - 2}
                    className="fill-white text-[15px] font-semibold"
                  >
                    {candidate.name}
                  </text>
                  <text
                    x={cx + HEAD + 12}
                    y={cy + 16}
                    className="fill-white/50 text-[14px] tabular-nums"
                  >
                    {entry.score?.toFixed(2).replace(".", ",")} / {maxTotal}
                  </text>
                </g>
              );
            })}

            <text
              x={PAD.left}
              y={H - 10}
              className="fill-white/35 text-[13px] uppercase tracking-[0.14em]"
            >
              1er vote
            </text>
            <text
              x={PAD.left + plotW}
              y={H - 10}
              textAnchor="end"
              className="fill-white/35 text-[13px] uppercase tracking-[0.14em]"
            >
              Maintenant · {data.totalVotes} votes
            </text>
          </svg>
        )}
      </section>

      {/* ---- Le classement, qui sert aussi de légende ---- */}
      <aside className="rounded-2xl border border-white/10 bg-[#12100b] p-4">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="font-serif text-lg font-bold text-white">Classement</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
            {data.totalVotes} votes
          </span>
        </div>

        <ol className="space-y-2.5">
          {standings.map((entry) => {
            const { candidate } = entry;
            const leader = entry.rank === 1;

            return (
              <li
                key={candidate.id}
                className={`rounded-xl border bg-white/[0.03] p-3 transition-colors ${
                  leader ? "border-white/25" : "border-white/[0.07]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Portrait : on reconnaît un visage avant de lire un nom. */}
                  <span
                    className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5"
                    style={{ boxShadow: `inset 0 0 0 2px ${candidate.color}` }}
                  >
                    {candidate.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={candidate.photoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="grid h-full w-full place-items-center font-serif text-lg font-bold"
                        style={{ color: candidate.color }}
                      >
                        {candidate.name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {candidate.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-white/40 tabular-nums">
                      {candidate.votes} vote{candidate.votes > 1 ? "s" : ""}
                      {" · "}
                      <span style={{ color: candidate.color }}>{entry.rank}<sup>{entry.rank === 1 ? "er" : "e"}</sup></span>
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block font-serif text-xl font-bold text-white tabular-nums">
                      {entry.score?.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="block text-[11px] text-white/35 tabular-nums">
                      sur {maxTotal}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}

          {standings.length === 0 ? (
            <li className="py-6 text-center text-sm text-white/40">
              Aucun candidat noté pour l&apos;instant.
            </li>
          ) : null}
        </ol>

        <p className="mt-4 px-1 text-xs leading-relaxed text-white/35">
          Moyenne pondérée par votant : un vote du jury spécial pèse davantage. Le nombre de
          votes est indicatif, il n&apos;entre pas dans le classement.
        </p>
      </aside>
    </div>
  );
}
