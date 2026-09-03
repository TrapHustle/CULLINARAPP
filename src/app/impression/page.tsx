import { redirect } from "next/navigation";
import { computeResults } from "@/lib/results";
import { isAuthenticated } from "@/lib/session";
import { PrintTrigger } from "./print-trigger";

export const dynamic = "force-dynamic";

function format(value: number | null, digits = 2) {
  return value === null ? "non noté" : value.toFixed(digits).replace(".", ",");
}

/**
 * Page de résultats optimisée pour l'impression.
 *
 * L'export PDF passe par l'impression du navigateur (§10.2) : pas de moteur de
 * rendu supplémentaire à embarquer, et un rendu identique à ce qui est affiché.
 */
export default async function ImpressionPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const results = await computeResults();
  const printedAt = new Date().toLocaleString("fr-FR");

  return (
    <main className="mx-auto max-w-3xl px-8 py-10 text-slate-900 print:px-0 print:py-0">
      <PrintTrigger />

      <header className="mb-8 border-b border-slate-300 pb-4">
        <h1 className="text-2xl font-bold">Concours culinaire — Résultats</h1>
        <p className="mt-1 text-sm text-slate-500">Document généré le {printedAt}</p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Classement général</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400 text-left">
              <th className="py-2 pr-3">Rang</th>
              <th className="py-2 pr-3">Candidat</th>
              <th className="py-2 pr-3">Note finale /{results.maxTotal}</th>
              <th className="py-2 pr-3">Jury spécial /{results.maxTotal}</th>
              <th className="py-2 pr-3">Public /{results.maxTotal}</th>
              <th className="py-2">Votants</th>
            </tr>
          </thead>
          <tbody>
            {results.ranking.map((entry) => (
              <tr key={entry.candidateId} className="border-b border-slate-200">
                <td className="py-2 pr-3 font-semibold">{entry.rank ?? "—"}</td>
                <td className="py-2 pr-3">{entry.name}</td>
                <td className="py-2 pr-3 font-semibold">{format(entry.finalScore)}</td>
                <td className="py-2 pr-3">{format(entry.specialScore)}</td>
                <td className="py-2 pr-3">{format(entry.publicScore)}</td>
                <td className="py-2">{entry.voterCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Moyenne pondérée par votant ; un vote du jury spécial compte double.
        </p>
      </section>

      {results.criteria.length > 0 ? (
        <section className="mb-10 break-inside-avoid">
          <h2 className="mb-3 text-lg font-semibold">Détail par critère (sur {results.scoreMax})</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-400 text-left">
                <th className="py-2 pr-3">Candidat</th>
                {results.criteria.map((criterion) => (
                  <th key={criterion.id} className="py-2 pr-3">
                    {criterion.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.ranking.map((entry) => (
                <tr key={entry.candidateId} className="border-b border-slate-200">
                  <td className="py-2 pr-3">{entry.name}</td>
                  {entry.byCriterion.map((criterion) => (
                    <td key={criterion.criterionId} className="py-2 pr-3">
                      {format(criterion.averageOutOf5)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="break-inside-avoid">
        <h2 className="mb-3 text-lg font-semibold">Détail par table (sur {results.maxTotal})</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400 text-left">
              <th className="py-2 pr-3">Candidat</th>
              <th className="py-2 pr-3">Table</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Moyenne</th>
              <th className="py-2">Votes</th>
            </tr>
          </thead>
          <tbody>
            {results.ranking.flatMap((entry) =>
              entry.byTable.map((table) => (
                <tr key={`${entry.candidateId}-${table.tableId}`} className="border-b border-slate-200">
                  <td className="py-2 pr-3">{entry.name}</td>
                  <td className="py-2 pr-3">{table.tableName}</td>
                  <td className="py-2 pr-3">{table.type === "SPECIAL" ? "Spécial ×2" : "Lambda"}</td>
                  <td className="py-2 pr-3">{format(table.averageRaw)}</td>
                  <td className="py-2">{table.voterCount}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
