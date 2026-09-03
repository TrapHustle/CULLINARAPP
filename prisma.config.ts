import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 ne charge plus automatiquement le fichier .env : on le fait ici pour
// que le CLI (migrate, studio, seed) dispose de DATABASE_URL.
loadEnv();

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // On lit `process.env` directement plutôt que le helper `env()` de Prisma :
    // ce dernier LÈVE une erreur si la variable est absente, ce qui fait échouer
    // le `prisma generate` lancé à l'installation sur Vercel (où l'URL n'est pas
    // nécessaire — seul le runtime en a besoin). Une chaîne vide suffit à
    // générer le client ; migrate/seed, eux, sont lancés avec la vraie URL.
    //
    // `DIRECT_DATABASE_URL` prime sur `DATABASE_URL` ici : Neon route ce dernier
    // via PgBouncer (suffixe `-pooler`), qui ne tient pas de session entre deux
    // requêtes. Or `prisma migrate` pose un verrou consultatif Postgres
    // (`pg_advisory_lock`) qui exige justement une session — sur le pooler, la
    // pose du verrou expire au bout de 10 s (P1002). Seul le CLI (migrate, seed,
    // studio) lit cette variable ; le runtime applicatif (`src/lib/prisma.ts`)
    // continue de se connecter via le pooler, adapté aux fonctions serverless.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
