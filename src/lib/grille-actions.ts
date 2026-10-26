"use server";

import { revalidatePath } from "next/cache";
import { exigerEcriture } from "./espace";
import type { EtatFormulaire } from "./evenements-actions";
import { premiereErreur } from "./evenements-core";
import {
  ajouterCritere,
  ajouterType,
  deplacerCritere,
  modifierCritere,
  modifierType,
  poserGrilleProposee,
  reglerEnLigne,
  reprendreGrilleEvenement,
  supprimerCritere,
  supprimerType,
  type Niveau,
} from "./grille";
import { critereSchema, lirePaliers, reglagesEnLigneSchema, typeVoteSchema } from "./grille-core";

/**
 * Actions de la grille de vote. Chaque action reçoit, liés à l'avance par la
 * page, l'événement et la sélection (`null` pour la grille de référence de
 * l'événement).
 */

const lire = (form: FormData, nom: string) => String(form.get(nom) ?? "");

function niveau(evenementId: string, selectionId: string | null): Niveau {
  return selectionId ? { kind: "selection", id: selectionId } : { kind: "evenement", id: evenementId };
}

function rafraichir(evenementId: string) {
  revalidatePath(`/espace/e/${evenementId}`, "layout");
}

function lireType(form: FormData) {
  return {
    libelle: lire(form, "libelle"),
    canal: lire(form, "canal"),
    avecCriteres: form.get("avecCriteres") === "on",
    acces: lire(form, "acces") || "OUVERT",
    part: lire(form, "part"),
  };
}

function lireCritere(form: FormData) {
  return { libelle: lire(form, "libelle"), bareme: lire(form, "bareme") };
}

export async function ajouterTypeAction(
  evenementId: string,
  selectionId: string | null,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const analyse = typeVoteSchema.safeParse(lireType(form));
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const r = await ajouterType(utilisateur.organisationId, niveau(evenementId, selectionId), analyse.data);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: `Type « ${analyse.data.libelle} » ajouté.` };
}

export async function modifierTypeAction(
  evenementId: string,
  selectionId: string | null,
  typeId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const analyse = typeVoteSchema.safeParse(lireType(form));
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const r = await modifierType(utilisateur.organisationId, niveau(evenementId, selectionId), typeId, analyse.data);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: "Enregistré." };
}

export async function supprimerTypeAction(
  evenementId: string,
  selectionId: string | null,
  typeId: string,
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await supprimerType(utilisateur.organisationId, niveau(evenementId, selectionId), typeId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: "Type supprimé." };
}

export async function ajouterCritereAction(
  evenementId: string,
  selectionId: string | null,
  typeId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const analyse = critereSchema.safeParse(lireCritere(form));
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const r = await ajouterCritere(utilisateur.organisationId, niveau(evenementId, selectionId), typeId, analyse.data);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: `Critère « ${analyse.data.libelle} » ajouté.` };
}

export async function modifierCritereAction(
  evenementId: string,
  selectionId: string | null,
  typeId: string,
  critereId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const analyse = critereSchema.safeParse(lireCritere(form));
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const r = await modifierCritere(utilisateur.organisationId, niveau(evenementId, selectionId), typeId, critereId, analyse.data);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: "Enregistré." };
}

export async function supprimerCritereAction(
  evenementId: string,
  selectionId: string | null,
  typeId: string,
  critereId: string,
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await supprimerCritere(utilisateur.organisationId, niveau(evenementId, selectionId), typeId, critereId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: "Critère supprimé." };
}

export async function deplacerCritereAction(
  evenementId: string,
  selectionId: string | null,
  typeId: string,
  critereId: string,
  sens: "haut" | "bas",
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await deplacerCritere(utilisateur.organisationId, niveau(evenementId, selectionId), typeId, critereId, sens);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return {};
}

export async function poserGrilleProposeeAction(evenementId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await poserGrilleProposee(utilisateur.organisationId, evenementId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: "Grille proposée posée : ajustez-la à votre concours." };
}

export async function reprendreGrilleAction(
  evenementId: string,
  selectionId: string,
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await reprendreGrilleEvenement(utilisateur.organisationId, selectionId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: "Grille de l'événement recopiée dans cette sélection." };
}

export async function reglerEnLigneAction(
  evenementId: string,
  selectionId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const analyse = reglagesEnLigneSchema.safeParse({
    prixVote: lire(form, "prixVote"),
    voixGratuite: form.get("voixGratuite") === "on",
    compteursVisibles: form.get("compteursVisibles") === "on",
    modeEnLigne: lire(form, "modeEnLigne"),
    moyensPaiement: form.getAll("moyensPaiement").map(String),
  });
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };

  const paliers = lirePaliers(form.getAll("voixMax").map(String), form.getAll("points").map(String));
  if (!paliers.ok) return { erreur: paliers.erreur };

  const r = await reglerEnLigne(utilisateur.organisationId, selectionId, analyse.data, paliers.paliers);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir(evenementId);
  return { succes: "Réglages du vote en ligne enregistrés." };
}
