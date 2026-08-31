import { AutoRefresh } from "@/components/auto-refresh";
import { computeResults } from "@/lib/results";

export const dynamic = "force-dynamic";

/** Affiche une note ou la mention « non noté » — jamais 0 pour un candidat sans vote (§11). */
function formatScore(value: number | null, suffix: string) {
  return value === null ? (
    <span className="text-slate-400">non noté</span>
  ) : (
    <>
      {value.toFixed(2).replace(".", ",")}
      <span className="text-slate-400">{suffix}</span>
    </>
  );
}

export default async function ResultatsPage() {
  const results = await computeResults();
  const hasVotes = results.totals.votes > 0;

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={5000} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Résultats</h1>
          <p className="mt-1 text-sm text-slate-500">
            Moyenne pondérée par votant, sur 20. Un candidat noté par 18 personnes n&apos;est ni
            avantagé ni désavantagé face à un candidat noté par 13.
          </p>
        </div>

        <div className="flex gap-2 print:hidden">
          <a
            href="/api/export/excel"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Export Excel
          </a>
          <a
            href="/impression"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Export PDF
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          {results.totals.votes} vote{results.totals.votes > 1 ? "s" : ""} reçu
          {results.totals.votes > 1 ? "s" : ""}
        </span>
        <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          {results.totals.candidates} candidats
        </span>
        <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          Total d&apos;un vote : {results.maxTotal} points
        </span>
      </div>

      {!hasVotes ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Aucun vote reçu pour l&apos;instant.
        </p>
      ) : null}

      {/* Classement général */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Classement général
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Rang</th>
                <th className="px-4 py-3 font-medium">Candidat</th>
                <th className="px-4 py-3 font-medium">Note /20</th>
                <th className="px-4 py-3 font-medium">Moyenne /{results.maxTotal}</th>
                <th className="px-4 py-3 font-medium">Votants</th>
                <th className="px-4 py-3 font-medium">Poids total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.ranking.map((entry) => (
                <tr key={entry.candidateId} className={entry.rank === 1 ? "bg-amber-50" : undefined}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{entry.rank ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{entry.name}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatScore(entry.finalOutOf20, " /20")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatScore(entry.averageRaw, ` /${results.maxTotal}`)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{entry.voterCount}</td>
                  <td className="px-4 py-3 text-slate-600">{entry.weightTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          « Poids total » est le diviseur réel de la moyenne : un vote du jury spécial y compte pour
          2.
        </p>
      </section>

      {/* Détail par critère */}
      {results.criteria.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Détail par critère (moyennes sur 10)
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Candidat</th>
                  {results.criteria.map((criterion) => (
                    <th key={criterion.id} className="px-4 py-3 font-medium">
                      {criterion.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.ranking.map((entry) => (
                  <tr key={entry.candidateId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{entry.name}</td>
                    {entry.byCriterion.map((criterion) => (
                      <td key={criterion.criterionId} className="px-4 py-3 text-slate-600">
                        {formatScore(criterion.averageOutOf10, " /10")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Détail par table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Détail par table (moyennes sur {results.maxTotal})
        </h2>

        <div className="space-y-4">
          {results.ranking.map((entry) => (
            <div key={entry.candidateId} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-medium text-slate-900">{entry.name}</h3>
              <div className="flex flex-wrap gap-2">
                {entry.byTable.map((table) => (
                  <div
                    key={table.tableId}
                    className="rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200"
                  >
                    <span className="text-slate-600">{table.tableName}</span>
                    {table.type === "SPECIAL" ? (
                      <span className="ml-1 text-xs text-amber-700">×2</span>
                    ) : null}
                    <span className="ml-2 font-medium text-slate-900">
                      {formatScore(table.averageRaw, "")}
                    </span>
                    <span className="ml-1 text-xs text-slate-400">
                      ({table.voterCount} vote{table.voterCount > 1 ? "s" : ""})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
