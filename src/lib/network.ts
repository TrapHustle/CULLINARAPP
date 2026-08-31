import os from "node:os";

/** Port UDP sur lequel le serveur répond aux tablettes qui le cherchent. */
export const DISCOVERY_PORT = 45678;

/** Question envoyée en diffusion par les tablettes sur le réseau Wi-Fi. */
export const DISCOVERY_PROBE = "CONCOURS_VOTE_DISCOVER?";

/** Nom du service annoncé dans les réponses, pour ne pas confondre avec un autre logiciel. */
export const DISCOVERY_SERVICE = "concours-vote";

/**
 * Adresses IPv4 du serveur sur le réseau local.
 *
 * Elles ne servent plus à appairer les tablettes — celles-ci trouvent le
 * serveur toutes seules sur le Wi-Fi (§10.3) — mais restent affichées dans le
 * dashboard à titre de diagnostic : voir sur quel réseau le portable est
 * réellement connecté aide à comprendre pourquoi une tablette ne trouve rien.
 */
export function lanAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      // `family` vaut "IPv4" (Node ≥ 18) ; on écarte la boucle locale.
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

/** Port d'écoute du serveur, tel que défini au lancement. */
export function serverPort(): string {
  return process.env.PORT ?? "3000";
}

/** Nom lisible du serveur, affiché sur les tablettes pendant la recherche. */
export function serverName(): string {
  return process.env.SERVER_NAME?.trim() || os.hostname();
}

/**
 * Adresse publique du serveur, quand il est hébergé en ligne.
 *
 * Dans ce cas les tablettes ne cherchent rien : l'URL est embarquée dans l'APK
 * à la compilation. La découverte Wi-Fi ne concerne que le mode réseau local.
 */
export function publicUrl(): string | null {
  return process.env.APP_PUBLIC_URL?.trim().replace(/\/+$/, "") || null;
}

/** Vrai si le serveur est joint par une adresse publique plutôt que par le Wi-Fi de la salle. */
export function isPubliclyHosted(): boolean {
  return publicUrl() !== null;
}
