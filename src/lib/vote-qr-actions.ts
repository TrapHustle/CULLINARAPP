"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { exigerEcriture } from "./espace";
import type { EtatFormulaire } from "./evenements-actions";
import {
  ajouterNumeros,
  basculerQr,
  changerAcces,
  noterQr,
  retirerNumero,
  verifierNumeroQr,
  voterQr,
  type ResultatNumero,
  type ResultatVoteQr,
} from "./vote-qr";
import { lireCsv, lireListe, lireSaisie, NUMEROS_MAX_PAR_AJOUT, type ListeLue } from "./vote-qr-core";

/**
 * Actions du vote par QR code. Les deux premières sont publiques (page
 * `/q/<lien>`, sans authentification) : tout y est revérifié côté serveur.
 */

export async function verifierNumeroAction(lien: string, telephone: string): Promise<ResultatNumero> {
  return verifierNumeroQr(String(lien), String(telephone ?? ""));
}

export async function voterQrAction(lien: string, participationId: string, telephone: string): Promise<ResultatVoteQr> {
  return voterQr(String(lien), String(participationId), String(telephone ?? ""));
}

export async function noterQrAction(
  lien: string,
  participationId: string,
  telephone: string,
  valeurs: Record<string, number>,
): Promise<ResultatVoteQr> {
  // Ne garde que des paires critère → nombre : le reste est revérifié par `noterQr`.
  const propres: Record<string, number> = {};
  for (const [critereId, valeur] of Object.entries(valeurs ?? {})) {
    if (typeof critereId === "string" && typeof valeur === "number") propres[critereId] = valeur;
  }
  return noterQr(String(lien), String(participationId), String(telephone ?? ""), propres);
}

// Panneau ---------------------------------------------------------------------

function rafraichir() {
  revalidatePath("/espace", "layout");
}

export async function basculerQrAction(typeVoteId: string, ouvert: boolean, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await basculerQr(utilisateur.organisationId, typeVoteId, ouvert);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: ouvert ? "Lien ouvert : on peut voter." : "Lien fermé." };
}

export async function changerAccesAction(
  typeVoteId: string,
  acces: "OUVERT" | "RESTREINT",
  _e: EtatFormulaire,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await changerAcces(utilisateur.organisationId, typeVoteId, acces === "RESTREINT" ? "RESTREINT" : "OUVERT");
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: acces === "RESTREINT" ? "Réservé aux numéros de la liste." : "Ouvert à tous, une fois par numéro." };
}

/** Ajoute une liste lue, et dit ce qui a été écarté. */
async function enregistrer(typeVoteId: string, liste: ListeLue, source: string): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  if (liste.numeros.length === 0) {
    return { erreur: liste.invalides.length > 0 ? `Aucun numéro valide (ligne ${liste.invalides[0].ligne} : « ${liste.invalides[0].texte} »).` : "Aucun numéro à ajouter." };
  }
  if (liste.numeros.length > NUMEROS_MAX_PAR_AJOUT) {
    return { erreur: `Trop de numéros d'un coup : ${NUMEROS_MAX_PAR_AJOUT.toLocaleString("fr-FR")} au plus. Découpez la liste.` };
  }
  const r = await ajouterNumeros(utilisateur.organisationId, typeVoteId, liste.numeros, source);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();

  const n = r.valeur.ajoutes;
  const details = [
    r.valeur.dejaPresents > 0 ? `${r.valeur.dejaPresents} déjà dans la liste` : null,
    liste.doublons > 0 ? `${liste.doublons} en double dans la saisie` : null,
    liste.invalides.length > 0
      ? `${liste.invalides.length} illisible${liste.invalides.length > 1 ? "s" : ""} (ligne${liste.invalides.length > 1 ? "s" : ""} ${liste.invalides
          .slice(0, 5)
          .map((i) => i.ligne)
          .join(", ")}${liste.invalides.length > 5 ? "…" : ""})`
      : null,
  ].filter(Boolean);
  return { succes: `${n} numéro${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}.${details.length > 0 ? ` Écartés : ${details.join(", ")}.` : ""}` };
}

export async function ajouterSaisieAction(typeVoteId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const texte = String(form.get("numeros") ?? "");
  if (texte.length > 300_000) return { erreur: "Saisie trop longue : importez plutôt un fichier." };
  return enregistrer(typeVoteId, lireSaisie(texte), "SAISIE");
}

/** Taille maximale d'un fichier importé. */
const FICHIER_MAX = 2 * 1024 * 1024;

export async function importerAction(typeVoteId: string, _e: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  await exigerEcriture();
  const fichier = form.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisissez un fichier Excel (.xlsx) ou CSV." };
  if (fichier.size > FICHIER_MAX) return { erreur: "Fichier trop lourd : 2 Mo au plus." };

  const nom = fichier.name.toLowerCase();
  let liste: ListeLue;
  if (nom.endsWith(".xlsx")) {
    const classeur = new ExcelJS.Workbook();
    try {
      await classeur.xlsx.load(await fichier.arrayBuffer());
    } catch {
      return { erreur: "Ce fichier Excel est illisible. Enregistrez-le en .xlsx ou en CSV, puis réessayez." };
    }
    const feuille = classeur.worksheets[0];
    if (!feuille) return { erreur: "Le fichier Excel est vide." };
    const lignes: string[][] = [];
    feuille.eachRow({ includeEmpty: true }, (ligne) => {
      const cellules: string[] = [];
      ligne.eachCell({ includeEmpty: true }, (cellule, col) => {
        cellules[col - 1] = cellule.text ?? "";
      });
      lignes.push(Array.from(cellules, (c) => c ?? ""));
    });
    liste = lireListe(lignes);
  } else if (nom.endsWith(".csv") || nom.endsWith(".txt")) {
    liste = lireCsv(await fichier.text());
  } else {
    return { erreur: "Format non pris en charge : Excel (.xlsx) ou CSV." };
  }
  return enregistrer(typeVoteId, liste, fichier.name);
}

export async function retirerNumeroAction(typeVoteId: string, numeroId: string, _e: EtatFormulaire): Promise<EtatFormulaire> {
  const utilisateur = await exigerEcriture();
  const r = await retirerNumero(utilisateur.organisationId, typeVoteId, numeroId);
  if (!r.ok) return { erreur: r.erreur };
  rafraichir();
  return { succes: "Numéro retiré." };
}
