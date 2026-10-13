"use client";

import { useRef, useState } from "react";
import type { OrgaReport, OrgaWithdrawal } from "@/lib/orga-actions";
import {
  DEFAULT_PHONE_COUNTRY,
  PAYMENT_METHOD_LABELS,
  parsePhone,
  type PhoneCountry,
} from "@/lib/public-vote-core";
import { requestWithdrawalAction } from "@/lib/withdrawal-actions";
import {
  formatAmount,
  MAX_WITHDRAWAL_NOTE,
  MIN_WITHDRAWAL_AMOUNT,
  parseWithdrawalAmount,
  WITHDRAWAL_COUNTRIES,
  WITHDRAWAL_METHODS,
  WITHDRAWAL_STATUS_LABELS,
  type WithdrawalMethod,
} from "@/lib/withdrawal-core";
import { CountryPicker, LOGOS, plateClass } from "./pay-ui";
import styles from "./voter.module.css";

/**
 * Demande de retrait, dans l'espace organisateur.
 *
 * L'organisateur ne voit rien du circuit interne : il envoie sa demande et
 * elle passe « en attente ». Ce qui suit — l'alerte par mail, le virement fait
 * à la main, la validation dans le dashboard — ne le concerne pas.
 *
 * Une seule demande peut attendre à la fois : le solde disponible soustrait
 * les demandes en cours, et empiler les demandes rendrait le solde illisible.
 */

const STATUS_TONES = {
  PENDING: styles.sPend,
  PAID: styles.sOk,
  REJECTED: styles.sFail,
} as const;

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const hourOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function WithdrawSection({
  report,
  onDone,
}: {
  report: OrgaReport;
  /** Recharge le rapport : le solde et l'historique changent après l'envoi. */
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { balance } = report;
  const waitingList = report.withdrawals.filter((row) => row.status === "PENDING");

  return (
    <>
      {waitingList.map((w) => (
        <WaitingBlock key={w.id} waiting={w} available={balance.available} />
      ))}
      {open ? (
        <RequestForm
          available={balance.available}
          onCancel={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            onDone();
          }}
        />
      ) : (
        <div className={styles.wallet}>
          <h3 className={styles.walletTitle}>Solde disponible</h3>
          <Ledger balance={balance} />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGold} ${styles.cta}`}
            onClick={() => setOpen(true)}
            disabled={balance.available < MIN_WITHDRAWAL_AMOUNT}
          >
            Demander un retrait
          </button>
          {balance.available < MIN_WITHDRAWAL_AMOUNT ? (
            <p className={styles.hint}>
              Le minimum est de {formatAmount(MIN_WITHDRAWAL_AMOUNT)} FCFA.
            </p>
          ) : null}
        </div>
      )}

      <WithdrawHistory rows={report.withdrawals} />
    </>
  );
}

function Ledger({ balance }: { balance: OrgaReport["balance"] }) {
  return (
    <div className={styles.ledger}>
      <div className={styles.ledgerRow}>
        <span className={styles.ledgerKey}>Revient à l&apos;organisateur</span>
        <span className={`${styles.ledgerVal} ${styles.num}`}>{formatAmount(balance.organiser)}</span>
      </div>
      {balance.paid > 0 ? (
        <div className={`${styles.ledgerRow} ${styles.ledgerMinus}`}>
          <span className={styles.ledgerKey}>Déjà reversé</span>
          <span className={`${styles.ledgerVal} ${styles.num}`}>− {formatAmount(balance.paid)}</span>
        </div>
      ) : null}
      {balance.pending > 0 ? (
        <div className={`${styles.ledgerRow} ${styles.ledgerMinus}`}>
          <span className={styles.ledgerKey}>Retraits en attente</span>
          <span className={`${styles.ledgerVal} ${styles.num}`}>− {formatAmount(balance.pending)}</span>
        </div>
      ) : null}
      <div className={`${styles.ledgerRow} ${styles.ledgerSum}`}>
        <span className={styles.ledgerKey}>Disponible</span>
        <span className={`${styles.ledgerVal} ${styles.num}`}>
          {formatAmount(balance.available)} FCFA
        </span>
      </div>
    </div>
  );
}

function WaitingBlock({
  waiting,
  available,
}: {
  waiting: OrgaWithdrawal;
  available: number;
}) {
  return (
    <div className={styles.wallet}>
      <div className={styles.wDone}>
        <span className={styles.wDoneIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5V12l3 2" />
          </svg>
        </span>
        <span className={styles.wDoneTitle}>Demande en attente</span>
        <span className={`${styles.wDoneAmt} ${styles.num}`}>
          {formatAmount(waiting.amount)} FCFA
        </span>
        <p className={`${styles.hint} ${styles.num}`}>
          {PAYMENT_METHOD_LABELS[waiting.method]} · {waiting.phone} · demandée le{" "}
          {dateOf(waiting.createdAt)} à {hourOf(waiting.createdAt)}
        </p>
        <p className={styles.hint}>
          Votre demande a été transmise. Le passage en « reversé » s&apos;affichera ici.
        </p>
      </div>
      <div className={styles.ledger}>
        <div className={`${styles.ledgerRow} ${styles.ledgerSum}`}>
          <span className={styles.ledgerKey}>Solde disponible</span>
          <span className={`${styles.ledgerVal} ${styles.num}`}>{formatAmount(available)} FCFA</span>
        </div>
      </div>
    </div>
  );
}

function RequestForm({
  available,
  onCancel,
  onSent,
}: {
  available: number;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<WithdrawalMethod>(WITHDRAWAL_METHODS[0]);
  const [country, setCountry] = useState<PhoneCountry>(
    WITHDRAWAL_COUNTRIES.find((item) => item.code === DEFAULT_PHONE_COUNTRY.code) ??
      WITHDRAWAL_COUNTRIES[0],
  );
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const parsedAmount = parseWithdrawalAmount(amount, available);
  const parsedPhone = parsePhone(phone, country);
  const ready = parsedAmount.ok && parsedPhone.ok;
  // Le champ rougit dès la frappe quand le montant dépasse le solde. Pas sous
  // le minimum : il le serait au premier chiffre tapé.
  const typedDigits = amount.replace(/[\s  ._]/g, "");
  const overBalance = /^\d+$/.test(typedDigits) && Number(typedDigits) > available;

  async function send() {
    if (busy) return;
    // Les contrôles sont refaits côté serveur : ici, ils servent à dire quoi
    // corriger sans attendre un aller-retour.
    if (!parsedAmount.ok) {
      setError(parsedAmount.error);
      amountRef.current?.focus();
      return;
    }
    if (!parsedPhone.ok) {
      setError(parsedPhone.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await requestWithdrawalAction({
        amount,
        method,
        phone,
        countryCode: country.code,
        note,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSent();
    } catch {
      setError("Envoi impossible. Vérifiez le réseau puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (pickerOpen) {
    return (
      <CountryPicker
        selected={country}
        countries={WITHDRAWAL_COUNTRIES}
        onBack={() => setPickerOpen(false)}
        onPick={(picked) => {
          setCountry(picked);
          setPickerOpen(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className={styles.wallet}>
      <h3 className={styles.walletTitle}>Demande de retrait</h3>

      <div className={styles.group}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor="w-amount">
            Montant à retirer
          </label>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setAmount(String(available));
              setError(null);
            }}
          >
            Tout retirer
          </button>
        </div>
        <div className={overBalance ? `${styles.field} ${styles.fieldBad}` : styles.field}>
          <input
            ref={amountRef}
            id="w-amount"
            className={styles.num}
            aria-invalid={overBalance}
            aria-describedby="w-amount-hint"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={formatAmount(available)}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
          <span className={styles.unit}>FCFA</span>
        </div>
        {overBalance ? (
          <p id="w-amount-hint" className={`${styles.hint} ${styles.hintBad}`} role="alert">
            Montant supérieur à votre solde :{" "}
            <span className={styles.num}>{formatAmount(available)}</span> FCFA au maximum.
          </p>
        ) : (
          <p id="w-amount-hint" className={styles.hint}>
            Entre <span className={styles.num}>{formatAmount(MIN_WITHDRAWAL_AMOUNT)}</span> et{" "}
            <span className={styles.num}>{formatAmount(available)}</span> FCFA — votre solde
            disponible.
          </p>
        )}
      </div>

      <div className={styles.group}>
        <span className={styles.label} id="w-method">
          Moyen de paiement
        </span>
        <div className={styles.pay} role="group" aria-labelledby="w-method">
          {WITHDRAWAL_METHODS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={method === key}
              onClick={() => {
                setMethod(key);
                setError(null);
              }}
            >
              <span className={`${styles.logo} ${plateClass(key)}`}>
                {LOGOS[key].map((logo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={logo.src} className={logo.className} src={logo.src} alt="" />
                ))}
              </span>
              {PAYMENT_METHOD_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="w-phone">
          Numéro qui reçoit l&apos;argent
        </label>
        <div className={styles.field}>
          <button
            type="button"
            className={styles.pickerBtn}
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Pays du numéro : ${country.name}. Changer de pays`}
          >
            <span aria-hidden="true">{country.flag}</span>
            <span className={styles.num}>+{country.dial}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <input
            id="w-phone"
            className={styles.num}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={country.hint}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setError(null);
            }}
          />
        </div>
        <p className={styles.hint}>
          Vérifiez-le : c&apos;est sur ce numéro que le virement sera fait.
        </p>
      </div>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="w-note">
          Message (facultatif)
        </label>
        <div className={`${styles.field} ${styles.fieldNote}`}>
          <textarea
            id="w-note"
            rows={2}
            maxLength={MAX_WITHDRAWAL_NOTE}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      {ready ? (
        <div className={styles.recap}>
          <div className={styles.ledgerRow}>
            <span className={styles.ledgerKey}>Montant</span>
            <span className={`${styles.ledgerVal} ${styles.num}`}>
              {formatAmount(parsedAmount.amount)} FCFA
            </span>
          </div>
          <div className={styles.ledgerRow}>
            <span className={styles.ledgerKey}>Vers</span>
            <span className={`${styles.ledgerVal} ${styles.num}`}>
              {PAYMENT_METHOD_LABELS[method]} · {parsedPhone.pretty}
            </span>
          </div>
          <div className={styles.ledgerRow}>
            <span className={styles.ledgerKey}>Solde après retrait</span>
            <span className={`${styles.ledgerVal} ${styles.num}`}>
              {formatAmount(Math.max(0, available - parsedAmount.amount))} FCFA
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className={styles.err} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.row2}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnLine}`}
          onClick={onCancel}
          disabled={busy}
        >
          Annuler
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGold}`}
          onClick={() => void send()}
          disabled={busy}
        >
          {busy ? "Envoi…" : "Envoyer la demande"}
        </button>
      </div>
    </div>
  );
}

function WithdrawHistory({ rows }: { rows: OrgaWithdrawal[] }) {
  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className={styles.histTitle}>Mes retraits</h3>
      <div className={styles.hist}>
        {rows.map((row) => (
          <div key={row.id} className={styles.histRow}>
            <span className={`${styles.histName} ${styles.num}`}>
              {formatAmount(row.amount)} FCFA
            </span>
            <span className={`${styles.histState} ${STATUS_TONES[row.status]}`}>
              {WITHDRAWAL_STATUS_LABELS[row.status]}
            </span>
            <span className={`${styles.histMeta} ${styles.num}`}>
              {PAYMENT_METHOD_LABELS[row.method]} · {row.phone} ·{" "}
              {row.processedAt
                ? `${row.status === "PAID" ? "reversé" : "refusé"} le ${dateOf(row.processedAt)}`
                : `demandé le ${dateOf(row.createdAt)} à ${hourOf(row.createdAt)}`}
              {row.adminNote ? ` · « ${row.adminNote} »` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
