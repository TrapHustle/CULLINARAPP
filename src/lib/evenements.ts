import { prisma } from "./prisma";
import { slugifier, slugLibre, type SaisieEvenement, type SaisieSelection } from "./evenements-core";
import { creationsDepuisModeles, creationsGrilleProposee } from "./grille-core";

/**
 * Événements et sélections : accès à la base.
 *
 * Chaque fonction reçoit l'organisation de l'utilisateur connecté et ne lit ni
 * n'écrit rien en dehors (RG 0.2). Un identifiant qui appartient à une autre
 * organisation se comporte exactement comme un identifiant inexistant.
 */

export type Resultat<T = void> = { ok: true; valeur: T } | { ok: false; erreur: string };

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };

export function listerEvenements(organisationId: string) {
  return prisma.evenement.findMany({
    where: { organisationId },
    orderBy: { creeLe: "desc" },
    include: {
      selections: { select: { etat: true }, orderBy: { rang: "asc" } },
    },
  });
}

export function evenementDeLOrganisation(organisationId: string, evenementId: string) {
  return prisma.evenement.findFirst({ where: { id: evenementId, organisationId } });
}

export function selectionDeLOrganisation(organisationId: string, selectionId: string) {
  return prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: { evenement: true },
  });
}

/** Ce qui empêche de supprimer : des votes ou des paiements déjà reçus (RG 2.6, 6.7). */
async function traces(where: { selectionId?: string; evenementId?: string }) {
  const filtre = where.selectionId
    ? { selectionId: where.selectionId }
    : { selection: { evenementId: where.evenementId } };
  const [suffrages, paiements] = await Promise.all([
    prisma.suffrage.count({ where: { participation: filtre } }),
    prisma.paiement.count({ where: filtre }),
  ]);
  return suffrages + paiements;
}

// Événements --------------------------------------------------------------

/** Crée l'événement avec la grille de vote proposée (RG 4.5), que l'organisateur ajuste ensuite. */
export async function creerEvenement(organisationId: string, saisie: SaisieEvenement) {
  return prisma.evenement.create({
    data: {
      organisationId,
      ...saisie,
      typesModeles: { create: creationsGrilleProposee() },
    },
  });
}

export async function modifierEvenement(
  organisationId: string,
  evenementId: string,
  saisie: SaisieEvenement,
): Promise<Resultat> {
  const { count } = await prisma.evenement.updateMany({
    where: { id: evenementId, organisationId },
    data: saisie,
  });
  return count === 1 ? { ok: true, valeur: undefined } : INTROUVABLE;
}

export async function supprimerEvenement(organisationId: string, evenementId: string): Promise<Resultat> {
  const evenement = await evenementDeLOrganisation(organisationId, evenementId);
  if (!evenement) return INTROUVABLE;
  if ((await traces({ evenementId })) > 0) {
    return { ok: false, erreur: "Cet événement a déjà reçu des votes ou des paiements : il ne peut plus être supprimé." };
  }
  await prisma.evenement.delete({ where: { id: evenementId } });
  await supprimerImage(organisationId, evenement.afficheUrl);
  return { ok: true, valeur: undefined };
}

// Image de l'événement ----------------------------------------------------

/** Identifiant d'image d'un chemin `/api/images/<id>`, ou `null`. */
function idImage(chemin: string | null): string | null {
  return chemin ? (/^\/api\/images\/([A-Za-z0-9_-]+)$/.exec(chemin)?.[1] ?? null) : null;
}

/** Supprime une image de l'organisation ; ne touche jamais celle d'une autre. */
export async function supprimerImage(organisationId: string, chemin: string | null) {
  const id = idImage(chemin);
  if (id) await prisma.image.deleteMany({ where: { id, organisationId } });
}

/**
 * Remplace l'image de l'événement (bannière de la page de vote, vignette du
 * panneau). Le fichier est déjà vérifié (type, poids) par l'appelant.
 */
export async function changerAffiche(
  organisationId: string,
  evenementId: string,
  fichier: { type: string; donnees: Uint8Array<ArrayBuffer> },
): Promise<Resultat> {
  const evenement = await evenementDeLOrganisation(organisationId, evenementId);
  if (!evenement) return INTROUVABLE;

  const image = await prisma.image.create({
    data: { organisationId, mimeType: fichier.type, data: fichier.donnees },
  });
  await prisma.evenement.update({
    where: { id: evenementId },
    data: { afficheUrl: `/api/images/${image.id}` },
  });
  // Après coup : si la suppression échoue, l'événement a déjà sa nouvelle image.
  await supprimerImage(organisationId, evenement.afficheUrl);
  return { ok: true, valeur: undefined };
}

export async function retirerAffiche(organisationId: string, evenementId: string): Promise<Resultat> {
  const evenement = await evenementDeLOrganisation(organisationId, evenementId);
  if (!evenement) return INTROUVABLE;
  await prisma.evenement.update({ where: { id: evenementId }, data: { afficheUrl: null } });
  await supprimerImage(organisationId, evenement.afficheUrl);
  return { ok: true, valeur: undefined };
}

// Sélections --------------------------------------------------------------

export function listerSelections(organisationId: string, evenementId: string) {
  return prisma.selection.findMany({
    where: { evenementId, evenement: { organisationId } },
    orderBy: { rang: "asc" },
    include: { _count: { select: { participations: true } } },
  });
}

export async function creerSelection(
  organisationId: string,
  evenementId: string,
  saisie: SaisieSelection,
): Promise<Resultat<{ id: string }>> {
  const evenement = await evenementDeLOrganisation(organisationId, evenementId);
  if (!evenement) return INTROUVABLE;

  // Le lien public est unique sur toute la plateforme (RG 7.1).
  const base = slugifier(`${evenement.nom} ${saisie.libelle}`);
  const pris = await prisma.selection.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });

  const derniere = await prisma.selection.findFirst({
    where: { evenementId },
    orderBy: { rang: "desc" },
    select: { rang: true },
  });

  // La grille de référence de l'événement est recopiée dans la sélection
  // (RG 3.2) : on pourra ensuite la modifier pour elle seule (RG 3.3).
  const modeles = await prisma.typeVoteModele.findMany({
    where: { evenementId },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    include: { criteres: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
  });

  const selection = await prisma.selection.create({
    data: {
      evenementId,
      ...saisie,
      // La nouvelle sélection passe en dernier : c'est la finale tant
      // qu'aucune autre ne vient après (RG 1.3).
      rang: (derniere?.rang ?? 0) + 1,
      slug: slugLibre(base, new Set(pris.map((s) => s.slug))),
      typesVote: { create: creationsDepuisModeles(modeles) },
    },
  });
  return { ok: true, valeur: { id: selection.id } };
}

export async function modifierSelection(
  organisationId: string,
  selectionId: string,
  saisie: SaisieSelection,
): Promise<Resultat> {
  const { count } = await prisma.selection.updateMany({
    where: { id: selectionId, evenement: { organisationId } },
    data: saisie,
  });
  return count === 1 ? { ok: true, valeur: undefined } : INTROUVABLE;
}

/** Échange le rang avec la sélection voisine. */
export async function deplacerSelection(
  organisationId: string,
  selectionId: string,
  sens: "haut" | "bas",
): Promise<Resultat> {
  const selection = await selectionDeLOrganisation(organisationId, selectionId);
  if (!selection) return INTROUVABLE;

  const voisine = await prisma.selection.findFirst({
    where: {
      evenementId: selection.evenementId,
      rang: sens === "haut" ? { lt: selection.rang } : { gt: selection.rang },
    },
    orderBy: { rang: sens === "haut" ? "desc" : "asc" },
  });
  if (!voisine) return { ok: true, valeur: undefined };

  await prisma.$transaction([
    prisma.selection.update({ where: { id: selection.id }, data: { rang: voisine.rang } }),
    prisma.selection.update({ where: { id: voisine.id }, data: { rang: selection.rang } }),
  ]);
  return { ok: true, valeur: undefined };
}

export async function supprimerSelection(organisationId: string, selectionId: string): Promise<Resultat> {
  const selection = await selectionDeLOrganisation(organisationId, selectionId);
  if (!selection) return INTROUVABLE;
  if (selection.etat !== "PREPAREE") {
    return { ok: false, erreur: "Seule une sélection encore en préparation peut être supprimée." };
  }
  if ((await traces({ selectionId })) > 0) {
    return { ok: false, erreur: "Cette sélection a déjà reçu des votes ou des paiements : elle ne peut plus être supprimée." };
  }
  await prisma.selection.delete({ where: { id: selectionId } });
  return { ok: true, valeur: undefined };
}

/** Chiffres de la vue d'ensemble d'un événement. */
export async function chiffresEvenement(organisationId: string, evenementId: string) {
  const filtre = { selection: { evenementId, evenement: { organisationId } } };
  const [selections, participations, suffrages] = await Promise.all([
    prisma.selection.findMany({
      where: { evenementId, evenement: { organisationId } },
      orderBy: { rang: "asc" },
      include: { _count: { select: { participations: true } } },
    }),
    prisma.participation.count({ where: filtre }),
    // Les voix des paiements simulés ne comptent jamais dans un chiffre officiel.
    prisma.suffrage.aggregate({
      where: { participation: filtre, annuleLe: null, NOT: { paiement: { is: { simule: true } } } },
      _sum: { poids: true },
    }),
  ]);

  return { selections, participations, voix: suffrages._sum.poids ?? 0 };
}
