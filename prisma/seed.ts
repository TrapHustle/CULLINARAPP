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

  const criteria = [
    { name: "Maîtrise culinaire & technique", maxPoints: 20 },
    { name: "Créativité & valorisation des produits locaux", maxPoints: 15 },
    { name: "Présentation, hygiène & organisation", maxPoints: 15 },
    { name: "Personnalité & potentiel talent traiteur", maxPoints: 15 },
    { name: "Potentiel audiovisuel", maxPoints: 10 },
  ];
  for (const [index, criterion] of criteria.entries()) {
    const existing = await prisma.criterion.findFirst({ where: { order: index + 1 } });
    if (!existing) {
      await prisma.criterion.create({ data: { ...criterion, order: index + 1 } });
    } else {
      await prisma.criterion.update({
        where: { id: existing.id },
        data: { ...criterion, order: index + 1 },
      });
    }
  }

  const candidates = [
    "DOUA ANGE TRIPHÈNE",
    "TEKPO DONALD",
    "SANGARE FERIMA",
    "KADJA HUGUES",
  ];
  for (const [index, name] of candidates.entries()) {
    const existing = await prisma.candidate.findFirst({ where: { order: index + 1 } });
    if (existing) {
      await prisma.candidate.update({
        where: { id: existing.id },
        data: { name, order: index + 1 },
      });
    } else {
      await prisma.candidate.create({ data: { name, order: index + 1 } });
    }
  }

  const tables = [
    ...Array.from({ length: 29 }, (_, index) => ({
      name: `Table ${index + 1}`,
      type: "LAMBDA",
      expectedJurors: 10,
    })),
    { name: "Jury spécial", type: "SPECIAL", expectedJurors: 10 },
  ];
  for (const table of tables) {
    const existing = await prisma.votingTable.findFirst({ where: { name: table.name } });
    if (!existing) {
      await prisma.votingTable.create({ data: table });
    } else if (table.name.startsWith("Table ")) {
      await prisma.votingTable.update({
        where: { id: existing.id },
        data: { expectedJurors: table.expectedJurors },
      });
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
