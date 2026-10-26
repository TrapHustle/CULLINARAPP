import { z } from "zod";
import { prisma } from "./prisma";
import { supprimerImage, type Resultat } from "./evenements";
import type { ImageEnvoyee } from "./image-envoyee";

/**
 * Candidats (RG 2). Le candidat appartient à l'organisation et peut revenir
 * d'une sélection ou d'une édition à l'autre ; sa présence dans une sélection
 * est une participation, qui porte l'ordre de passage et la disponibilité.
 */

export const candidatSchema = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom du candidat.").max(80, "Ce nom est trop long (80 caractères au plus)."),
  ville: z
    .string()
    .trim()
    .max(60, "La ville est trop longue (60 caractères au plus).")
    .transform((v) => (v === "" ? null : v)),
});

export type SaisieCandidat = z.infer<typeof candidatSchema>;

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };
const OK = { ok: true as const, valeur: undefined };

// Bibliothèque de l'organisation --------------------------------------------

export function listerCandidats(organisationId: string) {
  return prisma.candidat.findMany({
    where: { organisationId },
    orderBy: { nom: "asc" },
    include: {
      participations: { select: { selection: { select: { libelle: true, evenement: { select: { nom: true } } } } } },
    },
  });
}

async function enregistrerPhoto(organisationId: string, photo: ImageEnvoyee) {
  const image = await prisma.image.create({ data: { organisationId, mimeType: photo.type, data: photo.donnees } });
  return `/api/images/${image.id}`;
}

export async function creerCandidat(
  organisationId: string,
  saisie: SaisieCandidat,
  photo: ImageEnvoyee | null,
): Promise<Resultat<{ id: string }>> {
  const photoUrl = photo ? await enregistrerPhoto(organisationId, photo) : null;
  const candidat = await prisma.candidat.create({ data: { organisationId, ...saisie, photoUrl } });
  return { ok: true, valeur: { id: candidat.id } };
}

export async function modifierCandidat(
  organisationId: string,
  candidatId: string,
  saisie: SaisieCandidat,
  photo: ImageEnvoyee | null,
): Promise<Resultat> {
  const candidat = await prisma.candidat.findFirst({ where: { id: candidatId, organisationId } });
  if (!candidat) return INTROUVABLE;
  const photoUrl = photo ? await enregistrerPhoto(organisationId, photo) : candidat.photoUrl;
  await prisma.candidat.update({ where: { id: candidatId }, data: { ...saisie, photoUrl } });
  if (photo) await supprimerImage(organisationId, candidat.photoUrl);
  return OK;
}

/** Supprime un candidat qui n'est inscrit nulle part : ses votes ne doivent jamais disparaître (RG 2.6). */
export async function supprimerCandidat(organisationId: string, candidatId: string): Promise<Resultat> {
  const candidat = await prisma.candidat.findFirst({
    where: { id: candidatId, organisationId },
    include: { _count: { select: { participations: true } } },
  });
  if (!candidat) return INTROUVABLE;
  if (candidat._count.participations > 0) {
    return { ok: false, erreur: "Ce candidat est inscrit à une sélection : retirez-le d'abord de chaque sélection." };
  }
  await prisma.candidat.delete({ where: { id: candidatId } });
  await supprimerImage(organisationId, candidat.photoUrl);
  return OK;
}

// Participations -------------------------------------------------------------

async function selectionModifiable(organisationId: string, selectionId: string) {
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    select: { id: true, etat: true },
  });
  if (!selection) return INTROUVABLE;
  if (selection.etat === "CLOTUREE") return { ok: false as const, erreur: "La sélection est clôturée." };
  return OK;
}

export function listerParticipations(organisationId: string, selectionId: string) {
  return prisma.participation.findMany({
    where: { selectionId, selection: { evenement: { organisationId } } },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    include: {
      candidat: true,
      _count: { select: { suffrages: { where: { annuleLe: null } }, paiements: true } },
    },
  });
}

/** Inscrit des candidats de la bibliothèque à la sélection, à la suite des autres. */
export async function inscrire(organisationId: string, selectionId: string, candidatIds: string[]): Promise<Resultat<number>> {
  const controle = await selectionModifiable(organisationId, selectionId);
  if (!controle.ok) return controle;

  const candidats = await prisma.candidat.findMany({
    where: { id: { in: candidatIds }, organisationId, participations: { none: { selectionId } } },
    orderBy: { nom: "asc" },
    select: { id: true },
  });
  if (candidats.length === 0) return { ok: false, erreur: "Cochez au moins un candidat qui n'est pas encore inscrit." };

  const derniere = await prisma.participation.findFirst({
    where: { selectionId },
    orderBy: { ordre: "desc" },
    select: { ordre: true },
  });
  // Numéros de passage à partir de 1 : la page publique les affiche (#0001).
  const depart = (derniere?.ordre ?? 0) + 1;
  await prisma.participation.createMany({
    data: candidats.map((c, i) => ({ selectionId, candidatId: c.id, ordre: depart + i })),
    skipDuplicates: true,
  });
  return { ok: true, valeur: candidats.length };
}

/** Crée un candidat dans la bibliothèque et l'inscrit aussitôt. */
export async function creerEtInscrire(
  organisationId: string,
  selectionId: string,
  saisie: SaisieCandidat,
  photo: ImageEnvoyee | null,
): Promise<Resultat> {
  const controle = await selectionModifiable(organisationId, selectionId);
  if (!controle.ok) return controle;
  const cree = await creerCandidat(organisationId, saisie, photo);
  if (!cree.ok) return cree;
  const r = await inscrire(organisationId, selectionId, [cree.valeur.id]);
  return r.ok ? OK : r;
}

async function participationDeLOrganisation(organisationId: string, participationId: string) {
  return prisma.participation.findFirst({
    where: { id: participationId, selection: { evenement: { organisationId } } },
    include: { selection: { select: { etat: true } } },
  });
}

/** Retire un candidat d'une sélection, tant qu'aucun vote ni paiement ne s'y rattache. */
export async function retirer(organisationId: string, participationId: string): Promise<Resultat> {
  const p = await participationDeLOrganisation(organisationId, participationId);
  if (!p) return INTROUVABLE;
  if (p.selection.etat === "CLOTUREE") return { ok: false, erreur: "La sélection est clôturée." };
  const [suffrages, paiements] = await Promise.all([
    prisma.suffrage.count({ where: { participationId } }),
    prisma.paiement.count({ where: { participationId } }),
  ]);
  if (suffrages + paiements > 0) {
    return {
      ok: false,
      erreur: "Ce candidat a déjà reçu des votes ou des paiements : rendez-le indisponible plutôt que de le retirer.",
    };
  }
  await prisma.participation.delete({ where: { id: participationId } });
  return OK;
}

/** Disponibilité au vote, modifiable en temps réel (RG 2.4). */
export async function changerDisponibilite(organisationId: string, participationId: string, disponible: boolean): Promise<Resultat> {
  const p = await participationDeLOrganisation(organisationId, participationId);
  if (!p) return INTROUVABLE;
  if (p.selection.etat === "CLOTUREE") return { ok: false, erreur: "La sélection est clôturée." };
  await prisma.participation.update({
    where: { id: participationId },
    // La première mise à disponibilité d'une sélection ouverte date l'ouverture du candidat.
    data: { disponible, ...(disponible && !p.ouverteLe && p.selection.etat === "OUVERTE" ? { ouverteLe: new Date() } : {}) },
  });
  return OK;
}

/** Échange l'ordre de passage avec le voisin ; les ordres sont renumérotés au passage. */
export async function deplacerParticipation(organisationId: string, participationId: string, sens: "haut" | "bas"): Promise<Resultat> {
  const p = await participationDeLOrganisation(organisationId, participationId);
  if (!p) return INTROUVABLE;
  const toutes = await prisma.participation.findMany({
    where: { selectionId: p.selectionId },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const i = toutes.findIndex((x) => x.id === participationId);
  const j = sens === "haut" ? i - 1 : i + 1;
  if (j < 0 || j >= toutes.length) return OK;
  [toutes[i], toutes[j]] = [toutes[j], toutes[i]];
  await prisma.$transaction(toutes.map((x, ordre) => prisma.participation.update({ where: { id: x.id }, data: { ordre } })));
  return OK;
}
