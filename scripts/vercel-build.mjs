// `prisma migrate deploy` échoue sur une base neuve : la migration
// `1_event_identity_and_images` recrée des colonnes déjà créées par `0_init`
// (les deux sont déjà posées sur Neon prod, donc on ne peut pas corriger leur
// contenu sans casser l'empreinte que Prisma y a enregistrée). Sur une base
// vide, on pose donc le schéma directement puis on marque tout l'historique
// comme déjà appliqué, avant de laisser `migrate deploy` reprendre la main.
// Sur une base qui a déjà cet historique (Neon prod), ce script ne fait rien
// de plus qu'un `migrate deploy` normal.
import { execSync } from "node:child_process";
import { Client } from "pg";

// Ordre réellement appliqué sur Neon prod (ne pas trier le dossier : les noms
// ne sont pas dans un ordre lexicographique cohérent, ex. "2026…" < "2_…").
const HISTORY = [
  "0_init",
  "1_event_identity_and_images",
  "2_table_assignment",
  "3_data_generation",
  "4_vote_weights_and_scale",
  "5_vote_mode",
  "6_vote_mode_par_categorie",
  "4_shares",
  "20260905170000_add_criterion_max_points",
  "20260906120000_add_public_vote_count",
  "20260907140000_add_vote_event_archives",
  "20260929120000_public_vote",
  "20260930160000_share_online",
];

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.log("[vercel-build] Pas de base de données disponible au moment du build — étape migrate ignorée.");
  process.exit(0);
}

const client = new Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(`SELECT to_regclass('public."_prisma_migrations"') AS reg`);
const hasHistory = rows[0].reg !== null;
await client.end();

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (!hasHistory) {
  console.log("[vercel-build] Base neuve détectée : pose du schéma puis reconstruction de l'historique des migrations.");
  run("npx prisma db push");
  for (const name of HISTORY) {
    run(`npx prisma migrate resolve --applied ${name}`);
  }
}

run("npx prisma migrate deploy");
