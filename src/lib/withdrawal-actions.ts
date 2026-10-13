"use server";

import { revalidatePath } from "next/cache";
import { sendMail, withdrawalMailCc, withdrawalMailTo } from "./mail";
import { prisma } from "./prisma";
import { parsePhone, phoneCountry, splitRevenue } from "./public-vote-core";
import { getSession } from "./session";
import {
  cleanWithdrawalNote,
  isWithdrawalMethod,
  parseWithdrawalAmount,
  withdrawalBalance,
  WITHDRAWAL_COUNTRIES,
  type WithdrawalBalance,
  type WithdrawalMethod,
  type WithdrawalStatus,
} from "./withdrawal-core";
import { withdrawalMail } from "./withdrawal-mail";

/**
 * Demandes de retrait : la demande côté organisateur, le traitement côté
 * administration.
 *
 * Le montant n'est jamais lu depuis la page : le solde est recalculé par le
 * serveur à chaque demande, puis comparé au montant voulu. Une page modifiée
 * ne peut donc pas réclamer plus que ce qui est dû.
 */

export interface WithdrawalRow {
  id: string;
  amount: number;
  /** Numéro complet. Réservé à l'administration. */
  phone: string;
  method: WithdrawalMethod;
  note: string | null;
  status: WithdrawalStatus;
  adminNote: string | null;
  /** `false` quand le mail d'alerte n'a pas pu partir. */
  notified: boolean;
  createdAt: string;
  processedAt: string | null;
}

/** Solde retirable, recalculé depuis les paiements confirmés et les retraits. */
export async function currentBalance(): Promise<WithdrawalBalance> {
  const [earned, paid, pending] = await Promise.all([
    prisma.publicVotePayment.aggregate({
      where: { status: "CONFIRMED", simulated: false },
      _sum: { amount: true },
    }),
    prisma.withdrawalRequest.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.withdrawalRequest.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
  ]);

  const { organiser } = splitRevenue(earned._sum.amount ?? 0);
  return withdrawalBalance({
    organiser,
    paid: paid._sum.amount ?? 0,
    pending: pending._sum.amount ?? 0,
  });
}

function toRow(row: {
  id: string;
  amount: number;
  phone: string;
  method: string;
  note: string | null;
  status: string;
  adminNote: string | null;
  notifiedAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
}): WithdrawalRow {
  return {
    id: row.id,
    amount: row.amount,
    phone: row.phone,
    method: row.method as WithdrawalMethod,
    note: row.note,
    status: row.status as WithdrawalStatus,
    adminNote: row.adminNote,
    notified: row.notifiedAt !== null,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Côté organisateur                                                    */
/* ------------------------------------------------------------------ */

export type WithdrawalRequestResult =
  | { ok: true; amount: number; available: number; notified: boolean }
  | { ok: false; error: string };

export async function requestWithdrawalAction(input: {
  amount: string;
  method: string;
  phone: string;
  countryCode: string;
  note: string;
}): Promise<WithdrawalRequestResult> {
  const session = await getSession();
  if (session.orga !== true) {
    return { ok: false, error: "Session expirée. Connectez-vous à nouveau." };
  }

  if (typeof input.method !== "string" || !isWithdrawalMethod(input.method)) {
    return { ok: false, error: "Choisissez un moyen de paiement." };
  }
  const method: WithdrawalMethod = input.method;

  // Un retrait est un transfert mobile : le pays doit être couvert.
  const country = phoneCountry(input.countryCode);
  if (!WITHDRAWAL_COUNTRIES.some((allowed) => allowed.code === country.code)) {
    return {
      ok: false,
      error: `Les retraits ne sont pas possibles vers un numéro ${country.name}.`,
    };
  }
  const parsedPhone = parsePhone(String(input.phone ?? ""), country);
  if (!parsedPhone.ok) return { ok: false, error: parsedPhone.error };

  // Le solde fait foi, pas ce que la page affichait.
  const balance = await currentBalance();

  const parsedAmount = parseWithdrawalAmount(String(input.amount ?? ""), balance.available);
  if (!parsedAmount.ok) return { ok: false, error: parsedAmount.error };

  const note = cleanWithdrawalNote(input.note);
  const created = await prisma.withdrawalRequest.create({
    data: { amount: parsedAmount.amount, phone: parsedPhone.phone, method, note },
  });

  // Le mail vient après l'enregistrement : une alerte qui ne part pas ne doit
  // pas faire perdre la demande. L'administration verra qu'elle n'est pas
  // notifiée, et la demande reste traitable.
  const notified = await notifyWithdrawal({
    id: created.id,
    amount: created.amount,
    method,
    phone: parsedPhone.pretty,
    note,
    availableBefore: balance.available,
    createdAt: created.createdAt,
  });

  revalidatePath("/reversements");
  return {
    ok: true,
    amount: created.amount,
    available: Math.max(0, balance.available - created.amount),
    notified,
  };
}

async function notifyWithdrawal(input: {
  id: string;
  amount: number;
  method: WithdrawalMethod;
  phone: string;
  note: string | null;
  availableBefore: number;
  createdAt: Date;
}): Promise<boolean> {
  const to = withdrawalMailTo();
  if (!to) {
    console.error("[retrait] WITHDRAWAL_MAIL_TO n'est pas renseigné : aucune alerte envoyée.");
    return false;
  }

  const event = await prisma.session.findUnique({
    where: { id: "singleton" },
    select: { eventName: true },
  });

  const mail = withdrawalMail({
    eventName: event?.eventName?.trim() || "Concours culinaire",
    amount: input.amount,
    method: input.method,
    phone: input.phone,
    note: input.note,
    availableBefore: input.availableBefore,
    createdAt: input.createdAt,
  });

  const cc = withdrawalMailCc();
  const sent = await sendMail({ to, cc: cc ?? undefined, subject: mail.subject, text: mail.text, html: mail.html });
  if (!sent.ok) return false;

  await prisma.withdrawalRequest.update({
    where: { id: input.id },
    data: { notifiedAt: new Date() },
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Côté administration                                                  */
/* ------------------------------------------------------------------ */

export interface WithdrawalOverview {
  balance: WithdrawalBalance;
  waiting: WithdrawalRow[];
  settled: WithdrawalRow[];
  /** `false` quand aucun compte d'envoi n'est configuré sur ce serveur. */
  mailReady: boolean;
}

/** Vue de la page d'administration. La garde d'accès est celle du dashboard. */
export async function withdrawalOverview(): Promise<WithdrawalOverview> {
  const [balance, rows] = await Promise.all([
    currentBalance(),
    prisma.withdrawalRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const all = rows.map(toRow);
  return {
    balance,
    waiting: all.filter((row) => row.status === "PENDING"),
    settled: all.filter((row) => row.status !== "PENDING"),
    mailReady: withdrawalMailTo() !== null,
  };
}

async function requireAdmin(): Promise<boolean> {
  const session = await getSession();
  return session.loggedIn === true;
}

/**
 * Marque un reversement comme fait.
 *
 * Le geste n'envoie pas d'argent : il enregistre que le virement a été fait
 * chez l'opérateur. C'est pourquoi il n'est permis que depuis
 * l'administration, et seulement sur une demande encore en attente — un
 * double clic ne doit pas rouvrir une demande déjà close.
 */
export async function markWithdrawalPaidAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.withdrawalRequest.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "PAID",
      processedAt: new Date(),
      adminNote: cleanWithdrawalNote(String(formData.get("adminNote") ?? "")),
    },
  });
  revalidatePath("/reversements");
}

export async function rejectWithdrawalAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const reason = cleanWithdrawalNote(String(formData.get("adminNote") ?? ""));
  await prisma.withdrawalRequest.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "REJECTED",
      processedAt: new Date(),
      // Sans motif, l'organisateur verrait un refus muet.
      adminNote: reason ?? "Demande refusée, sans motif précisé.",
    },
  });
  revalidatePath("/reversements");
}
