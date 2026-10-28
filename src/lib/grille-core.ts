import { z } from "zod";
import { MAX_VOTE_PRICE, MIN_VOTE_PRICE, PAYMENT_METHODS, type PaymentMethod } from "./public-vote-core";

/**
 * Grille de vote : types de vote, critères, paliers et réglages du vote en
 * ligne. Règles de saisie et contrôles, sans base ni réseau (RG 3, 4, 7, 8.3).
 */

export const CANAUX = ["SALLE", "EN_LIGNE", "QR"] as const;
export type Canal = (typeof CANAUX)[number];

export const LIBELLES_CANAL: Record<Canal, string> = {
  SALLE: "En salle",
  EN_LIGNE: "En ligne",
  QR: "Par QR code",
};

/**
 * Qui peut voter par le lien d'un vote "QR" ou en salle : tout numéro
 * ("OUVERT"), ou seulement les numéros autorisés ("RESTREINT").
 */
export const ACCES = ["OUVERT", "RESTREINT"] as const;
export type Acces = (typeof ACCES)[number];

export const LIBELLES_ACCES: Record<Acces, string> = {
  OUVERT: "Normal · ouvert à tous",
  RESTREINT: "Restreint",
};

export const MODES_EN_LIGNE = ["A", "B", "C"] as const;
export type ModeEnLigneSaisi = (typeof MODES_EN_LIGNE)[number];

export const LIBELLES_MODE: Record<ModeEnLigneSaisi, { titre: string; detail: string }> = {
  A: {
    titre: "A · Part de voix relative",
    detail: "Voix du candidat ÷ total des voix × 100. Pour un vote gratuit ou semi-gratuit.",
  },
  B: {
    titre: "B · Paliers progressifs",
    detail: "Des points atteints à des plafonds de voix, règle de trois entre deux plafonds. Pour un vote payant communautaire.",
  },
  C: {
    titre: "C · Par leader",
    detail: "Voix du candidat ÷ voix du premier × 100 : le premier a 100. Pour un vote 100 % payant très disputé.",
  },
};

export const LIBELLES_MOYEN: Record<PaymentMethod, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MTN: "MTN MoMo",
  CARD: "Carte bancaire",
};

/** Bornes d'un barème : la note maximale d'un critère (RG 3.4). */
export const BAREME_MAX = 100;

/** Nombre décimal saisi en français : « 33,5 » comme « 33.5 ». */
const decimal = (message: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), message)
    .transform(Number);

const entier = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d{1,7}$/.test(v), message)
    .transform(Number)
    .refine((v) => v >= min && v <= max, message);

export const typeVoteSchema = z
  .object({
    libelle: z.string().trim().min(2, "Indiquez le nom du type de vote.").max(60, "Ce nom est trop long (60 caractères au plus)."),
    canal: z.enum(CANAUX, { message: "Choisissez le canal : en salle, en ligne ou par QR code." }),
    avecCriteres: z.boolean(),
    acces: z.enum(ACCES, { message: "Choisissez qui peut voter." }).default("OUVERT"),
    part: decimal("La part est un pourcentage, par exemple 40.").refine((v) => v <= 100, "La part ne peut pas dépasser 100 %."),
  })
  // Le vote en ligne et le vote par QR comptent des voix : jamais de critère
  // (RG 4.2). Le vote en ligne, payant, n'a pas de liste de numéros.
  .transform((d) => ({
    ...d,
    avecCriteres: d.canal === "SALLE" ? d.avecCriteres : false,
    acces: d.canal === "EN_LIGNE" ? ("OUVERT" as const) : d.acces,
  }));

export const critereSchema = z.object({
  libelle: z.string().trim().min(2, "Indiquez le nom du critère.").max(60, "Ce nom est trop long (60 caractères au plus)."),
  bareme: entier(1, BAREME_MAX, `Le barème est la note maximale, un entier de 1 à ${BAREME_MAX}.`),
});

export type SaisieTypeVote = z.infer<typeof typeVoteSchema>;
export type SaisieCritere = z.infer<typeof critereSchema>;

export interface PalierSaisi {
  voixMax: number;
  points: number;
}

/**
 * Paliers du mode B (RG 8.3) : plafonds de voix strictement croissants, points
 * croissants, sur 100 au plus. Les lignes laissées vides sont ignorées.
 */
export function lirePaliers(voixMax: string[], points: string[]): { ok: true; paliers: PalierSaisi[] } | { ok: false; erreur: string } {
  const paliers: PalierSaisi[] = [];
  for (let i = 0; i < Math.max(voixMax.length, points.length); i++) {
    const v = (voixMax[i] ?? "").trim();
    const p = (points[i] ?? "").trim().replace(",", ".");
    if (v === "" && p === "") continue;
    if (!/^\d{1,7}$/.test(v) || Number(v) <= 0) {
      return { ok: false, erreur: `Palier ${i + 1} : le plafond est un nombre de voix entier, au moins 1.` };
    }
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(p) || Number(p) <= 0 || Number(p) > 100) {
      return { ok: false, erreur: `Palier ${i + 1} : les points sont sur 100 (plus de 0, 100 au plus).` };
    }
    paliers.push({ voixMax: Number(v), points: Number(p) });
  }

  for (let i = 1; i < paliers.length; i++) {
    if (paliers[i].voixMax <= paliers[i - 1].voixMax) {
      return { ok: false, erreur: "Les plafonds de voix doivent aller en croissant, d'un palier au suivant." };
    }
    if (paliers[i].points < paliers[i - 1].points) {
      return { ok: false, erreur: "Les points ne peuvent pas baisser d'un palier au suivant." };
    }
  }
  return { ok: true, paliers };
}

export const reglagesEnLigneSchema = z.object({
  prixVote: entier(MIN_VOTE_PRICE, MAX_VOTE_PRICE, `Le prix d'une voix va de ${MIN_VOTE_PRICE} à ${MAX_VOTE_PRICE.toLocaleString("fr-FR")} FCFA.`),
  voixGratuite: z.boolean(),
  compteursVisibles: z.boolean(),
  modeEnLigne: z.enum(MODES_EN_LIGNE, { message: "Choisissez un mode de calcul." }),
  moyensPaiement: z
    .array(z.enum(PAYMENT_METHODS))
    .min(1, "Cochez au moins un moyen de paiement.")
    .transform((m) => [...new Set(m)]),
});

export type SaisieReglagesEnLigne = z.infer<typeof reglagesEnLigneSchema>;

// Grille proposée -----------------------------------------------------------

export interface TypePropose {
  libelle: string;
  canal: Canal;
  avecCriteres: boolean;
  payant: boolean;
  part: number;
  criteres: { libelle: string; bareme: number }[];
}

/**
 * Grille posée à la création d'un événement : les parts par défaut de RG 4.5
 * (en ligne 30 %, salle 30 %, jury 40 %). L'organisateur la modifie ensuite.
 */
export const GRILLE_PROPOSEE: TypePropose[] = [
  {
    libelle: "Jury",
    canal: "SALLE",
    avecCriteres: true,
    payant: false,
    part: 40,
    criteres: [
      { libelle: "Goût", bareme: 20 },
      { libelle: "Présentation", bareme: 10 },
    ],
  },
  {
    libelle: "Salle",
    canal: "SALLE",
    avecCriteres: true,
    payant: false,
    part: 30,
    criteres: [
      { libelle: "Goût", bareme: 20 },
      { libelle: "Présentation", bareme: 10 },
    ],
  },
  { libelle: "Vote en ligne", canal: "EN_LIGNE", avecCriteres: false, payant: true, part: 30, criteres: [] },
];

/** Créations imbriquées de la grille proposée, pour `evenement.typesModeles`. */
export function creationsGrilleProposee() {
  return GRILLE_PROPOSEE.map((t, ordre) => ({
    libelle: t.libelle,
    canal: t.canal,
    avecCriteres: t.avecCriteres,
    payant: t.payant,
    part: t.part,
    ordre,
    criteres: { create: t.criteres.map((c, i) => ({ ...c, ordre: i })) },
  }));
}

const ALPHABET_LIEN = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Code du lien public d'un type de vote (/q/<code>) : court, pour un QR code
 * peu dense et facile à scanner, et tiré au hasard pour ne pas se deviner.
 */
export function codeLien(): string {
  const octets = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(octets, (o) => ALPHABET_LIEN[o % ALPHABET_LIEN.length]).join("");
}

/** Créations imbriquées qui recopient une grille de référence dans une sélection (RG 3.2). */
export function creationsDepuisModeles(
  modeles: {
    libelle: string;
    canal: string;
    payant: boolean;
    avecCriteres: boolean;
    acces: string;
    part: number;
    deroule: string;
    ordre: number;
    criteres: { libelle: string; ordre: number; bareme: number }[];
  }[],
) {
  return modeles.map((m) => ({
    libelle: m.libelle,
    canal: m.canal,
    payant: m.payant,
    avecCriteres: m.avecCriteres,
    acces: m.acces,
    lien: codeLien(),
    part: m.part,
    deroule: m.deroule,
    ordre: m.ordre,
    criteres: { create: m.criteres.map((c) => ({ libelle: c.libelle, ordre: c.ordre, bareme: c.bareme })) },
  }));
}

// Contrôles -----------------------------------------------------------------

export interface TypeAControler {
  libelle: string;
  canal: string;
  avecCriteres: boolean;
  part: number;
  criteres: unknown[];
}

/** Somme des parts, arrondie au centième pour neutraliser les flottants. */
export function sommeDesParts(types: { part: number }[]): number {
  return Math.round(types.reduce((s, t) => s + t.part, 0) * 100) / 100;
}

/** Ce qui manque à une grille pour qu'on puisse voter avec (RG 4). Vide si rien. */
export function problemesGrille(types: TypeAControler[]): string[] {
  const problemes: string[] = [];
  if (types.length === 0) return ["Ajoutez au moins un type de vote."];

  const somme = sommeDesParts(types);
  if (somme !== 100) problemes.push(`Les parts font ${somme.toLocaleString("fr-FR")} % au total : il faut 100 %.`);

  for (const t of types) {
    if (t.part <= 0) problemes.push(`« ${t.libelle} » a une part nulle : donnez-lui une part ou supprimez-le.`);
    if (t.avecCriteres && t.criteres.length === 0) problemes.push(`« ${t.libelle} » note sur des critères, mais n'en a aucun.`);
  }

  if (types.filter((t) => t.canal === "EN_LIGNE").length > 1) {
    problemes.push("Un seul type de vote en ligne par grille.");
  }
  return problemes;
}

/** Les modes de paiement proposés, dans l'ordre d'affichage. */
export const MOYENS: PaymentMethod[] = [...PAYMENT_METHODS];
