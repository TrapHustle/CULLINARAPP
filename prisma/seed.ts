/**
 * Jeu de données de départ, destiné aux tests et aux répétitions.
 *
 * Ces valeurs ne sont qu'un point de départ modifiable depuis le dashboard :
 * rien n'est codé en dur dans l'application (§14).
 *
 *   npm run db:seed
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadEnv();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.session.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", votingOpen: false, timerEnabled: true, timerSeconds: 30 },
  });

  const criteria = ["Goût", "Présentation", "Créativité"];
  for (const [index, name] of criteria.entries()) {
    const existing = await prisma.criterion.findFirst({ where: { name } });
    if (!existing) {
      await prisma.criterion.create({ data: { name, order: index + 1 } });
    }
  }

  const candidates = ["Candidat 1", "Candidat 2", "Candidat 3", "Candidat 4"];
  for (const [index, name] of candidates.entries()) {
    const existing = await prisma.candidate.findFirst({ where: { name } });
    if (!existing) {
      await prisma.candidate.create({ data: { name, order: index + 1 } });
    }
  }

  const tables = [
    { name: "Table 1", type: "LAMBDA", expectedJurors: 5 },
    { name: "Table 2", type: "LAMBDA", expectedJurors: 5 },
    { name: "Table 3", type: "LAMBDA", expectedJurors: 5 },
    { name: "Jury spécial", type: "SPECIAL", expectedJurors: 3 },
  ];
  for (const table of tables) {
    const existing = await prisma.votingTable.findFirst({ where: { name: table.name } });
    if (!existing) {
      await prisma.votingTable.create({ data: table });
    }
  }

  const [criterionCount, candidateCount, tableCount] = await Promise.all([
    prisma.criterion.count(),
    prisma.candidate.count(),
    prisma.votingTable.count(),
  ]);

  console.log(
    `Seed terminé : ${candidateCount} candidats, ${tableCount} tables, ${criterionCount} critères.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
