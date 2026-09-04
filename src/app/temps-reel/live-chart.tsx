"use client";

import { useEffect, useRef, useState } from "react";

interface TimelineCandidate {
  id: string;
  name: string;
  color: string;
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
const PAD = { top: 28, right: 168, bottom: 44, left: 56 };

/**
 * Cadence de rafraîchissement. Assez courte pour que la salle voie la courbe
 * bouger, assez longue pour ne pas recalculer la série en boucle.
 */
const REFRESH_MS = 4000;

export function LiveChart({
  initial,
  pin,
}: {
  initial: TimelinePayload;
  /**
   * Code de proclamation, quand le graphique est affiché sur l'écran projeté.
   *
   * Cette machine n'a pas de session : elle passe par la route gardée par le
   * code plutôt que par celle réservée au dashboard. Absent, on interroge la
   * route authentifiée comme depuis la page Résultats.
   */
  pin?: string;
}) {
  const [data, setData] = useState(initial);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(true);
  const previousVotes = useRef(initial.totalVotes);
  const [flash, setFlash] = useState(false);

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

  // Un seul vote ne fait pas une courbe : on étale quand même sur deux
  // colonnes, sinon la ligne est un point invisible collé à l'axe.
  const lastIndex = Math.max(points.length, 2);
  const x = (index: number) =>
    PAD.left + ((index - 1) / (lastIndex - 1)) * (W - PAD.left - PAD.right);
  const y = (score: number) =>
    PAD.top + (1 - score / maxTotal) * (H - PAD.top - PAD.bottom);

  const last = points.at(-1);

  // Étiquettes de fin de courbe : posées à la note du candidat, puis écartées
  // pour ne pas se superposer quand deux candidats terminent au coude à coude.
  const labels = candidates
    .map((candidate, position) => ({
      candidate,
      position,
      score: last?.scores[position] ?? null,
    }))
    .filter(
      (entry): entry is { candidate: TimelineCandidate; position: number; score: number } =>
        entry.score !== null && !hidden.has(entry.candidate.id),
    )
    .sort((a, b) => b.score - a.score);

  const placed = labels.reduce<
    { candidate: TimelineCandidate; position: number; score: number; at: number; wanted: number }[]
  >((accumulated, entry) => {
    const wanted = y(entry.score);
    const floor = accumulated.at(-1);
    const at = floor === undefined ? wanted : Math.max(wanted, floor.at + 20);
    accumulated.push({ ...entry, at, wanted });
    return accumulated;
  }, []);

  const gridLines = 5;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              live ? "bg-emerald-500" : "bg-amber-500"
            } ${flash ? "animate-ping" : ""}`}
          />
          <span className="text-sm font-semibold text-slate-600">
            {live ? "En direct" : "Serveur injoignable — dernier état affiché"}
          </span>
        </div>
        <span className="text-sm font-medium text-slate-500">
          {data.totalVotes} vote{data.totalVotes > 1 ? "s" : ""} pris en compte
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {points.length === 0 ? (
          <p className="py-24 text-center text-slate-400">
            Aucun vote reçu — la courbe démarrera au premier bulletin.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="min-h-[320px] h-[52vh] w-full">
            {/* Grille horizontale : la note se lit sans suivre la courbe du doigt. */}
            {Array.from({ length: gridLines + 1 }, (_, i) => {
              const score = (maxTotal / gridLines) * i;
              return (
                <g key={i}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y(score)}
                    y2={y(score)}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 12}
                    y={y(score) + 4}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize={13}
                  >
                    {score.toFixed(0)}
                  </text>
                </g>
              );
            })}

            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(0)}
              y2={y(0)}
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
            <text x={PAD.left} y={H - 14} fill="#94a3b8" fontSize={13}>
              1er vote
            </text>
            <text x={W - PAD.right} y={H - 14} textAnchor="end" fill="#94a3b8" fontSize={13}>
              vote n°{points.length}
            </text>

            {candidates.map((candidate, position) => {
              if (hidden.has(candidate.id)) return null;

              // La courbe ne commence qu'au premier vote reçu par ce candidat :
              // avant, il n'est pas à zéro, il n'est pas noté.
              const path = points
                .filter((point) => point.scores[position] !== null)
                .map((point) => `${x(point.index)},${y(point.scores[position] as number)}`);
              if (path.length === 0) return null;

              const [lastX, lastY] = path[path.length - 1].split(",").map(Number);

              return (
                <g key={candidate.id}>
                  <polyline
                    points={path.join(" ")}
                    fill="none"
                    stroke={candidate.color}
                    strokeWidth={2.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <circle cx={lastX} cy={lastY} r={5} fill={candidate.color} />
                </g>
              );
            })}

            {/* Nom et note en bout de courbe : le classement se lit à droite,
                sans avoir à revenir à la légende. */}
            {placed.map(({ candidate, at, wanted, score }) => (
              <g key={candidate.id}>
                <line
                  x1={W - PAD.right}
                  x2={W - PAD.right + 10}
                  y1={wanted}
                  y2={at}
                  stroke={candidate.color}
                  strokeWidth={1}
                  opacity={0.5}
                />
                <text
                  x={W - PAD.right + 14}
                  y={at + 4}
                  fontSize={14}
                  fontWeight={700}
                  fill={candidate.color}
                >
                  {candidate.name.length > 14 ? `${candidate.name.slice(0, 13)}…` : candidate.name}
                </text>
                <text x={W - 6} y={at + 4} fontSize={13} fontWeight={600} textAnchor="end" fill="#64748b">
                  {score.toFixed(2).replace(".", ",")}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Légende cliquable : isoler deux candidats qui se disputent la tête vaut
          mieux que de suivre huit courbes emmêlées. */}
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate, position) => {
          const off = hidden.has(candidate.id);
          const rank = last?.ranks[position] ?? null;
          const score = last?.scores[position] ?? null;
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() =>
                setHidden((current) => {
                  const next = new Set(current);
                  if (next.has(candidate.id)) next.delete(candidate.id);
                  else next.add(candidate.id);
                  return next;
                })
              }
              className={`flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm transition ${
                off
                  ? "border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: off ? "#cbd5e1" : candidate.color }}
              />
              {rank !== null ? <span className="font-bold text-slate-500">{rank}.</span> : null}
              <span className="font-semibold">{candidate.name}</span>
              <span className="font-medium text-slate-400">
                {score === null ? "non noté" : score.toFixed(2).replace(".", ",")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
