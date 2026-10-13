/**
 * Contrôle de la migration vers le modèle SaaS (`20261013120000_saas_modele`).
 *
 * À lancer sur une COPIE de la base, après `prisma migrate deploy` :
 *
 *   DATABASE_URL=postgresql://…/copie npx tsx scripts/verifier-migration-saas.mts
 *
 * Compare les anciennes tables, restées intactes, aux nouvelles :
 *  1. les volumes et les montants doivent être identiques ;
 *  2. le classement calculé par l'ancien moteur et par le nouveau doit l'être
 *     aussi, à l'échelle près (barème total → 100). Seul écart admis : un
 *     candidat sans voix en ligne quand d'autres en ont reçu, que l'ancien
 *     moteur avantageait et qui reçoit désormais 0 sur cette part.
 *
 * Ne modifie rien. Code de sortie 1 au moindre écart non admis.
 */
import { prisma } from "../src/lib/prisma";
import { computeResults } from "../src/lib/results";
import { calculerResultats } from "../src/lib/resultats-saas";

const SELECTION = "sel_talent_traiteur";
let erreurs = 0;

function verifier(libelle: string, avant: unknown, apres: unknown) {
  const ok = JSON.stringify(avant) === JSON.stringify(apres);
  if (!ok) erreurs++;
  console.log(`${ok ? "OK    " : "ÉCART "} ${libelle} : ${JSON.stringify(avant)}${ok ? "" : ` → ${JSON.stringify(apres)}`}`);
}

console.log("— Volumes —");
verifier("candidats", await prisma.candidate.count(), await prisma.candidat.count());
verifier("tables de jury", await prisma.votingTable.count(), await prisma.tableJury.count());
verifier("votes des tablettes", await prisma.vote.count(), await prisma.suffrage.count({ where: { origine: "TABLETTE" } }));
verifier("notes par critère", await prisma.voteScore.count(), await prisma.valeur.count());
verifier("validations de table", await prisma.tableValidation.count(), await prisma.validationTable.count());
verifier("archives", await prisma.voteEventArchive.count(), await prisma.archiveSelection.count());

console.log("— Paiements —");
verifier(
  "paiements par statut",
  (await prisma.publicVotePayment.groupBy({ by: ["status"], _count: true, _sum: { amount: true }, orderBy: { status: "asc" } }))
    .map((l) => [l.status, l._count, l._sum.amount]),
  (await prisma.paiement.groupBy({ by: ["statut"], _count: true, _sum: { montant: true }, orderBy: { statut: "asc" } }))
    .map((l) => [l.statut, l._count, l._sum.montant]),
);
verifier(
  "voix payées confirmées",
  (await prisma.publicVotePayment.aggregate({ where: { status: "CONFIRMED", candidateId: { not: null } }, _sum: { votes: true } }))._sum.votes ?? 0,
  (await prisma.suffrage.aggregate({ where: { origine: "PAIEMENT" }, _sum: { poids: true } }))._sum.poids ?? 0,
);
verifier(
  "voix importées",
  (await prisma.candidate.aggregate({ _sum: { publicVoteCount: true } }))._sum.publicVoteCount ?? 0,
  (await prisma.suffrage.aggregate({ where: { origine: "IMPORT" }, _sum: { poids: true } }))._sum.poids ?? 0,
);

console.log("— Retraits —");
verifier(
  "retraits par statut",
  (await prisma.withdrawalRequest.groupBy({ by: ["status"], _count: true, _sum: { amount: true }, orderBy: { status: "asc" } }))
    .map((l) => [l.status, l._count, l._sum.amount]),
  (await prisma.demandeRetrait.groupBy({ by: ["statut"], _count: true, _sum: { montant: true }, orderBy: { statut: "asc" } }))
    .map((l) => [l.statut, l._count, l._sum.montant]),
);

console.log("— Classement —");
const ancien = await computeResults();
const nouveau = await calculerResultats(SELECTION);
const enLigneTotal = ancien.publicVoteTotal;

for (const ligne of ancien.ranking) {
  const n = nouveau.classement.find((l) => l.candidat.candidatId === ligne.candidateId);
  const avant = ligne.finalScore === null ? null : (ligne.finalScore / ancien.maxTotal) * 100;
  const apres = n?.note ?? null;
  const ecart = avant === null || apres === null ? (avant === apres ? 0 : Infinity) : Math.abs(avant - apres);
  // L'ancien score est arrondi au centième sur l'échelle du barème : on tolère
  // l'erreur d'arrondi une fois ramenée sur 100.
  const tolerance = (0.005 / ancien.maxTotal) * 100 + 1e-9;
  const admis = ligne.publicVoteCount === 0 && enLigneTotal > 0;
  const statut = ecart <= tolerance ? "OK    " : admis ? "VOULU " : "ÉCART ";
  if (statut === "ÉCART ") erreurs++;
  console.log(
    `${statut} ${ligne.name.padEnd(24)} rang ${ligne.rank ?? "-"} → ${n?.rang ?? "-"}   ` +
      `${avant?.toFixed(2) ?? "non noté"} → ${apres?.toFixed(2) ?? "non noté"} /100` +
      (statut === "VOULU " ? "   (0 voix en ligne : part en ligne à 0 au lieu d'être retirée)" : ""),
  );
}

console.log(erreurs === 0 ? "\nMigration conforme." : `\n${erreurs} écart(s) non admis.`);
await prisma.$disconnect();
process.exit(erreurs === 0 ? 0 : 1);
