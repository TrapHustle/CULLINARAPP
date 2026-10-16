"use server";

import { revalidatePath } from "next/cache";
import { exigerUtilisateur } from "./espace";
import { ajouterMembre, changementSchema, changerMotDePasse, changerRole, membreSchema, retirerMembre, ROLES_EQUIPE, type RoleEquipe } from "./equipe";
import type { EtatFormulaire } from "./evenements-actions";
import { premiereErreur } from "./evenements-core";
import { annulerRetrait, demanderRetrait } from "./recettes";

const lire = (form: FormData, nom: string) => String(form.get(nom) ?? "");
const RESERVE = { erreur: "Réservé au propriétaire du compte." };

async function proprietaire() {
  const utilisateur = await exigerUtilisateur();
  return utilisateur.role === "PROPRIETAIRE" ? utilisateur : null;
}

// Recettes -------------------------------------------------------------------

export async function demanderRetraitAction(_e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const u = await proprietaire();
  if (!u) return RESERVE;
  const r = await demanderRetrait(u.organisationId, u.email, {
    montant: lire(form, "montant"),
    moyen: lire(form, "moyen"),
    telephone: lire(form, "telephone"),
    note: lire(form, "note"),
  });
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/espace", "layout");
  revalidatePath("/plateforme", "layout");
  return {
    succes: `Demande de ${r.valeur.montant.toLocaleString("fr-FR")} FCFA envoyée${r.valeur.mail ? " : la plateforme est prévenue par e-mail." : "."}`,
  };
}

export async function annulerRetraitAction(demandeId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const u = await proprietaire();
  if (!u) return RESERVE;
  const r = await annulerRetrait(u.organisationId, demandeId);
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/espace", "layout");
  return { succes: "Demande annulée." };
}

// Équipe ---------------------------------------------------------------------

export async function ajouterMembreAction(_e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const u = await proprietaire();
  if (!u) return RESERVE;
  const analyse = membreSchema.safeParse({ email: lire(form, "email"), role: lire(form, "role"), motDePasse: lire(form, "motDePasse") });
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const r = await ajouterMembre(u.organisationId, analyse.data);
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/espace/equipe");
  return { succes: `${analyse.data.email} peut se connecter avec le mot de passe choisi.` };
}

export async function changerRoleAction(utilisateurId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const u = await proprietaire();
  if (!u) return RESERVE;
  const role = lire(form, "role");
  if (!(ROLES_EQUIPE as readonly string[]).includes(role)) return { erreur: "Rôle inconnu." };
  const r = await changerRole(u.organisationId, utilisateurId, role as RoleEquipe);
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/espace/equipe");
  return { succes: "Rôle modifié." };
}

export async function retirerMembreAction(utilisateurId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const u = await proprietaire();
  if (!u) return RESERVE;
  const r = await retirerMembre(u.organisationId, utilisateurId, u.id);
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/espace/equipe");
  return { succes: "Accès retiré." };
}

// Mon compte -------------------------------------------------------------------

export async function changerMotDePasseAction(_e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const u = await exigerUtilisateur();
  const analyse = changementSchema.safeParse({
    actuel: lire(form, "actuel"),
    nouveau: lire(form, "nouveau"),
    confirmation: lire(form, "confirmation"),
  });
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const r = await changerMotDePasse(u.id, analyse.data.actuel, analyse.data.nouveau);
  if (!r.ok) return { erreur: r.erreur };
  return { succes: "Mot de passe changé." };
}
