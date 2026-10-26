import { z } from "zod";

/**
 * Événements et sélections : règles de saisie, sans base ni réseau
 * (RG 1.1 à 1.5).
 */

export const ETATS_SELECTION = ["PREPAREE", "OUVERTE", "CLOTUREE"] as const;
export type EtatSelection = (typeof ETATS_SELECTION)[number];

export const LIBELLES_ETAT: Record<EtatSelection, string> = {
  PREPAREE: "Préparée",
  OUVERTE: "Ouverte",
  CLOTUREE: "Clôturée",
};

/** Champ texte facultatif : une saisie vide devient `null`. */
const texteFacultatif = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

/** `AAAA-MM-JJ` (champ date) → minuit UTC, ou `null`. */
const dateFacultative = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide.")
  .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00Z`)));

/**
 * `AAAA-MM-JJTHH:MM` (champ date et heure) → instant, ou `null`.
 *
 * L'heure saisie est celle d'Abidjan, qui est l'heure UTC toute l'année : on
 * peut donc la lire telle quelle sans fuseau à convertir.
 */
const dateHeureFacultative = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Date et heure invalides.")
  .transform((v) => (v === "" ? null : new Date(`${v}:00Z`)));

export const evenementSchema = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom de l'événement.").max(120, "Ce nom est trop long (120 caractères au plus)."),
  edition: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,3}$/.test(v), "L'édition est un nombre, par exemple 7.")
    .transform((v) => (v === "" ? null : Number(v))),
  sousTitre: texteFacultatif(120, "Le sous-titre est trop long (120 caractères au plus)."),
  date: dateFacultative,
});

export const selectionSchema = z
  .object({
    libelle: z.string().trim().min(2, "Indiquez le nom de la sélection.").max(120, "Ce nom est trop long (120 caractères au plus)."),
    lieu: texteFacultatif(120, "Le lieu est trop long (120 caractères au plus)."),
    debut: dateHeureFacultative,
    fin: dateHeureFacultative,
    nbQualifies: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{1,4}$/.test(v), "Le nombre de qualifiés est un nombre entier.")
      .transform((v) => (v === "" ? 0 : Number(v))),
  })
  .refine((d) => !d.debut || !d.fin || d.fin > d.debut, {
    message: "La fin doit être après le début.",
    path: ["fin"],
  });

export type SaisieEvenement = z.infer<typeof evenementSchema>;
export type SaisieSelection = z.infer<typeof selectionSchema>;

/**
 * Partie lisible du lien public de vote (RG 7.1) : minuscules, sans accents,
 * mots séparés par des tirets. « 1ʳᵉ sélection · Bouaké » → « 1re-selection-bouake ».
 */
export function slugifier(texte: string): string {
  const slug = texte
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "selection";
}

/** Premier slug libre : `base`, puis `base-2`, `base-3`… */
export function slugLibre(base: string, pris: Set<string>): string {
  if (!pris.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidat = `${base}-${n}`;
    if (!pris.has(candidat)) return candidat;
  }
}

/** Valeur d'un champ `date` à partir d'une date stockée. */
export function versChampDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Valeur d'un champ `datetime-local` à partir d'un instant stocké (heure d'Abidjan = UTC). */
export function versChampDateHeure(date: Date | null): string {
  return date ? date.toISOString().slice(0, 16) : "";
}

export function premiereErreur(erreur: z.ZodError): string {
  return erreur.issues[0]?.message ?? "Saisie invalide.";
}

// Liste des événements ---------------------------------------------------------

export type StatutEvenement = "EN_COURS" | "A_VENIR" | "PASSE";

/**
 * Où en est un événement, d'après ses sélections : en cours dès qu'une est
 * ouverte, passé quand toutes sont clôturées, à venir sinon (rien d'ouvert
 * encore, ou pas de sélection).
 */
export function statutEvenement(etats: string[]): StatutEvenement {
  if (etats.includes("OUVERTE")) return "EN_COURS";
  if (etats.length > 0 && etats.every((e) => e === "CLOTUREE")) return "PASSE";
  return "A_VENIR";
}

/** La sélection qui représente l'événement : l'ouverte, sinon la prochaine à ouvrir, sinon la dernière. */
export function selectionVitrine<T extends { etat: string }>(selections: T[]): T | null {
  return (
    selections.find((s) => s.etat === "OUVERTE") ??
    selections.find((s) => s.etat === "PREPAREE") ??
    selections[selections.length - 1] ??
    null
  );
}
