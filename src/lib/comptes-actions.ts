"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authentifier, creerCompte } from "./comptes";
import { connexionSchema, inscriptionSchema, premiereErreur } from "./comptes-core";
import { checkLogin, clearLoginFailures, noteLoginFailure, realClientIp, waitMessage } from "./rate-limit";
import { getSession } from "./session";

export type EtatFormulaire = { erreur?: string; valeurs?: Record<string, string> };

const LIMITE = "espace";

async function adresse(): Promise<string> {
  const liste = await headers();
  return realClientIp((nom) => liste.get(nom));
}

async function ouvrirSession(utilisateurId: string, organisationId: string) {
  const session = await getSession();
  session.utilisateurId = utilisateurId;
  session.organisationId = organisationId;
  await session.save();
}

export async function inscrireAction(_etat: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const saisie = {
    organisation: String(form.get("organisation") ?? ""),
    email: String(form.get("email") ?? ""),
    motDePasse: String(form.get("motDePasse") ?? ""),
    confirmation: String(form.get("confirmation") ?? ""),
  };
  // Les mots de passe ne sont jamais renvoyés au navigateur.
  const valeurs = { organisation: saisie.organisation, email: saisie.email };

  const analyse = inscriptionSchema.safeParse(saisie);
  if (!analyse.success) return { erreur: premiereErreur(analyse.error), valeurs };

  // La création de comptes en rafale est limitée comme la connexion.
  const ip = await adresse();
  const attente = checkLogin(LIMITE, ip, "inscription");
  if (attente.blocked) return { erreur: waitMessage(attente.minutes), valeurs };

  const resultat = await creerCompte(analyse.data);
  if (!resultat.ok) {
    noteLoginFailure(LIMITE, ip, "inscription");
    return { erreur: resultat.erreur, valeurs };
  }

  await ouvrirSession(resultat.utilisateurId, resultat.organisationId);
  redirect("/espace");
}

export async function connecterAction(_etat: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const saisie = {
    email: String(form.get("email") ?? ""),
    motDePasse: String(form.get("motDePasse") ?? ""),
  };
  const valeurs = { email: saisie.email };

  const analyse = connexionSchema.safeParse(saisie);
  if (!analyse.success) return { erreur: premiereErreur(analyse.error), valeurs };

  const ip = await adresse();
  const attente = checkLogin(LIMITE, ip, analyse.data.email);
  if (attente.blocked) return { erreur: waitMessage(attente.minutes), valeurs };

  const resultat = await authentifier(analyse.data);
  if (!resultat.ok) {
    noteLoginFailure(LIMITE, ip, analyse.data.email);
    return { erreur: resultat.erreur, valeurs };
  }

  clearLoginFailures(LIMITE, ip, analyse.data.email);
  await ouvrirSession(resultat.utilisateurId, resultat.organisationId);
  redirect("/espace");
}

export async function deconnecterAction(): Promise<void> {
  const session = await getSession();
  // On ne ferme que l'espace des organisations : un accès plateforme ouvert
  // dans le même navigateur reste ouvert.
  delete session.utilisateurId;
  delete session.organisationId;
  await session.save();
  redirect("/connexion");
}
