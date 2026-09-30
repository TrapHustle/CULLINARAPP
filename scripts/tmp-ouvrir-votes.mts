import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 });
const prisma = new PrismaClient({ adapter });

const candidate = await prisma.candidate.findFirst({ orderBy: { order: "asc" } });
if (!candidate) throw new Error("aucun candidat");

await prisma.candidate.update({
  where: { id: candidate.id },
  data: { openedAt: candidate.openedAt ?? new Date() },
});
await prisma.session.upsert({
  where: { id: "singleton" },
  create: { id: "singleton", activeCandidateId: candidate.id, votingOpen: true },
  update: { activeCandidateId: candidate.id, votingOpen: true },
});

const criteria = await prisma.criterion.findMany({ orderBy: { order: "asc" } });
console.log("ouvert pour:", candidate.name, "| criteres:", criteria.map((c) => c.name).join(", "));
await prisma.$disconnect();
