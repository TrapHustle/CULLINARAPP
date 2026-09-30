/**
 * Remet la base a zero avant l'evenement.
 *
 * Efface les votes et les validations, libere les tables, referme les
 * candidats. La structure reste : candidats, tables et criteres sont conserves,
 * seules les donnees de vote partent. Renommer les candidats se fait ensuite
 * depuis la page Configuration.
 *
 * Le numero de generation est incremente : chaque tablette compare le sien a
 * chaque cycle et efface ses donnees locales toute seule. Sans lui, elles
 * garderaient des identifiants de tables et de candidats qui ne designent plus
 * rien apres un changement de base.
 *
 * Agit sur la base designee par DATABASE_URL — verifiez laquelle avant.
 *
 *   npx tsx scripts/remise-a-zero.mts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });

console.log("base :", url.replace(/:[^:@]+@/, ":***@"));

console.log("scores supprimes   :", (await prisma.voteScore.deleteMany({})).count);
console.log("votes supprimes    :", (await prisma.vote.deleteMany({})).count);
console.log("validations levees :", (await prisma.tableValidation.deleteMany({})).count);
console.log(
  "tables liberees    :",
  (await prisma.votingTable.updateMany({ data: { assignedDeviceId: null, assignedAt: null } })).count,
);
console.log(
  "candidats refermes :",
  (await prisma.candidate.updateMany({ data: { openedAt: null } })).count,
);

const before = await prisma.session.findFirst();
const next = String(Number(before?.dataGeneration ?? "1") + 1);
await prisma.session.update({
  where: { id: "singleton" },
  data: { activeCandidateId: null, votingOpen: false, dataGeneration: next },
});
console.log("generation         :", before?.dataGeneration ?? "1", "->", next);

await prisma.$disconnect();
