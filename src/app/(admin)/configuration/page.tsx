import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { ChefHatIcon, ClocheIcon, SlidersIcon, TimerIcon, WarningIcon } from "@/components/icons";
import { CandidatePhoto } from "@/components/candidate-photo";
import { DangerZone } from "@/components/danger-zone";
import { RowEditor } from "@/components/row-editor";
import {
  createCandidateAction,
  createCriterionAction,
  createTableAction,
  deleteCandidateAction,
  deleteCriterionAction,
  deleteTableAction,
  releaseAllTablesAction,
  removeCandidatePhotoAction,
  resetEventAction,
  resetVotesAction,
  updateCandidateAction,
  updateCriterionAction,
  updateTableAction,
  updateTimerAction,
  uploadCandidatePhotoAction,
} from "@/lib/actions";
import { getOrCreateSession, prisma } from "@/lib/prisma";
import { maxTotalForCriteria } from "@/lib/scoring";
import {
  ACCEPTED_IMAGE_TYPES,
  RELEASE_TABLES_CONFIRMATION,
  RESET_CONFIRMATION,
  RESET_EVENT_CONFIRMATION,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  const [candidates, tables, criteria, voteCount, session] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.votingTable.findMany({ orderBy: { name: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
    prisma.vote.count(),
    getOrCreateSession(),
  ]);

  const sections = [
    { href: "#candidats", label: "Candidats", count: candidates.length, Icon: ChefHatIcon },
    { href: "#tables", label: "Tables", count: tables.length, Icon: ClocheIcon },
    { href: "#criteres", label: "Critères", count: criteria.length, Icon: SlidersIcon },
    { href: "#remise-a-zero", label: "Zone dangereuse", count: voteCount, Icon: WarningIcon },
  ];

  return (
    <div className="space-y-gutter">
      <div>
        <p className="text-label-sm uppercase tracking-[0.2em] text-primary">Avant l&apos;événement</p>
        <h1 className="mt-1 font-serif text-display-lg text-on-surface">Configuration</h1>
        <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
          Structure du concours et paramètres d&apos;évaluation.
        </p>
      </div>

      <div className="grid gap-gutter lg:grid-cols-12">
        {/* Sommaire latéral : les trois blocs à préparer, et où on en est. */}
        <nav className="lg:col-span-3">
          <ul className="sticky top-24 space-y-1 rounded-xl bg-surface-container p-2 gold-border">
            {sections.map(({ href, label, count, Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  className="flex h-touch items-center gap-3 rounded-lg px-3 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-high hover:text-primary"
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{label}</span>
                  <span className="text-label-sm text-outline">{count}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-gutter lg:col-span-9">
          {/* Candidats */}
          <section id="candidats" className="scroll-mt-24 rounded-xl bg-surface-container gold-border">
            <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
              <ChefHatIcon className="h-5 w-5 text-primary" />
              <h2 className="flex-1 font-serif text-headline-md text-primary">Candidats</h2>
              <span className="text-label-sm text-outline">{candidates.length}</span>
            </div>

            <p className="px-5 pt-4 text-label-sm text-on-surface-variant">
              Cliquez une vignette pour ajouter ou remplacer un portrait (JPEG, PNG ou WebP).
            </p>

            <ul className="divide-y divide-outline-variant/20 px-5">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="flex items-center gap-3 py-3">
                  <CandidatePhoto
                    candidateId={candidate.id}
                    name={candidate.name}
                    photoUrl={candidate.photoUrl}
                    uploadAction={uploadCandidatePhotoAction}
                    removeAction={removeCandidatePhotoAction}
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  />
                  <RowEditor
                    action={updateCandidateAction}
                    id={candidate.id}
                    editLabel={`Modifier « ${candidate.name} »`}
                    fields={[
                      {
                        kind: "text",
                        name: "name",
                        label: "Nom",
                        required: true,
                        defaultValue: candidate.name,
                      },
                      {
                        kind: "number",
                        name: "order",
                        label: "Ordre",
                        defaultValue: candidate.order,
                        min: 0,
                      },
                    ]}
                  >
                    <span className="w-8 text-label-sm text-outline">#{candidate.order}</span>
                    <span className="flex-1 text-body-md text-on-surface">{candidate.name}</span>
                    {candidate.openedAt ? (
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-label-sm text-primary">
                        déjà ouvert
                      </span>
                    ) : null}
                  </RowEditor>
                  <DeleteButton
                    action={deleteCandidateAction}
                    id={candidate.id}
                    confirmMessage={`Supprimer « ${candidate.name} » ? Tous ses votes seront également effacés.`}
                  />
                </li>
              ))}
              {candidates.length === 0 ? (
                <li className="py-3 text-label-sm text-on-surface-variant">
                  Aucun candidat pour le moment.
                </li>
              ) : null}
            </ul>

            <div className="border-t border-outline-variant/30 px-5 py-4">
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
            </div>
          </section>

          <div className="grid gap-gutter xl:grid-cols-2">
            {/* Tables */}
            <section id="tables" className="scroll-mt-24 rounded-xl bg-surface-container gold-border">
              <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
                <ClocheIcon className="h-5 w-5 text-primary" />
                <h2 className="flex-1 font-serif text-headline-md text-primary">Tables</h2>
                <span className="text-label-sm text-outline">{tables.length}</span>
              </div>

              <p className="px-5 pt-4 text-label-sm text-on-surface-variant">
                « Jury spécial » = votes comptés double.
              </p>

              <ul className="divide-y divide-outline-variant/20 px-5">
                {tables.map((table) => (
                  <li key={table.id} className="flex items-center gap-3 py-3">
                    <RowEditor
                      action={updateTableAction}
                      id={table.id}
                      editLabel={`Modifier « ${table.name} »`}
                      fields={[
                        {
                          kind: "text",
                          name: "name",
                          label: "Nom",
                          required: true,
                          defaultValue: table.name,
                        },
                        {
                          kind: "select",
                          name: "type",
                          label: "Type",
                          defaultValue: table.type,
                          options: [
                            { value: "LAMBDA", label: "Lambda" },
                            { value: "SPECIAL", label: "Jury spécial (×2)" },
                          ],
                        },
                        {
                          kind: "number",
                          name: "expectedJurors",
                          label: "Jurés",
                          defaultValue: table.expectedJurors,
                          min: 1,
                        },
                      ]}
                    >
                      <span className="flex-1 text-body-md text-on-surface">{table.name}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-label-sm ${
                          table.type === "SPECIAL"
                            ? "bg-primary/15 text-primary"
                            : "bg-surface-high text-on-surface-variant"
                        }`}
                      >
                        {table.type === "SPECIAL" ? "Jury spécial ×2" : "Lambda"}
                      </span>
                      <span className="text-label-sm text-outline">
                        {table.expectedJurors} juré{table.expectedJurors > 1 ? "s" : ""}
                      </span>
                    </RowEditor>
                    <DeleteButton
                      action={deleteTableAction}
                      id={table.id}
                      confirmMessage={`Supprimer « ${table.name} » ? Tous ses votes seront également effacés.`}
                    />
                  </li>
                ))}
                {tables.length === 0 ? (
                  <li className="py-3 text-label-sm text-on-surface-variant">
                    Aucune table pour le moment.
                  </li>
                ) : null}
              </ul>

              <div className="border-t border-outline-variant/30 px-5 py-4">
                <ActionForm
                  action={createTableAction}
                  submitLabel="Ajouter la table"
                  fields={[
                    {
                      kind: "text",
                      name: "name",
                      label: "Nom",
                      required: true,
                      placeholder: "Table 4",
                    },
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
              </div>
            </section>

            {/* Critères */}
            <section id="criteres" className="scroll-mt-24 rounded-xl bg-surface-container gold-border">
              <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
                <SlidersIcon className="h-5 w-5 text-primary" />
                <h2 className="flex-1 font-serif text-headline-md text-primary">Critères</h2>
                <span className="text-label-sm text-outline">{criteria.length}</span>
              </div>

              <p className="px-5 pt-4 text-label-sm text-on-surface-variant">
                Noté de 1 à 5 (×2 → /10). Total d&apos;un vote :{" "}
                <strong className="text-primary">{maxTotalForCriteria(criteria.length)} points</strong>.
              </p>

              <ul className="divide-y divide-outline-variant/20 px-5">
                {criteria.map((criterion) => (
                  <li key={criterion.id} className="flex items-center gap-3 py-3">
                    <RowEditor
                      action={updateCriterionAction}
                      id={criterion.id}
                      editLabel={`Modifier « ${criterion.name} »`}
                      fields={[
                        {
                          kind: "text",
                          name: "name",
                          label: "Nom",
                          required: true,
                          defaultValue: criterion.name,
                        },
                        {
                          kind: "number",
                          name: "order",
                          label: "Ordre",
                          defaultValue: criterion.order,
                          min: 0,
                        },
                      ]}
                    >
                      <span className="w-8 text-label-sm text-outline">#{criterion.order}</span>
                      <span className="flex-1 text-body-md text-on-surface">{criterion.name}</span>
                    </RowEditor>
                    <DeleteButton
                      action={deleteCriterionAction}
                      id={criterion.id}
                      confirmMessage={`Supprimer le critère « ${criterion.name} » ? Les notes déjà saisies sur ce critère seront effacées.`}
                    />
                  </li>
                ))}
                {criteria.length === 0 ? (
                  <li className="py-3 text-label-sm text-on-surface-variant">
                    Aucun critère pour le moment.
                  </li>
                ) : null}
              </ul>

              <div className="border-t border-outline-variant/30 px-5 py-4">
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
              </div>
            </section>
          </div>

          {/* Chronomètre — un réglage d'avant l'événement, déplacé ici depuis le
              Pilotage : pendant un vote on surveille l'avancement des tables,
              pas une durée qu'on ne touche plus. */}
          <section className="rounded-xl bg-surface-container p-5 gold-border">
            <h2 className="mb-1 flex items-center gap-2 font-serif text-headline-md text-primary">
              <TimerIcon className="h-5 w-5" />
              Chronomètre
            </h2>
            <p className="mb-4 text-label-sm text-on-surface-variant">
              Durée accordée à chaque juré. Le décompte s&apos;égrène sur la tablette, pas sur le
              serveur : une coupure réseau ne l&apos;interrompt pas.
            </p>

            <form action={updateTimerAction} className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 text-body-md text-on-surface-variant">
                <input
                  type="checkbox"
                  name="timerEnabled"
                  defaultChecked={session.timerEnabled}
                  className="h-4 w-4 rounded border-outline-variant accent-[color:var(--gold)]"
                />
                Activer le chronomètre
              </label>

              <label className="text-label-sm text-on-surface-variant">
                <span className="mb-1 block">Durée (secondes)</span>
                <input
                  type="number"
                  name="timerSeconds"
                  min={5}
                  max={600}
                  defaultValue={session.timerSeconds}
                  className="w-28 rounded-lg border border-outline-variant/60 px-3 py-2 text-body-md"
                />
              </label>

              <button
                type="submit"
                className="h-touch rounded-lg border border-primary/40 px-4 text-label-lg text-primary transition-colors hover:bg-primary/5"
              >
                Enregistrer
              </button>
            </form>
          </section>

          {/* Zone dangereuse, volontairement en dernier : on ne la croise qu'en
              descendant toute la page, jamais en la survolant. */}
          <section id="remise-a-zero" className="scroll-mt-24">
            <DangerZone
              releaseTablesAction={releaseAllTablesAction}
              releaseTablesWord={RELEASE_TABLES_CONFIRMATION}
              assignedCount={tables.filter((table) => table.assignedDeviceId).length}
              resetVotesAction={resetVotesAction}
              resetVotesWord={RESET_CONFIRMATION}
              resetEventAction={resetEventAction}
              resetEventWord={RESET_EVENT_CONFIRMATION}
              voteCount={voteCount}
              candidateCount={candidates.length}
              tableCount={tables.length}
              criterionCount={criteria.length}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
