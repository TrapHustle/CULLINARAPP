"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerEcriture } from "./espace";
import {
  creerEvenement,
  creerSelection,
  deplacerSelection,
  modifierEvenement,
  modifierSelection,
  supprimerEvenement,
  supprimerSelection,
} from "./evenements";
import { evenementSchema, premiereErreur, selectionSchema } from "./evenements-core";

export type EtatFormulaire = { erreur?: string; succes?: string; valeurs?: Record<string, string> };

const lire = (form: FormData, nom: string) => String(form.get(nom) ?? "");

function lireEvenement(form: FormData) {
  return {
    nom: lire(form, "nom"),
    edition: lire(form, "edition"),
    sousTitre: lire(form, "sousTitre"),
    date: lire(form, "date"),
  };
}

function lireSelection(form: FormData) {
  return {
    libelle: lire(form, "libelle"),
    lieu: lire(form, "lieu"),
    debut: lire(form, "debut"),
    fin: lire(form, "fin"),
    nbQualifies: lire(form, "nbQualifies"),
  };
}

// Événements --------------------------------------------------------------

export async function creerEvenementAction(_e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const valeurs = lireEvenement(form);
  const analyse = evenementSchema.safeParse(valeurs);
  if (!analyse.success) return { erreur: premiereErreur(analyse.error), valeurs };

  const evenement = await creerEvenement(utilisateur.organisationId, analyse.data);
  redirect(`/espace/e/${evenement.id}/selections`);
}

export async function modifierEvenementAction(
  evenementId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const valeurs = lireEvenement(form);
  const analyse = evenementSchema.safeParse(valeurs);
  if (!analyse.success) return { erreur: premiereErreur(analyse.error), valeurs };

  const resultat = await modifierEvenement(utilisateur.organisationId, evenementId, analyse.data);
  if (!resultat.ok) return { erreur: resultat.erreur, valeurs };
  revalidatePath(`/espace/e/${evenementId}`, "layout");
  return { succes: "Modifications enregistrées.", valeurs };
}

export async function supprimerEvenementAction(evenementId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const resultat = await supprimerEvenement(utilisateur.organisationId, evenementId);
  if (!resultat.ok) return { erreur: resultat.erreur };
  revalidatePath("/espace", "layout");
  redirect("/espace");
}

// Sélections --------------------------------------------------------------

export async function creerSelectionAction(
  evenementId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const valeurs = lireSelection(form);
  const analyse = selectionSchema.safeParse(valeurs);
  if (!analyse.success) return { erreur: premiereErreur(analyse.error), valeurs };

  const resultat = await creerSelection(utilisateur.organisationId, evenementId, analyse.data);
  if (!resultat.ok) return { erreur: resultat.erreur, valeurs };
  revalidatePath(`/espace/e/${evenementId}`, "layout");
  return { succes: `Sélection « ${analyse.data.libelle} » ajoutée.` };
}

export async function modifierSelectionAction(
  evenementId: string,
  selectionId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const valeurs = lireSelection(form);
  const analyse = selectionSchema.safeParse(valeurs);
  if (!analyse.success) return { erreur: premiereErreur(analyse.error), valeurs };

  const resultat = await modifierSelection(utilisateur.organisationId, selectionId, analyse.data);
  if (!resultat.ok) return { erreur: resultat.erreur, valeurs };
  revalidatePath(`/espace/e/${evenementId}`, "layout");
  return { succes: "Modifications enregistrées.", valeurs };
}

export async function deplacerSelectionAction(evenementId: string, selectionId: string, sens: "haut" | "bas") {
  const utilisateur = await exigerEcriture();
  await deplacerSelection(utilisateur.organisationId, selectionId, sens);
  revalidatePath(`/espace/e/${evenementId}`, "layout");
}

export async function supprimerSelectionAction(
  evenementId: string,
  selectionId: string,
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const resultat = await supprimerSelection(utilisateur.organisationId, selectionId);
  if (!resultat.ok) return { erreur: resultat.erreur };
  revalidatePath(`/espace/e/${evenementId}`, "layout");
  redirect(`/espace/e/${evenementId}/selections`);
}
