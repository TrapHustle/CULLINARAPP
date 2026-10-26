import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import type { Resultat } from "./evenements";
import { partDe } from "./recettes";
import { cleanWithdrawalNote } from "./withdrawal-core";

/**
 * Espace plateforme (super-admin Inovyx) : toutes les organisations, leurs
 * événements, les paiements, les reversements et les commissions.
 *
 * Le compte super-admin appartient à l'organisation technique de la
 * plateforme, qui n'apparaît dans aucune liste de clients.
 */

/** Les organisations clientes : toutes, sauf celle qui porte les comptes de la plateforme. */
const CLIENTES: Prisma.OrganisationWhereInput = { utilisateurs: { none: { role: "SUPERADMIN" } } };

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };
const OK = { ok: true as const, valeur: undefined };

export async function chiffresPlateforme() {
  const [organisations, suspendues, evenements, ouvertes, reels, simules, retraitsAttente, reverse] = await Promise.all([
    prisma.organisation.count({ where: CLIENTES }),
    prisma.organisation.count({ where: { ...CLIENTES, actif: false } }),
    prisma.evenement.count(),
    prisma.selection.count({ where: { etat: "OUVERTE" } }),
    prisma.paiement.aggregate({ where: { statut: "CONFIRMED", simule: false }, _sum: { montant: true }, _count: true }),
    prisma.paiement.count({ where: { statut: "CONFIRMED", simule: true } }),
    prisma.demandeRetrait.aggregate({ where: { statut: "PENDING" }, _sum: { montant: true }, _count: true }),
    prisma.demandeRetrait.aggregate({ where: { statut: "PAID" }, _sum: { montant: true } }),
  ]);
  const commissions = await commissionsParOrganisation();
  return {
    organisations,
    suspendues,
    evenements,
    ouvertes,
    brut: reels._sum.montant ?? 0,
    paiements: reels._count,
    simules,
    commission: commissions.reduce((s, c) => s + c.commission, 0),
    retraitsAttente: { nb: retraitsAttente._count, montant: retraitsAttente._sum.montant ?? 0 },
    reverse: reverse._sum.montant ?? 0,
  };
}

export async function listerOrganisations() {
  const organisations = await prisma.organisation.findMany({
    where: CLIENTES,
    orderBy: { creeLe: "desc" },
    include: {
      utilisateurs: { select: { email: true, role: true }, orderBy: { creeLe: "asc" } },
      _count: { select: { evenements: true, candidats: true } },
    },
  });
  const brut = await prisma.paiement.groupBy({
    by: ["organisationId"],
    where: { statut: "CONFIRMED", simule: false },
    _sum: { montant: true },
  });
  const parOrg = new Map(brut.map((b) => [b.organisationId, b._sum.montant ?? 0]));
  const [ouvertes, reverses] = await Promise.all([
    prisma.selection.findMany({ where: { etat: "OUVERTE" }, select: { evenement: { select: { organisationId: true } } } }),
    prisma.demandeRetrait.groupBy({ by: ["organisationId"], where: { statut: "PAID" }, _sum: { montant: true } }),
  ]);
  const enCours = new Map<string, number>();
  for (const s of ouvertes) enCours.set(s.evenement.organisationId, (enCours.get(s.evenement.organisationId) ?? 0) + 1);
  const reverse = new Map(reverses.map((r) => [r.organisationId, r._sum.montant ?? 0]));
  return organisations.map((o) => ({
    ...o,
    brut: parOrg.get(o.id) ?? 0,
    reverse: reverse.get(o.id) ?? 0,
    selectionsOuvertes: enCours.get(o.id) ?? 0,
    mode: (o.paiementConfig as { mode?: string } | null)?.mode === "sirap" ? "sirap" : "simulation",
  }));
}

export const reglagesOrganisationSchema = z.object({
  partOrganisateur: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, "La part reversée est un pourcentage de 0 à 100.")
    .transform(Number),
  mode: z.enum(["simulation", "sirap"]),
  actif: z.boolean(),
});

export async function reglerOrganisation(
  organisationId: string,
  saisie: z.infer<typeof reglagesOrganisationSchema>,
): Promise<Resultat> {
  const o = await prisma.organisation.findFirst({ where: { id: organisationId, ...CLIENTES } });
  if (!o) return INTROUVABLE;
  const config = { ...((o.paiementConfig as Record<string, unknown> | null) ?? {}), mode: saisie.mode };
  await prisma.organisation.update({
    where: { id: organisationId },
    data: { partOrganisateur: saisie.partOrganisateur, actif: saisie.actif, paiementConfig: config as Prisma.InputJsonValue },
  });
  return OK;
}

/** Suspend ou réactive une organisation, sans toucher à ses autres réglages. */
export async function basculerOrganisation(organisationId: string, actif: boolean): Promise<Resultat> {
  const { count } = await prisma.organisation.updateMany({ where: { id: organisationId, ...CLIENTES }, data: { actif } });
  return count === 1 ? OK : INTROUVABLE;
}

/** Supprime une organisation sans trace comptable (paiement, retrait, archive). */
export async function supprimerOrganisation(organisationId: string): Promise<Resultat> {
  const o = await prisma.organisation.findFirst({
    where: { id: organisationId, ...CLIENTES },
    include: { _count: { select: { paiements: true, demandesRetrait: true, archives: true } } },
  });
  if (!o) return INTROUVABLE;
  if (o._count.paiements + o._count.demandesRetrait + o._count.archives > 0) {
    return { ok: false, erreur: "Cette organisation a des paiements, retraits ou archives : suspendez-la plutôt." };
  }
  const votes = await prisma.suffrage.count({ where: { participation: { selection: { evenement: { organisationId } } } } });
  if (votes > 0) return { ok: false, erreur: "Cette organisation a déjà reçu des votes : suspendez-la plutôt." };
  await prisma.$transaction([
    prisma.participation.deleteMany({ where: { selection: { evenement: { organisationId } } } }),
    prisma.organisation.delete({ where: { id: organisationId } }),
  ]);
  return OK;
}

export function listerEvenementsPlateforme() {
  return prisma.evenement.findMany({
    orderBy: { creeLe: "desc" },
    take: 200,
    include: {
      organisation: { select: { nom: true, actif: true } },
      selections: {
        orderBy: { rang: "asc" },
        select: { id: true, libelle: true, etat: true, slug: true, _count: { select: { participations: true } } },
      },
    },
  });
}

export function listerPaiementsPlateforme(filtre: { statut?: string; simule?: boolean }) {
  return prisma.paiement.findMany({
    where: {
      ...(filtre.statut ? { statut: filtre.statut } : {}),
      ...(filtre.simule === undefined ? {} : { simule: filtre.simule }),
    },
    orderBy: { creeLe: "desc" },
    take: 200,
    include: { organisation: { select: { nom: true } }, selection: { select: { libelle: true } } },
  });
}

export function listerRetraitsPlateforme() {
  return prisma.demandeRetrait.findMany({
    orderBy: [{ statut: "asc" }, { creeLe: "desc" }],
    take: 200,
    include: { organisation: { select: { nom: true } } },
  });
}

/** Marque une demande payée (virement fait) ou refusée. Une seule fois. */
export async function traiterRetrait(demandeId: string, statut: "PAID" | "REJECTED", note: string): Promise<Resultat> {
  const { count } = await prisma.demandeRetrait.updateMany({
    where: { id: demandeId, statut: "PENDING" },
    data: { statut, noteAdmin: cleanWithdrawalNote(note), traiteeLe: new Date() },
  });
  return count === 1 ? OK : { ok: false, erreur: "Cette demande a déjà été traitée." };
}

/** Commission de la plateforme et reste dû à chaque organisation. */
export async function commissionsParOrganisation() {
  const [organisations, brut, retraits] = await Promise.all([
    prisma.organisation.findMany({ where: CLIENTES, select: { id: true, nom: true, partOrganisateur: true } }),
    prisma.paiement.groupBy({ by: ["organisationId"], where: { statut: "CONFIRMED", simule: false }, _sum: { montant: true } }),
    prisma.demandeRetrait.groupBy({ by: ["organisationId", "statut"], where: { statut: { in: ["PAID", "PENDING"] } }, _sum: { montant: true } }),
  ]);
  const brutPar = new Map(brut.map((b) => [b.organisationId, b._sum.montant ?? 0]));
  return organisations
    .map((o) => {
      const montant = brutPar.get(o.id) ?? 0;
      const part = partDe(montant, o.partOrganisateur);
      const somme = (statut: string) =>
        retraits.find((r) => r.organisationId === o.id && r.statut === statut)?._sum.montant ?? 0;
      return {
        id: o.id,
        nom: o.nom,
        taux: o.partOrganisateur,
        brut: montant,
        part,
        commission: montant - part,
        reverse: somme("PAID"),
        enCours: somme("PENDING"),
        resteDu: Math.max(0, part - somme("PAID")),
      };
    })
    .sort((a, b) => b.brut - a.brut);
}
