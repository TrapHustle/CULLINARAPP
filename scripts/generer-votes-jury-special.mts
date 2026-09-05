import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const scoreSets = [
  [[15, 12, 12, 12, 8], [20, 12, 15, 12, 8], [15, 15, 12, 15, 8]],
  [[15, 12, 12, 12, 10], [20, 12, 12, 12, 8], [15, 15, 15, 12, 8]],
  [[20, 15, 12, 15, 10], [15, 15, 15, 15, 8], [20, 12, 15, 15, 10]],
  [[15, 12, 12, 15, 8], [20, 12, 12, 12, 10], [15, 15, 12, 12, 10]],
];

async function main() {
  const [candidates, table, criteria] = await Promise.all([
    prisma.candidate.findMany({ orderBy: { order: "asc" }, take: 4 }),
    prisma.votingTable.findFirst({ where: { type: "SPECIAL" }, orderBy: { name: "asc" } }),
    prisma.criterion.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (!table) throw new Error("Aucune table SPECIAL n'existe.");
  if (candidates.length !== 4) throw new Error(`Il faut exactement 4 candidats (trouve: ${candidates.length}).`);
  if (criteria.length === 0) throw new Error("Aucun critere n'existe.");
  if (criteria.reduce((total, criterion) => total + criterion.maxPoints, 0) !== 75) {
    throw new Error("Le total des criteres n'est pas 75.");
  }

  await prisma.vote.deleteMany({
    where: { tableId: table.id, candidateId: { in: candidates.map((candidate) => candidate.id) } },
  });

  for (const [candidateIndex, candidate] of candidates.entries()) {
    for (let jurorIndex = 1; jurorIndex <= 3; jurorIndex++) {
      const scores = scoreSets[candidateIndex][jurorIndex - 1];
      await prisma.vote.create({
        data: {
          id: randomUUID(),
          tableId: table.id,
          candidateId: candidate.id,
          jurorIndex,
          createdAt: new Date(),
          scores: {
            create: criteria.map((criterion, criterionIndex) => ({
              criterionId: criterion.id,
              rawValue: scores[criterionIndex],
            })),
          },
        },
      });
    }
  }

  const created = await prisma.vote.findMany({
    where: { tableId: table.id, candidateId: { in: candidates.map((candidate) => candidate.id) } },
    select: { candidateId: true, scores: { select: { rawValue: true } } },
  });
  const counts = candidates.map((candidate) => created.filter((vote) => vote.candidateId === candidate.id).length);
  const scoreCount = created.reduce((total, vote) => total + vote.scores.length, 0);
  const averages = candidates.map((candidate) => {
    const votes = created.filter((vote) => vote.candidateId === candidate.id);
    const total = votes.reduce(
      (sum, vote) => sum + vote.scores.reduce((voteTotal, score) => voteTotal + score.rawValue, 0),
      0,
    );
    return (total / votes.length).toFixed(2);
  });
  console.log(`Votes generes: ${candidates.length} candidats x 3 jures sur « ${table.name} ».`);
  console.log(`Verification: ${counts.join(", ")} votes par candidat, ${scoreCount} notes de criteres.`);
  console.log(`Moyennes finales sur 75: ${averages.join(", ")}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());