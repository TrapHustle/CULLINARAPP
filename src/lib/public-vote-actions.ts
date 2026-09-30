"use server";

import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "./actions";
import { getOrCreateSession, prisma, SESSION_ID } from "./prisma";
import { paymentMode, refreshPendingPayments } from "./public-vote";
import {
  enabledMethods,
  isPaymentMethod,
  isPublicVoteOpen,
  makePaymentReference,
  MIN_PAYMENT_AMOUNT,
  normalizePhone,
  type PaymentMethod,
} from "./public-vote-core";
import { getSession } from "./session";
import { createSirapPayment } from "./sirap";
import { publicVotePaymentSchema, publicVoteSettingsSchema } from "./validation";

async function requireAuth() {
  const session = await getSession();
  if (!session.loggedIn) redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Page publique : paiement d'un lot de votes                           */
/* ------------------------------------------------------------------ */

/** Ce que la page publique peut savoir d'un paiement — jamais le numéro. */
export type PublicVoteReceipt = {
  reference: string;
  candidateName: string;
  votes: number;
  amount: number;
  method: PaymentMethod;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  simulated: boolean;
};

export type PublicVotePaymentResult =
  | { ok: true; kind: "confirmed"; receipt: PublicVoteReceipt }
  | { ok: true; kind: "redirect"; url: string; reference: string }
  | { ok: false; error: string };

/**
 * Au plus 5 demandes par numéro toutes les 10 minutes : Orange et MTN envoient
 * une demande de validation au numéro saisi, qu'on ne doit pas pouvoir inonder.
 */
const PHONE_LIMIT = 5;
const PHONE_WINDOW_MS = 10 * 60_000;

function toReceipt(payment: {
  reference: string;
  candidateName: string;
  votes: number;
  amount: number;
  method: string;
  status: string;
  simulated: boolean;
}): PublicVoteReceipt {
  return {
    reference: payment.reference,
    candidateName: payment.candidateName,
    votes: payment.votes,
    amount: payment.amount,
    method: isPaymentMethod(payment.method) ? payment.method : "WAVE",
    status: payment.status === "CONFIRMED" || payment.status === "FAILED" ? payment.status : "PENDING",
    simulated: payment.simulated,
  };
}

/**
 * Demande le paiement d'un lot de votes pour un candidat.
 *
 * Volontairement sans authentification : c'est l'action du public. Tout ce qui
 * compte est donc revérifié ici, jamais cru sur parole — vote ouvert, candidat
 * existant, moyen de paiement proposé, nombre de votes borné, numéro valide —
 * et le montant est recalculé à partir du prix en base : la page n'envoie
 * qu'un nombre de votes.
 *
 * Mode réel (`PAIEMENT_MODE=sirap`) : le paiement est enregistré « en
 * attente », puis le visiteur est envoyé chez son opérateur. Il ne compte
 * qu'une fois la passerelle interrogée et le paiement confirmé.
 * Mode simulation : confirmé sur-le-champ, marqué simulé, jamais compté dans
 * les résultats officiels.
 */
export async function startPublicVotePaymentAction(input: {
  candidateId: string;
  votes: number;
  method: string;
  phone: string;
}): Promise<PublicVotePaymentResult> {
  const parsed = publicVotePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const { candidateId, votes, method } = parsed.data;

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: "Numéro invalide. Format attendu : 07 00 00 00 00." };
  }

  const session = await getOrCreateSession();
  if (!isPublicVoteOpen(session)) {
    return { ok: false, error: "Le vote est fermé : aucun paiement n'a été pris." };
  }
  if (!enabledMethods(session.publicVoteMethods).includes(method)) {
    return { ok: false, error: "Ce moyen de paiement n'est plus proposé. Choisissez-en un autre." };
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, name: true },
  });
  if (!candidate) {
    return { ok: false, error: "Ce candidat ne fait plus partie du vote." };
  }

  const unitPrice = session.publicVotePrice;
  const amount = votes * unitPrice;
  if (amount < MIN_PAYMENT_AMOUNT) {
    return { ok: false, error: `Le paiement minimum est de ${MIN_PAYMENT_AMOUNT} FCFA.` };
  }

  const recent = await prisma.publicVotePayment.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - PHONE_WINDOW_MS) } },
  });
  if (recent >= PHONE_LIMIT) {
    return { ok: false, error: "Trop de demandes pour ce numéro. Réessayez dans quelques minutes." };
  }

  const base = {
    candidateId: candidate.id,
    candidateName: candidate.name,
    votes,
    unitPrice,
    amount,
    method,
    phone,
  };

  if (paymentMode() === "simulation") {
    // La référence est tirée au sort ; en cas de collision (improbable), on en
    // tire une autre plutôt que d'échouer.
    for (let attempt = 0; attempt < 5; attempt++) {
      const reference = makePaymentReference((size) => randomInt(size));
      try {
        const payment = await prisma.publicVotePayment.create({
          data: { ...base, reference, status: "CONFIRMED", simulated: true, confirmedAt: new Date() },
        });
        revalidatePath("/voter");
        revalidatePath("/vote-public");
        return { ok: true, kind: "confirmed", receipt: toReceipt(payment) };
      } catch (error) {
        const duplicate =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!duplicate) throw error;
      }
    }
    return { ok: false, error: "Le paiement n'a pas abouti. Réessayez dans un instant." };
  }

  const request = await createSirapPayment({
    phone,
    method,
    amount,
    label: `VOTE|${candidate.id}|x${votes}`,
  });
  if (!request.ok) return { ok: false, error: request.error };

  // Enregistré avant d'envoyer le visiteur payer : sans cette trace, un
  // paiement confirmé ne compterait jamais.
  try {
    await prisma.publicVotePayment.create({
      data: {
        ...base,
        reference: request.reference,
        providerReference: request.transaction || null,
        status: "PENDING",
        simulated: false,
      },
    });
  } catch (error) {
    console.error(`Paiement ${request.reference} non enregistré`, error);
    return {
      ok: false,
      error: "Le paiement n'a pas pu être enregistré. Ne payez pas : réessayez dans un instant.",
    };
  }

  revalidatePath("/vote-public");
  return { ok: true, kind: "redirect", url: request.url, reference: request.reference };
}

/**
 * Où en est un paiement, à partir de sa référence — appelée par la page quand
 * le visiteur revient de chez son opérateur.
 *
 * Un paiement en attente est redemandé à la passerelle ; seul le serveur
 * décide qu'il est confirmé. La réponse ne contient jamais le numéro.
 */
export async function checkPublicVotePaymentAction(
  reference: string,
): Promise<{ ok: true; receipt: PublicVoteReceipt } | { ok: false; error: string }> {
  if (typeof reference !== "string" || reference.length === 0 || reference.length > 64) {
    return { ok: false, error: "Paiement introuvable." };
  }

  let payment = await prisma.publicVotePayment.findUnique({ where: { reference } });
  if (!payment) return { ok: false, error: "Paiement introuvable." };

  if (payment.status === "PENDING" && !payment.simulated) {
    const changed = await refreshPendingPayments([reference]);
    if (changed > 0) {
      payment = await prisma.publicVotePayment.findUnique({ where: { reference } });
      if (!payment) return { ok: false, error: "Paiement introuvable." };
      revalidatePath("/voter");
      revalidatePath("/vote-public");
    }
  }

  return { ok: true, receipt: toReceipt(payment) };
}

/* ------------------------------------------------------------------ */
/* Dashboard : réglages et nettoyage                                    */
/* ------------------------------------------------------------------ */

export async function updatePublicVoteSettingsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = publicVoteSettingsSchema.safeParse({
    publicVoteOpen: formData.get("publicVoteOpen") === "on",
    eventName: formData.get("eventName"),
    publicVoteTagline: formData.get("publicVoteTagline"),
    publicVoteSubtitle: formData.get("publicVoteSubtitle"),
    publicVotePrice: formData.get("publicVotePrice"),
    publicVoteClosesAt: formData.get("publicVoteClosesAt") ?? "",
    publicVoteShowCounts: formData.get("publicVoteShowCounts") === "on",
    publicVoteStyle: formData.get("publicVoteStyle"),
    publicVoteMethods: formData.getAll("publicVoteMethods"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Réglages invalides." };
  }

  await getOrCreateSession();
  const updated = await prisma.session.update({
    where: { id: SESSION_ID },
    data: parsed.data,
  });

  revalidatePath("/vote-public");
  revalidatePath("/voter");

  if (updated.publicVoteOpen && !isPublicVoteOpen(updated)) {
    return {
      success:
        enabledMethods(updated.publicVoteMethods).length === 0
          ? "Réglages enregistrés, mais aucun moyen de paiement n'est coché : la page reste fermée."
          : "Réglages enregistrés, mais l'heure de clôture est passée : la page reste fermée.",
    };
  }

  return {
    success: updated.publicVoteOpen
      ? "Réglages enregistrés. Le vote est ouvert au public."
      : "Réglages enregistrés. Le vote est fermé au public.",
  };
}

/**
 * Efface les paiements simulés — ceux des répétitions et des démonstrations.
 *
 * Les paiements réels ne sont jamais effacés d'ici : ce sont des traces
 * comptables.
 */
export async function clearSimulatedPaymentsAction(): Promise<void> {
  await requireAuth();

  await prisma.publicVotePayment.deleteMany({ where: { simulated: true } });

  revalidatePath("/vote-public");
  revalidatePath("/voter");
}

/** Redemande à la passerelle le statut des paiements en attente (bouton du dashboard). */
export async function refreshPendingPaymentsAction(): Promise<void> {
  await requireAuth();
  const changed = await refreshPendingPayments();
  revalidatePath("/vote-public");
  if (changed > 0) revalidatePath("/voter");
}
