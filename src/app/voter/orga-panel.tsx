"use client";

import { useEffect, useRef, useState } from "react";
import {
  orgaLoginAction,
  orgaLogoutAction,
  orgaReportAction,
  type OrgaPayment,
  type OrgaReport,
} from "@/lib/orga-actions";
import { formatNumber, PAYMENT_METHOD_LABELS, votesLabel } from "@/lib/public-vote-core";
import { WithdrawSection } from "./withdraw-form";
import styles from "./voter.module.css";

/**
 * Espace organisateur, **toujours en page pleine**.
 *
 * Contrairement à la feuille de paiement, il ne suit pas `VOTE_PLEIN_ECRAN` :
 * un panneau flottant y était illisible sur mobile — recettes, solde,
 * formulaire de retrait et deux historiques ne tiennent pas dans un tiroir.
 *
 * Il donne la lecture des recettes et la demande de retrait. Les commandes du
 * concours, et la validation des reversements, restent dans le dashboard.
 */

type Filter = "all" | "CONFIRMED" | "PENDING" | "FAILED";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "CONFIRMED", label: "Confirmés" },
  { key: "PENDING", label: "En attente" },
  { key: "FAILED", label: "Échoués" },
];

const STATUS_LABELS: Record<OrgaPayment["status"], string> = {
  CONFIRMED: "Confirmé",
  PENDING: "En attente",
  FAILED: "Échoué",
};

const STATUS_TONES: Record<OrgaPayment["status"], string> = {
  CONFIRMED: styles.sOk,
  PENDING: styles.sPend,
  FAILED: styles.sFail,
};

const hourOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

export function OrgaButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className={styles.orgaBtn}
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label="Espace organisateur"
      title="Espace organisateur"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" />
      </svg>
    </button>
  );
}

export function OrgaPanel({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<OrgaReport | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLInputElement>(null);

  // Une session encore valide évite de redemander le mot de passe.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await orgaReportAction();
      if (cancelled) return;
      if (result.ok) setReport(result.report);
      else userRef.current?.focus();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // La page du fond ne défile plus derrière le panneau.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  /** Le focus reste dans le panneau tant qu'il est ouvert. */
  function keepFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const reachable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => element.offsetParent !== null);
    if (reachable.length === 0) return;
    const first = reachable[0];
    const last = reachable[reachable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const login = await orgaLoginAction({ username, password });
      if (!login.ok) {
        setError(login.error);
        setPassword("");
        return;
      }
      const result = await orgaReportAction();
      if (result.ok) {
        setReport(result.report);
        setPassword("");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Connexion impossible. Vérifiez le réseau puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  /** Recharge le rapport sans redemander le mot de passe. */
  async function refresh() {
    const result = await orgaReportAction();
    if (result.ok) setReport(result.report);
  }

  async function signOut() {
    await orgaLogoutAction();
    setReport(null);
    setUsername("");
    setPassword("");
    onClose();
  }

  const shown = report
    ? report.payments.filter((payment) => filter === "all" || payment.status === filter)
    : [];

  return (
    <div className={styles.full}>
      <aside
        className={styles.drawer}
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={keepFocus}
        role="dialog"
        aria-modal="true"
        aria-labelledby="orga-title"
      >
        <div className={styles.drawerHead}>
          <div className={styles.drawerWho}>
            <span className={styles.eyebrow}>Accès réservé</span>
            <h2 id="orga-title">Espace organisateur</h2>
          </div>
          <button type="button" className={styles.x} onClick={onClose} aria-label="Fermer le panneau">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {report === null ? (
          <div className={styles.drawerBody}>
            <p className={styles.lead}>
              Entrez les identifiants de l&apos;organisateur pour consulter les recettes et
              l&apos;historique des paiements.
            </p>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="orga-user">
                Identifiant
              </label>
              <input
                ref={userRef}
                id="orga-user"
                className={styles.orgaInput}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor="orga-pass">
                Mot de passe
              </label>
              <input
                id="orga-pass"
                className={styles.orgaInput}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void signIn();
                }}
              />
            </div>

            {error ? (
              <p className={styles.err} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              className={`${styles.btn} ${styles.btnGold} ${styles.cta}`}
              onClick={() => void signIn()}
              disabled={busy}
            >
              {busy ? "Vérification…" : "Se connecter"}
            </button>
            <p className={styles.hint}>
              Après 15 essais manqués, l&apos;accès se bloque 10 minutes depuis cette adresse.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.drawerBody}>
              <WithdrawSection report={report} onDone={() => void refresh()} />

              <div>
                <h3 className={styles.histTitle}>
                  Voix par candidat{" "}
                  <span className={`${styles.muted} ${styles.num}`}>
                    · {formatNumber(report.totalVotes)} au total
                  </span>
                </h3>
                <div className={styles.hist}>
                  {report.candidates.length === 0 ? (
                    <p className={styles.histEmpty}>Aucun candidat enregistré.</p>
                  ) : (
                    report.candidates.map((candidate) => (
                      <div key={candidate.id} className={styles.voteRow}>
                        <span className={styles.histName}>{candidate.name}</span>
                        <span className={`${styles.histAmt} ${styles.num}`}>
                          {formatNumber(candidate.total)}
                        </span>
                        {candidate.imported > 0 ? (
                          <span className={`${styles.histMeta} ${styles.num}`}>
                            {formatNumber(candidate.online)} en ligne ·{" "}
                            {formatNumber(candidate.imported)} repris
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.tiles}>
                <div className={styles.tile}>
                  <span className={`${styles.tileN} ${styles.num}`}>{formatNumber(report.votes)}</span>
                  <span className={styles.tileL}>Votes payés</span>
                </div>
                <div className={styles.tile}>
                  <span className={`${styles.tileN} ${styles.num}`}>{formatNumber(report.confirmed)}</span>
                  <span className={styles.tileL}>Confirmés</span>
                </div>
                <div className={`${styles.tile} ${styles.tilePend}`}>
                  <span className={`${styles.tileN} ${styles.num}`}>{formatNumber(report.pending)}</span>
                  <span className={styles.tileL}>En attente</span>
                </div>
                <div className={`${styles.tile} ${styles.tileFail}`}>
                  <span className={`${styles.tileN} ${styles.num}`}>{formatNumber(report.failed)}</span>
                  <span className={styles.tileL}>Échoués</span>
                </div>
              </div>

              {report.simulatedVotes > 0 ? (
                <p className={styles.hint}>
                  {votesLabel(report.simulatedVotes)} de répétition ne sont comptés ni dans la recette
                  ni dans la part d&apos;Inovyx Tech.
                </p>
              ) : null}

              <div>
                <h3 className={styles.histTitle}>Historique des paiements</h3>
                <div className={styles.filters}>
                  {FILTERS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={filter === item.key}
                      onClick={() => setFilter(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className={styles.hist}>
                  {shown.length === 0 ? (
                    <p className={styles.histEmpty}>Aucun paiement dans cette catégorie.</p>
                  ) : (
                    shown.map((payment) => (
                      <div key={payment.reference} className={styles.histRow}>
                        <span className={styles.histName}>
                          {payment.candidateName}
                          {payment.simulated ? " · répétition" : ""}
                        </span>
                        <span className={`${styles.histAmt} ${styles.num}`}>
                          {formatNumber(payment.amount)} FCFA
                        </span>
                        <span className={`${styles.histMeta} ${styles.num}`}>
                          {votesLabel(payment.votes)} · {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                          {payment.phone} · réf. {payment.reference}
                        </span>
                        <span className={`${styles.histState} ${STATUS_TONES[payment.status]} ${styles.num}`}>
                          {STATUS_LABELS[payment.status]} · {dayOf(payment.createdAt)}{" "}
                          {hourOf(payment.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className={styles.drawerFoot}>
              <span className={`${styles.stamp} ${styles.num}`}>
                Arrêté à {hourOf(report.generatedAt)}
              </span>
              <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={() => void signOut()}>
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
