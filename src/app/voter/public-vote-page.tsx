"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { PublicVoteCandidate, PublicVoteView } from "@/lib/public-vote";
import {
  checkPublicVotePaymentAction,
  startPublicVotePaymentAction,
  type PublicVoteReceipt,
} from "@/lib/public-vote-actions";
import {
  formatNumber,
  initials,
  MAX_VOTES_PER_PAYMENT,
  normalizePhone,
  PUBLIC_THEME_KEY,
  PAYMENT_METHOD_LABELS,
  votePercent,
  votesLabel,
  type PaymentMethod,
  type PublicVoteStyle,
} from "@/lib/public-vote-core";
import styles from "./voter.module.css";

/** Cadence de mise à jour des compteurs pendant que la page reste ouverte. */
const REFRESH_MS = 15_000;
/** Lots proposés en un geste dans la fenêtre de vote. */
const PACKS = [1, 5, 10, 20];
/** Durée minimale de l'écran « Paiement en cours », pour qu'il se lise. */
const MIN_PAYING_MS = 900;

const LOGOS: Record<PaymentMethod, { src: string; className: string }[]> = {
  WAVE: [{ src: "/pay/wave.png", className: styles.logoWave }],
  ORANGE_MONEY: [{ src: "/pay/orange-money.svg", className: styles.logoOm }],
  MTN: [{ src: "/pay/mtn.svg", className: styles.logoMtn }],
  CARD: [
    { src: "/pay/visa.svg", className: styles.logoVisa },
    { src: "/pay/mastercard.svg", className: styles.logoMc },
  ],
};

/** Plaque derrière le logo : blanche, sauf le jaune de MTN que son logo suppose. */
const plateClass = (method: PaymentMethod) => (method === "MTN" ? styles.plateMtn : "");

/* ------------------------------------------------------------------ */
/* Paiement parti chez l'opérateur                                      */
/* ------------------------------------------------------------------ */

/**
 * La passerelle n'a pas d'URL de retour : après avoir payé, le visiteur
 * revient seul sur la page. Le paiement en cours est donc noté dans son
 * navigateur avant de partir, pour être retrouvé et vérifié à son retour.
 */
const PENDING_KEY = "voter-payment";
/** Vérification toutes les 5 secondes, pendant 5 minutes. */
const POLL_MS = 5_000;
const POLL_MAX = 60;

type PendingPayment = { reference: string; candidateId: string };

function readPending(): PendingPayment | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    if (value && typeof value === "object") {
      const { reference, candidateId } = value as Record<string, unknown>;
      if (typeof reference === "string" && typeof candidateId === "string") return { reference, candidateId };
    }
  } catch {
    // Stockage indisponible : le paiement reste vérifié par le serveur.
  }
  return null;
}
function rememberPending(pending: PendingPayment) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Sans stockage, le paiement sera confirmé par le serveur sans retour visible.
  }
}
function forgetPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Rien à faire.
  }
}

/* ------------------------------------------------------------------ */
/* Thème et horloge, lus sans décalage d'hydratation                    */
/* ------------------------------------------------------------------ */

type Theme = "light" | "dark";

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

/** Le thème est posé sur `<html>` par le layout racine, avec le même choix mémorisé que le dashboard. */
function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);
  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(PUBLIC_THEME_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée) : la bascule vaut pour la visite en cours.
    }
  };
  return [theme, toggle];
}

let clockNow = 0;
function subscribeClock(onTick: () => void) {
  // Remise à l'heure dès l'abonnement : une page rouverte ne repart pas de
  // l'heure de sa visite précédente.
  clockNow = Date.now();
  const timer = setInterval(() => {
    clockNow = Date.now();
    onTick();
  }, 20_000);
  return () => clearInterval(timer);
}
function readClock() {
  if (clockNow === 0) clockNow = Date.now();
  return clockNow;
}

/**
 * Heure courante, rafraîchie toutes les 20 secondes. `null` au rendu serveur
 * et à l'hydratation : le compte à rebours n'apparaît qu'une fois la page
 * chargée, sans jamais contredire le rendu du serveur.
 */
function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, readClock, () => null);
}

/* ------------------------------------------------------------------ */
/* Petits éléments                                                      */
/* ------------------------------------------------------------------ */

function Ordinal({ rank }: { rank: number }) {
  return (
    <>
      {rank}
      <sup>{rank === 1 ? "er" : "e"}</sup>
    </>
  );
}

function Portrait({ candidate }: { candidate: PublicVoteCandidate }) {
  if (!candidate.photoUrl) {
    return (
      <span className={styles.monogram} aria-hidden="true">
        {initials(candidate.name)}
      </span>
    );
  }
  // Une balise <img> nue : les portraits sont servis par /api/images, déjà
  // mis en cache pour de bon, sans passer par l'optimiseur d'images.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={candidate.photoUrl} alt={candidate.name} width={480} height={480} />;
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function ThemeButton() {
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className={styles.themeBtn}
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      )}
      <span>{dark ? "Mode clair" : "Mode sombre"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

interface ViewProps {
  view: PublicVoteView;
  open: boolean;
  /** « Clôture le vendredi 2 octobre 2026 à 22 h », ou `null` sans heure de clôture. */
  closing: string | null;
  closedMessage: string | null;
  onVote: (candidateId: string) => void;
}

export function PublicVotePage({ view, style }: { view: PublicVoteView; style: PublicVoteStyle }) {
  const router = useRouter();
  const now = useNow();
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [resume, setResume] = useState<PendingPayment | null>(null);

  // Retour de chez l'opérateur : on rouvre la fenêtre sur le paiement en cours.
  useEffect(() => {
    const timer = setTimeout(() => {
      const pending = readPending();
      if (pending) {
        setResume(pending);
        setSheetFor(pending.candidateId);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Les compteurs suivent les votes des autres visiteurs sans rechargement.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  // La page peut rester ouverte au-delà de l'heure de clôture : elle se ferme
  // alors d'elle-même, sans attendre sa prochaine mise à jour.
  const closedByClock = view.closesAt !== null && now !== null && Date.parse(view.closesAt) <= now;
  const open = view.open && !closedByClock;
  const closedMessage = open
    ? null
    : view.ended || closedByClock
      ? "Le vote est clos. Rendez-vous à la proclamation des résultats."
      : "Le vote n'est pas ouvert pour le moment.";

  const props: ViewProps = {
    view,
    open,
    closing: view.closesAtLabel
      ? `${view.ended || closedByClock ? "Clôturé" : "Clôture"} le ${view.closesAtLabel}`
      : null,
    closedMessage,
    onVote: setSheetFor,
  };

  const sheetCandidate = sheetFor ? view.candidates.find((c) => c.id === sheetFor) : undefined;

  // Une fois ouverte, la fenêtre reste affichée même si le vote se ferme
  // entre-temps : un paiement en cours doit pouvoir montrer son issue. Le
  // serveur, lui, refuse tout paiement arrivé après la fermeture.
  const sheet = sheetCandidate ? (
    <VoteSheet
      key={sheetCandidate.id}
      candidate={sheetCandidate}
      view={view}
      resumeReference={resume?.candidateId === sheetCandidate.id ? resume.reference : undefined}
      onClose={() => {
        setSheetFor(null);
        setResume(null);
      }}
      onPaid={() => router.refresh()}
    />
  ) : null;

  if (style === "CLAIR") {
    return (
      <div className={`${styles.page} ${styles.clair}`}>
        <ClearView {...props} />
        {sheet}
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${style === "MENU" ? styles.menu : ""}`}>
      <header className={styles.top}>
        <div className={styles.topIn}>
          <span className={styles.brand}>Grand Concours Culinaire</span>
          <ThemeButton />
        </div>
      </header>

      <main className={styles.wrap}>
        {style === "MENU" ? <MenuView {...props} /> : <CardsView {...props} />}
      </main>

      <SiteFooter view={view} />

      {sheet}
    </div>
  );
}

/* ---- Style « Clair » : affiche en fond, cartes rectangulaires ---- */

function ClearView({ view, open, closing, closedMessage, onVote }: ViewProps) {
  const [query, setQuery] = useState("");
  const total = view.totalVotes ?? 0;
  const term = query.trim().toLowerCase();
  const shown = view.candidates.filter(
    (candidate) => !term || `${candidate.name} ${candidate.city ?? ""}`.toLowerCase().includes(term),
  );

  return (
    <>
      <header className={styles.clTop}>
        <div className={styles.clIn}>
          <span className={styles.clMark} aria-hidden="true">
            GC
          </span>
          <div className={styles.clBrand}>
            <b>Grand Concours Culinaire</b>
            <span>Vote du public en ligne</span>
          </div>
        </div>
      </header>

      <section className={styles.clHero}>
        {view.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.clHeroBg} src={view.posterUrl} alt="" />
        ) : null}
        <div className={`${styles.clIn} ${styles.clHeroIn} ${view.posterUrl ? styles.clHeroWithPoster : ""}`}>
          {view.tagline ? <p className={styles.clEyebrow}>{view.tagline}</p> : null}
          <h1>{view.eventName}</h1>
          <div className={styles.clChips}>
            <span className={styles.clChip}>
              <span className={open ? styles.clDotOn : styles.clDotOff} />
              {open ? "Vote ouvert" : "Vote fermé"}
            </span>
            <span className={`${styles.clChip} ${styles.num}`}>{formatNumber(view.price)} FCFA le vote</span>
          </div>
          {closing ? <p className={`${styles.clClose} ${styles.num}`}>{closing}</p> : null}
        </div>
      </section>

      <main className={`${styles.clIn} ${styles.clMain}`}>
        {closedMessage ? <p className={styles.closed}>{closedMessage}</p> : null}

        <div className={styles.clTools}>
          {view.subtitle ? <div className={styles.clStage}>{view.subtitle}</div> : <div />}
          <label className={styles.clSearch}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Rechercher un candidat…"
              aria-label="Rechercher un candidat"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {view.candidates.length === 0 ? (
          <EmptyList />
        ) : shown.length === 0 ? (
          <p className={styles.empty}>Aucun candidat ne correspond à cette recherche.</p>
        ) : (
          <ol
            className={styles.clList}
            aria-label={view.showCounts ? "Candidats, du plus voté au moins voté" : "Candidats, dans l'ordre de passage"}
          >
            {shown.map((candidate) => {
              const percent = candidate.votes !== null ? votePercent(candidate.votes, total) : null;
              return (
                <li key={candidate.id} className={styles.clCard}>
                  <div className={styles.clBanner}>
                    {candidate.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={candidate.photoUrl} alt={candidate.name} />
                    ) : (
                      <span className={styles.clInitials} aria-hidden="true">
                        {initials(candidate.name)}
                      </span>
                    )}
                    <div className={styles.clEvent}>
                      <b>{view.eventName}</b>
                      {view.tagline ? <span>{view.tagline}</span> : null}
                    </div>
                    <span className={`${styles.clNum} ${styles.num}`}>#{String(candidate.order).padStart(4, "0")}</span>
                    {candidate.rank !== null ? (
                      <span className={styles.clRank}>
                        <Ordinal rank={candidate.rank} />
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.clBody}>
                    <div>
                      <h3 className={styles.clName}>
                        {candidate.name}
                        {candidate.city ? ` – ${candidate.city}` : ""}
                      </h3>
                      <p className={styles.clRole}>Candidat(e) · Nominé(e)</p>
                    </div>
                    {candidate.votes !== null ? (
                      <div className={styles.clScore}>
                        <p className={styles.num}>
                          <b>{votesLabel(candidate.votes)}</b>
                          <span>{percent} %</span>
                        </p>
                        <div className={styles.clBar}>
                          <i style={{ width: `${total ? (candidate.votes / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={styles.clVote}
                      disabled={!open}
                      onClick={() => onVote(candidate.id)}
                    >
                      Voter
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </main>

      <footer className={styles.clFoot}>
        <div className={`${styles.clIn} ${styles.clFootIn}`}>
          <strong>
            © {new Date(view.generatedAt).getUTCFullYear()} {view.eventName}
            {view.tagline ? ` — ${view.tagline}` : ""}
          </strong>
          <div className={styles.clPay} aria-label="Moyens de paiement">
            {view.methods.map((method) => (
              <span key={method} className={plateClass(method)}>
                {LOGOS[method].map((logo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={logo.src} src={logo.src} alt={PAYMENT_METHOD_LABELS[method]} />
                ))}
              </span>
            ))}
          </div>
          <p>1 vote = {formatNumber(view.price)} FCFA. Chaque vote compte dès que le paiement est confirmé.</p>
          {view.simulated ? <p>Aperçu : paiements simulés, aucune somme n&apos;est prélevée.</p> : null}
        </div>
      </footer>
    </>
  );
}

/** Pied de page : l'événement, la règle du vote, les moyens de paiement. */
function SiteFooter({ view }: { view: PublicVoteView }) {
  return (
    <footer className={styles.siteFoot}>
      <div className={styles.siteFootIn}>
        <div>
          <h4>{view.eventName}</h4>
          {view.tagline ? <p>{view.tagline}</p> : null}
          {view.subtitle ? <p>{view.subtitle}</p> : null}
        </div>
        <div>
          <h4>Le vote</h4>
          <p className={styles.num}>1 vote = {formatNumber(view.price)} FCFA, autant de votes que vous voulez.</p>
          <p>Chaque vote compte dès que le paiement est confirmé.</p>
        </div>
        <div>
          <h4>Paiement</h4>
          <p>{view.methods.map((method) => PAYMENT_METHOD_LABELS[method]).join(" · ") || "Aucun moyen de paiement actif"}</p>
          <div className={styles.footLogos}>
            {view.methods.map((method) => (
              <span key={method} className={plateClass(method)}>
                {LOGOS[method].map((logo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={logo.src} src={logo.src} alt={PAYMENT_METHOD_LABELS[method]} />
                ))}
              </span>
            ))}
          </div>
        </div>
        <p className={styles.legal}>
          <span>© {new Date(view.generatedAt).getUTCFullYear()} {view.eventName}</span>
          {view.simulated ? <span>Aperçu : paiements simulés, aucune somme n&apos;est prélevée.</span> : null}
        </p>
      </div>
    </footer>
  );
}

function StateLabel({ open }: { open: boolean }) {
  return (
    <span className={`${styles.state} ${open ? "" : styles.stateOff}`}>
      {open ? "Vote ouvert" : "Vote fermé"}
    </span>
  );
}

function EmptyList() {
  return <p className={styles.empty}>Les candidats seront présentés ici très bientôt.</p>;
}

/* ---- Style « Cartes » ---- */

function CardsView({ view, open, closing, closedMessage, onVote }: ViewProps) {
  const total = view.totalVotes ?? 0;
  return (
    <>
      <section className={styles.hero}>
        {view.tagline ? <span className={styles.eyebrow}>{view.tagline}</span> : null}
        <h1>{view.eventName}</h1>
        {view.subtitle ? <p className={styles.stage}>{view.subtitle}</p> : null}
        <p className={styles.meta}>
          <StateLabel open={open} />
          <span>
            1 vote = <b className={styles.num}>{formatNumber(view.price)} FCFA</b>
          </span>
          {closing ? <span className={styles.num}>{closing}</span> : null}
        </p>
      </section>

      {closedMessage ? <p className={styles.closed}>{closedMessage}</p> : null}

      {view.candidates.length === 0 ? (
        <EmptyList />
      ) : (
        <section
          className={styles.grid}
          aria-label={view.showCounts ? "Candidats, du plus voté au moins voté" : "Candidats"}
        >
          {view.candidates.map((candidate) => (
            <article key={candidate.id} className={styles.card}>
              <div className={styles.photo}>
                <Portrait candidate={candidate} />
              </div>
              <div className={styles.cardBody}>
                <h3>{candidate.name}</h3>
                {candidate.city ? (
                  <span className={styles.city}>
                    <PinIcon />
                    {candidate.city}
                  </span>
                ) : null}
                {candidate.votes !== null && candidate.rank !== null ? (
                  <p className={`${styles.score} ${styles.num}`}>
                    <span>
                      <Ordinal rank={candidate.rank} /> · <b>{votesLabel(candidate.votes)}</b>
                    </span>
                    <span>{votePercent(candidate.votes, total)} %</span>
                  </p>
                ) : null}
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGold}`}
                  disabled={!open}
                  onClick={() => onVote(candidate.id)}
                >
                  Voter
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

/* ---- Style « Carte du menu » ---- */

function MenuView({ view, open, closing, closedMessage, onVote }: ViewProps) {
  const total = view.totalVotes ?? 0;
  return (
    <section className={styles.cCard}>
      <div className={styles.cTop}>
        {view.tagline ? <span className={styles.eyebrow}>{view.tagline}</span> : null}
        <h1 className={styles.cTitle}>{view.eventName}</h1>
        {view.subtitle ? <p className={styles.cSub}>{view.subtitle}</p> : null}
        <p className={styles.cSub}>
          1 vote · <b className={styles.num}>{formatNumber(view.price)} FCFA</b>
          {closing ? <span className={styles.num}> · {closing}</span> : null}
        </p>
        <StateLabel open={open} />
      </div>

      {closedMessage ? <p className={styles.closed}>{closedMessage}</p> : null}

      {view.candidates.length === 0 ? (
        <EmptyList />
      ) : (
        <ol
          className={styles.cList}
          aria-label={view.showCounts ? "Candidats, du plus voté au moins voté" : "Candidats, dans l'ordre de passage"}
        >
          {view.candidates.map((candidate) => (
            <li key={candidate.id} className={styles.cItem}>
              <div className={`${styles.avatar} ${styles.cPhoto}`}>
                <Portrait candidate={candidate} />
              </div>
              <span className={styles.cNo}>
                {candidate.rank !== null ? <Ordinal rank={candidate.rank} /> : `Nº ${candidate.order}`}
              </span>
              <h3>{candidate.name}</h3>
              {candidate.city ? <p className={styles.cCity}>{candidate.city}</p> : null}
              <div className={styles.cLine}>
                {candidate.votes !== null ? (
                  <span className={`${styles.cVotes} ${styles.num}`}>
                    <b>{votesLabel(candidate.votes)}</b> · {votePercent(candidate.votes, total)} %
                  </span>
                ) : null}
                <span className={styles.cDots} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.cVote}
                  disabled={!open}
                  onClick={() => onVote(candidate.id)}
                >
                  Voter
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {view.methods.length > 0 ? (
        <p className={styles.cFoot}>{view.methods.map((method) => PAYMENT_METHOD_LABELS[method]).join(" · ")}</p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtre de vote                                                      */
/* ------------------------------------------------------------------ */

type Step = "form" | "paying" | "redirecting" | "checking" | "done" | "failed";

function Spinner({ title, detail }: { title: string; detail?: React.ReactNode }) {
  return (
    <div className={styles.center} role="status">
      <div className={styles.spin} aria-hidden="true" />
      <h2>{title}</h2>
      {detail ? <p className={`${styles.muted} ${styles.num}`}>{detail}</p> : null}
    </div>
  );
}

function VoteSheet({
  candidate,
  view,
  resumeReference,
  onClose,
  onPaid,
}: {
  candidate: PublicVoteCandidate;
  view: PublicVoteView;
  /** Référence d'un paiement parti chez l'opérateur, à vérifier dès l'ouverture. */
  resumeReference?: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [votes, setVotes] = useState(5);
  const [method, setMethod] = useState<PaymentMethod | undefined>(view.methods[0]);
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>(resumeReference ? "checking" : "form");
  const [reference, setReference] = useState<string | null>(resumeReference ?? null);
  const [receipt, setReceipt] = useState<PublicVoteReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const payRef = useRef<HTMLButtonElement>(null);
  const onPaidRef = useRef(onPaid);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const clamp = (value: number) => Math.max(1, Math.min(MAX_VOTES_PER_PAYMENT, value));
  const amount = votes * view.price;
  const busy = step === "paying" || step === "redirecting";

  // Échap ferme la fenêtre, sauf pendant l'envoi du paiement.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    payRef.current?.focus();
  }, []);

  // Vérification d'un paiement parti chez l'opérateur : seul le serveur, après
  // avoir interrogé la passerelle, dit qu'il est payé.
  useEffect(() => {
    if (step !== "checking" || !reference) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const result = await checkPublicVotePaymentAction(reference);
        if (cancelled) return;
        if (!result.ok) {
          forgetPending();
          setError(result.error);
          setStep("failed");
          return;
        }
        setReceipt(result.receipt);
        if (result.receipt.status === "CONFIRMED") {
          forgetPending();
          setStep("done");
          onPaidRef.current();
          return;
        }
        if (result.receipt.status === "FAILED") {
          forgetPending();
          setError("Le paiement n'a pas abouti. Aucun vote n'a été compté.");
          setStep("failed");
          return;
        }
      } catch {
        // Réseau coupé : on réessaie au prochain passage.
      }
      if (cancelled) return;
      attempts += 1;
      if (attempts < POLL_MAX) timer = setTimeout(run, POLL_MS);
      else setExhausted(true);
    };

    timer = setTimeout(run, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [step, reference, round]);

  async function pay() {
    if (!method) return;
    if (!normalizePhone(phone)) {
      setError("Numéro invalide. Format attendu : 07 00 00 00 00.");
      return;
    }
    setError(null);
    setStep("paying");
    try {
      const [result] = await Promise.all([
        startPublicVotePaymentAction({ candidateId: candidate.id, votes, method, phone }),
        new Promise((resolve) => setTimeout(resolve, MIN_PAYING_MS)),
      ]);
      if (!result.ok) {
        setError(result.error);
        setStep("form");
      } else if (result.kind === "confirmed") {
        setReceipt(result.receipt);
        setStep("done");
        onPaid();
      } else {
        // Noté avant de partir : la page le retrouvera au retour du visiteur.
        rememberPending({ reference: result.reference, candidateId: candidate.id });
        setReference(result.reference);
        setStep("redirecting");
        window.location.assign(result.url);
      }
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau puis réessayez : rien n'a été prélevé.");
      setStep("form");
    }
  }

  function startOver() {
    setReceipt(null);
    setReference(null);
    setError(null);
    setExhausted(false);
    setStep("form");
  }

  return (
    <div
      className={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="vote-sheet-title">
        <div className={styles.sheetHead}>
          <div className={styles.avatar}>
            <Portrait candidate={candidate} />
          </div>
          <div>
            <span className={styles.eyebrow}>
              Voter pour{candidate.city ? ` · ${candidate.city}` : ""}
            </span>
            <h2 id="vote-sheet-title">{candidate.name}</h2>
          </div>
          {!busy ? (
            <button type="button" className={styles.x} onClick={onClose} aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>

        {step === "form" ? (
          <>
            <div className={styles.group}>
              <span className={styles.label} id="vote-count-label">
                Nombre de votes
              </span>
              <div className={styles.stepper}>
                <button type="button" onClick={() => setVotes((v) => clamp(v - 1))} aria-label="Un vote de moins">
                  −
                </button>
                <input
                  className={styles.num}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_VOTES_PER_PAYMENT}
                  value={votes}
                  aria-labelledby="vote-count-label"
                  onChange={(event) => setVotes(clamp(Number.parseInt(event.target.value, 10) || 1))}
                />
                <button type="button" onClick={() => setVotes((v) => clamp(v + 1))} aria-label="Un vote de plus">
                  +
                </button>
              </div>
              <div className={styles.chips}>
                {PACKS.map((pack) => (
                  <button
                    key={pack}
                    type="button"
                    className={`${styles.chip} ${styles.num}`}
                    aria-pressed={votes === pack}
                    onClick={() => setVotes(pack)}
                  >
                    {pack}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.group}>
              <span className={styles.label}>Payer avec</span>
              <div className={styles.pay}>
                {view.methods.map((key) => (
                  <button key={key} type="button" aria-pressed={method === key} onClick={() => setMethod(key)}>
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

            <label className={styles.group}>
              <span className={styles.label}>Numéro qui paie</span>
              <input
                className={`${styles.phone} ${styles.num}`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07 00 00 00 00"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button
              ref={payRef}
              type="button"
              className={`${styles.btn} ${styles.btnGold} ${styles.cta} ${styles.num}`}
              disabled={!method}
              onClick={pay}
            >
              Payer {formatNumber(amount)} FCFA
            </button>
            <p className={styles.sim}>
              {view.simulated
                ? "Paiement simulé : aucune somme n'est prélevée."
                : "Vous validerez le paiement chez votre opérateur, puis reviendrez sur cette page."}
            </p>
          </>
        ) : null}

        {step === "paying" && method ? (
          <Spinner title="Paiement en cours…" detail={`${PAYMENT_METHOD_LABELS[method]} · ${formatNumber(amount)} FCFA`} />
        ) : null}

        {step === "redirecting" && method ? (
          <Spinner
            title={`Direction ${PAYMENT_METHOD_LABELS[method]}…`}
            detail="Validez le paiement, puis revenez sur cette page : vos votes y seront confirmés."
          />
        ) : null}

        {step === "checking" ? (
          <>
            <Spinner
              title="Vérification du paiement…"
              detail={
                exhausted
                  ? "Toujours en attente. Validez la demande reçue sur votre téléphone, puis vérifiez à nouveau."
                  : "Validez la demande reçue sur votre téléphone si ce n'est pas déjà fait."
              }
            />
            {exhausted ? (
              <div className={styles.row2}>
                <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onClose}>
                  Fermer
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGold}`}
                  onClick={() => {
                    setExhausted(false);
                    setRound((value) => value + 1);
                  }}
                >
                  Vérifier à nouveau
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {step === "failed" ? (
          <>
            <div className={styles.center} role="alert">
              <h2>Paiement non abouti</h2>
              <p className={styles.muted}>{error ?? "Le paiement n'a pas abouti. Aucun vote n'a été compté."}</p>
            </div>
            <div className={styles.row2}>
              <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onClose}>
                Fermer
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={startOver}>
                Réessayer
              </button>
            </div>
          </>
        ) : null}

        {step === "done" && receipt ? (
          <>
            <div className={styles.center} role="status">
              <div className={styles.check}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </div>
              <h2>Merci !</h2>
              <p>
                <b className={styles.num}>{votesLabel(receipt.votes)}</b> pour {receipt.candidateName}
              </p>
              <p className={`${styles.muted} ${styles.num} ${styles.receipt}`}>
                {formatNumber(receipt.amount)} FCFA · {PAYMENT_METHOD_LABELS[receipt.method]} · réf.{" "}
                {receipt.reference}
              </p>
            </div>
            <div className={styles.row2}>
              <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onClose}>
                Fermer
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={startOver}>
                Revoter
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
