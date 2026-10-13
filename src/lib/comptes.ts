import { prisma } from "./prisma";
import { hacherMotDePasse, verifierMotDePasse } from "./mot-de-passe";
import type { Connexion, Inscription } from "./comptes-core";

/**
 * Comptes des organisations : accès à la base. Les actions serveur
 * (`comptes-actions.ts`) ajoutent la session et la limite d'essais.
 */

export type ResultatCompte =
  | { ok: true; utilisateurId: string; organisationId: string }
  | { ok: false; erreur: string };

/** Crée l'organisation et son propriétaire, ensemble ou pas du tout. */
export async function creerCompte(saisie: Inscription): Promise<ResultatCompte> {
  const existant = await prisma.utilisateur.findUnique({ where: { email: saisie.email } });
  if (existant) {
    return { ok: false, erreur: "Un compte existe déjà avec cette adresse. Connectez-vous." };
  }

  const motDePasseHash = await hacherMotDePasse(saisie.motDePasse);

  try {
    const utilisateur = await prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.create({ data: { nom: saisie.organisation } });
      return tx.utilisateur.create({
        data: {
          organisationId: organisation.id,
          email: saisie.email,
          motDePasseHash,
          role: "PROPRIETAIRE",
        },
      });
    });
    return { ok: true, utilisateurId: utilisateur.id, organisationId: utilisateur.organisationId };
  } catch (erreur) {
    // Deux inscriptions simultanées avec la même adresse : la contrainte
    // d'unicité tranche, la seconde est refusée proprement.
    if ((erreur as { code?: string }).code === "P2002") {
      return { ok: false, erreur: "Un compte existe déjà avec cette adresse. Connectez-vous." };
    }
    throw erreur;
  }
}

/**
 * Vérifie l'adresse et le mot de passe. Le message d'échec est le même dans
 * les deux cas : il ne doit pas révéler quelles adresses ont un compte.
 */
export async function authentifier(saisie: Connexion): Promise<ResultatCompte> {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { email: saisie.email } });
  // Sans compte, on calcule quand même une empreinte : sinon la réponse,
  // plus rapide, trahirait que l'adresse n'existe pas.
  const ok = await verifierMotDePasse(saisie.motDePasse, utilisateur?.motDePasseHash ?? (await leurre()));
  if (!utilisateur) return { ok: false, erreur: "Adresse e-mail ou mot de passe incorrect." };

  if (!ok) return { ok: false, erreur: "Adresse e-mail ou mot de passe incorrect." };
  return { ok: true, utilisateurId: utilisateur.id, organisationId: utilisateur.organisationId };
}

let empreinteLeurre: Promise<string> | null = null;

/** Empreinte d'un mot de passe que personne ne possède, calculée une fois. */
function leurre(): Promise<string> {
  empreinteLeurre ??= hacherMotDePasse(crypto.randomUUID());
  return empreinteLeurre;
}
