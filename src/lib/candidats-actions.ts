"use server";

import { revalidatePath } from "next/cache";
import {
  candidatSchema,
  changerDisponibilite,
  creerCandidat,
  creerEtInscrire,
  deplacerParticipation,
  inscrire,
  modifierCandidat,
  retirer,
  supprimerCandidat,
} from "./candidats";
import { exigerEcriture } from "./espace";
import type { EtatFormulaire } from "./evenements-actions";
import { premiereErreur } from "./evenements-core";
import { lireImageEnvoyee } from "./image-envoyee";

const lire = (form: FormData, nom: string) => String(form.get(nom) ?? "");

/** Saisie et photo d'un candidat, ou le premier message d'erreur. */
async function lireCandidat(form: FormData) {
  const analyse = candidatSchema.safeParse({ nom: lire(form, "nom"), ville: lire(form, "ville") });
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const photo = await lireImageEnvoyee(form, "photo");
  if (typeof photo === "string") return { erreur: photo };
  return { saisie: analyse.data, photo };
}

function rafraichir() {
  revalidatePath("/espace", "layout");
}

// Bibliothèque ------------------------------------------------------------------

export async function creerCandidatAction(_e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const lu = await lireCandidat(form);
  if ("erreur" in lu) return { erreur: lu.erreur };
  await creerCandidat(utilisateur.organisationId, lu.saisie, lu.photo);
  rafraichir();
  return { succes: `${lu.saisie.nom} ajouté.` };
}

export async function modifierCandidatAction(candidatId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const lu = await lireCandidat(form);
  if ("erreur" in lu) return { erreur: lu.erreur };
  const r = await modifierCandidat(utilisateur.organisationId, candidatId, lu.saisie, lu.photo);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Enregistré." };
}

export async function supprimerCandidatAction(candidatId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await supprimerCandidat(utilisateur.organisationId, candidatId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Candidat supprimé." };
}

// Participations ----------------------------------------------------------------

export async function inscrireAction(selectionId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const ids = form.getAll("candidatId").map(String);
  const r = await inscrire(utilisateur.organisationId, selectionId, ids);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: `${r.valeur} candidat${r.valeur > 1 ? "s inscrits" : " inscrit"}.` };
}

export async function creerEtInscrireAction(selectionId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const lu = await lireCandidat(form);
  if ("erreur" in lu) return { erreur: lu.erreur };
  const r = await creerEtInscrire(utilisateur.organisationId, selectionId, lu.saisie, lu.photo);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: `${lu.saisie.nom} inscrit.` };
}

export async function retirerAction(participationId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await retirer(utilisateur.organisationId, participationId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Candidat retiré de la sélection." };
}

export async function disponibiliteAction(
  participationId: string,
  disponible: boolean,
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await changerDisponibilite(utilisateur.organisationId, participationId, disponible);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return {};
}

export async function deplacerParticipationAction(
  participationId: string,
  sens: "haut" | "bas",
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await deplacerParticipation(utilisateur.organisationId, participationId, sens);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return {};
}
