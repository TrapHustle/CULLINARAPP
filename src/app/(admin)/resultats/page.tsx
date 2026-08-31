import { AutoRefresh } from "@/components/auto-refresh";
import { DownloadIcon, PrintIcon, TrophyIcon } from "@/components/icons";
import { computeResults } from "@/lib/results";

export const dynamic = "force-dynamic";

/** Affiche une note ou la mention « non noté » — jamais 0 pour un candidat sans vote (§11). */
function formatScore(value: number | null) {
  return value === null ? "non noté" : value.toFixed(2).replace(".", ",");
}

/** Mention honorifique des trois premières places, comme sur un palmarès imprimé. */
const MEDALS = ["Médaille d'or", "Médaille d'argent", "Médaille de bronze"];

export default async function ResultatsPage() {
  const results = await computeResults();
  const hasVotes = results.totals.votes > 0;

  return (
    <div className="space-y-gutter">
      <AutoRefresh intervalMs={5000} />

      {/* En-tête : titre éditorial d'un côté, exports de l'autre. */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-label-sm uppercase tracking-[0.2em] text-primary">Classement final</p>
          <h1 className="mt-1 font-serif text-display-lg text-on-surface">Palmarès général</h1>
          <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
            Moyenne pondérée par votant, ramenée sur 20. Un vote du jury spécial y compte double.
          </p>
        </div>

        <div className="flex gap-3 print:hidden">
          <a
            href="/api/export/excel"
            className="flex h-touch items-center gap-2 rounded-lg border border-outline-variant px-4 text-label-lg text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary"
          >
            <DownloadIcon className="h-4 w-4" />
            Exporter en Excel
          </a>
          <a
            href="/impression"
            target="_blank"
            rel="noreferrer"
            className="gold-gradient flex h-touch items-center gap-2 rounded-lg px-4 text-label-lg transition hover:brightness-105"
          >
            <PrintIcon className="h-4 w-4" />
            Imprimer le PDF
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <span className="rounded-full border border-outline-variant/40 bg-surface-container px-4 py-1.5 text-label-sm text-on-surface-variant">
          {results.totals.votes} vote{results.totals.votes > 1 ? "s" : ""} reçu
          {results.totals.votes > 1 ? "s" : ""}
        </span>
        <span className="rounded-full border border-outline-variant/40 bg-surface-container px-4 py-1.5 text-label-sm text-on-surface-variant">
          {results.totals.candidates} candidat{results.totals.candidates > 1 ? "s" : ""}
        </span>
      </div>

      {!hasVotes ? (
        <p className="rounded-xl border border-dashed border-outline-variant p-10 text-center text-body-md text-on-surface-variant">
          Aucun vote reçu pour l&apos;instant.
        </p>
      ) : null}

      {/* Classement général */}
      <section className="overflow-hidden rounded-xl bg-surface-container gold-border">
        <div className="hidden border-b border-outline-variant/30 px-6 py-3 text-label-sm uppercase tracking-wider text-outline sm:grid sm:grid-cols-[4rem_1fr_10rem_6rem]">
          <span>Rang</span>
          <span>Candidat</span>
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
                        {formatScore(entry.finalOutOf20)}
                      </span>
                      <span className="ml-1 text-label-sm text-outline">/20</span>
                      {podium && entry.finalOutOf20 !== null ? (
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
                      Moyenne brute {formatScore(entry.averageRaw)} / {results.maxTotal}.
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
                              {formatScore(criterion.averageOutOf10)}
                              <span className="ml-1 text-label-sm text-outline">/10</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div>
                      <p className="mb-2 text-label-sm uppercase tracking-wider text-outline">
                        Par table (sur {results.maxTotal})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {entry.byTable.map((table) => (
                          <span
                            key={table.tableId}
                            className="rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-label-sm text-on-surface-variant"
                          >
                            {table.tableName}
                            {table.type === "SPECIAL" ? (
                              <span className="ml-1 text-primary">×2</span>
                            ) : null}
                            <span className="ml-2 text-on-surface">
                              {formatScore(table.averageRaw)}
                            </span>
                            <span className="ml-1 text-outline">
                              ({table.voterCount} vote{table.voterCount > 1 ? "s" : ""})
                            </span>
                          </span>
                        ))}
                      </div>
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

      {/* Récapitulatif par critère : la lecture croisée que le classement ne donne pas. */}
      {results.criteria.length > 0 && hasVotes ? (
        <section className="overflow-hidden rounded-xl bg-surface-container gold-border">
          <h2 className="border-b border-outline-variant/30 px-6 py-4 font-serif text-headline-md text-primary">
            Détail par critère (moyennes sur 10)
          </h2>

          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full text-body-md">
              <thead className="border-b border-outline-variant/30 text-left text-label-sm uppercase tracking-wider text-outline">
                <tr>
                  <th className="px-6 py-3 font-medium">Candidat</th>
                  {results.criteria.map((criterion) => (
                    <th key={criterion.id} className="px-6 py-3 font-medium">
                      {criterion.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {results.ranking.map((entry) => (
                  <tr key={entry.candidateId}>
                    <td className="px-6 py-3 text-on-surface">{entry.name}</td>
                    {entry.byCriterion.map((criterion) => (
                      <td key={criterion.criterionId} className="px-6 py-3 text-on-surface-variant">
                        {formatScore(criterion.averageOutOf10)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
