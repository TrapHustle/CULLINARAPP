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
