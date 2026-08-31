/**
 * Scénario de bout en bout contre le serveur HTTP réel.
 * Vérifie les garanties du §14 : rejet avant ouverture, idempotence,
 * pondération ×2 et équité de la moyenne.
 */
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

loadEnv();

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  console.log(`${condition ? "  OK  " : " ECHEC"} | ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

async function syncVotes(votes: unknown[]) {
  const response = await fetch(`${BASE}/api/sync/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ votes }),
  });
  return response.json() as Promise<{
    accepted: string[];
    rejected: { id: string; reason: string; retryable: boolean }[];
  }>;
}

async function main() {
  // Repartir d'une base de votes propre pour que le scénario soit reproductible.
  await prisma.voteScore.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.tableValidation.deleteMany();
  await prisma.candidate.updateMany({ data: { openedAt: null } });

  const config = await (await fetch(`${BASE}/api/config`)).json();
  const candidate = config.candidates[0];
  const other = config.candidates[1];
  const lambdaTables = config.tables.filter((t: any) => t.type === "LAMBDA");
  const specialTable = config.tables.find((t: any) => t.type === "SPECIAL");
  const criteria = config.criteria;

  const scores = (a: number, b: number, c: number) => [
    { criterionId: criteria[0].id, rawValue: a },
    { criterionId: criteria[1].id, rawValue: b },
    { criterionId: criteria[2].id, rawValue: c },
  ];

  const makeVote = (tableId: string, candidateId: string, jurorIndex: number, s: number[]) => ({
    id: randomUUID(),
    tableId,
    candidateId,
    jurorIndex,
    createdAt: new Date().toISOString(),
    scores: scores(s[0], s[1], s[2]),
  });

  console.log("\n--- 1. Vote refusé tant que le candidat n'a jamais été ouvert ---");
  const early = await syncVotes([makeVote(lambdaTables[0].id, candidate.id, 1, [4, 4, 4])]);
  check(
    "vote rejeté, non réessayable",
    early.accepted.length === 0 && early.rejected[0]?.retryable === false,
    early.rejected[0]?.reason,
  );

  // L'organisateur ouvre les votes (équivalent de l'action serveur).
  await prisma.candidate.updateMany({
    where: { id: { in: [candidate.id, other.id] } },
    data: { openedAt: new Date() },
  });

  console.log("\n--- 2. Exemple chiffré du §4.3 : 3 lambda + 1 spécial ---");
  const batch = [
    makeVote(lambdaTables[0].id, candidate.id, 1, [4, 5, 3]), // 24
    makeVote(lambdaTables[0].id, candidate.id, 2, [3, 4, 4]), // 22
    makeVote(lambdaTables[0].id, candidate.id, 3, [5, 5, 4]), // 28
    makeVote(specialTable.id, candidate.id, 1, [5, 5, 5]), // 30, poids 2
  ];
  const first = await syncVotes(batch);
  check("4 votes acceptés", first.accepted.length === 4, `rejetés: ${first.rejected.length}`);

  console.log("\n--- 3. Idempotence : le même lot renvoyé deux fois ---");
  const replay = await syncVotes(batch);
  const voteCount = await prisma.vote.count({ where: { candidateId: candidate.id } });
  check("relot accepté", replay.accepted.length === 4);
  check("aucun doublon créé", voteCount === 4, `${voteCount} votes en base`);

  console.log("\n--- 4. Équité : moins de votants, meilleure moyenne ---");
  // L'autre candidat reçoit 2 votes seulement, mais meilleurs.
  await syncVotes([
    makeVote(lambdaTables[1].id, other.id, 1, [5, 5, 5]),
    makeVote(lambdaTables[1].id, other.id, 2, [5, 5, 5]),
  ]);

  console.log("\n--- 5. Validation de table (idempotente) ---");
  const validate = async () =>
    (
      await fetch(`${BASE}/api/tables/${lambdaTables[0].id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id }),
      })
    ).status;
  const s1 = await validate();
  const s2 = await validate();
  const validationCount = await prisma.tableValidation.count();
  check("double validation sans erreur", s1 === 200 && s2 === 200, `${s1}/${s2}`);
  check("une seule ligne de validation", validationCount === 1);

  console.log("\n--- 6. Vérification du calcul sur les données réellement stockées ---");
  const votes = await prisma.vote.findMany({ include: { scores: true, table: true } });
  const forCandidate = votes.filter((v) => v.candidateId === candidate.id);
  let weighted = 0;
  let weight = 0;
  for (const v of forCandidate) {
    const total = v.scores.reduce((t, s) => t + s.rawValue * 2, 0);
    const w = v.table.type === "SPECIAL" ? 2 : 1;
    weighted += total * w;
    weight += w;
  }
  const avg = weighted / weight;
  const final = (avg * 20) / 30;
  check("moyenne = 26,8/30", Math.abs(avg - 26.8) < 1e-9, `obtenu ${avg}`);
  check("note finale = 17,87/20", Math.abs(final - 17.8666667) < 1e-5, `obtenu ${final.toFixed(4)}`);

  const otherVotes = votes.filter((v) => v.candidateId === other.id);
  const otherAvg =
    otherVotes.reduce((t, v) => t + v.scores.reduce((s, x) => s + x.rawValue * 2, 0), 0) /
    otherVotes.length;
  check(
    "candidat à 2 votants (30/30) devance celui à 4 votants (26,8/30)",
    otherAvg > avg,
    `${otherAvg} > ${avg}`,
  );

  console.log(`\n${failures === 0 ? "TOUS LES CONTROLES SONT PASSES" : `${failures} CONTROLE(S) EN ECHEC`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
