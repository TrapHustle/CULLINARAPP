import { AutoRefresh } from "@/components/auto-refresh";
import { closeVotingAction, openVotingAction, updateTimerAction } from "@/lib/actions";
import { getOrCreateSession, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PilotagePage() {
  const session = await getOrCreateSession();

  const [candidates, tables] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.votingTable.findMany({ orderBy: { name: "asc" } }),
  ]);

  const activeCandidate = session.activeCandidateId
    ? candidates.find((candidate) => candidate.id === session.activeCandidateId)
    : undefined;

  // Avancement des tables pour le candidat en cours.
  const [validations, voteCounts] = activeCandidate
    ? await Promise.all([
        prisma.tableValidation.findMany({ where: { candidateId: activeCandidate.id } }),
        prisma.vote.groupBy({
          by: ["tableId"],
          where: { candidateId: activeCandidate.id },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const validatedTableIds = new Set(validations.map((validation) => validation.tableId));
  const votesByTable = new Map(voteCounts.map((row) => [row.tableId, row._count._all]));

  return (
    <div className="space-y-8">
      <AutoRefresh />

      <div>
        <h1 className="text-xl font-semibold">Pilotage des votes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ouvrez les votes candidat par candidat. Toutes les tables votent pour le même candidat au
          même moment.
        </p>
      </div>

      {/* État courant */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              session.votingOpen ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {session.votingOpen ? "Votes ouverts" : "Votes fermés"}
          </span>

          <span className="text-sm text-slate-600">
            {activeCandidate ? (
              <>
                Candidat en cours : <strong className="text-slate-900">{activeCandidate.name}</strong>
              </>
            ) : (
              "Aucun candidat sélectionné"
            )}
          </span>

          {session.votingOpen ? (
            <form action={closeVotingAction} className="ml-auto">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Fermer les votes
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {/* Candidats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Candidats
        </h2>

        {candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Aucun candidat. Ajoutez-en depuis la page Configuration.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {candidates.map((candidate) => {
              const isActive = candidate.id === session.activeCandidateId;
              return (
                <li
                  key={candidate.id}
                  className={`flex items-center gap-3 rounded-xl border bg-white p-4 ${
                    isActive ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{candidate.name}</p>
                    <p className="text-xs text-slate-500">
                      {candidate.openedAt
                        ? `Ouvert le ${candidate.openedAt.toLocaleString("fr-FR")}`
                        : "Jamais ouvert"}
                    </p>
                  </div>

                  <form action={openVotingAction}>
                    <input type="hidden" name="candidateId" value={candidate.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                    >
                      {isActive && session.votingOpen ? "Rouvrir" : "Ouvrir les votes"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Avancement des tables */}
      {activeCandidate ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Avancement pour {activeCandidate.name}
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Table</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Votes reçus</th>
                  <th className="px-4 py-3 font-medium">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tables.map((table) => {
                  const received = votesByTable.get(table.id) ?? 0;
                  const validated = validatedTableIds.has(table.id);
                  return (
                    <tr key={table.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{table.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {table.type === "SPECIAL" ? "Jury spécial (×2)" : "Lambda"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {received} / {table.expectedJurors}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            validated
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {validated ? "Validée" : "En attente"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Chronomètre */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Chronomètre
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          À l&apos;expiration, le vote en cours est soumis automatiquement sur la tablette avec les
          notes déjà sélectionnées.
        </p>

        <form action={updateTimerAction} className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="timerEnabled"
              defaultChecked={session.timerEnabled}
              className="h-4 w-4 rounded border-slate-300"
            />
            Activer le chronomètre
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Durée (secondes)</span>
            <input
              type="number"
              name="timerSeconds"
              min={5}
              max={600}
              defaultValue={session.timerSeconds}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Enregistrer
          </button>
        </form>
      </section>
    </div>
  );
}
