"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { checkLogin, clearLoginFailures, noteLoginFailure, realClientIp, waitMessage } from "./rate-limit";
import { onlineVotesByCandidate } from "./public-vote";
import { INOVYX_SHARE, maskPhone, splitRevenue, type PaymentMethod } from "./public-vote-core";
import { getSession } from "./session";
import { currentBalance } from "./withdrawal-actions";
import type { WithdrawalBalance, WithdrawalMethod, WithdrawalStatus } from "./withdrawal-core";

/**
 * Espace organisateur du panneau public `/voter`.
 *
 * Ce panneau vit sur une page ouverte à tous : il ne donne donc qu'un droit de
 * lecture — recettes et historique — et jamais les commandes du dashboard. Ses
 * identifiants (`ORGA_USERNAME`, `ORGA_PASSWORD`) sont distincts de ceux de
 * l'administration, pour qu'un mot de passe tapé devant une salle n'ouvre pas
 * le reste de l'application.
 */

async function clientKey(): Promise<string> {
  const list = await headers();
  return realClientIp((name) => list.get(name));
}

/** Comparaison à durée constante : la réponse ne trahit pas le préfixe exact. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type OrgaLoginResult = { ok: true } | { ok: false; error: string };

export async function orgaLoginAction(input: {
  username: string;
  password: string;
}): Promise<OrgaLoginResult> {
  const expectedUser = process.env.ORGA_USERNAME;
  const expectedPassword = process.env.ORGA_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return { ok: false, error: "L'espace organisateur n'est pas configuré sur ce serveur." };
  }

  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  const key = await clientKey();
  const attente = checkLogin("orga", key, username);
  if (attente.blocked) return { ok: false, error: waitMessage(attente.minutes) };

  if (!sameSecret(username, expectedUser) || !sameSecret(password, expectedPassword)) {
    noteLoginFailure("orga", key, username);
    return { ok: false, error: "Identifiant ou mot de passe incorrect." };
  }

  clearLoginFailures("orga", key, username);
  const session = await getSession();
  session.orga = true;
  await session.save();
  return { ok: true };
}

export async function orgaLogoutAction(): Promise<void> {
  const session = await getSession();
  session.orga = false;
  await session.save();
}

export interface OrgaPayment {
  reference: string;
  candidateName: string;
  votes: number;
  amount: number;
  method: PaymentMethod;
  /** Numéro masqué : seuls les deux premiers et deux derniers chiffres. */
  phone: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  simulated: boolean;
  createdAt: string;
}

export interface OrgaCandidateVotes {
  id: string;
  name: string;
  /** Voix payées en ligne et confirmées. */
  online: number;
  /** Voix reprises d'une campagne précédente, saisies dans Configuration. */
  imported: number;
  total: number;
}

/** Un retrait tel que l'organisateur le voit : son numéro reste masqué. */
export interface OrgaWithdrawal {
  id: string;
  amount: number;
  method: WithdrawalMethod;
  phone: string;
  status: WithdrawalStatus;
  /** Motif du refus, ou note de reversement laissée par l'administration. */
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface OrgaReport {
  /** Voix confirmées, en ligne et reprises, tous candidats confondus. */
  totalVotes: number;
  candidates: OrgaCandidateVotes[];

  /** Montant total collecté : confirmé, hors répétitions. */
  revenue: number;
  /** Part revenant à Inovyx Tech. */
  inovyx: number;
  /** Part revenant à l'organisateur. */
  organiser: number;
  share: number;

  /** Ce qui est retirable, une fois les retraits déjà faits ou en cours déduits. */
  balance: WithdrawalBalance;
  withdrawals: OrgaWithdrawal[];

  /** Voix payées en ligne, dont découle la recette. */
  votes: number;
  confirmed: number;
  pending: number;
  failed: number;
  /** Votes de répétition, montrés à part et jamais comptés dans la recette. */
  simulatedVotes: number;
  payments: OrgaPayment[];
  generatedAt: string;
}

const HISTORY_SIZE = 100;

export async function orgaReportAction(): Promise<
  { ok: true; report: OrgaReport } | { ok: false; error: string }
> {
  const session = await getSession();
  if (session.orga !== true) {
    return { ok: false, error: "Session expirée. Connectez-vous à nouveau." };
  }

  const real = { simulated: false } as const;
  const [earned, confirmed, pending, failed, simulated, rows, candidates, online, balance, withdrawals] =
    await Promise.all([
      prisma.publicVotePayment.aggregate({
        where: { status: "CONFIRMED", ...real },
        _sum: { votes: true, amount: true },
        _count: { _all: true },
      }),
      prisma.publicVotePayment.count({ where: { status: "CONFIRMED", ...real } }),
      prisma.publicVotePayment.count({ where: { status: "PENDING" } }),
      prisma.publicVotePayment.count({ where: { status: "FAILED" } }),
      prisma.publicVotePayment.aggregate({
        where: { status: "CONFIRMED", simulated: true },
        _sum: { votes: true },
      }),
      prisma.publicVotePayment.findMany({
        orderBy: { createdAt: "desc" },
        take: HISTORY_SIZE,
      }),
      prisma.candidate.findMany({
        orderBy: { order: "asc" },
        select: { id: true, name: true, publicVoteCount: true },
      }),
      onlineVotesByCandidate({ includeSimulated: false }),
      currentBalance(),
      prisma.withdrawalRequest.findMany({ orderBy: { createdAt: "desc" }, take: HISTORY_SIZE }),
    ]);

  const revenue = earned._sum.amount ?? 0;
  const { inovyx, organiser } = splitRevenue(revenue);

  const perCandidate: OrgaCandidateVotes[] = candidates
    .map((candidate) => {
      const paid = online.get(candidate.id) ?? 0;
      return {
        id: candidate.id,
        name: candidate.name,
        online: paid,
        imported: candidate.publicVoteCount,
        total: paid + candidate.publicVoteCount,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "fr"));

  return {
    ok: true,
    report: {
      totalVotes: perCandidate.reduce((sum, candidate) => sum + candidate.total, 0),
      candidates: perCandidate,
      revenue,
      inovyx,
      organiser,
      share: INOVYX_SHARE,
      balance,
      withdrawals: withdrawals.map((row) => ({
        id: row.id,
        amount: row.amount,
        method: row.method as WithdrawalMethod,
        phone: row.phone,
        status: row.status as WithdrawalStatus,
        adminNote: row.adminNote,
        createdAt: row.createdAt.toISOString(),
        processedAt: row.processedAt?.toISOString() ?? null,
      })),
      votes: earned._sum.votes ?? 0,
      confirmed,
      pending,
      failed,
      simulatedVotes: simulated._sum.votes ?? 0,
      payments: rows.map((row) => ({
        reference: row.reference,
        candidateName: row.candidateName,
        votes: row.votes,
        amount: row.amount,
        method: row.method as PaymentMethod,
        phone: maskPhone(row.phone),
        status: row.status as OrgaPayment["status"],
        simulated: row.simulated,
        createdAt: row.createdAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    },
  };
}
