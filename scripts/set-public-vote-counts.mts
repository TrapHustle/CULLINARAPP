import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const countsByName = new Map([
  ["TEKPO", 820],
  ["SANGARE", 639],
  ["DOUA", 58],
  ["KADJA", 183],
]);

async function main() {
  const candidates = await prisma.candidate.findMany({ orderBy: { order: "asc" }, take: 4 });
  if (candidates.length !== countsByName.size) throw new Error("Le nombre de candidats n'est pas egal a 4.");

  const counts = candidates.map((candidate) => {
    const match = [...countsByName.entries()].find(([name]) => candidate.name.toUpperCase().includes(name));
    if (!match) throw new Error(`Candidat non associe : ${candidate.name}`);
    return match[1];
  });

  await prisma.$transaction(
    candidates.map((candidate, index) =>
      prisma.candidate.update({
        where: { id: candidate.id },
        data: { publicVoteCount: counts[index] },
      }),
    ),
  );

  console.log(candidates.map((candidate, index) => `${candidate.name}: ${counts[index]}`).join("\n"));
  console.log(`Total public: ${counts.reduce((total, count) => total + count, 0)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
