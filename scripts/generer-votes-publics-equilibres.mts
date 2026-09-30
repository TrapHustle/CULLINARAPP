import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const minimumPerCandidate = 52;

function choices(maxPoints: number) {
  if (maxPoints === 20) return [0, 5, 10, 15, 20];
  if (maxPoints === 15) return [0, 4, 8, 12, 15];
  if (maxPoints === 10) return [0, 2, 4, 6, 8, 10];
  return Array.from({ length: maxPoints + 1 }, (_, value) => value);
}

function randomScore(maxPoints: number) {
  const values = choices(maxPoints);
  return values[1 + Math.floor(Math.random() * (values.length - 1))];
}

async function main() {
  const [candidates, tables, criteria] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" }, take: 4 }),
    prisma.votingTable.findMany({ where: { type: "LAMBDA" }, orderBy: { name: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (candidates.length !== 4) throw new Error(`Il faut 4 candidats (trouve: ${candidates.length}).`);
  if (tables.length === 0) throw new Error("Aucune table publique disponible.");
  if (criteria.length === 0) throw new Error("Aucun critere disponible.");

  const existing = await prisma.vote.findMany({
    where: { table: { type: "LAMBDA" }, candidateId: { in: candidates.map((candidate) => candidate.id) } },
    select: { candidateId: true, tableId: true, jurorIndex: true },
  });

  const target = Math.max(
    minimumPerCandidate,
    ...candidates.map((candidate) => existing.filter((vote) => vote.candidateId === candidate.id).length),
  );
  const created: string[] = [];

  for (const candidate of candidates) {
    const used = new Set(
      existing
        .filter((vote) => vote.candidateId === candidate.id)
        .map((vote) => `${vote.tableId}:${vote.jurorIndex}`),
    );
    const current = used.size;

    for (const table of tables) {
      for (let jurorIndex = 1; jurorIndex <= table.expectedJurors && current + created.filter((id) => id.startsWith(`${candidate.id}:`)).length < target; jurorIndex++) {
        const slot = `${table.id}:${jurorIndex}`;
        if (used.has(slot)) continue;

        const vote = await prisma.vote.create({
          data: {
            id: randomUUID(),
            tableId: table.id,
            candidateId: candidate.id,
            jurorIndex,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000)),
            scores: {
              create: criteria.map((criterion) => ({
                criterionId: criterion.id,
                rawValue: randomScore(criterion.maxPoints),
              })),
            },
          },
        });
        created.push(`${candidate.id}:${vote.id}`);
        used.add(slot);
      }
    }
  }

  const counts = await prisma.vote.groupBy({
    by: ["candidateId"],
    where: { table: { type: "LAMBDA" }, candidateId: { in: candidates.map((candidate) => candidate.id) } },
    _count: { _all: true },
  });

  console.log(`Votes publics ajoutes: ${created.length}.`);
  console.log(`Total egalise par candidat: ${candidates.map((candidate) => counts.find((row) => row.candidateId === candidate.id)?._count._all ?? 0).join(", ")}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
