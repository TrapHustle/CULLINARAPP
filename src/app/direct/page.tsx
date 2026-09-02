import type { Metadata } from "next";
import { getOrCreateSession, prisma } from "@/lib/prisma";
import { DirectDisplay } from "./display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Concours culinaire — En direct",
};

/**
 * Écran destiné au vidéoprojecteur.
 *
 * Volontairement **hors du groupe `(admin)`**, donc hors de la garde
 * d'authentification : la machine du vidéoprojecteur n'a personne pour saisir
 * un mot de passe, et un rechargement ne doit jamais laisser le mur vide.
 * L'absence de connexion est sans conséquence parce que la page ne lit que
 * `/api/direct`, qui ne contient aucun score.
 *
 * La page ne se pilote pas : elle n'a ni bouton ni raccourci. Elle suit l'état
 * décidé depuis le Pilotage, ce qui est la seule ergonomie tenable pour un
 * écran situé à l'autre bout de la salle.
 *
 * Le premier rendu est fait côté serveur pour que l'écran affiche déjà quelque
 * chose avant même que le JavaScript ne prenne le relais ; ensuite le composant
 * client interroge `/api/direct` toutes les deux secondes.
 */
export default async function DirectPage() {
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
    received: Math.min(received.get(table.id) ?? 0, table.expectedJurors),
    validated: validated.has(table.id),
  }));

  return (
    <DirectDisplay
      initial={{
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
      }}
    />
  );
}
