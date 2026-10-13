import { PAYMENT_METHOD_LABELS } from "./public-vote-core";
import { formatAmount, type WithdrawalMethod } from "./withdrawal-core";

/**
 * Corps du mail d'alerte envoyé quand l'organisateur demande un retrait.
 *
 * Volontairement sans base ni réseau : le contenu se teste seul, et l'envoi
 * reste le travail de `mail.ts`. Le mail doit suffire à faire le virement sans
 * ouvrir l'application — c'est pourquoi il répète le numéro et le solde.
 */

export interface WithdrawalMailInput {
  eventName: string;
  amount: number;
  method: WithdrawalMethod;
  /** Numéro complet : celui qui fait le virement en a besoin en entier. */
  phone: string;
  note: string | null;
  availableBefore: number;
  createdAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function longDate(date: Date): string {
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function withdrawalMail(input: WithdrawalMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const method = PAYMENT_METHOD_LABELS[input.method];
  const after = Math.max(0, input.availableBefore - input.amount);

  const rows: [string, string][] = [
    ["Montant", `${formatAmount(input.amount)} FCFA`],
    ["Moyen de paiement", method],
    ["Numéro à créditer", input.phone],
    ["Demandé le", longDate(input.createdAt)],
    ["Solde disponible avant", `${formatAmount(input.availableBefore)} FCFA`],
    ["Solde après", `${formatAmount(after)} FCFA`],
  ];

  const subject = `Demande de retrait — ${formatAmount(input.amount)} FCFA — ${input.eventName}`;

  const text = [
    `L'organisateur de ${input.eventName} demande un retrait.`,
    "",
    ...rows.map(([key, value]) => `${key} : ${value}`),
    ...(input.note ? ["", `Message de l'organisateur : « ${input.note} »`] : []),
    "",
    "Une fois le virement fait, marquez la demande comme reversée dans",
    "Administration -> Reversements.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f6f4ee;padding:24px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#211c13">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fffdf7;border:1px solid #e3d9c0;border-radius:12px">
<tr><td style="padding:20px 22px;border-bottom:1px solid #e3d9c0">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7c5e">Digitalyx Vote</div>
<div style="font-size:19px;font-weight:700;margin-top:4px">Demande de retrait</div>
</td></tr>
<tr><td style="padding:20px 22px">
<p style="margin:0 0 16px;font-size:14px;line-height:1.5">L'organisateur de <strong>${escapeHtml(input.eventName)}</strong> demande un retrait.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px">
${rows
  .map(
    ([key, value]) =>
      `<tr><td style="padding:6px 0;color:#6b6252">${escapeHtml(key)}</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(value)}</td></tr>`,
  )
  .join("\n")}
</table>
${
  input.note
    ? `<p style="margin:16px 0 0;padding-left:10px;border-left:2px solid #e3d9c0;font-size:13.5px;font-style:italic;color:#5e5649">« ${escapeHtml(input.note)} »</p>`
    : ""
}
<p style="margin:18px 0 0;font-size:12.5px;color:#8a7c5e;line-height:1.5">Une fois le virement fait, marquez la demande comme reversée dans Administration &rarr; Reversements.</p>
</td></tr>
</table>
</body></html>`;

  return { subject, text, html };
}
