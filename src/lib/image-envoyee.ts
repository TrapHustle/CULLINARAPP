import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./validation";

export type ImageEnvoyee = { type: string; donnees: Uint8Array<ArrayBuffer> };

/**
 * Image envoyée dans un champ fichier : absente (`null`), refusée (message)
 * ou prête à enregistrer.
 */
export async function lireImageEnvoyee(form: FormData, champ: string): Promise<ImageEnvoyee | string | null> {
  const fichier = form.get(champ);
  if (!(fichier instanceof File) || fichier.size === 0) return null;
  if (!ACCEPTED_IMAGE_TYPES.includes(fichier.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "Format d'image accepté : JPEG, PNG ou WebP.";
  }
  if (fichier.size > MAX_IMAGE_BYTES) {
    return `Image trop lourde (${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} Mo au plus).`;
  }
  return { type: fichier.type, donnees: new Uint8Array(await fichier.arrayBuffer()) };
}
