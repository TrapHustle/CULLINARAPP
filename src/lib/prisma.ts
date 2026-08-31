import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL est absent. Renseignez-le dans le fichier .env.");
}

// Prisma 7 exige un « driver adapter » explicite pour se connecter à la base.
// Le pool est volontairement petit : l'application sert une poignée de tablettes
// et les hébergeurs serverless limitent le nombre de connexions simultanées.
const adapter = new PrismaPg({ connectionString, max: 5 });

// En développement, Next.js recharge les modules à chaud : sans ce singleton,
// chaque rechargement ouvrirait une nouvelle connexion à SQLite jusqu'à
// épuisement des handles de fichier.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Identifiant de l'unique ligne de session de l'événement. */
export const SESSION_ID = "singleton";

/**
 * Récupère la session de l'événement, en la créant à la volée au premier appel.
 * Évite d'avoir à garantir sa présence dans le seed.
 */
export async function getOrCreateSession() {
  return prisma.session.upsert({
    where: { id: SESSION_ID },
    update: {},
    create: { id: SESSION_ID },
  });
}
