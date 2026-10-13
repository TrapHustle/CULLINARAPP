import { z } from "zod";

/**
 * Comptes des organisations : règles de saisie, sans base ni réseau.
 *
 * Un compte, c'est une ORGANISATION (le client) et son premier UTILISATEUR, le
 * propriétaire (RG 0.1, 0.3).
 */

export const ROLES = ["PROPRIETAIRE", "ORGANISATEUR", "JURY", "LECTURE"] as const;
export type Role = (typeof ROLES)[number];

/** Longueur minimale d'un mot de passe : une phrase courte vaut mieux qu'un code. */
export const MOT_DE_PASSE_MIN = 10;

export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

const email = z
  .string()
  .trim()
  .min(1, "Indiquez votre adresse e-mail.")
  .max(200, "Cette adresse est trop longue.")
  .email("Cette adresse e-mail n'est pas valide.")
  .transform(normaliserEmail);

export const inscriptionSchema = z
  .object({
    organisation: z
      .string()
      .trim()
      .min(2, "Indiquez le nom de votre organisation.")
      .max(80, "Ce nom est trop long (80 caractères au plus)."),
    email,
    motDePasse: z
      .string()
      .min(MOT_DE_PASSE_MIN, `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`)
      .max(200, "Ce mot de passe est trop long."),
    confirmation: z.string(),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: "Les deux mots de passe ne sont pas identiques.",
    path: ["confirmation"],
  });

export const connexionSchema = z.object({
  email,
  motDePasse: z.string().min(1, "Indiquez votre mot de passe.").max(200),
});

export type Inscription = z.infer<typeof inscriptionSchema>;
export type Connexion = z.infer<typeof connexionSchema>;

/** Premier message d'erreur d'une saisie refusée, à afficher tel quel. */
export function premiereErreur(erreur: z.ZodError): string {
  return erreur.issues[0]?.message ?? "Saisie invalide.";
}
