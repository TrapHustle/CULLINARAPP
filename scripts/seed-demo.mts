/**
 * Jeu de démonstration complet, pour les répétitions et les tests d'affichage.
 *
 * Contrairement à `prisma/seed.ts`, qui complète prudemment ce qui manque, ce
 * script **repart de zéro** : il vide le bureau de vote puis le remplit de
 * candidats dotés d'un portrait. C'est ce qu'on veut pour préparer une
 * répétition, pas pour amorcer une base de production.
 *
 *   npm run db:seed-demo            visages générés par IA, téléchargés
 *   npm run db:seed-demo -- --offline  portraits dessinés localement
 *
 * Par défaut on télécharge des visages synthétiques : ce sont eux qui
 * permettent de juger l'écran projeté et le rendu sur les tablettes. Sans
 * internet — le cas prévu en salle — on retombe automatiquement sur les
 * portraits dessinés, et le script le dit.
 *
 * Dans les deux cas l'image est stockée en base comme le serait une vraie photo
 * envoyée depuis le dashboard : le chemin `/api/images/<id>` qui en résulte
 * emprunte exactement le même code.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { fetchFaces } from "./faces.mjs";
import { makePortraitPng } from "./portrait.mjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 });
const prisma = new PrismaClient({ adapter });

const CRITERIA = ["Goût", "Présentation", "Créativité"];

const TABLES = [
  { name: "Table 1", type: "LAMBDA", expectedJurors: 5 },
  { name: "Table 2", type: "LAMBDA", expectedJurors: 5 },
  { name: "Table 3", type: "LAMBDA", expectedJurors: 5 },
  { name: "Jury spécial", type: "SPECIAL", expectedJurors: 3 },
];

/**
 * Libellés volontairement neutres.
 *
 * Les visages téléchargés sont tirés au hasard : un prénom marqué tomberait une
 * fois sur deux sur un portrait qui ne lui correspond pas, et l'incohérence
 * ferait douter de l'affichage au lieu de le valider.
 */
const CANDIDATES = ["Chef Berthier", "Chef Ferrand"];

interface Photo {
  bytes: Buffer;
  mimeType: string;
}

/** Portraits dessinés sur place : aucun réseau, toujours disponibles. */
function drawPhotos(count: number): Photo[] {
  return Array.from({ length: count }, (_, index) => ({
    bytes: makePortraitPng(index),
    mimeType: "image/png",
  }));
}

/**
 * Choisit la source des photos.
 *
 * Le repli n'est pas un détail de confort : ce script sert à préparer une
 * répétition, souvent dans la salle elle-même, où il n'y a par construction
 * pas d'internet. Échouer là-dessus laisserait l'organisateur sans jeu de test
 * pour une raison qui n'a rien à voir avec le concours.
 */
async function collectPhotos(count: number): Promise<Photo[]> {
  if (process.argv.includes("--offline")) {
    console.log("Portraits dessinés localement (--offline).");
    return drawPhotos(count);
  }

  console.log("Téléchargement de visages générés par IA…");
  try {
    const faces = await fetchFaces(count, (index, bytes) =>
      console.log(`  visage ${index}/${count} — ${(bytes / 1024).toFixed(0)} Ko`),
    );
    return faces.map((bytes) => ({ bytes, mimeType: "image/jpeg" }));
  } catch (error) {
    console.warn(`  échec : ${error instanceof Error ? error.message : error}`);
    console.warn("  repli sur les portraits dessinés localement.");
    return drawPhotos(count);
  }
}

async function main() {
  console.log("Réinitialisation du bureau de vote…");

  await prisma.$transaction([
    prisma.vote.deleteMany({}),
    prisma.tableValidation.deleteMany({}),
    prisma.candidate.deleteMany({}),
    prisma.votingTable.deleteMany({}),
    prisma.criterion.deleteMany({}),
    prisma.image.deleteMany({}),
  ]);

  await prisma.session.upsert({
    where: { id: "singleton" },
    update: {
      activeCandidateId: null,
      votingOpen: false,
      timerEnabled: true,
      timerSeconds: 30,
    },
    create: { id: "singleton", votingOpen: false, timerEnabled: true, timerSeconds: 30 },
  });

  for (const [index, name] of CRITERIA.entries()) {
    await prisma.criterion.create({ data: { name, order: index + 1 } });
  }

  for (const table of TABLES) {
    await prisma.votingTable.create({ data: table });
  }

  const photos = await collectPhotos(CANDIDATES.length);

  let totalBytes = 0;
  for (const [index, name] of CANDIDATES.entries()) {
    const photo = photos[index];
    totalBytes += photo.bytes.length;

    const image = await prisma.image.create({
      // `Buffer` est un `Uint8Array` au sens large ; Prisma en attend un dont
      // le tampon sous-jacent est un `ArrayBuffer` simple, d'où la copie.
      data: { mimeType: photo.mimeType, data: new Uint8Array(photo.bytes) },
    });

    await prisma.candidate.create({
      data: {
        name,
        order: index + 1,
        photoUrl: `/api/images/${image.id}`,
      },
    });

    console.log(`  ${name} — ${(photo.bytes.length / 1024).toFixed(0)} Ko`);
  }

  const expectedVoters = TABLES.reduce((sum, table) => sum + table.expectedJurors, 0);

  console.log(
    [
      "",
      `${CANDIDATES.length} candidats, ${TABLES.length} tables, ${CRITERIA.length} critères.`,
      `${expectedVoters} jurés attendus par candidat.`,
      `Photos : ${(totalBytes / 1024).toFixed(0)} Ko au total en base.`,
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
