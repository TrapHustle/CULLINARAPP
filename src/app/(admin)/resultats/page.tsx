import { AutoRefresh } from "@/components/auto-refresh";
import { DownloadIcon, PrintIcon } from "@/components/icons";
import { RankingTable } from "@/components/ranking-table";
import { computeResults } from "@/lib/results";

export const dynamic = "force-dynamic";

/** Affiche une note ou la mention « non noté » — jamais 0 pour un candidat sans vote (§11). */
function formatScore(value: number | null) {
  return value === null ? "non noté" : value.toFixed(2).replace(".", ",");
}

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
            Moyenne pondérée par votant, sur {results.maxTotal}. Un vote du jury spécial y compte
            double.
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

      {/* Classement général, avec des onglets pour lire la note finale, celle
          du jury spécial, ou celle du public. */}
      <RankingTable results={results} />

      {/* Récapitulatif par critère : la lecture croisée que le classement ne donne pas. */}
      {results.criteria.length > 0 && hasVotes ? (
        <section className="overflow-hidden rounded-xl bg-surface-container gold-border">
          <h2 className="border-b border-outline-variant/30 px-6 py-4 font-serif text-headline-md text-primary">
            Détail par critère (moyennes sur {results.scoreMax})
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
                        {formatScore(criterion.averageOutOf5)}
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
