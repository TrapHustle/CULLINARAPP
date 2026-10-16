"use server";

import { revalidatePath } from "next/cache";
import { exigerEcriture } from "./espace";
import type { EtatFormulaire } from "./evenements-actions";
import { annulerSaisie, lireContexteFiche, lireFiche, saisirFiche, saisirVoix } from "./notes";
import { basculerEnLigne, basculerSalle, cloturer, enregistrerQualifies, ouvrir, reporterQualifies } from "./pilotage";

function rafraichir() {
  revalidatePath("/espace", "layout");
  revalidatePath("/v", "layout");
}

export async function ouvrirAction(selectionId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await ouvrir(utilisateur.organisationId, selectionId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "La sélection est ouverte : le vote a commencé." };
}

export async function basculerEnLigneAction(selectionId: string, ouvert: boolean, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await basculerEnLigne(utilisateur.organisationId, selectionId, ouvert);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: ouvert ? "Vote en ligne repris." : "Vote en ligne suspendu." };
}

export async function basculerSalleAction(selectionId: string, ouvert: boolean, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await basculerSalle(utilisateur.organisationId, selectionId, ouvert);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: ouvert ? "Vote en salle repris." : "Vote en salle suspendu." };
}

export async function cloturerAction(selectionId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  if (String(form.get("confirmation") ?? "").trim().toUpperCase() !== "CLOTURER") {
    return { erreur: "Tapez CLOTURER pour confirmer : la clôture est définitive." };
  }
  const r = await cloturer(utilisateur.organisationId, selectionId, form.getAll("qualifie").map(String));
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Sélection clôturée : résultats figés, qualifiés enregistrés." };
}

export async function qualifiesAction(selectionId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await enregistrerQualifies(utilisateur.organisationId, selectionId, form.getAll("qualifie").map(String));
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Qualifiés enregistrés." };
}

export async function reporterAction(selectionId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await reporterQualifies(utilisateur.organisationId, selectionId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return {
    succes:
      r.valeur === 0
        ? "Les qualifiés étaient déjà inscrits à la sélection suivante."
        : `${r.valeur} qualifié${r.valeur > 1 ? "s inscrits" : " inscrit"} à la sélection suivante.`,
  };
}

// Notes en salle -------------------------------------------------------------

export async function saisirFicheAction(
  selectionId: string,
  typeVoteId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const jure = String(form.get("jure") ?? "").trim();
  if (!/^\d{1,3}$/.test(jure) || Number(jure) < 1) return { erreur: "Indiquez le numéro du juré (1, 2, 3…)." };

  const ctx = await lireContexteFiche(utilisateur.organisationId, selectionId, typeVoteId);
  if (!ctx.ok) return { erreur: ctx.erreur };
  const fiche = lireFiche(
    form,
    ctx.selection.participations.map((p) => ({ id: p.id, nom: p.candidat.nom })),
    ctx.type.criteres,
  );
  if (!fiche.ok) return { erreur: fiche.erreur };

  const r = await saisirFiche(utilisateur.organisationId, selectionId, typeVoteId, Number(jure), fiche.lignes);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: `Fiche du juré n° ${jure} enregistrée : ${r.valeur} candidat${r.valeur > 1 ? "s notés" : " noté"}.` };
}

export async function saisirVoixAction(
  selectionId: string,
  typeVoteId: string,
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const participationId = String(form.get("participationId") ?? "");
  const voix = String(form.get("voix") ?? "").trim();
  if (!/^\d{1,6}$/.test(voix) || Number(voix) < 1) return { erreur: "Le nombre de voix est un entier, au moins 1." };
  const r = await saisirVoix(utilisateur.organisationId, selectionId, typeVoteId, participationId, Number(voix));
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: `${voix} voix enregistrée${Number(voix) > 1 ? "s" : ""}.` };
}

export async function annulerSaisieAction(suffrageId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await annulerSaisie(utilisateur.organisationId, suffrageId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Vote annulé." };
}
