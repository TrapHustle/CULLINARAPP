"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { etatPaiementAction, payerAction, voterGratuitAction } from "@/lib/vote-public-saas-actions";
import type { Recu } from "@/lib/vote-public-saas";
import {
  DEFAULT_PHONE_COUNTRY,
  detectPhoneCountry,
  formatNumber,
  initials,
  MIN_PAYMENT_AMOUNT,
  parsePhone,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  rankByVotes,
  votePercent,
  votesLabel,
  type PaymentMethod,
  type PhoneCountry,
} from "@/lib/public-vote-core";
import { CountryPicker, LOGOS, plateClass } from "@/app/voter/pay-ui";
// Même feuille de style que l'ancienne page `/voter` (style « Clair ») : le
// public retrouve exactement la page qu'il connaît.
import styles from "@/app/voter/voter.module.css";

interface Candidat {
  participationId: string;
  ordre: number;
  nom: string;
  ville: string | null;
  photoUrl: string | null;
  /** `null` quand l'organisateur masque les compteurs. */
  voix: number | null;
}

interface Props {
  slug: string;
  evenement: { nom: string; sousTitre: string | null; afficheUrl: string | null; organisation: string };
  selection: {
    libelle: string;
    lieu: string | null;
    fin: string | null;
    /** « vendredi 2 octobre 2026 à 22 h », calculé par le serveur. */
    finLibelle: string | null;
    etat: string;
    prixVote: number;
    voixGratuite: boolean;
    compteursVisibles: boolean;
    moyens: string[];
  };
  ouvert: boolean;
  simulation: boolean;
  voixMax: number;
  candidats: Candidat[];
}

/** Cadence de mise à jour des compteurs pendant que la page reste ouverte. */
const REFRESH_MS = 15_000;
/** Durée minimale de l'écran « Paiement en cours », pour qu'il se lise. */
const MIN_PAYING_MS = 900;
/** Vérification toutes les 5 secondes, pendant 5 minutes. */
const POLL_MS = 5_000;
const POLL_MAX = 60;

/* ------------------------------------------------------------------ */
/* Paiement parti chez l'opérateur                                      */
/* ------------------------------------------------------------------ */

/**
 * La passerelle n'a pas d'URL de retour : après avoir payé, le visiteur
 * revient seul sur la page. Le paiement en cours est donc noté dans son
 * navigateur avant de partir, pour être retrouvé et vérifié à son retour.
 */
type PaiementEnCours = { reference: string; participationId: string };
const cleStockage = (slug: string) => `dv-paiement-${slug}`;

function lireEnCours(slug: string): PaiementEnCours | null {
  try {
    const valeur: unknown = JSON.parse(localStorage.getItem(cleStockage(slug)) ?? "null");
    if (valeur && typeof valeur === "object") {
      const { reference, participationId } = valeur as Record<string, unknown>;
      if (typeof reference === "string" && typeof participationId === "string") return { reference, participationId };
    }
  } catch {
    // Stockage indisponible : le paiement reste vérifié par le serveur.
  }
  return null;
}
function noterEnCours(slug: string, enCours: PaiementEnCours) {
  try {
    localStorage.setItem(cleStockage(slug), JSON.stringify(enCours));
  } catch {
    // Sans stockage, le paiement sera confirmé par le serveur sans retour visible.
  }
}
function oublierEnCours(slug: string) {
  try {
    localStorage.removeItem(cleStockage(slug));
  } catch {
    // Rien à faire.
  }
}

/* ------------------------------------------------------------------ */
/* Horloge, lue sans décalage d'hydratation                             */
/* ------------------------------------------------------------------ */

let maintenant = 0;
function abonnerHorloge(onTick: () => void) {
  maintenant = Date.now();
  const minuterie = setInterval(() => {
    maintenant = Date.now();
    onTick();
  }, 20_000);
  return () => clearInterval(minuterie);
}
function lireHorloge() {
  if (maintenant === 0) maintenant = Date.now();
  return maintenant;
}
/** `null` au rendu serveur : la page ne se ferme d'elle-même qu'une fois chargée. */
function useMaintenant(): number | null {
  return useSyncExternalStore(abonnerHorloge, lireHorloge, () => null);
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

function Ordinal({ rang }: { rang: number }) {
  return (
    <>
      {rang}
      <sup>{rang === 1 ? "er" : "e"}</sup>
    </>
  );
}

function Portrait({ candidat }: { candidat: Candidat }) {
  if (!candidat.photoUrl) {
    return (
      <span className={styles.monogram} aria-hidden="true">
        {initials(candidat.nom)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={candidat.photoUrl} alt={candidat.nom} width={480} height={480} />;
}

const estMoyen = (m: string): m is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(m);

export function VotePublic({ slug, evenement, selection, ouvert: ouvertServeur, simulation, voixMax, candidats }: Props) {
  const router = useRouter();
  const now = useMaintenant();
  const [query, setQuery] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [reprise, setReprise] = useState<PaiementEnCours | null>(null);
  /** Paiements dont le visiteur a déjà fermé la fenêtre : elle ne se rouvre plus d'elle-même. */
  const ecartes = useRef<Set<string>>(new Set());
  const moyens = selection.moyens.filter(estMoyen);

  // Retour de chez l'opérateur : on rouvre la fenêtre sur le paiement en cours.
  useEffect(() => {
    const regarder = () => {
      const enCours = lireEnCours(slug);
      if (!enCours || ecartes.current.has(enCours.reference)) return;
      setReprise(enCours);
      setChoisi(enCours.participationId);
    };
    const visible = () => {
      if (document.visibilityState === "visible") regarder();
    };
    const minuterie = setTimeout(regarder, 0);
    window.addEventListener("pageshow", regarder);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(minuterie);
      window.removeEventListener("pageshow", regarder);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [slug]);

  // Les compteurs suivent les votes des autres visiteurs sans rechargement.
  useEffect(() => {
    const minuterie = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(minuterie);
  }, [router]);

  // La page peut rester ouverte au-delà de l'heure de clôture : elle se ferme alors d'elle-même.
  const fermeParHorloge = selection.fin !== null && now !== null && Date.parse(selection.fin) <= now;
  const ouvert = ouvertServeur && !fermeParHorloge;
  const termine = selection.etat === "CLOTUREE" || fermeParHorloge;
  const messageFerme = ouvert
    ? null
    : termine
      ? "Le vote est clos. Rendez-vous à la proclamation des résultats."
      : "Le vote n'est pas ouvert pour le moment.";
  const cloture = selection.finLibelle ? `${termine ? "Clôturé" : "Clôture"} le ${selection.finLibelle}` : null;

  // Compteurs visibles : du plus voté au moins voté, comme sur l'ancienne page.
  const total = candidats.reduce((s, c) => s + (c.voix ?? 0), 0);
  // Même classement que l'ancienne page : les ex aequo partagent leur rang.
  const classes = selection.compteursVisibles
    ? rankByVotes(candidats.map((c) => ({ ...c, order: c.ordre, votes: c.voix ?? 0 })))
    : null;
  const ordonnes = classes ?? candidats;
  const rangs = new Map((classes ?? []).map((c) => [c.participationId, c.rank]));
  // Numéro de passage affiché d'après la position, pas la valeur brute de
  // `ordre` : les sélections créées avant la numérotation à 1 partent de 0.
  const numeros = new Map(candidats.map((c, i) => [c.participationId, i + 1]));
  const terme = query.trim().toLowerCase();
  const affiches = ordonnes.filter((c) => !terme || `${c.nom} ${c.ville ?? ""}`.toLowerCase().includes(terme));

  const etape =
    selection.lieu && !selection.libelle.toLowerCase().includes(selection.lieu.toLowerCase())
      ? `${selection.libelle} · ${selection.lieu}`
      : selection.libelle;
  const surtitre = evenement.sousTitre ?? evenement.organisation;
  const candidatChoisi = choisi ? candidats.find((c) => c.participationId === choisi) : undefined;

  return (
    <div className={`${styles.page} ${styles.clair}`}>
      <header className={styles.clTop}>
        <div className={styles.clIn}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.clMark} src="/brand/inovyx-logo.png" alt="Inovyx Tech" />
          <div className={styles.clBrand}>
            <b>Digitalyx Vote</b>
            <span>Vote du public en ligne</span>
          </div>
          <span className={styles.clSpacer} />
          <Link href="/connexion" className={styles.orgaBtn} aria-label="Espace organisateur" title="Espace organisateur">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" />
            </svg>
          </Link>
        </div>
      </header>

      <section className={styles.clHero}>
        {evenement.afficheUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.clHeroBg} src={evenement.afficheUrl} alt="" />
        ) : null}
        <div className={`${styles.clIn} ${styles.clHeroIn} ${evenement.afficheUrl ? styles.clHeroWithPoster : ""}`}>
          {surtitre ? <p className={styles.clEyebrow}>{surtitre}</p> : null}
          <h1>{evenement.nom}</h1>
          <div className={styles.clChips}>
            <span className={styles.clChip}>
              <span className={ouvert ? styles.clDotOn : styles.clDotOff} />
              {ouvert ? "Vote ouvert" : "Vote fermé"}
            </span>
            <span className={`${styles.clChip} ${styles.num}`}>{formatNumber(selection.prixVote)} FCFA le vote</span>
          </div>
          {cloture ? <p className={`${styles.clClose} ${styles.num}`}>{cloture}</p> : null}
        </div>
      </section>

      <main className={`${styles.clIn} ${styles.clMain}`}>
        {messageFerme ? <p className={styles.closed}>{messageFerme}</p> : null}

        <div className={styles.clTools}>
          <div className={styles.clStage}>{etape}</div>
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

        {candidats.length === 0 ? (
          <p className={styles.empty}>Les candidats seront présentés ici très bientôt.</p>
        ) : affiches.length === 0 ? (
          <p className={styles.empty}>Aucun candidat ne correspond à cette recherche.</p>
        ) : (
          <ol
            className={styles.clList}
            aria-label={selection.compteursVisibles ? "Candidats, du plus voté au moins voté" : "Candidats, dans l'ordre de passage"}
          >
            {affiches.map((c) => {
              const rang = selection.compteursVisibles ? rangs.get(c.participationId) : undefined;
              return (
                <li key={c.participationId} className={styles.clCard}>
                  <div className={styles.clBanner}>
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photoUrl} alt={c.nom} />
                    ) : (
                      <span className={styles.clInitials} aria-hidden="true">
                        {initials(c.nom)}
                      </span>
                    )}
                    <span className={`${styles.clNum} ${styles.num}`}>#{String(numeros.get(c.participationId) ?? c.ordre).padStart(4, "0")}</span>
                    {rang !== undefined ? (
                      <span className={styles.clRank}>
                        <Ordinal rang={rang} />
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.clBody}>
                    <div>
                      <h3 className={styles.clName}>
                        {c.nom}
                        {c.ville ? ` – ${c.ville}` : ""}
                      </h3>
                      <p className={styles.clRole}>Candidat(e) · Nominé(e)</p>
                    </div>
                    {c.voix !== null ? (
                      <div className={styles.clScore}>
                        <p className={styles.num}>
                          <b>{votesLabel(c.voix)}</b>
                          <span>{votePercent(c.voix, total)} %</span>
                        </p>
                        <div className={styles.clBar}>
                          <i style={{ width: `${total ? (c.voix / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ) : null}
                    <button type="button" className={styles.clVote} disabled={!ouvert} onClick={() => setChoisi(c.participationId)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
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
            {evenement.nom}
            {surtitre ? ` — ${surtitre}` : ""}
          </strong>
          <div className={styles.clPay} aria-label="Moyens de paiement">
            {moyens.map((m) => (
              <span key={m} className={plateClass(m)}>
                {LOGOS[m].map((logo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={logo.src} src={logo.src} alt={PAYMENT_METHOD_LABELS[m]} />
                ))}
              </span>
            ))}
          </div>
          <p>1 vote = {formatNumber(selection.prixVote)} FCFA. Chaque vote compte dès que le paiement est confirmé.</p>
          {simulation ? <p>Aperçu : paiements simulés, aucune somme n&apos;est prélevée.</p> : null}
          <p>Vote organisé par {evenement.organisation} · © INOVYX TECH · Digitalyx Vote</p>
        </div>
      </footer>

      {/* Une fois ouverte, la fenêtre reste affichée même si le vote se ferme
          entre-temps : un paiement en cours doit pouvoir montrer son issue. */}
      {candidatChoisi ? (
        <FenetreVote
          key={candidatChoisi.participationId}
          slug={slug}
          candidat={candidatChoisi}
          selection={selection}
          moyens={moyens}
          simulation={simulation}
          voixMax={voixMax}
          referenceReprise={reprise?.participationId === candidatChoisi.participationId ? reprise.reference : undefined}
          onFermer={() => {
            if (reprise) ecartes.current.add(reprise.reference);
            setChoisi(null);
            setReprise(null);
          }}
          onVote={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtre de vote                                                      */
/* ------------------------------------------------------------------ */

type Etape = "form" | "paying" | "redirecting" | "checking" | "done" | "failed" | "merci";

function Spinner({ title, detail }: { title: string; detail?: React.ReactNode }) {
  return (
    <div className={styles.center} role="status">
      <div className={styles.spin} aria-hidden="true" />
      <h2>{title}</h2>
      {detail ? <p className={`${styles.muted} ${styles.num}`}>{detail}</p> : null}
    </div>
  );
}

function FenetreVote({
  slug,
  candidat,
  selection,
  moyens,
  simulation,
  voixMax,
  referenceReprise,
  onFermer,
  onVote,
}: {
  slug: string;
  candidat: Candidat;
  selection: Props["selection"];
  moyens: PaymentMethod[];
  simulation: boolean;
  voixMax: number;
  /** Référence d'un paiement parti chez l'opérateur, à vérifier dès l'ouverture. */
  referenceReprise?: string;
  onFermer: () => void;
  onVote: () => void;
}) {
  const [onglet, setOnglet] = useState<"payer" | "gratuit">(
    selection.voixGratuite && !referenceReprise ? "gratuit" : "payer",
  );
  const [votes, setVotes] = useState(1);
  const [method, setMethod] = useState<PaymentMethod | undefined>(moyens[0]);
  const [country, setCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [step, setStep] = useState<Etape>(referenceReprise ? "checking" : "form");
  const [reference, setReference] = useState<string | null>(referenceReprise ?? null);
  const [receipt, setReceipt] = useState<Recu | null>(null);
  const [merci, setMerci] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  /** Les reproches n'apparaissent qu'une fois « Payer » appuyé. */
  const [scolded, setScolded] = useState(false);
  const [copied, setCopied] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLElement>(null);
  const onVoteRef = useRef(onVote);

  useEffect(() => {
    onVoteRef.current = onVote;
  }, [onVote]);

  const gratuit = onglet === "gratuit";
  const clamp = (value: number) => Math.max(1, Math.min(voixMax, value));
  const amount = votes * selection.prixVote;
  const busy = step === "paying";
  // La voix gratuite n'accepte que les numéros ivoiriens : le pays ne se change pas.
  const pays = gratuit ? DEFAULT_PHONE_COUNTRY : country;
  const parsed = parsePhone(phone, pays);
  /** Wave, Orange Money et MTN n'encaissent que depuis les pays couverts. */
  const outOfReach = !gratuit && method !== undefined && method !== "CARD" && !country.mobile;

  // Échap ferme la liste des pays, puis la fenêtre — jamais pendant l'envoi.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pickerOpen) {
        setPickerOpen(false);
        return;
      }
      if (!busy) onFermer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onFermer, pickerOpen]);

  // La page du fond ne défile plus derrière la fenêtre.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Le focus se pose sur la fenêtre, pas sur « Payer » : une touche Entrée ne
  // doit pas lancer un paiement à l'ouverture.
  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  // Retour de chez l'opérateur sans rechargement de la page.
  useEffect(() => {
    if (step !== "redirecting" || !reference) return;
    const resume = () => setStep("checking");
    const onVisible = () => {
      if (document.visibilityState === "visible") resume();
    };
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [step, reference]);

  // Vérification d'un paiement parti chez l'opérateur : seul le serveur dit qu'il est payé.
  useEffect(() => {
    if (step !== "checking" || !reference) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const result = await etatPaiementAction(reference);
        if (cancelled) return;
        if (!result) {
          oublierEnCours(slug);
          setError("Ce paiement est introuvable. Aucun vote n'a été compté.");
          setStep("failed");
          return;
        }
        setReceipt(result);
        if (result.statut === "CONFIRMED") {
          oublierEnCours(slug);
          setStep("done");
          onVoteRef.current();
          return;
        }
        if (result.statut === "FAILED") {
          oublierEnCours(slug);
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
  }, [step, reference, round, slug]);

  /** Le focus reste dans la fenêtre tant qu'elle est ouverte. */
  function keepFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const root = sheetRef.current;
    if (!root) return;
    const scope = pickerOpen ? root.querySelector(`.${styles.picker}`) ?? root : root;
    const reachable = Array.from(
      scope.querySelectorAll<HTMLElement>('button, input, select, a[href], [tabindex]:not([tabindex="-1"])'),
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

  function changePhone(value: string) {
    // Un numéro écrit avec son indicatif règle le pays de lui-même (paiement seulement).
    const detected = gratuit ? null : detectPhoneCountry(value);
    if (detected && detected.country.code !== country.code) {
      setCountry(detected.country);
      setPhone(detected.rest);
      return;
    }
    setPhone(value);
  }

  function choisirOnglet(suivant: "payer" | "gratuit") {
    // La voix gratuite lit le numéro comme ivoirien : un numéro étranger saisi
    // pour payer y deviendrait le numéro de quelqu'un d'autre.
    if (suivant === "gratuit" && country.code !== DEFAULT_PHONE_COUNTRY.code) setPhone("");
    setOnglet(suivant);
    setError(null);
    setScolded(false);
  }

  async function voteGratuit() {
    setScolded(true);
    setError(null);
    if (!parsed.ok) {
      phoneRef.current?.focus();
      return;
    }
    setStep("paying");
    try {
      const [result] = await Promise.all([
        voterGratuitAction(slug, candidat.participationId, parsed.phone),
        new Promise((resolve) => setTimeout(resolve, MIN_PAYING_MS)),
      ]);
      if (!result.ok) {
        setError(result.erreur);
        setStep("form");
      } else {
        setMerci(result.message);
        setStep("merci");
        onVote();
      }
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
      setStep("form");
    }
  }

  async function pay() {
    setScolded(true);
    setError(null);

    // Le bouton reste toujours actif : c'est l'appui qui dit quoi corriger.
    if (!method) {
      setError("Choisissez d'abord un moyen de paiement.");
      return;
    }
    if (amount < MIN_PAYMENT_AMOUNT) {
      const least = Math.ceil(MIN_PAYMENT_AMOUNT / selection.prixVote);
      setError(
        `Les opérateurs refusent les paiements sous ${formatNumber(MIN_PAYMENT_AMOUNT)} FCFA. Prenez au moins ${votesLabel(least)}.`,
      );
      return;
    }
    if (!parsed.ok) {
      phoneRef.current?.focus();
      return;
    }
    if (outOfReach) {
      setError(
        `${PAYMENT_METHOD_LABELS[method]} n'accepte pas un numéro ${country.name}. Choisissez un autre moyen de paiement, ou un numéro couvert par la passerelle.`,
      );
      return;
    }

    setStep("paying");
    try {
      const [result] = await Promise.all([
        payerAction({ slug, participationId: candidat.participationId, voix: votes, moyen: method, telephone: parsed.phone }),
        new Promise((resolve) => setTimeout(resolve, MIN_PAYING_MS)),
      ]);
      if (!result.ok) {
        setError(result.erreur);
        setStep("form");
      } else if (result.type === "confirme") {
        setReceipt(result.recu);
        setStep("done");
        onVote();
      } else {
        // Noté avant de partir : la page le retrouvera au retour du visiteur.
        noterEnCours(slug, { reference: result.reference, participationId: candidat.participationId });
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
    setMerci(null);
    setError(null);
    setExhausted(false);
    setScolded(false);
    setCopied(false);
    setOnglet("payer");
    setStep("form");
  }

  async function copyReference() {
    const value = receipt?.reference;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Presse-papiers refusé : on sélectionne la référence pour la copier à la main.
      const node = refRef.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  /** Message sous le champ : relecture du numéro, ou ce qu'il faut corriger. */
  const phoneHint = parsed.ok
    ? { text: gratuit ? `Votre numéro : ${parsed.pretty}` : `Sera débité : ${parsed.pretty}`, tone: styles.hintGood }
    : scolded || phone.replace(/\D/g, "").length > 3
      ? { text: parsed.error, tone: styles.hintBad }
      : gratuit
        ? { text: "Une voix offerte par numéro de Côte d'Ivoire.", tone: "" }
        : {
            text:
              country.len !== null
                ? `${country.name} · ${country.len} chiffres. Numéro étranger ? Écrivez-le avec son +indicatif.`
                : "Écrivez le numéro avec son indicatif, par exemple +41 79 123 45 67.",
            tone: "",
          };

  return (
    <div
      className={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onFermer();
      }}
    >
      <div
        className={styles.sheet}
        ref={sheetRef}
        tabIndex={-1}
        onKeyDown={keepFocus}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vote-sheet-title"
      >
        <div className={styles.sheetHead}>
          <div className={styles.avatar}>
            <Portrait candidat={candidat} />
          </div>
          <div>
            <span className={styles.eyebrow}>Voter pour{candidat.ville ? ` · ${candidat.ville}` : ""}</span>
            <h2 id="vote-sheet-title">{candidat.nom}</h2>
          </div>
          {!busy ? (
            <button type="button" className={styles.x} onClick={onFermer} aria-label="Fermer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>

        {step === "form" ? (
          <>
            <div className={styles.sheetBody}>
              {selection.voixGratuite ? (
                <div className={styles.group}>
                  <span className={styles.label} id="vote-kind-label">
                    Type de vote
                  </span>
                  <div className={styles.pay} role="group" aria-labelledby="vote-kind-label">
                    <button type="button" aria-pressed={gratuit} onClick={() => choisirOnglet("gratuit")}>
                      Voix gratuite
                    </button>
                    <button type="button" aria-pressed={!gratuit} onClick={() => choisirOnglet("payer")}>
                      Acheter des votes
                    </button>
                  </div>
                </div>
              ) : null}

              {!gratuit ? (
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
                        max={voixMax}
                        value={votes}
                        aria-labelledby="vote-count-label"
                        onChange={(event) => setVotes(clamp(Number.parseInt(event.target.value, 10) || 1))}
                      />
                      <button type="button" onClick={() => setVotes((v) => clamp(v + 1))} aria-label="Un vote de plus">
                        +
                      </button>
                    </div>
                  </div>

                  <div className={styles.group}>
                    <span className={styles.label} id="pay-label">
                      Payer avec
                    </span>
                    <div className={styles.pay} role="group" aria-labelledby="pay-label">
                      {moyens.map((key) => (
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
                    {outOfReach && method ? (
                      <p className={styles.warn}>
                        {PAYMENT_METHOD_LABELS[method]} ne fonctionne pas depuis un numéro {country.name}. Choisissez un
                        autre moyen de paiement, ou un numéro couvert par la passerelle.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              <div className={styles.group}>
                <label className={styles.label} htmlFor="vote-phone">
                  {gratuit ? "Votre numéro de téléphone" : method === "CARD" ? "Numéro pour le reçu" : "Numéro qui paie"}
                </label>
                <div className={styles.field}>
                  <button
                    type="button"
                    className={styles.pickerBtn}
                    onClick={() => setPickerOpen(true)}
                    disabled={gratuit}
                    aria-haspopup="dialog"
                    aria-label={`Pays du numéro : ${pays.name}${gratuit ? "" : ". Changer de pays"}`}
                  >
                    <span aria-hidden="true">{pays.flag}</span>
                    <span className={`${styles.dial} ${styles.num}`}>{pays.dial ? `+${pays.dial}` : "+"}</span>
                    {!gratuit ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    ) : null}
                  </button>
                  <input
                    ref={phoneRef}
                    id="vote-phone"
                    className={styles.num}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={pays.hint}
                    value={phone}
                    onChange={(event) => changePhone(event.target.value)}
                  />
                </div>
                <p className={`${styles.hint} ${phoneHint.tone}`}>{phoneHint.text}</p>
                {!gratuit && method === "CARD" ? (
                  <p className={styles.hint}>
                    Vous saisirez votre carte sur la page sécurisée de la banque ; ce numéro ne sert qu&apos;au reçu.
                  </p>
                ) : null}
              </div>

              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}

              <p className={styles.terms}>
                En votant, vous acceptez nos{" "}
                <Link href="/cgu" target="_blank">
                  conditions générales d&apos;utilisation
                </Link>
                .
              </p>
            </div>

            <div className={styles.sheetFoot}>
              {gratuit ? (
                <>
                  <button type="button" className={`${styles.btn} ${styles.btnGold} ${styles.cta}`} onClick={voteGratuit}>
                    Voter gratuitement
                  </button>
                  <p className={styles.sim}>Une seule voix gratuite par numéro. Pour soutenir encore, achetez des votes.</p>
                </>
              ) : (
                <>
                  <div className={styles.recap}>
                    <span className={styles.num}>
                      {formatNumber(votes)} × {formatNumber(selection.prixVote)} FCFA
                    </span>
                    <b className={styles.num}>{formatNumber(amount)} FCFA</b>
                  </div>
                  <button type="button" className={`${styles.btn} ${styles.btnGold} ${styles.cta} ${styles.num}`} onClick={pay}>
                    Payer {formatNumber(amount)} FCFA
                  </button>
                  <p className={styles.sim}>
                    {simulation
                      ? "Paiement simulé : aucune somme n'est prélevée."
                      : "Vous validerez le paiement chez votre opérateur, puis reviendrez sur cette page."}
                  </p>
                </>
              )}
            </div>
          </>
        ) : null}

        {step === "paying" ? (
          <div className={styles.sheetBody}>
            {gratuit ? (
              <Spinner title="Enregistrement de votre voix…" />
            ) : (
              <Spinner
                title="Paiement en cours…"
                detail={`${method ? PAYMENT_METHOD_LABELS[method] : ""} · ${formatNumber(amount)} FCFA`}
              />
            )}
          </div>
        ) : null}

        {step === "redirecting" && method ? (
          <>
            <div className={styles.sheetBody}>
              <Spinner
                title={`Direction ${PAYMENT_METHOD_LABELS[method]}…`}
                detail="Validez le paiement chez votre opérateur, puis revenez sur cette page."
              />
            </div>
            <div className={styles.sheetFoot}>
              <div className={styles.row2}>
                <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onFermer}>
                  Fermer
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={() => setStep("checking")}>
                  J&apos;ai payé
                </button>
              </div>
              <p className={styles.sim}>Déjà payé mais cet écran tourne encore ? Appuyez sur « J&apos;ai payé ».</p>
            </div>
          </>
        ) : null}

        {step === "checking" ? (
          <>
            <div className={styles.sheetBody}>
              <Spinner
                title="Vérification du paiement…"
                detail={
                  exhausted
                    ? "Toujours en attente. Validez la demande reçue sur votre téléphone, puis vérifiez à nouveau."
                    : "Validez la demande reçue sur votre téléphone si ce n'est pas déjà fait."
                }
              />
            </div>
            <div className={styles.sheetFoot}>
              <div className={styles.row2}>
                <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onFermer}>
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
                  Vérifier maintenant
                </button>
              </div>
              <p className={styles.sim}>Vos votes seront comptés même si vous fermez cette fenêtre.</p>
            </div>
          </>
        ) : null}

        {step === "failed" ? (
          <>
            <div className={styles.sheetBody}>
              <div className={styles.center} role="alert">
                <h2>Paiement non abouti</h2>
                <p className={styles.muted}>{error ?? "Le paiement n'a pas abouti. Aucun vote n'a été compté."}</p>
              </div>
            </div>
            <div className={styles.sheetFoot}>
              <div className={styles.row2}>
                <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onFermer}>
                  Fermer
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={startOver}>
                  Réessayer
                </button>
              </div>
            </div>
          </>
        ) : null}

        {step === "merci" ? (
          <>
            <div className={styles.sheetBody}>
              <div className={styles.center} role="status">
                <div className={styles.check}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </div>
                <h2>Merci !</h2>
                <p>{merci}</p>
              </div>
            </div>
            <div className={styles.sheetFoot}>
              <div className={styles.row2}>
                <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onFermer}>
                  Fermer
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={startOver}>
                  Acheter des votes
                </button>
              </div>
            </div>
          </>
        ) : null}

        {step === "done" && receipt ? (
          <>
            <div className={styles.sheetBody}>
              <div className={styles.center} role="status">
                <div className={styles.check}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </div>
                <h2>Merci !</h2>
                <p>
                  <b className={styles.num}>{votesLabel(receipt.voix)}</b> pour {receipt.candidat}
                </p>
                <p className={`${styles.muted} ${styles.num} ${styles.receipt}`}>
                  {formatNumber(receipt.montant)} FCFA · {PAYMENT_METHOD_LABELS[receipt.moyen]}
                </p>
                <div className={styles.refLine}>
                  <span className={`${styles.muted} ${styles.num} ${styles.receipt}`}>
                    réf. <b ref={refRef}>{receipt.reference}</b>
                  </span>
                  <button type="button" className={styles.copy} onClick={copyReference}>
                    {copied ? "Copié" : "Copier"}
                  </button>
                </div>
                {receipt.simule ? (
                  <p className={styles.muted}>Paiement de démonstration : rien n&apos;a été prélevé.</p>
                ) : null}
              </div>
            </div>
            <div className={styles.sheetFoot}>
              <div className={styles.row2}>
                <button type="button" className={`${styles.btn} ${styles.btnLine}`} onClick={onFermer}>
                  Fermer
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={startOver}>
                  Revoter
                </button>
              </div>
            </div>
          </>
        ) : null}

        {pickerOpen ? (
          <CountryPicker
            selected={country}
            onBack={() => setPickerOpen(false)}
            onPick={(picked) => {
              setCountry(picked);
              setPickerOpen(false);
              phoneRef.current?.focus();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
