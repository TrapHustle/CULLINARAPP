/**
 * Récupère des visages **générés par IA** pour les jeux de test.
 *
 * Les images viennent de `thispersondoesnotexist.com`, qui produit des visages
 * synthétiques : personne n'y est reconnaissable, ce qui évite d'afficher la
 * photo d'un individu réel sur un faux candidat.
 *
 * C'est un utilitaire de répétition, jamais un chemin de production : il exige
 * internet, alors que le serveur doit rester utilisable sans. En cas d'échec,
 * l'appelant retombe sur les portraits dessinés localement (`portrait.mts`).
 */
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const SOURCE = "https://thispersondoesnotexist.com/random-person.jpeg";

/** Un JPEG commence toujours par ces trois octets. */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function fetchOne(signal?: AbortSignal): Promise<Buffer> {
  const response = await fetch(SOURCE, {
    signal,
    // Sans en-tête de navigateur, la protection anti-robot renvoie une page
    // HTML au lieu de l'image.
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "image/jpeg,image/*",
      // Le service sert volontiers la même image deux fois de suite si on la
      // laisse venir du cache : on l'interdit explicitement.
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`réponse ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!isJpeg(bytes)) {
    throw new Error("la réponse n'est pas une image JPEG");
  }
  if (bytes.length < 10_000) {
    throw new Error(`image suspecte (${bytes.length} octets)`);
  }

  return bytes;
}

/**
 * Télécharge `count` visages **tous différents**.
 *
 * L'unicité est vérifiée par empreinte : le service renvoie parfois deux fois
 * la même image, et deux candidats au même visage rendraient le jeu de test
 * trompeur — on croirait à un bug d'affichage.
 */
export async function fetchFaces(
  count: number,
  onProgress?: (index: number, bytes: number) => void,
): Promise<Buffer[]> {
  const faces: Buffer[] = [];
  const seen = new Set<string>();

  // Large marge d'essais : chaque échec est soit un doublon, soit un aléa
  // réseau, et abandonner au premier accroc gâcherait le reste du lot.
  const maxAttempts = count * 5;
  let attempts = 0;
  let lastError: unknown;

  while (faces.length < count && attempts < maxAttempts) {
    attempts++;
    try {
      const bytes = await fetchOne(AbortSignal.timeout(20_000));
      const digest = createHash("sha256").update(bytes).digest("hex");

      if (seen.has(digest)) {
        await sleep(1200);
        continue;
      }

      seen.add(digest);
      faces.push(bytes);
      onProgress?.(faces.length, bytes.length);
    } catch (error) {
      lastError = error;
    }

    // Le service génère une image par requête : on lui laisse le temps de
    // renouveler la sienne, et on évite de le marteler.
    if (faces.length < count) await sleep(900);
  }

  if (faces.length < count) {
    const reason = lastError instanceof Error ? lastError.message : "cause inconnue";
    throw new Error(
      `${faces.length}/${count} visages seulement après ${attempts} tentatives (${reason})`,
    );
  }

  return faces;
}
