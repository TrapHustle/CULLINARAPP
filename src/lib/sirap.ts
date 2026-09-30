import type { PaymentMethod } from "./public-vote-core";

/**
 * Passerelle de paiement SIRAP / INOVYX (Wave, Orange Money, MTN MoMo, carte).
 *
 * Ce qu'il faut savoir de cette API, et qui dicte tout le reste :
 *  - ni clé ni signature : le montant n'est donc jamais lu depuis la page, il
 *    est calculé par le serveur ;
 *  - aucune notification : un paiement n'est connu comme payé qu'en
 *    redemandant son statut (`checkSirapPayment`) ;
 *  - aucune URL de retour : après avoir payé, le visiteur revient seul sur la
 *    page, qui retrouve alors son paiement en cours ;
 *  - l'enveloppe répond `status: "OK"` même en cas d'échec : le vrai résultat
 *    est dans `message.status` ;
 *  - seul un formulaire à champs plats est accepté (`customer=…`).
 */

const SIRAP_API = process.env.SIRAP_API_URL ?? "https://sira.inovyx.net/Inyx/apis/";

/** Codes opérateur attendus par la passerelle. */
const PROVIDERS: Record<PaymentMethod, string> = {
  WAVE: "waveci",
  ORANGE_MONEY: "orangeci",
  MTN: "mtnci",
  CARD: "cards",
};

type SirapMessage = Record<string, unknown>;

async function callSirap(path: string, form?: Record<string, string>): Promise<SirapMessage | null> {
  try {
    const response = await fetch(SIRAP_API + path, {
      method: form ? "POST" : "GET",
      headers: form ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
      body: form ? new URLSearchParams(form).toString() : undefined,
      cache: "no-store",
      // Au-delà, on abandonne sans réessayer : relancer une demande de paiement
      // qui a expiré pourrait en créer une seconde.
      signal: AbortSignal.timeout(25_000),
    });
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const message = (data as Record<string, unknown>).message;
    return message && typeof message === "object" ? (message as SirapMessage) : null;
  } catch {
    return null;
  }
}

const text = (value: unknown, max: number) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "";

export type SirapPaymentRequest =
  | { ok: true; reference: string; url: string; transaction: string }
  | { ok: false; error: string };

/**
 * Demande un paiement. Le visiteur doit ensuite être envoyé sur `url`, où il
 * valide chez son opérateur.
 */
export async function createSirapPayment(input: {
  phone: string;
  method: PaymentMethod;
  amount: number;
  /** Jointe au paiement : permet de retrouver les votes dans le compte marchand. */
  label: string;
}): Promise<SirapPaymentRequest> {
  const message = await callSirap("doPayment/", {
    customer: input.phone,
    provider: PROVIDERS[input.method],
    amount: String(input.amount),
    custom_data: input.label,
  });

  if (!message) {
    return { ok: false, error: "Le service de paiement ne répond pas. Réessayez dans un instant : rien n'a été prélevé." };
  }

  const reference = text(message.payment_ref, 64);
  const url = text(message.url, 2000);
  if (message.status !== "success" || !reference || !/^https:\/\//i.test(url)) {
    const reason = text(message.message, 200);
    return {
      ok: false,
      error: `Le paiement a été refusé${reason ? ` : ${reason}` : "."} Rien n'a été prélevé.`,
    };
  }

  return { ok: true, reference, url, transaction: text(message.transaction, 80) };
}

export type SirapStatus = { status: "success" | "failed" | "pending"; transaction: string } | null;

/** Où en est un paiement. `null` si la passerelle ne répond pas. */
export async function checkSirapPayment(reference: string): Promise<SirapStatus> {
  const message = await callSirap(`checkPaymentStatus/?payement_ref=${encodeURIComponent(reference)}`);
  if (!message) return null;
  const status = message.status === "success" || message.status === "failed" ? message.status : "pending";
  return { status, transaction: text(message.txnreference, 80) };
}
