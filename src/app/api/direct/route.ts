import { getOrCreateSession, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/direct
 *
 * Tout ce dont l'écran projeté a besoin — et **rien d'autre**.
 *
 * Cette route est publique, comme `/api/config` : personne ne saisit de mot de
 * passe sur la machine du vidéoprojecteur, et un écran qui redemanderait à se
 * connecter au milieu de la soirée serait ingérable.
 *
 * Elle ne renvoie donc **aucune note, aucune moyenne, aucun classement**. C'est
 * la règle qui gouverne ce fichier : les tables votent à des rythmes différents,
 * et un score affiché au mur influencerait les jurés qui n'ont pas fini. Le
 * calcul reste derrière `/api/results`, qui exige une session.
 *
 * Ce qui est diffusé n'est que de l'avancement : combien de votes sont arrivés,
 * et quelles tables ont terminé. Cela ne dit rien de qui gagne.
 */
export async function GET() {
  const session = await getOrCreateSession();

  const [candidates, tables] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    prisma.votingTable.findMany({ orderBy: { name: "asc" } }),
  ]);

  const activeIndex = session.activeCandidateId
    ? candidates.findIndex((candidate) => candidate.id === session.activeCandidateId)
    : -1;
  const active = activeIndex >= 0 ? candidates[activeIndex] : null;

  const [validations, voteCounts] = active
    ? await Promise.all([
        prisma.tableValidation.findMany({
          where: { candidateId: active.id },
          select: { tableId: true },
        }),
        prisma.vote.groupBy({
          by: ["tableId"],
          where: { candidateId: active.id },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const validated = new Set(validations.map((validation) => validation.tableId));
  const received = new Map(voteCounts.map((row) => [row.tableId, row._count._all]));

  const tableRows = tables.map((table) => ({
    id: table.id,
    name: table.name,
    special: table.type === "SPECIAL",
    expectedJurors: table.expectedJurors,
    // Le compteur est borné au nombre de jurés attendus : une table qui aurait
    // reçu un vote de plus (correction, resynchronisation) ne doit pas afficher
    // « 6 / 5 » au mur.
    received: Math.min(received.get(table.id) ?? 0, table.expectedJurors),
    validated: validated.has(table.id),
  }));

  return Response.json({
    votingOpen: session.votingOpen,
    candidate: active
      ? {
          name: active.name,
          photoUrl: active.photoUrl,
          position: activeIndex + 1,
          total: candidates.length,
        }
      : null,
    expected: tables.reduce((sum, table) => sum + table.expectedJurors, 0),
    received: tableRows.reduce((sum, table) => sum + table.received, 0),
    tables: tableRows,
    allValidated: tables.length > 0 && tableRows.every((table) => table.validated),
  });
}
