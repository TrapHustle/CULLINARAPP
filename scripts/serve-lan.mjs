import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";

import { startBeacon } from "./discovery-beacon.mjs";

/**
 * Lance le serveur web *et* la balise de découverte Wi-Fi dans le même
 * processus.
 *
 * Les deux vont ensemble : un serveur sans balise est un serveur que les
 * tablettes ne savent plus trouver. Les démarrer séparément exposerait
 * l'organisateur à en oublier un le jour J.
 *
 *   node scripts/serve-lan.mjs dev     développement
 *   node scripts/serve-lan.mjs start   production (après `npm run build`)
 */

const mode = process.argv[2] === "dev" ? "dev" : "start";
const port = process.env.PORT ?? "3000";
const name = process.env.SERVER_NAME?.trim() || os.hostname();

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

const beacon = startBeacon({ port, name });

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

// `-H 0.0.0.0` est indispensable : par défaut Next n'écoute que sur localhost
// et les tablettes auraient beau trouver le portable, elles se heurteraient à
// une connexion refusée.
const child = spawn(process.execPath, [nextBin, mode, "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  env: process.env,
});

const addresses = lanAddresses();
console.log(
  addresses.length > 0
    ? `[serveur] joignable sur le réseau : ${addresses.map((a) => `http://${a}:${port}`).join("  ")}`
    : "[serveur] aucune interface réseau détectée — le portable est-il connecté au Wi-Fi ?",
);

function closeBeacon() {
  // La balise a pu se fermer seule (port déjà pris) : refermer lèverait.
  try {
    beacon.close();
  } catch {
    /* déjà fermée */
  }
}

function shutdown() {
  closeBeacon();
  child.kill();
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

child.on("exit", (code) => {
  closeBeacon();
  process.exit(code ?? 0);
});
