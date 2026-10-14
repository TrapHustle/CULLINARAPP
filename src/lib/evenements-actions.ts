"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerEcriture } from "./espace";
import {
  changerAffiche,
  creerEvenement,
  creerSelection,
  deplacerSelection,
  modifierEvenement,
  modifierSelection,
  retirerAffiche,
  supprimerEvenement,
  supprimerSelection,
} from "./evenements";
import { evenementSchema, premiereErreur, selectionSchema } from "./evenements-core";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./validation";

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

/**
 * Image envoyée dans le champ `affiche` : absente (`null`), refusée (message)
 * ou prête à enregistrer.
 */
async function lireImage(form: FormData): Promise<{ type: string; donnees: Uint8Array<ArrayBuffer> } | string | null> {
  const fichier = form.get("affiche");
  if (!(fichier instanceof File) || fichier.size === 0) return null;
  if (!ACCEPTED_IMAGE_TYPES.includes(fichier.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "Format d'image accepté : JPEG, PNG ou WebP.";
  }
  if (fichier.size > MAX_IMAGE_BYTES) {
    return `Image trop lourde (${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} Mo au plus).`;
  }
  return { type: fichier.type, donnees: new Uint8Array(await fichier.arrayBuffer()) };
}

// Événements --------------------------------------------------------------

export async function creerEvenementAction(_e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const valeurs = lireEvenement(form);
  const analyse = evenementSchema.safeParse(valeurs);
  if (!analyse.success) return { erreur: premiereErreur(analyse.error), valeurs };
  const image = await lireImage(form);
  if (typeof image === "string") return { erreur: image, valeurs };

  const evenement = await creerEvenement(utilisateur.organisationId, analyse.data);
  if (image) await changerAffiche(utilisateur.organisationId, evenement.id, image);
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

export async function changerAfficheAction(
  evenementId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const image = await lireImage(form);
  if (image === null) return { erreur: "Choisissez une image." };
  if (typeof image === "string") return { erreur: image };

  const resultat = await changerAffiche(utilisateur.organisationId, evenementId, image);
  if (!resultat.ok) return { erreur: resultat.erreur };
  revalidatePath("/espace", "layout");
  return { succes: "Image enregistrée." };
}

export async function retirerAfficheAction(evenementId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const resultat = await retirerAffiche(utilisateur.organisationId, evenementId);
  if (!resultat.ok) return { erreur: resultat.erreur };
  revalidatePath("/espace", "layout");
  return { succes: "Image retirée." };
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
