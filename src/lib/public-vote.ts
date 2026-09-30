import { getOrCreateSession, prisma } from "./prisma";
import { checkSirapPayment } from "./sirap";
import {
  enabledMethods,
  formatClosingDate,
  isPublicVoteOpen,
  rankByVotes,
  toPublicVoteStyle,
  type PaymentMethod,
  type PublicVoteStyle,
} from "./public-vote-core";

/**
 * Vote du public en ligne — lecture des données, côté serveur.
 *
 * Les votes d'un candidat = ses votes importés (`Candidate.publicVoteCount`,
 * repris de l'ancienne plateforme) + les votes des paiements confirmés sur
 * `/voter`. Les deux sources ne se mélangent jamais en base.
 */

export type PaymentMode = "simulation" | "sirap";

/**
 * Mode de paiement, fixé par l'environnement du serveur.
 *
 * `PAIEMENT_MODE=sirap` : les paiements passent réellement par la passerelle
 * SIRAP / INOVYX. Toute autre valeur, ou rien : simulation — « Payer » valide
 * sans rien prélever, et ces votes n'entrent jamais dans les résultats
 * officiels. Par prudence, rien de réel ne part sans ce réglage explicite.
 */
export function paymentMode(): PaymentMode {
  return process.env.PAIEMENT_MODE === "sirap" ? "sirap" : "simulation";
}

/** Au-delà, un paiement resté en attente est considéré comme abandonné. */
const PENDING_MAX_DAYS = 3;
/** Nombre de statuts redemandés à la passerelle par passage. */
const REFRESH_BATCH = 20;

/**
 * Redemande à la passerelle le statut des paiements en attente.
 *
 * La passerelle ne prévient jamais : sans cette question, un vote payé ne
 * serait jamais compté. Elle est posée au retour du visiteur, depuis le
 * dashboard et par la tâche planifiée. Renvoie le nombre de paiements dont le
 * statut a changé.
 */
export async function refreshPendingPayments(references?: string[]): Promise<number> {
  const pending = await prisma.publicVotePayment.findMany({
    where: {
      status: "PENDING",
      simulated: false,
      ...(references ? { reference: { in: references } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: REFRESH_BATCH,
  });

  const expiredBefore = Date.now() - PENDING_MAX_DAYS * 86_400_000;
  let changed = 0;

  for (const payment of pending) {
    if (payment.createdAt.getTime() < expiredBefore) {
      await prisma.publicVotePayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      changed++;
      continue;
    }

    const result = await checkSirapPayment(payment.reference);
    if (!result || result.status === "pending") continue;

    // Mise à jour conditionnelle : deux vérifications simultanées ne
    // confirment jamais deux fois le même paiement.
    const { count } = await prisma.publicVotePayment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: result.status === "success" ? "CONFIRMED" : "FAILED",
        confirmedAt: result.status === "success" ? new Date() : null,
        providerReference: result.transaction || payment.providerReference,
      },
    });
    changed += count;
  }

  return changed;
}

/**
 * Votes payés en ligne, par candidat.
 *
 * `includeSimulated` : la page publique et le dashboard comptent les paiements
 * simulés, pour qu'une répétition se voie à l'écran. Les résultats officiels,
 * eux, ne les comptent jamais.
 */
export async function onlineVotesByCandidate({
  includeSimulated,
}: {
  includeSimulated: boolean;
}): Promise<Map<string, number>> {
  const rows = await prisma.publicVotePayment.groupBy({
    by: ["candidateId"],
    where: {
      status: "CONFIRMED",
      candidateId: { not: null },
      ...(includeSimulated ? {} : { simulated: false }),
    },
    _sum: { votes: true },
  });

  return new Map(
    rows
      .filter((row) => row.candidateId !== null)
      .map((row) => [row.candidateId as string, row._sum.votes ?? 0]),
  );
}

export interface PublicVoteCandidate {
  id: string;
  name: string;
  city: string | null;
  photoUrl: string | null;
  /** Ordre de passage, tel que réglé dans Configuration. */
  order: number;
  /** `null` quand l'organisateur masque les compteurs. */
  rank: number | null;
  votes: number | null;
}

/** Tout ce que la page `/voter` affiche — et rien de plus. */
export interface PublicVoteView {
  eventName: string;
  /** Affiche de l'événement (`/api/images/<id>`), en fond de l'en-tête du style clair. */
  posterUrl: string | null;
  tagline: string | null;
  subtitle: string | null;
  price: number;
  open: boolean;
  /** Vrai si l'heure de clôture est passée : le vote est terminé, pas seulement fermé. */
  ended: boolean;
  /** Date ISO de clôture, ou `null` si l'organisateur n'en a pas fixé. */
  closesAt: string | null;
  /** La même, en toutes lettres : « vendredi 2 octobre 2026 à 22 h ». */
  closesAtLabel: string | null;
  showCounts: boolean;
  style: PublicVoteStyle;
  methods: PaymentMethod[];
  simulated: boolean;
  /** Heure du calcul (ISO) : la page s'en sert pour l'année du pied de page, sans décalage d'hydratation. */
  generatedAt: string;
  /** `null` quand les compteurs sont masqués. */
  totalVotes: number | null;
  /** Du plus voté au moins voté ; dans l'ordre de passage si les compteurs sont masqués. */
  candidates: PublicVoteCandidate[];
}

export async function getPublicVoteView(): Promise<PublicVoteView> {
  const [session, candidates, online] = await Promise.all([
    getOrCreateSession(),
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    onlineVotesByCandidate({ includeSimulated: true }),
  ]);

  const now = new Date();
  const showCounts = session.publicVoteShowCounts;
  const withVotes = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    city: candidate.city,
    photoUrl: candidate.photoUrl,
    order: candidate.order,
    votes: candidate.publicVoteCount + (online.get(candidate.id) ?? 0),
  }));

  // Compteurs masqués : ils ne quittent pas le serveur. La page ne reçoit ni
  // votes ni rangs, seulement l'ordre de passage.
  const list: PublicVoteCandidate[] = showCounts
    ? rankByVotes(withVotes)
    : withVotes.map((candidate) => ({ ...candidate, rank: null, votes: null }));

  return {
    eventName: session.eventName?.trim() || "Vote du public",
    posterUrl: session.eventPhotoUrl,
    tagline: session.publicVoteTagline,
    subtitle: session.publicVoteSubtitle,
    price: session.publicVotePrice,
    open: isPublicVoteOpen(session, now),
    ended: session.publicVoteClosesAt !== null && session.publicVoteClosesAt <= now,
    closesAt: session.publicVoteClosesAt?.toISOString() ?? null,
    closesAtLabel: session.publicVoteClosesAt ? formatClosingDate(session.publicVoteClosesAt) : null,
    showCounts,
    style: toPublicVoteStyle(session.publicVoteStyle),
    methods: enabledMethods(session.publicVoteMethods),
    simulated: paymentMode() === "simulation",
    generatedAt: now.toISOString(),
    totalVotes: showCounts ? withVotes.reduce((sum, candidate) => sum + candidate.votes, 0) : null,
    candidates: list,
  };
}

/** Données de l'écran « Vote public » du dashboard. */
export async function getPublicVoteDashboard() {
  const [session, candidates, online, confirmed, simulated, recent, pending] = await Promise.all([
    getOrCreateSession(),
    prisma.candidate.findMany({ orderBy: { order: "asc" } }),
    onlineVotesByCandidate({ includeSimulated: true }),
    prisma.publicVotePayment.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { votes: true, amount: true },
      _count: { _all: true },
    }),
    prisma.publicVotePayment.aggregate({
      where: { status: "CONFIRMED", simulated: true },
      _sum: { votes: true, amount: true },
      _count: { _all: true },
    }),
    prisma.publicVotePayment.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.publicVotePayment.count({ where: { status: "PENDING" } }),
  ]);

  const ranking = rankByVotes(
    candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      photoUrl: candidate.photoUrl,
      order: candidate.order,
      imported: candidate.publicVoteCount,
      online: online.get(candidate.id) ?? 0,
      votes: candidate.publicVoteCount + (online.get(candidate.id) ?? 0),
    })),
  );

  return {
    session,
    open: isPublicVoteOpen(session),
    ranking,
    importedVotes: candidates.reduce((sum, candidate) => sum + candidate.publicVoteCount, 0),
    onlineVotes: confirmed._sum.votes ?? 0,
    revenue: confirmed._sum.amount ?? 0,
    payments: confirmed._count._all,
    simulatedVotes: simulated._sum.votes ?? 0,
    simulatedRevenue: simulated._sum.amount ?? 0,
    simulatedPayments: simulated._count._all,
    pendingPayments: pending,
    mode: paymentMode(),
    recent,
  };
}
