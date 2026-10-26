import { randomUUID } from "node:crypto";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import type { Resultat } from "./evenements";
import { prisma } from "./prisma";
import { identifiantQr, type LigneNumero } from "./vote-qr-core";

/**
 * Vote par QR code (canal "QR") : accès à la base.
 *
 * Côté public, `/q/<lien>` : on tape son numéro, on choisit un candidat, une
 * seule voix par numéro et par type de vote (contrainte unique de `Votant`).
 * En accès "RESTREINT", le numéro doit être dans `NumeroAutorise`.
 *
 * Côté organisateur : ouvrir/fermer le lien et tenir la liste des numéros.
 * L'organisateur voit qui a voté, jamais pour qui.
 */

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };

// Page publique ---------------------------------------------------------------

export const lirePageQr = cache(async (lien: string) => {
  if (typeof lien !== "string" || lien.length === 0 || lien.length > 64) return null;
  return prisma.typeVote.findUnique({
    where: { lien },
    include: {
      selection: {
        include: {
          evenement: { include: { organisation: { select: { nom: true, actif: true } } } },
          participations: {
            where: { disponible: true },
            orderBy: [{ ordre: "asc" }, { id: "asc" }],
            include: { candidat: { select: { nom: true, ville: true, photoUrl: true } } },
          },
        },
      },
    },
  });
});

/** Le lien accepte des voix : vote "QR" ouvert, sélection ouverte et dans les temps, organisation active. */
export function voteQrOuvert(
  t: {
    canal: string;
    ouvert: boolean;
    selection: { etat: string; fin: Date | null; evenement: { organisation: { actif: boolean } } };
  },
  maintenant = new Date(),
): boolean {
  return (
    t.canal === "QR" &&
    t.ouvert &&
    t.selection.etat === "OUVERTE" &&
    t.selection.evenement.organisation.actif &&
    (t.selection.fin === null || t.selection.fin > maintenant)
  );
}

export type ResultatNumero = { ok: true } | { ok: false; erreur: string };

const NON_RECONNU = "Numéro non reconnu. Ce vote est réservé aux personnes inscrites : rapprochez-vous de l'organisateur.";
const DEJA_VOTE = "Ce numéro a déjà voté. Une seule voix par personne.";

/** Contrôle du numéro avant de montrer les candidats. Le vote le refait de toute façon. */
async function controlerNumero(type: { id: string; acces: string }, telephone: string) {
  const identifiant = identifiantQr(telephone, type.acces);
  if (!identifiant) {
    return { ok: false as const, erreur: "Numéro invalide. Exemple : 07 00 00 00 00." };
  }
  if (type.acces === "RESTREINT") {
    const autorise = await prisma.numeroAutorise.findUnique({
      where: { typeVoteId_telephone: { typeVoteId: type.id, telephone: identifiant } },
      select: { id: true },
    });
    if (!autorise) return { ok: false as const, erreur: NON_RECONNU };
  }
  const deja = await prisma.votant.findUnique({
    where: { typeVoteId_identifiant: { typeVoteId: type.id, identifiant } },
    select: { id: true },
  });
  if (deja) return { ok: false as const, erreur: DEJA_VOTE };
  return { ok: true as const, identifiant };
}

export async function verifierNumeroQr(lien: string, telephone: string): Promise<ResultatNumero> {
  const type = await lirePageQr(lien);
  if (!type || type.canal !== "QR") return { ok: false, erreur: "Ce vote n'existe pas." };
  if (!voteQrOuvert(type)) return { ok: false, erreur: "Le vote est fermé." };
  const c = await controlerNumero(type, telephone);
  return c.ok ? { ok: true } : c;
}

export type ResultatVoteQr = { ok: true; candidat: string } | { ok: false; erreur: string };

/** Enregistre la voix : votant et suffrage ensemble, une seule fois par numéro. */
export async function voterQr(lien: string, participationId: string, telephone: string): Promise<ResultatVoteQr> {
  const type = await lirePageQr(lien);
  if (!type || type.canal !== "QR") return { ok: false, erreur: "Ce vote n'existe pas." };
  if (!voteQrOuvert(type)) return { ok: false, erreur: "Le vote est fermé." };
  const participation = type.selection.participations.find((p) => p.id === participationId);
  if (!participation) return { ok: false, erreur: "Ce candidat n'est plus proposé au vote." };

  const c = await controlerNumero(type, telephone);
  if (!c.ok) return c;

  try {
    await prisma.$transaction(async (tx) => {
      const votant = await tx.votant.create({
        data: { selectionId: type.selectionId, typeVoteId: type.id, identifiant: c.identifiant },
      });
      await tx.suffrage.create({
        data: { id: randomUUID(), participationId, typeVoteId: type.id, poids: 1, origine: "QR", votantId: votant.id },
      });
    });
  } catch (erreur) {
    // Deux envois simultanés du même numéro : la contrainte unique tranche.
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
      return { ok: false, erreur: DEJA_VOTE };
    }
    throw erreur;
  }
  return { ok: true, candidat: participation.candidat.nom };
}

// Panneau de l'organisateur ---------------------------------------------------

/** Les types de vote d'une sélection, avec de quoi afficher leur lien et leurs compteurs. */
export async function lireLiens(organisationId: string, selectionId: string) {
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: {
      evenement: { select: { nom: true } },
      typesVote: { orderBy: [{ ordre: "asc" }, { id: "asc" }] },
    },
  });
  if (!selection) return null;

  const ids = selection.typesVote.filter((t) => t.canal === "QR").map((t) => t.id);
  const [autorises, votants] = await Promise.all([
    prisma.numeroAutorise.groupBy({ by: ["typeVoteId"], where: { typeVoteId: { in: ids } }, _count: true }),
    prisma.votant.groupBy({ by: ["typeVoteId"], where: { typeVoteId: { in: ids } }, _count: true }),
  ]);
  const nbAutorises = new Map(autorises.map((a) => [a.typeVoteId, a._count]));
  const nbVotants = new Map(votants.map((v) => [v.typeVoteId, v._count]));

  return {
    selection,
    types: selection.typesVote.map((t) => ({
      ...t,
      autorises: nbAutorises.get(t.id) ?? 0,
      votants: nbVotants.get(t.id) ?? 0,
    })),
  };
}

/** Un type "QR" de l'organisation, ou rien. */
async function typeQr(organisationId: string, typeVoteId: string) {
  return prisma.typeVote.findFirst({
    where: { id: typeVoteId, canal: "QR", selection: { evenement: { organisationId } } },
    include: { selection: { select: { etat: true } } },
  });
}

/** Ouvre ou ferme le lien d'un vote "QR". Il n'accepte des voix que sélection ouverte. */
export async function basculerQr(organisationId: string, typeVoteId: string, ouvert: boolean): Promise<Resultat> {
  const type = await typeQr(organisationId, typeVoteId);
  if (!type) return INTROUVABLE;
  if (ouvert && type.selection.etat === "CLOTUREE") return { ok: false, erreur: "La sélection est clôturée." };
  await prisma.typeVote.update({ where: { id: typeVoteId }, data: { ouvert } });
  return { ok: true, valeur: undefined };
}

/** Numéros autorisés d'un vote, avec l'heure du vote s'il a eu lieu (jamais le candidat choisi). */
export async function lireNumeros(organisationId: string, typeVoteId: string) {
  const type = await typeQr(organisationId, typeVoteId);
  if (!type) return null;
  const [numeros, votants] = await Promise.all([
    prisma.numeroAutorise.findMany({ where: { typeVoteId }, orderBy: [{ creeLe: "asc" }, { id: "asc" }] }),
    prisma.votant.findMany({ where: { typeVoteId }, select: { identifiant: true, creeLe: true } }),
  ]);
  const aVote = new Map(votants.map((v) => [v.identifiant, v.creeLe]));
  return numeros.map((n) => ({ ...n, voteLe: aVote.get(n.telephone) ?? null }));
}

export interface BilanAjout {
  ajoutes: number;
  dejaPresents: number;
}

/** Ajoute des numéros à la liste ; ceux déjà présents sont laissés tels quels. */
export async function ajouterNumeros(
  organisationId: string,
  typeVoteId: string,
  numeros: LigneNumero[],
  source: string,
): Promise<Resultat<BilanAjout>> {
  const type = await typeQr(organisationId, typeVoteId);
  if (!type) return INTROUVABLE;
  if (type.acces !== "RESTREINT") return { ok: false, erreur: "Ce vote est ouvert à tous : il n'a pas de liste." };
  if (type.selection.etat === "CLOTUREE") return { ok: false, erreur: "La sélection est clôturée." };

  const { count } = await prisma.numeroAutorise.createMany({
    data: numeros.map((n) => ({ typeVoteId, telephone: n.telephone, nom: n.nom, source: source.slice(0, 80) })),
    skipDuplicates: true,
  });
  return { ok: true, valeur: { ajoutes: count, dejaPresents: numeros.length - count } };
}

/** Retire un numéro qui n'a pas encore voté : un numéro qui a voté reste, sa voix aussi. */
export async function retirerNumero(organisationId: string, typeVoteId: string, numeroId: string): Promise<Resultat> {
  const type = await typeQr(organisationId, typeVoteId);
  if (!type) return INTROUVABLE;
  const numero = await prisma.numeroAutorise.findFirst({ where: { id: numeroId, typeVoteId } });
  if (!numero) return INTROUVABLE;
  const aVote = await prisma.votant.findUnique({
    where: { typeVoteId_identifiant: { typeVoteId, identifiant: numero.telephone } },
    select: { id: true },
  });
  if (aVote) return { ok: false, erreur: "Ce numéro a déjà voté : il reste dans la liste." };
  await prisma.numeroAutorise.delete({ where: { id: numeroId } });
  return { ok: true, valeur: undefined };
}
