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
    url: process.env.DATABASE_URL ?? "",
  },
});
