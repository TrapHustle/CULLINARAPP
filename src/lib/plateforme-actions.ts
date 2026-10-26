"use server";

import { revalidatePath } from "next/cache";
import { exigerSuperAdmin } from "./espace";
import type { EtatFormulaire } from "./evenements-actions";
import { premiereErreur } from "./evenements-core";
import { basculerOrganisation, reglagesOrganisationSchema, reglerOrganisation, supprimerOrganisation, traiterRetrait } from "./plateforme";
import { rafraichirPaiementsSaas } from "./vote-public-saas";

function rafraichir() {
  revalidatePath("/plateforme", "layout");
  revalidatePath("/espace", "layout");
}

export async function reglerOrganisationAction(organisationId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  await exigerSuperAdmin();
  const analyse = reglagesOrganisationSchema.safeParse({
    partOrganisateur: String(form.get("partOrganisateur") ?? ""),
    mode: String(form.get("mode") ?? ""),
    actif: form.get("actif") === "on",
  });
  if (!analyse.success) return { erreur: premiereErreur(analyse.error) };
  const r = await reglerOrganisation(organisationId, analyse.data);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Réglages enregistrés." };
}

export async function basculerOrganisationAction(organisationId: string, actif: boolean, _e: EtatFormulaire): Promise<EtatFormulaire> {
  await exigerSuperAdmin();
  const r = await basculerOrganisation(organisationId, actif);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: actif ? "Organisation réactivée." : "Organisation suspendue." };
}

export async function supprimerOrganisationAction(organisationId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  await exigerSuperAdmin();
  const r = await supprimerOrganisation(organisationId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Organisation supprimée." };
}

export async function traiterRetraitAction(
  demandeId: string,
  statut: "PAID" | "REJECTED",
  _e: EtatFormulaire,
  form: FormData,
): Promise<EtatFormulaire> {
  await exigerSuperAdmin();
  if (statut !== "PAID" && statut !== "REJECTED") return { erreur: "Statut inconnu." };
  const r = await traiterRetrait(demandeId, statut, String(form.get("note") ?? ""));
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: statut === "PAID" ? "Marquée payée." : "Demande refusée." };
}

export async function verifierPaiementsAction(_e: EtatFormulaire): Promise<EtatFormulaire> {
  await exigerSuperAdmin();
  const n = await rafraichirPaiementsSaas();
  rafraichir();
  return { succes: n === 0 ? "Aucun changement chez la passerelle." : `${n} paiement${n > 1 ? "s" : ""} mis à jour.` };
}
