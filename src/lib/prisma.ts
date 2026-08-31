import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// En développement, Next.js recharge les modules à chaud : sans ce singleton,
// chaque rechargement ouvrirait une nouvelle connexion jusqu'à épuisement des
// connexions autorisées par l'hébergeur.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL est absent. Renseignez-le dans le fichier .env.");
  }

  // Prisma 7 exige un « driver adapter » explicite. Le pool est volontairement
  // petit : l'application sert une poignée de tablettes et les hébergeurs
  // serverless limitent le nombre de connexions simultanées.
  const adapter = new PrismaPg({ connectionString, max: 5 });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

/// Client Prisma **initialisé à la demande**.
///
/// La connexion n'est créée qu'au premier accès réel — jamais à l'import. C'est
/// indispensable pour la construction sur Vercel : Next.js charge chaque module
/// de route au build (« collect configuration »), et lever une erreur à l'import
/// parce que `DATABASE_URL` n'est pas encore là ferait échouer tout le build.
/// L'URL n'est requise qu'à l'exécution, où l'hébergeur la fournit.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = globalForPrisma.prisma ?? createClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

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
