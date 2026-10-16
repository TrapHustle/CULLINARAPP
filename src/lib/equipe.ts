import { z } from "zod";
import { prisma } from "./prisma";
import type { Resultat } from "./evenements";
import { MOT_DE_PASSE_MIN, normaliserEmail } from "./comptes-core";
import { hacherMotDePasse, verifierMotDePasse } from "./mot-de-passe";

/**
 * Équipe de l'organisation (RG 0.3, 0.4) et mot de passe de chacun.
 * Seul le propriétaire gère l'équipe ; il reste toujours au moins un
 * propriétaire.
 */

export const ROLES_EQUIPE = ["PROPRIETAIRE", "ORGANISATEUR", "JURY", "LECTURE"] as const;
export type RoleEquipe = (typeof ROLES_EQUIPE)[number];

export const LIBELLES_ROLE: Record<string, { nom: string; detail: string }> = {
  PROPRIETAIRE: { nom: "Propriétaire", detail: "Tout, y compris l'équipe et les retraits." },
  ORGANISATEUR: { nom: "Organisateur", detail: "Prépare et pilote les concours." },
  JURY: { nom: "Jury", detail: "Consulte, sans rien modifier." },
  LECTURE: { nom: "Lecture seule", detail: "Consulte, sans rien modifier." },
  SUPERADMIN: { nom: "Plateforme", detail: "Administration de DIGITALYX-VOTE." },
};

const motDePasse = z
  .string()
  .min(MOT_DE_PASSE_MIN, `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`)
  .max(200, "Ce mot de passe est trop long.");

export const membreSchema = z.object({
  email: z.string().trim().min(1, "Indiquez l'adresse e-mail.").max(200).email("Cette adresse e-mail n'est pas valide.").transform(normaliserEmail),
  role: z.enum(ROLES_EQUIPE, { message: "Choisissez un rôle." }),
  motDePasse,
});

export const changementSchema = z
  .object({ actuel: z.string().min(1, "Indiquez votre mot de passe actuel."), nouveau: motDePasse, confirmation: z.string() })
  .refine((d) => d.nouveau === d.confirmation, { message: "Les deux mots de passe ne sont pas identiques.", path: ["confirmation"] });

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };
const OK = { ok: true as const, valeur: undefined };

export function listerEquipe(organisationId: string) {
  return prisma.utilisateur.findMany({ where: { organisationId }, orderBy: { creeLe: "asc" } });
}

export async function ajouterMembre(organisationId: string, saisie: z.infer<typeof membreSchema>): Promise<Resultat> {
  if (await prisma.utilisateur.findUnique({ where: { email: saisie.email } })) {
    return { ok: false, erreur: "Un compte existe déjà avec cette adresse." };
  }
  try {
    await prisma.utilisateur.create({
      data: { organisationId, email: saisie.email, role: saisie.role, motDePasseHash: await hacherMotDePasse(saisie.motDePasse) },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, erreur: "Un compte existe déjà avec cette adresse." };
    throw e;
  }
  return OK;
}

/** Nombre de propriétaires, pour ne jamais retirer le dernier. */
async function proprietaires(organisationId: string) {
  return prisma.utilisateur.count({ where: { organisationId, role: "PROPRIETAIRE" } });
}

export async function changerRole(organisationId: string, utilisateurId: string, role: RoleEquipe): Promise<Resultat> {
  const membre = await prisma.utilisateur.findFirst({ where: { id: utilisateurId, organisationId } });
  if (!membre || membre.role === "SUPERADMIN") return INTROUVABLE;
  if (membre.role === "PROPRIETAIRE" && role !== "PROPRIETAIRE" && (await proprietaires(organisationId)) <= 1) {
    return { ok: false, erreur: "Il faut au moins un propriétaire : nommez-en un autre d'abord." };
  }
  await prisma.utilisateur.update({ where: { id: utilisateurId }, data: { role } });
  return OK;
}

export async function retirerMembre(organisationId: string, utilisateurId: string, moi: string): Promise<Resultat> {
  if (utilisateurId === moi) return { ok: false, erreur: "Vous ne pouvez pas retirer votre propre compte." };
  const membre = await prisma.utilisateur.findFirst({ where: { id: utilisateurId, organisationId } });
  if (!membre || membre.role === "SUPERADMIN") return INTROUVABLE;
  if (membre.role === "PROPRIETAIRE" && (await proprietaires(organisationId)) <= 1) {
    return { ok: false, erreur: "Il faut au moins un propriétaire." };
  }
  await prisma.utilisateur.delete({ where: { id: utilisateurId } });
  return OK;
}

export async function changerMotDePasse(utilisateurId: string, actuel: string, nouveau: string): Promise<Resultat> {
  const u = await prisma.utilisateur.findUnique({ where: { id: utilisateurId } });
  if (!u) return INTROUVABLE;
  if (!(await verifierMotDePasse(actuel, u.motDePasseHash))) return { ok: false, erreur: "Le mot de passe actuel est incorrect." };
  await prisma.utilisateur.update({ where: { id: utilisateurId }, data: { motDePasseHash: await hacherMotDePasse(nouveau) } });
  return OK;
}
