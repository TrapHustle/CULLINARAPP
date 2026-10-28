import { z } from "zod";

/**
 * Règles pures de l'API des tablettes (`/api/tablette/...`), sans base : de
 * quoi les tester directement.
 */

/** Durée du jeton d'une tablette : une saison de concours, la tablette reste connectée. */
export const DUREE_JETON_S = 180 * 24 * 60 * 60;

/** Nombre de votes au plus par envoi : une tablette renvoie le reste au lot suivant. */
export const LOT_MAX = 500;

/**
 * Un vote saisi sur une tablette. `id` est tiré par la tablette : renvoyé dix
 * fois, il ne crée qu'un vote. `valeurs` donne une note par critère pour un
 * vote avec critères ; il est absent pour un vote par voix.
 */
export const suffrageTabletteSchema = z.object({
  id: z.string().uuid("Identifiant de vote invalide."),
  typeVoteId: z.string().min(1).max(64),
  participationId: z.string().min(1).max(64),
  jure: z.number().int().min(1).max(999),
  valeurs: z.record(z.string().min(1).max(64), z.number().int().min(0).max(1000)).nullish(),
});

export type SuffrageTablette = z.infer<typeof suffrageTabletteSchema>;

export const lotTabletteSchema = z.object({
  suffrages: z.array(z.unknown()).max(LOT_MAX, `Pas plus de ${LOT_MAX} votes par envoi.`),
});

/**
 * Contrôle les notes d'un vote contre les critères de son type : une note
 * entière par critère, de 0 à son barème, rien de plus. Pour un type sans
 * critère, aucune note n'est attendue. Renvoie le motif du refus, ou `null`.
 */
export function controlerValeurs(
  type: { avecCriteres: boolean; criteres: { id: string; libelle: string; bareme: number }[] },
  valeurs: Record<string, number> | null | undefined,
): string | null {
  if (!type.avecCriteres) {
    return valeurs && Object.keys(valeurs).length > 0 ? "Ce vote compte des voix : il n'a pas de notes." : null;
  }
  if (type.criteres.length === 0) return "Ce vote n'a pas encore de critères.";
  if (!valeurs) return "Les notes manquent.";
  const attendus = new Set(type.criteres.map((c) => c.id));
  for (const id of Object.keys(valeurs)) {
    if (!attendus.has(id)) return "Une note porte sur un critère inconnu.";
  }
  for (const c of type.criteres) {
    const v = valeurs[c.id];
    if (v === undefined) return `La note « ${c.libelle} » manque.`;
    if (!Number.isInteger(v) || v < 0 || v > c.bareme) return `« ${c.libelle} » est une note de 0 à ${c.bareme}.`;
  }
  return null;
}
