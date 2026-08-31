import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import {
  createCandidateAction,
  createCriterionAction,
  createTableAction,
  deleteCandidateAction,
  deleteCriterionAction,
  deleteTableAction,
} from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { maxTotalForCriteria } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  const [candidates, tables, criteria] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.votingTable.findMany({ orderBy: { name: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <p className="mt-1 text-sm text-slate-500">À préparer avant l&apos;événement.</p>
      </div>

      {/* Candidats */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">Candidats ({candidates.length})</h2>

        <ul className="mb-5 divide-y divide-slate-100">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="flex items-center gap-3 py-2.5">
              <span className="w-8 text-sm text-slate-400">#{candidate.order}</span>
              <span className="flex-1 font-medium text-slate-900">{candidate.name}</span>
              {candidate.openedAt ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  déjà ouvert
                </span>
              ) : null}
              <DeleteButton
                action={deleteCandidateAction}
                id={candidate.id}
                confirmMessage={`Supprimer « ${candidate.name} » ? Tous ses votes seront également effacés.`}
              />
            </li>
          ))}
          {candidates.length === 0 ? (
            <li className="py-2.5 text-sm text-slate-500">Aucun candidat pour le moment.</li>
          ) : null}
        </ul>

        <ActionForm
          action={createCandidateAction}
          submitLabel="Ajouter le candidat"
          fields={[
            { kind: "text", name: "name", label: "Nom", required: true, placeholder: "Chef…" },
            {
              kind: "number",
              name: "order",
              label: "Ordre",
              defaultValue: candidates.length + 1,
              min: 0,
            },
          ]}
        />
      </section>

      {/* Tables */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">Tables ({tables.length})</h2>
        <p className="mb-4 text-sm text-slate-500">« Jury spécial » = votes comptés double.</p>

        <ul className="mb-5 divide-y divide-slate-100">
          {tables.map((table) => (
            <li key={table.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 font-medium text-slate-900">{table.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  table.type === "SPECIAL"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {table.type === "SPECIAL" ? "Jury spécial ×2" : "Lambda"}
              </span>
              <span className="text-sm text-slate-500">
                {table.expectedJurors} juré{table.expectedJurors > 1 ? "s" : ""}
              </span>
              <DeleteButton
                action={deleteTableAction}
                id={table.id}
                confirmMessage={`Supprimer « ${table.name} » ? Tous ses votes seront également effacés.`}
              />
            </li>
          ))}
          {tables.length === 0 ? (
            <li className="py-2.5 text-sm text-slate-500">Aucune table pour le moment.</li>
          ) : null}
        </ul>

        <ActionForm
          action={createTableAction}
          submitLabel="Ajouter la table"
          fields={[
            { kind: "text", name: "name", label: "Nom", required: true, placeholder: "Table 4" },
            {
              kind: "select",
              name: "type",
              label: "Type",
              options: [
                { value: "LAMBDA", label: "Lambda" },
                { value: "SPECIAL", label: "Jury spécial (×2)" },
              ],
            },
            { kind: "number", name: "expectedJurors", label: "Jurés", defaultValue: 5, min: 1 },
          ]}
        />
      </section>

      {/* Critères */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">Critères ({criteria.length})</h2>
        <p className="mb-4 text-sm text-slate-500">
          Noté de 1 à 5 (×2 → /10). Total d&apos;un vote :{" "}
          <strong>{maxTotalForCriteria(criteria.length)} points</strong>.
        </p>

        <ul className="mb-5 divide-y divide-slate-100">
          {criteria.map((criterion) => (
            <li key={criterion.id} className="flex items-center gap-3 py-2.5">
              <span className="w-8 text-sm text-slate-400">#{criterion.order}</span>
              <span className="flex-1 font-medium text-slate-900">{criterion.name}</span>
              <DeleteButton
                action={deleteCriterionAction}
                id={criterion.id}
                confirmMessage={`Supprimer le critère « ${criterion.name} » ? Les notes déjà saisies sur ce critère seront effacées.`}
              />
            </li>
          ))}
          {criteria.length === 0 ? (
            <li className="py-2.5 text-sm text-slate-500">Aucun critère pour le moment.</li>
          ) : null}
        </ul>

        <ActionForm
          action={createCriterionAction}
          submitLabel="Ajouter le critère"
          fields={[
            { kind: "text", name: "name", label: "Nom", required: true, placeholder: "Goût" },
            {
              kind: "number",
              name: "order",
              label: "Ordre",
              defaultValue: criteria.length + 1,
              min: 0,
            },
          ]}
        />
      </section>
    </div>
  );
}
