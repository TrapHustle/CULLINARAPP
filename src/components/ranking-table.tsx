import { TrophyIcon } from "@/components/icons";
import { TableVotesList } from "@/components/table-votes";
import type { CandidateResult } from "@/lib/results";

/** Affiche une note ou la mention « non noté » — jamais 0 pour un candidat sans vote (§11). */
function formatScore(value: number | null) {
  return value === null ? "non noté" : value.toFixed(2).replace(".", ",");
}

/** Mention honorifique des trois premières places, comme sur un palmarès imprimé. */
const MEDALS = ["Médaille d'or", "Médaille d'argent", "Médaille de bronze"];

const GRID = "sm:grid-cols-[4rem_1fr_7rem_7rem_9rem_6rem]";

/**
 * Palmarès général : trois colonnes de note — Jury spécial, Public, puis Note
 * finale, chacune sous son propre en-tête — plutôt qu'une seule valeur qui
 * change de sens selon un onglet. Le classement (rang, médailles, ordre
 * d'affichage) reste celui de la note finale ; les deux autres colonnes n'en
 * sont que la composition.
 */
export function RankingTable({
  results,
}: {
  results: { ranking: CandidateResult[]; maxTotal: number; scoreMax: number };
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-surface-container gold-border">
      <div
        className={`hidden border-b border-outline-variant/30 px-6 py-3 text-label-sm uppercase tracking-wider text-outline sm:grid ${GRID}`}
      >
        <span>Rang</span>
        <span>Candidat</span>
        <span className="text-right">Jury spécial</span>
        <span className="text-right">Public</span>
        <span className="text-right">Note finale</span>
        <span className="text-right">Détails</span>
      </div>

      <ul className="divide-y divide-outline-variant/20">
        {results.ranking.map((entry) => {
          const podium = entry.rank !== null && entry.rank <= 3;
          const first = entry.rank === 1;

          return (
            <li
              key={entry.candidateId}
              className={first ? "border-l-2 border-primary bg-primary/5" : undefined}
            >
              <details className="group">
                <summary
                  className={`grid cursor-pointer list-none items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-high/40 sm:grid ${GRID}`}
                >
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

                  {/* Jury spécial et Public : la composition, chacune sous son
                      propre en-tête plutôt qu'un onglet qui change de sens. */}
                  <span className="text-right">
                    <span className="font-serif text-headline-sm text-on-surface-variant sm:hidden">
                      Jury spécial{" "}
                    </span>
                    <span className="text-on-surface-variant">{formatScore(entry.specialScore)}</span>
                  </span>

                  <span className="text-right">
                    <span className="font-serif text-headline-sm text-on-surface-variant sm:hidden">
                      Public{" "}
                    </span>
                    <span className="text-on-surface-variant">{formatScore(entry.publicScore)}</span>
                  </span>

                  <span className="text-right">
                    <span
                      className={`font-serif ${
                        first ? "text-display-lg text-primary" : "text-headline-lg text-on-surface"
                      }`}
                    >
                      {formatScore(entry.finalScore)}
                    </span>
                    <span className="ml-1 text-label-sm text-outline">/{results.maxTotal}</span>
                    {podium && entry.finalScore !== null ? (
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
                            <span className="ml-1 text-label-sm text-outline">/{results.scoreMax}</span>
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
                    <TableVotesList
                      tables={entry.byTable}
                      maxTotal={results.maxTotal}
                      scoreMax={results.scoreMax}
                    />
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
