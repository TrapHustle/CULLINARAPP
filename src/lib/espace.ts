import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getSession } from "./session";

/**
 * Utilisateur connecté à l'espace des organisations, ou `null`.
 *
 * Relu en base à chaque requête : un compte supprimé perd l'accès tout de
 * suite, même avec un cookie encore valide.
 */
export async function utilisateurConnecte() {
  const session = await getSession();
  if (!session.utilisateurId) return null;

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: session.utilisateurId },
    include: { organisation: true },
  });

  // Le cookie doit désigner la même organisation que la base : sinon on
  // n'accorde rien.
  if (!utilisateur || utilisateur.organisationId !== session.organisationId) return null;
  return utilisateur;
}

/**
 * Garde des pages et actions de l'espace. Toute requête en base qui suit doit
 * être bornée à `organisationId` (RG 0.2).
 */
export async function exigerUtilisateur() {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/connexion");
  return utilisateur;
}

/** Rôles autorisés à modifier la configuration (RG 0.4). */
const ROLES_ECRITURE = new Set(["PROPRIETAIRE", "ORGANISATEUR"]);

/** Garde des actions qui modifient : un compte en lecture seule ou jury est refusé. */
export async function exigerEcriture() {
  const utilisateur = await exigerUtilisateur();
  if (!ROLES_ECRITURE.has(utilisateur.role)) {
    throw new Error("Votre rôle ne permet pas de modifier la configuration.");
  }
  return utilisateur;
}

/** Initiales affichées dans l'avatar : deux lettres tirées de l'adresse. */
export function initiales(email: string): string {
  const local = email.split("@")[0] ?? "";
  const morceaux = local.split(/[._-]+/).filter(Boolean);
  const lettres = morceaux.length >= 2 ? morceaux[0][0] + morceaux[1][0] : local.slice(0, 2);
  return lettres.toUpperCase() || "?";
}
