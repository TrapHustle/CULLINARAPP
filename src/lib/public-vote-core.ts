/**
 * Vote du public en ligne — règles pures, sans base de données.
 *
 * Partagées par la page publique `/voter`, le dashboard et les actions
 * serveur ; couvertes par `public-vote-core.test.ts`.
 *
 * Le principe : un vote est payé, et une même personne peut en acheter autant
 * qu'elle le souhaite. Il n'y a donc rien à dédoublonner — seul compte un
 * paiement confirmé.
 */

export const PAYMENT_METHODS = ["WAVE", "ORANGE_MONEY", "MTN", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MTN: "MTN MoMo",
  CARD: "Carte bancaire",
};

/**
 * Montant minimum d'un paiement, en FCFA : en dessous, les opérateurs
 * refusent la demande.
 */
export const MIN_PAYMENT_AMOUNT = 100;

/**
 * Numéro de téléphone ivoirien tel que le visiteur l'écrit (espaces, points,
 * tirets, +225, 00225…), ramené à ses 10 chiffres. `null` si le nombre de
 * chiffres est inattendu : on refuse plutôt que de deviner, un chiffre de trop
 * désignerait une autre ligne.
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00225")) digits = digits.slice(5);
  else if (digits.startsWith("225") && digits.length > 10) digits = digits.slice(3);
  // Ancienne écriture internationale, sans le zéro : +225 7 01 02 03 04.
  if (digits.length === 9 && "1257".includes(digits[0])) digits = `0${digits}`;
  return digits.length === 10 ? digits : null;
}

/** Le style clair (affiche en fond, cartes rectangulaires) en premier : c'est la présentation retenue. */
export const PUBLIC_VOTE_STYLES = ["CLAIR", "MENU", "CARTES"] as const;
export type PublicVoteStyle = (typeof PUBLIC_VOTE_STYLES)[number];

export const PUBLIC_VOTE_STYLE_LABELS: Record<PublicVoteStyle, string> = {
  CLAIR: "Clair (affiche)",
  MENU: "Carte du menu",
  CARTES: "Cartes",
};

/**
 * Plafond de votes par paiement. Il limite un seul paiement, pas la personne :
 * au-delà, on paie un second lot.
 */
export const MAX_VOTES_PER_PAYMENT = 100;

/**
 * Choix clair / sombre de la page publique, rangé à part de celui du dashboard.
 * Sans choix mémorisé, la page s'ouvre en mode nuit.
 */
export const PUBLIC_THEME_KEY = "voter-theme";

/** Bornes du prix d'un vote, en FCFA. */
export const MIN_VOTE_PRICE = 25;
export const MAX_VOTE_PRICE = 100_000;

export interface PublicVoteSettings {
  publicVoteOpen: boolean;
  publicVoteClosesAt: Date | null;
  publicVoteMethods: string[];
}

/** Moyens de paiement actifs, dans l'ordre d'affichage, sans valeur inconnue. */
export function enabledMethods(methods: readonly string[]): PaymentMethod[] {
  return PAYMENT_METHODS.filter((method) => methods.includes(method));
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function toPublicVoteStyle(value: string | null | undefined): PublicVoteStyle {
  return value === "CARTES" || value === "MENU" ? value : "CLAIR";
}

/**
 * Date de clôture complète : « vendredi 2 octobre 2026 à 22 h ».
 *
 * Toujours à l'heure d'Abidjan, qui est l'heure GMT toute l'année : le texte
 * est le même pour le serveur (UTC chez Vercel), l'organisateur et le public.
 */
export function formatClosingDate(date: Date): string {
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(date);
  const day = date.getUTCDate();
  const minutes = date.getUTCMinutes();
  const time = `${date.getUTCHours()} h${minutes ? ` ${String(minutes).padStart(2, "0")}` : ""}`;
  return `${weekday} ${day === 1 ? "1er" : day} ${month} ${date.getUTCFullYear()} à ${time}`;
}

/**
 * Le vote accepte-t-il un paiement maintenant ?
 *
 * Trois conditions : l'organisateur l'a ouvert, l'heure de clôture (si elle
 * existe) n'est pas passée, et au moins un moyen de paiement est proposé — sans
 * quoi la page ouverte n'offrirait aucun moyen de voter.
 */
export function isPublicVoteOpen(settings: PublicVoteSettings, now: Date = new Date()): boolean {
  if (!settings.publicVoteOpen) return false;
  if (settings.publicVoteClosesAt && settings.publicVoteClosesAt.getTime() <= now.getTime()) {
    return false;
  }
  return enabledMethods(settings.publicVoteMethods).length > 0;
}

/**
 * Classe les candidats du plus voté au moins voté.
 *
 * Deux candidats à égalité partagent le même rang (1er, 1er, 3e) : départager
 * par l'ordre de passage donnerait une avance qu'aucun vote ne justifie. Cet
 * ordre ne sert qu'à fixer leur place à l'écran.
 */
export function rankByVotes<T extends { order: number; votes: number }>(
  candidates: readonly T[],
): (T & { rank: number })[] {
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes || a.order - b.order);
  return sorted.map((candidate) => ({
    ...candidate,
    rank: sorted.findIndex((other) => other.votes === candidate.votes) + 1,
  }));
}

/**
 * Nombre écrit à la française, groupé par milliers avec une espace : « 1 700 ».
 *
 * Écrit à la main plutôt que via `toLocaleString` : le serveur et le navigateur
 * n'ont pas toujours les mêmes données de langue, et une différence d'espace
 * entre les deux rendus casserait l'hydratation de la page.
 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** « 1 vote », « 820 votes ». */
export function votesLabel(count: number): string {
  return `${formatNumber(count)} ${count > 1 ? "votes" : "vote"}`;
}

/** Part d'un candidat dans le total, en pourcentage entier. 0 si personne n'a voté. */
export function votePercent(votes: number, total: number): number {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}

/**
 * Alphabet des références de paiement : sans 0/O ni 1/I/L, pour qu'une
 * référence dictée au téléphone ne soit jamais mal recopiée.
 */
const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Référence remise au votant, de la forme « VP-9NF24H ». */
export function makePaymentReference(randomIndex: (size: number) => number): string {
  let reference = "VP-";
  for (let i = 0; i < 6; i++) {
    reference += REFERENCE_ALPHABET[randomIndex(REFERENCE_ALPHABET.length)];
  }
  return reference;
}

/** Initiales affichées à la place d'un portrait manquant. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
