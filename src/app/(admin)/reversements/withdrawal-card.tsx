"use client";

import { useState } from "react";
import { markWithdrawalPaidAction, rejectWithdrawalAction, type WithdrawalRow } from "@/lib/withdrawal-actions";
import { formatAmount, formatDateTime, MAX_WITHDRAWAL_NOTE } from "@/lib/withdrawal-core";
import { PAYMENT_METHOD_LABELS } from "@/lib/public-vote-core";

/**
 * Une demande en attente, avec ses deux gestes de traitement.
 *
 * Le bouton dit « J'ai fait le virement » et non « Valider » : l'application
 * n'envoie pas d'argent, elle enregistre qu'il a été envoyé. Le refus exige un
 * motif, parce que l'organisateur le verra à la place de son retrait.
 */
export function WithdrawalCard({ row, after }: { row: WithdrawalRow; after: number }) {
  const [rejecting, setRejecting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(row.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé (page non sécurisée) : le numéro reste lisible.
    }
  }

  return (
    <article className="border-b border-outline-variant/30 px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-serif text-headline-md tabular-nums text-on-surface">
          {formatAmount(row.amount)} FCFA
        </span>
        <span className="rounded-full border border-gold-soft px-2 py-0.5 text-label-sm uppercase tracking-wider text-gold-soft">
          En attente
        </span>
        <span className="ml-auto text-label-sm text-outline">
          Demandée le {formatDateTime(row.createdAt)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Pair label="Moyen de paiement" value={PAYMENT_METHOD_LABELS[row.method]} />
        <div>
          <dt className="text-label-sm uppercase tracking-wider text-outline">Numéro à créditer</dt>
          <dd className="text-body-md font-semibold tabular-nums text-on-surface">
            {row.phone}
            <button
              type="button"
              onClick={() => void copyPhone()}
              className="ml-2 text-label-sm font-normal text-primary underline transition-colors hover:text-gold-soft"
            >
              {copied ? "copié" : "copier"}
            </button>
          </dd>
        </div>
        <Pair label="Solde après reversement" value={`${formatAmount(after)} FCFA`} />
      </dl>

      {row.note ? (
        <p className="mt-3 border-l-2 border-outline-variant/40 pl-3 text-body-md italic text-on-surface-variant">
          « {row.note} »
        </p>
      ) : null}

      {row.notified ? null : (
        <p className="mt-3 text-label-sm text-error">
          Le mail d&apos;alerte n&apos;a pas pu être envoyé pour cette demande. Elle reste
          traitable : seul l&apos;avertissement a manqué.
        </p>
      )}

      {rejecting ? (
        <form action={rejectWithdrawalAction} className="mt-4 space-y-3 rounded-lg border border-error/50 p-3">
          <input type="hidden" name="id" value={row.id} />
          <label className="block text-label-sm uppercase tracking-wider text-outline" htmlFor={`why-${row.id}`}>
            Motif du refus — l&apos;organisateur le verra
          </label>
          <textarea
            id={`why-${row.id}`}
            name="adminNote"
            rows={3}
            maxLength={MAX_WITHDRAWAL_NOTE}
            placeholder="Ex. : numéro erroné, montant supérieur au solde…"
            className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md text-on-surface"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-lg border border-error px-3 py-2 text-label-lg text-error transition-colors hover:bg-error/10"
            >
              Confirmer le refus
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-lg border border-outline-variant/40 px-3 py-2 text-label-lg text-on-surface-variant transition-colors hover:border-primary/40"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={markWithdrawalPaidAction}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              onClick={(event) => {
                if (
                  !window.confirm(
                    `Confirmer que ${formatAmount(row.amount)} FCFA ont bien été envoyés sur le ${row.phone} en ${PAYMENT_METHOD_LABELS[row.method]} ?`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-label-lg font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              J&apos;ai fait le virement
            </button>
          </form>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="rounded-lg border border-error/60 px-3 py-2 text-label-lg text-error transition-colors hover:bg-error/10"
          >
            Refuser
          </button>
        </div>
      )}

      <p className="mt-3 text-label-sm text-outline">
        Confirmez seulement après avoir vraiment envoyé l&apos;argent : l&apos;application ne
        vérifie rien chez l&apos;opérateur.
      </p>
    </article>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label-sm uppercase tracking-wider text-outline">{label}</dt>
      <dd className="text-body-md font-semibold tabular-nums text-on-surface">{value}</dd>
    </div>
  );
}
