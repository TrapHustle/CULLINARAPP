"use client";

import { useState } from "react";
import { TrophyIcon } from "@/components/icons";
import { TableVotesList } from "@/components/table-votes";
import type { CandidateResult } from "@/lib/results";

/** Affiche une note ou la mention « non noté » — jamais 0 pour un candidat sans vote (§11). */
function formatScore(value: number | null) {
  return value === null ? "non noté" : value.toFixed(2).replace(".", ",");
}

/** Mention honorifique des trois premières places, comme sur un palmarès imprimé. */
const MEDALS = ["Médaille d'or", "Médaille d'argent", "Médaille de bronze"];

type Metric = "final" | "special" | "public";

const METRICS: { id: Metric; label: string }[] = [
  { id: "final", label: "Note finale" },
  { id: "special", label: "Jury spécial" },
  { id: "public", label: "Public" },
];

function scoreFor(entry: CandidateResult, metric: Metric): number | null {
  if (metric === "special") return entry.specialScore;
  if (metric === "public") return entry.publicScore;
  return entry.finalScore;
}

/**
 * Palmarès général, avec des onglets pour lire la note finale, celle du seul
 * jury spécial, ou celle du seul public (les tables normales).
 *
 * Le classement (rang, médailles, ordre d'affichage) reste toujours celui de
 * la note finale — ce sont les onglets « Jury spécial » et « Public » qui
 * expliquent sa composition, pas des classements concurrents. Composant
 * client car le choix d'onglet est un état d'écran, sans rapport avec les
 * données.
 */
export function RankingTable({ results }: { results: { ranking: CandidateResult[]; maxTotal: number } }) {
  const [metric, setMetric] = useState<Metric>("final");

  return (
    <section className="overflow-hidden rounded-xl bg-surface-container gold-border">
      <div className="hidden border-b border-outline-variant/30 px-6 py-3 text-label-sm uppercase tracking-wider text-outline sm:grid sm:grid-cols-[4rem_1fr_10rem_6rem]">
        <span>Rang</span>
        <span>Candidat</span>
        <span className="flex justify-end gap-3">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={
                metric === m.id
                  ? "text-primary"
                  : "text-outline transition-colors hover:text-on-surface-variant"
              }
            >
              {m.label}
            </button>
          ))}
        </span>
        <span className="text-right">Détails</span>
      </div>

      <ul className="divide-y divide-outline-variant/20">
        {results.ranking.map((entry) => {
          const podium = entry.rank !== null && entry.rank <= 3;
          const first = entry.rank === 1;
          const score = scoreFor(entry, metric);

          return (
            <li
              key={entry.candidateId}
              className={first ? "border-l-2 border-primary bg-primary/5" : undefined}
            >
              <details className="group">
                <summary className="grid cursor-pointer list-none items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-high/40 sm:grid-cols-[4rem_1fr_10rem_6rem]">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-label-lg ${
                      first
                        ? "gold-gradient"
                        : podium
                          ? "border border-primary/40 text-primary"
                          : "border border-outline-variant/40 text-on-surface-variant"
                    }`}
                  >
                    {entry.rank ?? "—"}
                  </span>

                  <span className="min-w-0">
                    <span
                      className={`block truncate font-serif ${
                        first ? "text-headline-lg text-primary" : "text-headline-md text-on-surface"
                      }`}
                    >
                      {entry.name}
                    </span>
                    <span className="text-label-sm text-outline">
                      {entry.voterCount} votant{entry.voterCount > 1 ? "s" : ""} · poids total{" "}
                      {entry.weightTotal}
                    </span>
                  </span>

                  <span className="text-right">
                    <span
                      className={`font-serif ${
                        first ? "text-display-lg text-primary" : "text-headline-lg text-on-surface"
                      }`}
                    >
                      {formatScore(score)}
                    </span>
                    <span className="ml-1 text-label-sm text-outline">/{results.maxTotal}</span>
                    {/* La médaille reste celle du classement général : les
                        onglets Jury spécial / Public n'en ont pas de la leur,
                        ce ne sont pas des classements séparés. */}
                    {metric === "final" && podium && entry.finalScore !== null ? (
                      <span className="block text-label-sm text-on-surface-variant">
                        {MEDALS[(entry.rank ?? 1) - 1]}
                      </span>
                    ) : null}
                  </span>

                  <span className="text-right text-label-sm text-primary">
                    <span className="group-open:hidden">Voir</span>
                    <span className="hidden group-open:inline">Masquer</span>
                  </span>
                </summary>

                {/* Détail : moyennes par critère, puis par table. */}
                <div className="space-y-4 bg-surface-low px-6 py-5">
                  <h3 className="flex items-center gap-2 font-serif text-headline-md text-primary">
                    <TrophyIcon className="h-5 w-5" />
                    Détail de l&apos;évaluation — {entry.name}
                  </h3>

                  <p className="text-label-sm text-on-surface-variant">
                    Note finale {formatScore(entry.finalScore)} / {results.maxTotal} — dont jury
                    spécial {formatScore(entry.specialScore)} et public {formatScore(entry.publicScore)}.
                  </p>

                  {entry.byCriterion.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {entry.byCriterion.map((criterion) => (
                        <div
                          key={criterion.criterionId}
                          className="rounded-lg border border-outline-variant/30 bg-surface-container p-4"
                        >
                          <p className="text-label-sm uppercase tracking-wider text-outline">
                            {criterion.name}
                          </p>
                          <p className="mt-1 font-serif text-headline-md text-on-surface">
                            {formatScore(criterion.averageOutOf5)}
                            <span className="ml-1 text-label-sm text-outline">/5</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-2 text-label-sm uppercase tracking-wider text-outline">
                      Par table (sur {results.maxTotal}) — touchez une table pour voir le détail
                      des jurés
                    </p>
                    <TableVotesList tables={entry.byTable} maxTotal={results.maxTotal} />
                  </div>
                </div>
              </details>
            </li>
          );
        })}
        {results.ranking.length === 0 ? (
          <li className="px-6 py-8 text-center text-body-md text-on-surface-variant">
            Aucun candidat configuré.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
