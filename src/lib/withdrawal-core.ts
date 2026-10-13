import { PHONE_COUNTRIES, type PaymentMethod, type PhoneCountry } from "./public-vote-core";

/**
 * Retrait de l'organisateur : les règles, sans base ni réseau.
 *
 * Le reversement n'est pas automatique. La passerelle SIRAP ne sait
 * qu'encaisser (`doPayment`) : elle n'a pas d'opération de versement. Une
 * demande de retrait est donc un **message** — enregistré, envoyé par mail,
 * puis marqué comme réglé à la main par Inovyx Tech une fois le virement fait.
 * Rien ici ne déplace de l'argent.
 */

/**
 * Moyens proposés pour recevoir l'argent : les mêmes opérateurs que la
 * passerelle, **sans la carte bancaire** — on ne reverse pas sur une carte.
 */
export const WITHDRAWAL_METHODS = ["WAVE", "ORANGE_MONEY", "MTN"] as const;
export type WithdrawalMethod = (typeof WITHDRAWAL_METHODS)[number];

export function isWithdrawalMethod(value: string): value is WithdrawalMethod {
  return (WITHDRAWAL_METHODS as readonly string[]).includes(value);
}

/**
 * Un retrait reste un paiement mobile : seuls les pays où la passerelle joint
 * Wave, Orange Money et MTN MoMo peuvent recevoir un virement.
 */
export const WITHDRAWAL_COUNTRIES: PhoneCountry[] = PHONE_COUNTRIES.filter(
  (country) => country.mobile,
);

/** En dessous, les opérateurs refusent le transfert. */
export const MIN_WITHDRAWAL_AMOUNT = 500;

export const WITHDRAWAL_STATUSES = ["PENDING", "PAID", "REJECTED"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export function isWithdrawalStatus(value: string): value is WithdrawalStatus {
  return (WITHDRAWAL_STATUSES as readonly string[]).includes(value);
}

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING: "En attente",
  PAID: "Reversé",
  REJECTED: "Refusé",
};

/** Longueur maximale d'un message laissé par l'organisateur ou par l'admin. */
export const MAX_WITHDRAWAL_NOTE = 400;

export interface WithdrawalBalance {
  /** Part de l'organisateur sur les recettes confirmées. */
  organiser: number;
  /** Somme des retraits déjà reversés. */
  paid: number;
  /** Somme des retraits demandés et pas encore traités. */
  pending: number;
  /** Ce qu'il peut demander maintenant. */
  available: number;
}

/**
 * Solde retirable.
 *
 * Les demandes encore en attente sont retirées du disponible : sans cela, deux
 * demandes successives pourraient réclamer deux fois le même argent. Le solde
 * ne descend jamais sous zéro — un remboursement ou une correction de recette
 * pourrait sinon afficher un disponible négatif.
 */
export function withdrawalBalance(input: {
  organiser: number;
  paid: number;
  pending: number;
}): WithdrawalBalance {
  const available = Math.max(0, input.organiser - input.paid - input.pending);
  return { organiser: input.organiser, paid: input.paid, pending: input.pending, available };
}

export type ParsedAmount = { ok: true; amount: number } | { ok: false; error: string };

/**
 * Montant saisi, ramené à un entier de FCFA.
 *
 * La saisie est tolérante parce que le champ affiche le montant espacé par
 * milliers (« 250 000 ») : espaces, espaces insécables et points de
 * séparation sont acceptés. En revanche un centime n'a pas de sens en FCFA, et
 * un montant au-dessus du solde est refusé en nommant le solde.
 */
export function parseWithdrawalAmount(raw: string, available: number): ParsedAmount {
  const cleaned = String(raw ?? "")
    .replace(/[\s  ._]/g, "")
    .trim();

  if (cleaned === "") return { ok: false, error: "Indiquez le montant à retirer." };
  if (!/^\d+$/.test(cleaned)) {
    return { ok: false, error: "Le montant ne doit contenir que des chiffres." };
  }

  const amount = Number(cleaned);
  if (!Number.isSafeInteger(amount)) {
    return { ok: false, error: "Ce montant est trop grand." };
  }
  if (amount < MIN_WITHDRAWAL_AMOUNT) {
    return {
      ok: false,
      error: `Le minimum est de ${formatAmount(MIN_WITHDRAWAL_AMOUNT)} FCFA.`,
    };
  }
  if (available < MIN_WITHDRAWAL_AMOUNT) {
    return { ok: false, error: "Votre solde est trop faible pour un retrait." };
  }
  if (amount > available) {
    return {
      ok: false,
      error: `Vous ne pouvez pas retirer plus que votre solde : ${formatAmount(available)} FCFA.`,
    };
  }
  return { ok: true, amount };
}

/** Message libre, borné et débarrassé des sauts de ligne multiples. */
export function cleanWithdrawalNote(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text === "" ? null : text.slice(0, MAX_WITHDRAWAL_NOTE);
}

/**
 * Date et heure d'une demande. Ici et non dans la carte : la page des
 * reversements est rendue côté serveur, et une fonction d'un module
 * `"use client"` n'y est pas appelable.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/** Séparateur de milliers par espace insécable fin, comme le reste des écrans. */
export function formatAmount(value: number): string {
  return value.toLocaleString("fr-FR").replace(/ | /g, " ");
}

/**
 * Une seule demande en attente à la fois.
 *
 * C'est volontaire : le solde disponible se calcule en soustrayant les
 * demandes en attente, et empiler les demandes rendrait l'historique et le
 * traitement illisibles pour celui qui fait les virements à la main.
 */
export const PENDING_LIMIT_MESSAGE =
  "Une demande est déjà en attente. Attendez son traitement avant d'en faire une autre.";

/** Les moyens de retrait sont un sous-ensemble des moyens de paiement. */
export function asPaymentMethod(method: WithdrawalMethod): PaymentMethod {
  return method;
}
