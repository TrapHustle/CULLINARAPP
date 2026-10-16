import { prisma } from "./prisma";
import type { Resultat } from "./evenements";
import { sendMail, withdrawalMailCc, withdrawalMailTo } from "./mail";
import { normalizePhone } from "./public-vote-core";
import {
  cleanWithdrawalNote,
  formatAmount,
  isWithdrawalMethod,
  parseWithdrawalAmount,
  PENDING_LIMIT_MESSAGE,
  withdrawalBalance,
  type WithdrawalBalance,
} from "./withdrawal-core";

/**
 * Recettes des votes payés et reversements à l'organisation.
 *
 * L'argent des votes réels arrive sur le compte marchand de la plateforme ;
 * l'organisation en reçoit sa part (`partOrganisateur`, 90 % par défaut) en
 * demandant un retrait, que la plateforme vire puis marque « payé ». Les
 * paiements simulés n'ont rapporté aucun argent : ils sont comptés à part et
 * ne sont jamais reversables.
 */

export interface Recettes {
  brut: number;
  partOrganisateur: number;
  /** Pourcentage reversé à l'organisation. */
  taux: number;
  commission: number;
  solde: WithdrawalBalance;
  nbPaiements: number;
  simules: { nb: number; montant: number };
  enAttente: { nb: number; montant: number };
}

/** Part de l'organisateur, arrondie à l'entier inférieur : on ne reverse jamais un FCFA de trop. */
export function partDe(brut: number, taux: number): number {
  return Math.floor((brut * taux) / 100);
}

export async function recettesOrganisation(organisationId: string): Promise<Recettes> {
  const [organisation, reels, simules, attente, retraits] = await Promise.all([
    prisma.organisation.findUniqueOrThrow({ where: { id: organisationId }, select: { partOrganisateur: true } }),
    prisma.paiement.aggregate({
      where: { organisationId, statut: "CONFIRMED", simule: false },
      _sum: { montant: true },
      _count: true,
    }),
    prisma.paiement.aggregate({ where: { organisationId, statut: "CONFIRMED", simule: true }, _sum: { montant: true }, _count: true }),
    prisma.paiement.aggregate({ where: { organisationId, statut: "PENDING" }, _sum: { montant: true }, _count: true }),
    prisma.demandeRetrait.groupBy({
      by: ["statut"],
      where: { organisationId, statut: { in: ["PAID", "PENDING"] } },
      _sum: { montant: true },
    }),
  ]);

  const brut = reels._sum.montant ?? 0;
  const taux = organisation.partOrganisateur;
  const part = partDe(brut, taux);
  const somme = (statut: string) => retraits.find((r) => r.statut === statut)?._sum.montant ?? 0;

  return {
    brut,
    partOrganisateur: part,
    taux,
    commission: brut - part,
    solde: withdrawalBalance({ organiser: part, paid: somme("PAID"), pending: somme("PENDING") }),
    nbPaiements: reels._count,
    simules: { nb: simules._count, montant: simules._sum.montant ?? 0 },
    enAttente: { nb: attente._count, montant: attente._sum.montant ?? 0 },
  };
}

/** Recettes réelles confirmées, par sélection. */
export async function recettesParSelection(organisationId: string) {
  const groupes = await prisma.paiement.groupBy({
    by: ["selectionId"],
    where: { organisationId, statut: "CONFIRMED", simule: false },
    _sum: { montant: true, voix: true },
    _count: true,
  });
  const selections = await prisma.selection.findMany({
    where: { id: { in: groupes.map((g) => g.selectionId).filter((x): x is string => x !== null) } },
    select: { id: true, libelle: true, evenement: { select: { nom: true } } },
  });
  const noms = new Map(selections.map((s) => [s.id, `${s.evenement.nom} · ${s.libelle}`]));
  return groupes
    .map((g) => ({
      nom: g.selectionId ? (noms.get(g.selectionId) ?? "Sélection supprimée") : "Sélection supprimée",
      montant: g._sum.montant ?? 0,
      voix: g._sum.voix ?? 0,
      paiements: g._count,
    }))
    .sort((a, b) => b.montant - a.montant);
}

export function derniersPaiements(organisationId: string, nb = 50) {
  return prisma.paiement.findMany({
    where: { organisationId },
    orderBy: { creeLe: "desc" },
    take: nb,
    include: { selection: { select: { libelle: true } } },
  });
}

export function retraitsOrganisation(organisationId: string) {
  return prisma.demandeRetrait.findMany({ where: { organisationId }, orderBy: { creeLe: "desc" }, take: 50 });
}

/**
 * Demande de retrait de la part de l'organisation. Une seule demande en
 * attente à la fois ; le montant ne dépasse jamais le solde disponible.
 */
export async function demanderRetrait(
  organisationId: string,
  demandeur: string,
  saisie: { montant: string; moyen: string; telephone: string; note: string },
): Promise<Resultat<{ montant: number; mail: boolean }>> {
  if (!isWithdrawalMethod(saisie.moyen)) return { ok: false, erreur: "Choisissez Wave, Orange Money ou MTN MoMo." };
  const telephone = normalizePhone(saisie.telephone);
  if (!telephone) return { ok: false, erreur: "Numéro invalide. Exemple : 07 00 00 00 00." };

  // Verrou sur la ligne de l'organisation : deux demandes simultanées passent
  // l'une après l'autre, la seconde voit la première et est refusée.
  const issue = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id = ${organisationId} FOR UPDATE`;
    if ((await tx.demandeRetrait.count({ where: { organisationId, statut: "PENDING" } })) > 0) {
      return { ok: false as const, erreur: PENDING_LIMIT_MESSAGE };
    }
    const recettes = await recettesOrganisation(organisationId);
    const montant = parseWithdrawalAmount(saisie.montant, recettes.solde.available);
    if (!montant.ok) return { ok: false as const, erreur: montant.error };
    const cree = await tx.demandeRetrait.create({
      data: {
        organisationId,
        montant: montant.amount,
        moyen: saisie.moyen,
        telephone,
        note: cleanWithdrawalNote(saisie.note),
      },
      include: { organisation: { select: { nom: true } } },
    });
    return { ok: true as const, demande: cree };
  });
  if (!issue.ok) return issue;
  const demande = issue.demande;

  // Alerte à la plateforme. Sans compte d'envoi, la demande est quand même
  // enregistrée et visible dans l'espace super-admin.
  let mail = false;
  const destinataire = withdrawalMailTo();
  if (destinataire) {
    const texte = [
      `Nouvelle demande de retrait sur DIGITALYX-VOTE.`,
      ``,
      `Organisation : ${demande.organisation.nom}`,
      `Demandée par : ${demandeur}`,
      `Montant : ${formatAmount(demande.montant)} FCFA`,
      `Moyen : ${demande.moyen} · ${telephone}`,
      demande.note ? `Message : ${demande.note}` : ``,
      ``,
      `À traiter dans l'espace plateforme, onglet Reversements.`,
    ].join("\n");
    const envoi = await sendMail({
      to: destinataire,
      cc: withdrawalMailCc() ?? undefined,
      subject: `Retrait ${formatAmount(demande.montant)} FCFA — ${demande.organisation.nom}`,
      text: texte,
    });
    mail = envoi.ok;
    if (envoi.ok) await prisma.demandeRetrait.update({ where: { id: demande.id }, data: { notifieLe: new Date() } });
  }
  return { ok: true, valeur: { montant: demande.montant, mail } };
}

/** Annule sa propre demande tant qu'elle n'est pas traitée. */
export async function annulerRetrait(organisationId: string, demandeId: string): Promise<Resultat> {
  const { count } = await prisma.demandeRetrait.updateMany({
    where: { id: demandeId, organisationId, statut: "PENDING" },
    data: { statut: "REJECTED", noteAdmin: "Annulée par l'organisation.", traiteeLe: new Date() },
  });
  return count === 1 ? { ok: true, valeur: undefined } : { ok: false, erreur: "Cette demande n'est plus en attente." };
}
