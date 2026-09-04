import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/components/confirm-button";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  DotIcon,
  HourglassIcon,
  StopIcon,
  UnlockIcon,
  VoteIcon,
  WarningIcon,
} from "@/components/icons";
import {
  closeAndAdvanceAction,
  closeVotingAction,
  devalidateTableAction,
  openAllVotingAction,
  openVotingAction,
} from "@/lib/actions";
import { getOrCreateSession, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PilotagePage() {
  const session = await getOrCreateSession();

  const [candidates, tables] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.votingTable.findMany({ orderBy: { name: "asc" } }),
  ]);

  /** Vrai dès qu'une des deux catégories attend tous les candidats ouverts. */
  const byJuror =
    session.voteModePublic === "BY_JUROR" || session.voteModeSpecial === "BY_JUROR";

  const activeIndex = session.activeCandidateId
    ? candidates.findIndex((candidate) => candidate.id === session.activeCandidateId)
    : -1;
  const activeCandidate = activeIndex >= 0 ? candidates[activeIndex] : undefined;
  const nextCandidate = activeIndex >= 0 ? candidates[activeIndex + 1] : candidates[0];

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

  const validatedCount = tables.filter((table) => validatedTableIds.has(table.id)).length;
  // Tables restant à valider pour le candidat en cours : c'est ce qu'il faut
  // savoir avant de clore, et la seule chose qui puisse faire hésiter.
  const pendingTables = activeCandidate
    ? tables.filter((table) => !validatedTableIds.has(table.id))
    : [];
  const progress = tables.length > 0 ? Math.round((validatedCount / tables.length) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
      <AutoRefresh />

      {/* ---- Colonne 1 : les candidats, dans l'ordre de passage ---- */}
      <section className="flex flex-col overflow-hidden rounded-xl bg-surface-container gold-border lg:col-span-3">
        <div className="border-b border-outline-variant/30 p-4">
          <h1 className="font-serif text-headline-md text-primary">Candidats</h1>
          <p className="mt-0.5 text-label-sm text-on-surface-variant">
            {byJuror
              ? "Un déroulé « juré après juré » est actif : ouvrez tous les votes."
              : "Ouvrez les votes candidat par candidat."}
          </p>

          {/* Ouvrir tout d'un coup : ce que suppose le déroulé « juré après
              juré », où chaque juré parcourt l'ensemble des candidats. Reste
              accessible dans l'autre déroulé — l'organisateur peut avoir ses
              raisons — mais n'y est pas mis en avant. */}
          {candidates.length > 0 ? (
            <div className="mt-3">
              <ConfirmButton
                action={openAllVotingAction}
                values={{}}
                label="Ouvrir tous les votes"
                confirmMessage={
                  `Ouvrir les votes pour les ${candidates.length} candidats en même temps ?\n\n` +
                  "Aucun candidat ne sera plus « en cours » : les tablettes laisseront " +
                  "chaque juré les parcourir tous."
                }
                icon={<VoteIcon className="h-4 w-4" />}
                className={
                  byJuror
                    ? "gold-gradient flex h-touch w-full items-center justify-center gap-2 rounded-lg text-label-lg transition hover:brightness-105"
                    : "flex h-touch w-full items-center justify-center gap-2 rounded-lg border border-primary/40 text-label-lg text-primary transition-colors hover:bg-primary/5"
                }
              />
            </div>
          ) : null}
        </div>

        <div className="custom-scrollbar max-h-[70vh] flex-1 space-y-2 overflow-y-auto p-2">
          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-outline-variant p-6 text-label-sm text-on-surface-variant">
              Aucun candidat. Ajoutez-en depuis la page Configuration.
            </p>
          ) : null}

          {candidates.map((candidate) => {
            const isActive = candidate.id === session.activeCandidateId;
            return (
              <div
                key={candidate.id}
                className={
                  isActive
                    ? "relative overflow-hidden rounded-lg bg-surface-highest p-3 gold-border-active"
                    : "rounded-lg border border-outline-variant/30 bg-surface p-3 transition-colors hover:border-primary/30"
                }
              >
                {isActive ? (
                  <span className="absolute right-0 top-0 rounded-bl-lg bg-primary/20 px-2 py-1 text-label-sm text-primary">
                    Actif
                  </span>
                ) : null}

                <div className="mb-3 pr-12">
                  <p
                    className={`truncate text-body-lg leading-tight ${
                      isActive ? "text-on-surface" : "text-on-surface-variant"
                    }`}
                  >
                    {candidate.name}
                  </p>
                  <p className="text-label-sm text-outline">
                    {candidate.openedAt
                      ? `Ouvert le ${candidate.openedAt.toLocaleString("fr-FR")}`
                      : "Jamais ouvert"}
                  </p>
                </div>

                <form action={openVotingAction}>
                  <input type="hidden" name="candidateId" value={candidate.id} />
                  <button
                    type="submit"
                    className={
                      isActive && session.votingOpen
                        ? "gold-gradient flex h-touch w-full items-center justify-center gap-2 rounded-lg text-label-lg transition hover:brightness-105"
                        : "flex h-touch w-full items-center justify-center gap-2 rounded-lg border border-primary/40 text-label-lg text-primary transition-colors hover:bg-primary/5"
                    }
                  >
                    <VoteIcon className="h-4 w-4" />
                    {isActive && session.votingOpen ? "Votes ouverts" : "Ouvrir les votes"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Colonne 2 : l'état en direct et les actions de tour ---- */}
      <section className="flex flex-col gap-gutter lg:col-span-5">
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-xl bg-surface-container p-6 py-12 gold-border">
          <div aria-hidden className="gold-halo pointer-events-none absolute inset-0" />

          {session.votingOpen ? (
            <span className="mb-6 flex items-center gap-2 rounded-full border border-error/30 bg-error-container/20 px-4 py-1.5 text-label-lg uppercase tracking-wider text-error">
              <DotIcon className="h-3 w-3 animate-pulse" />
              Direct — vote en cours
            </span>
          ) : (
            <span className="mb-6 flex items-center gap-2 rounded-full border border-outline-variant px-4 py-1.5 text-label-lg uppercase tracking-wider text-on-surface-variant">
              <DotIcon className="h-3 w-3" />
              Votes fermés
            </span>
          )}

          {/* Sans candidat en cours mais scrutin ouvert, on est en « juré après
              juré » : afficher « aucun candidat sélectionné » se lirait comme
              une panne alors que la salle vote. */}
          <h2 className="text-center font-serif text-headline-lg text-on-surface">
            {activeCandidate
              ? activeCandidate.name
              : session.votingOpen
                ? `Tous les candidats (${candidates.length})`
                : "Aucun candidat sélectionné"}
          </h2>
          <p className="mt-2 text-body-md text-on-surface-variant">
            {activeCandidate
              ? "Candidat en cours d'évaluation"
              : session.votingOpen
                ? "Chaque juré les parcourt tous, à son rythme"
                : "Ouvrez les votes d'un candidat pour démarrer"}
          </p>

          {/* Le chronomètre a quitté cet écran : c'est un réglage d'avant
              l'événement, pas une information à surveiller pendant un vote. Il
              vit désormais dans Configuration. La place revient à l'avancement,
              qui est la seule chose qu'on regarde vraiment ici. */}

          {/* Avancement réel : tables ayant validé pour ce candidat. */}
          <div className="relative mt-12 w-full max-w-md">
            <div className="mb-2 flex justify-between text-label-sm text-on-surface-variant">
              <span>Progression du vote</span>
              <span>
                {validatedCount}/{tables.length} tables validées
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-highest">
              <div className="gold-gradient h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Actions de fin de tour */}
        <div className="flex flex-col gap-3">
          {/* Averti sans bloquer : une table peut être absente ou sa tablette en
              panne, et il faut pouvoir avancer quand même. Les nommer évite
              d'avoir à comparer soi-même la liste des cartes. */}
          {activeCandidate && pendingTables.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/10 px-3 py-2 text-label-sm text-error">
              <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {pendingTables.length === 1
                  ? `${pendingTables[0].name} n'a pas encore validé.`
                  : `${pendingTables.length} tables n'ont pas encore validé : ${pendingTables
                      .map((table) => table.name)
                      .join(", ")}.`}
              </span>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {activeCandidate ? (
              <form action={closeAndAdvanceAction} className="flex-1">
                <button
                  type="submit"
                  className="gold-gradient flex h-touch w-full items-center justify-center gap-2 rounded-lg text-label-lg transition hover:brightness-105"
                >
                  {nextCandidate ? "Clore et passer au suivant" : "Clore le dernier candidat"}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </form>
            ) : nextCandidate ? (
              <form action={openVotingAction} className="flex-1">
                <input type="hidden" name="candidateId" value={nextCandidate.id} />
                <button
                  type="submit"
                  className="gold-gradient flex h-touch w-full items-center justify-center gap-2 rounded-lg text-label-lg transition hover:brightness-105"
                >
                  Ouvrir le premier candidat
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </form>
            ) : null}

            {session.votingOpen ? (
              <form action={closeVotingAction}>
                <button
                  type="submit"
                  title="Ferme les votes sans changer de candidat"
                  className="flex h-touch items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 text-label-lg text-on-surface-variant transition-colors hover:border-error/50 hover:text-error"
                >
                  <StopIcon className="h-4 w-4" />
                  Suspendre
                </button>
              </form>
            ) : null}
          </div>
        </div>

      </section>

      {/* ---- Colonne 3 : l'état des tables ---- */}
      <section className="flex flex-col overflow-hidden rounded-xl bg-surface-container gold-border lg:col-span-4">
        <div className="flex items-center justify-between border-b border-outline-variant/30 p-4">
          <h2 className="font-serif text-headline-md text-primary">Tables</h2>
          <div className="flex gap-4 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-success" />
              Validé
            </span>
            <span className="flex items-center gap-1.5">
              <HourglassIcon className="h-4 w-4 text-outline" />
              En attente
            </span>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[70vh] flex-1 overflow-y-auto p-3">
          {tables.length === 0 ? (
            <p className="rounded-lg border border-dashed border-outline-variant p-6 text-label-sm text-on-surface-variant">
              Aucune table. Ajoutez-en depuis la page Configuration.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {tables.map((table) => {
                const received = votesByTable.get(table.id) ?? 0;
                const validated = validatedTableIds.has(table.id);
                const special = table.type === "SPECIAL";
                return (
                  <li
                    key={table.id}
                    className={`relative rounded-lg p-3 ${
                      special
                        ? "bg-surface-high gold-border-active"
                        : "border border-outline-variant/30 bg-surface"
                    }`}
                  >
                    {special ? (
                      <span className="absolute -top-2 left-3 rounded-full bg-primary px-1.5 text-label-sm text-on-primary">
                        ×2
                      </span>
                    ) : null}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`truncate text-body-md ${
                            special ? "text-primary" : "text-on-surface"
                          }`}
                        >
                          {table.name}
                        </p>
                        <p className="text-label-sm text-outline">
                          {special ? "Jury spécial" : "Table lambda"}
                        </p>
                      </div>
                      {validated ? (
                        <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <HourglassIcon className="h-5 w-5 shrink-0 text-outline" />
                      )}
                    </div>

                    <p className="mt-2 text-label-sm text-on-surface-variant">
                      {received} / {table.expectedJurors} vote
                      {table.expectedJurors > 1 ? "s" : ""} reçu{received > 1 ? "s" : ""}
                    </p>

                    {/* Rattrapage d'une validation prématurée : sans cela, une
                        table verrouillée par erreur finissait le concours avec
                        un juré manquant. */}
                    {validated && activeCandidate ? (
                      <div className="mt-2">
                        <ConfirmButton
                          action={devalidateTableAction}
                          values={{ tableId: table.id, candidateId: activeCandidate.id }}
                          label="Dévalider"
                          icon={<UnlockIcon className="h-3.5 w-3.5" />}
                          confirmMessage={`Rouvrir les votes de « ${table.name} » pour ${activeCandidate.name} ? Sa tablette pourra de nouveau saisir et corriger ses votes.`}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
