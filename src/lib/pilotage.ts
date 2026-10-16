import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { Resultat } from "./evenements";
import { controlesOuverture, peutOuvrir } from "./pilotage-core";
import { calculerResultats } from "./resultats-saas";

/**
 * Pilotage d'une sélection (RG 1.5, 8.7, 9) : préparée → ouverte → clôturée.
 * On ne revient jamais en arrière : une sélection clôturée a des résultats
 * figés (RG 9.5).
 */

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };
const OK = { ok: true as const, valeur: undefined };

/** Tout ce qu'il faut pour contrôler l'ouverture. */
export function lireSelectionPilotage(organisationId: string, selectionId: string) {
  return prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: {
      evenement: { select: { id: true, nom: true } },
      paliers: true,
      typesVote: { include: { criteres: true }, orderBy: { ordre: "asc" } },
      participations: { select: { id: true, disponible: true, qualifie: true } },
      archives: { orderBy: { clotureLe: "desc" }, take: 1 },
    },
  });
}

export type SelectionPilotage = NonNullable<Awaited<ReturnType<typeof lireSelectionPilotage>>>;

export function controlesDe(s: SelectionPilotage) {
  return controlesOuverture({
    etat: s.etat,
    fin: s.fin,
    modeEnLigne: s.modeEnLigne,
    prixVote: s.prixVote,
    moyensPaiement: s.moyensPaiement,
    paliers: s.paliers,
    types: s.typesVote,
    participations: s.participations,
  });
}

export async function ouvrir(organisationId: string, selectionId: string): Promise<Resultat> {
  const s = await lireSelectionPilotage(organisationId, selectionId);
  if (!s) return INTROUVABLE;
  if (s.etat !== "PREPAREE") return { ok: false, erreur: "Seule une sélection en préparation peut être ouverte." };
  if (!peutOuvrir(controlesDe(s))) return { ok: false, erreur: "La sélection n'est pas prête : voyez les contrôles." };

  const maintenant = new Date();
  // Passage conditionnel : deux clics simultanés n'ouvrent qu'une fois.
  const { count } = await prisma.selection.updateMany({
    where: { id: selectionId, etat: "PREPAREE" },
    data: {
      etat: "OUVERTE",
      voteEnLigneOuvert: s.typesVote.some((t) => t.canal === "EN_LIGNE"),
      voteSalleOuvert: true,
      debut: s.debut ?? maintenant,
    },
  });
  if (count !== 1) return { ok: false, erreur: "La sélection vient de changer d'état. Rechargez la page." };
  await prisma.participation.updateMany({
    where: { selectionId, disponible: true, ouverteLe: null },
    data: { ouverteLe: maintenant },
  });
  return OK;
}

/** Suspend ou reprend le vote en ligne d'une sélection ouverte, sans la clôturer. */
export async function basculerEnLigne(organisationId: string, selectionId: string, ouvert: boolean): Promise<Resultat> {
  const s = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: { typesVote: { where: { canal: "EN_LIGNE" }, select: { id: true } } },
  });
  if (!s) return INTROUVABLE;
  if (s.etat !== "OUVERTE") return { ok: false, erreur: "Le vote en ligne ne se règle que sur une sélection ouverte." };
  if (ouvert && s.typesVote.length === 0) return { ok: false, erreur: "Cette sélection n'a pas de vote en ligne." };
  await prisma.selection.update({ where: { id: selectionId }, data: { voteEnLigneOuvert: ouvert } });
  return OK;
}

/** Suspend ou reprend la saisie des votes en salle (notes du jury, voix de la salle). */
export async function basculerSalle(organisationId: string, selectionId: string, ouvert: boolean): Promise<Resultat> {
  const { count } = await prisma.selection.updateMany({
    where: { id: selectionId, etat: "OUVERTE", evenement: { organisationId } },
    data: { voteSalleOuvert: ouvert },
  });
  return count === 1 ? OK : { ok: false, erreur: "Le vote en salle ne se règle que sur une sélection ouverte." };
}

/**
 * Clôture : plus aucun vote n'est accepté, le classement officiel est figé
 * dans une archive (RG 9.5), et les qualifiés choisis sont enregistrés
 * (RG 9.2).
 */
export async function cloturer(organisationId: string, selectionId: string, qualifies: string[]): Promise<Resultat> {
  const s = await lireSelectionPilotage(organisationId, selectionId);
  if (!s) return INTROUVABLE;
  if (s.etat !== "OUVERTE") return { ok: false, erreur: "Seule une sélection ouverte peut être clôturée." };

  // On ferme d'abord : aucun vote ne doit arriver entre le calcul et l'archive.
  const { count } = await prisma.selection.updateMany({
    where: { id: selectionId, etat: "OUVERTE" },
    data: { etat: "CLOTUREE", voteEnLigneOuvert: false, voteSalleOuvert: false },
  });
  if (count !== 1) return { ok: false, erreur: "La sélection vient de changer d'état. Rechargez la page." };

  const ids = new Set(s.participations.map((p) => p.id));
  const retenus = qualifies.filter((id) => ids.has(id));
  try {
    const resultats = await calculerResultats(selectionId);
    await prisma.$transaction([
      prisma.participation.updateMany({ where: { selectionId }, data: { qualifie: false } }),
      prisma.participation.updateMany({ where: { id: { in: retenus } }, data: { qualifie: true } }),
      prisma.archiveSelection.create({
        data: {
          organisationId,
          selectionId,
          nom: `${s.evenement.nom} — ${s.libelle}`,
          date: s.debut ?? new Date(),
          snapshot: instantane(s, resultats) as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
  } catch (erreur) {
    // Sans archive, une sélection clôturée n'aurait pas de classement figé :
    // on la rouvre pour qu'une nouvelle clôture soit possible.
    await prisma.selection.update({
      where: { id: selectionId },
      data: { etat: "OUVERTE", voteEnLigneOuvert: s.voteEnLigneOuvert, voteSalleOuvert: s.voteSalleOuvert },
    });
    throw erreur;
  }
  return OK;
}

/** Ce qu'on fige à la clôture : de quoi réafficher le classement sans recalcul. */
export interface Instantane {
  calculeLe: string;
  modeEnLigne: string;
  types: { id: string; libelle: string; part: number; canal: string }[];
  classement: {
    rang: number | null;
    note: number | null;
    egalite: boolean;
    participationId: string;
    nom: string;
    ville: string | null;
    types: { typeVoteId: string; note: number | null; volume: number }[];
  }[];
}

function instantane(s: SelectionPilotage, r: Awaited<ReturnType<typeof calculerResultats>>): Instantane {
  return {
    calculeLe: new Date().toISOString(),
    modeEnLigne: s.modeEnLigne,
    types: s.typesVote.map((t) => ({ id: t.id, libelle: t.libelle, part: t.part, canal: t.canal })),
    classement: r.classement.map((l) => ({
      rang: l.rang,
      note: l.note,
      egalite: l.egalite,
      participationId: l.candidat.participationId,
      nom: l.candidat.nom,
      ville: l.candidat.ville,
      types: l.candidat.types.map((t) => ({ typeVoteId: t.typeVoteId, note: t.note, volume: t.volume })),
    })),
  };
}

/** Change les qualifiés d'une sélection clôturée (arbitrage d'une égalité, par exemple). */
export async function enregistrerQualifies(organisationId: string, selectionId: string, qualifies: string[]): Promise<Resultat> {
  const s = await lireSelectionPilotage(organisationId, selectionId);
  if (!s) return INTROUVABLE;
  if (s.etat !== "CLOTUREE") return { ok: false, erreur: "Les qualifiés s'enregistrent à la clôture." };
  const ids = new Set(s.participations.map((p) => p.id));
  const retenus = qualifies.filter((id) => ids.has(id));
  await prisma.$transaction([
    prisma.participation.updateMany({ where: { selectionId }, data: { qualifie: false } }),
    prisma.participation.updateMany({ where: { id: { in: retenus } }, data: { qualifie: true } }),
  ]);
  return OK;
}

/** La sélection qui suit, dans le même événement. */
export function selectionSuivante(evenementId: string, rang: number) {
  return prisma.selection.findFirst({
    where: { evenementId, rang: { gt: rang } },
    orderBy: { rang: "asc" },
  });
}

/**
 * Inscrit les qualifiés à la sélection suivante, avec une nouvelle
 * participation : leurs votes ne se cumulent pas (RG 9.3, 9.4).
 */
export async function reporterQualifies(organisationId: string, selectionId: string): Promise<Resultat<number>> {
  const s = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: { participations: { where: { qualifie: true }, orderBy: { ordre: "asc" }, select: { candidatId: true } } },
  });
  if (!s) return INTROUVABLE;
  if (s.etat !== "CLOTUREE") return { ok: false, erreur: "Clôturez d'abord la sélection." };
  if (s.participations.length === 0) return { ok: false, erreur: "Aucun candidat n'est qualifié." };

  const suivante = await selectionSuivante(s.evenementId, s.rang);
  if (!suivante) return { ok: false, erreur: "Il n'y a pas de sélection après celle-ci : c'est la finale." };
  if (suivante.etat === "CLOTUREE") return { ok: false, erreur: "La sélection suivante est déjà clôturée." };

  const deja = await prisma.participation.findMany({ where: { selectionId: suivante.id }, select: { candidatId: true, ordre: true } });
  const presents = new Set(deja.map((p) => p.candidatId));
  const nouveaux = s.participations.filter((p) => !presents.has(p.candidatId));
  const depart = Math.max(-1, ...deja.map((p) => p.ordre)) + 1;
  // Dans une sélection déjà ouverte, les qualifiés sont ouverts au vote dès maintenant.
  const ouverteLe = suivante.etat === "OUVERTE" ? new Date() : null;
  await prisma.participation.createMany({
    data: nouveaux.map((p, i) => ({ selectionId: suivante.id, candidatId: p.candidatId, ordre: depart + i, ouverteLe })),
    skipDuplicates: true,
  });
  return { ok: true, valeur: nouveaux.length };
}
