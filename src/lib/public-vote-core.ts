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

/* ------------------------------------------------------------------ */
/* Recettes et part du prestataire                                      */
/* ------------------------------------------------------------------ */

/** Part des recettes revenant à Inovyx Tech. */
export const INOVYX_SHARE = 0.1;

/**
 * Partage d'une recette entre Inovyx Tech et l'organisateur. La part de
 * l'organisateur est obtenue par soustraction, jamais par un second arrondi :
 * les deux montants retombent ainsi toujours exactement sur le total.
 */
export function splitRevenue(total: number): { inovyx: number; organiser: number } {
  const inovyx = Math.round(total * INOVYX_SHARE);
  return { inovyx, organiser: total - inovyx };
}

/**
 * Numéro masqué pour l'espace organisateur : les deux premiers et les deux
 * derniers chiffres suffisent à reconnaître une ligne qu'on connaît, sans
 * exposer le numéro entier sur un panneau atteignable depuis la page publique.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const international = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return international ? `+${digits}` : digits;
  const hidden = "\u2022".repeat(digits.length - 4);
  return `${international ? "+" : ""}${digits.slice(0, 2)} ${hidden} ${digits.slice(-2)}`;
}

/* ------------------------------------------------------------------ */
/* Numéro de téléphone                                                  */
/* ------------------------------------------------------------------ */

export interface PhoneCountry {
  code: string;
  name: string;
  flag: string;
  /** Indicatif, sans le `+`. */
  dial: string;
  /** Longueur du numéro national, ou `null` pour une saisie libre. */
  len: number | null;
  /** Exemple montré dans le champ. */
  hint: string;
  /**
   * `true` quand le zéro de tête est un préfixe d'acheminement à retirer du
   * numéro international (France, Belgique), `false` quand il fait partie du
   * numéro (Côte d'Ivoire, Bénin).
   */
  trunk: boolean;
  /** `true` si la passerelle y joint Wave, Orange Money et MTN MoMo. */
  mobile: boolean;
}

/**
 * Pays acceptés pour le numéro qui paie. La Côte d'Ivoire vient en premier :
 * c'est le choix par défaut de la page de vote.
 */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dial: "225", len: 10, hint: "07 01 02 03 04", trunk: false, mobile: true },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", dial: "221", len: 9, hint: "77 123 45 67", trunk: false, mobile: true },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", dial: "226", len: 8, hint: "70 12 34 56", trunk: false, mobile: true },
  { code: "ML", name: "Mali", flag: "🇲🇱", dial: "223", len: 8, hint: "70 12 34 56", trunk: false, mobile: true },
  { code: "BJ", name: "Bénin", flag: "🇧🇯", dial: "229", len: 10, hint: "01 97 12 34 56", trunk: false, mobile: true },
  { code: "TG", name: "Togo", flag: "🇹🇬", dial: "228", len: 8, hint: "90 12 34 56", trunk: false, mobile: true },
  { code: "GN", name: "Guinée", flag: "🇬🇳", dial: "224", len: 9, hint: "62 12 34 56 7", trunk: false, mobile: true },
  { code: "CM", name: "Cameroun", flag: "🇨🇲", dial: "237", len: 9, hint: "6 12 34 56 78", trunk: false, mobile: true },
  { code: "FR", name: "France", flag: "🇫🇷", dial: "33", len: 9, hint: "6 12 34 56 78", trunk: true, mobile: false },
  { code: "BE", name: "Belgique", flag: "🇧🇪", dial: "32", len: 9, hint: "470 12 34 56", trunk: true, mobile: false },
  { code: "US", name: "États-Unis / Canada", flag: "🇺🇸", dial: "1", len: 10, hint: "555 123 4567", trunk: false, mobile: false },
  { code: "XX", name: "Autre pays", flag: "🌍", dial: "", len: null, hint: "indicatif puis numéro", trunk: false, mobile: false },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export function phoneCountry(code: string | undefined): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.code === code) ?? DEFAULT_PHONE_COUNTRY;
}

/** Chiffres saisis, débarrassés de l'indicatif du pays choisi. */
function nationalDigits(raw: string, country: PhoneCountry): string {
  let digits = raw.replace(/\D/g, "");
  if (!country.dial) return digits;
  if (digits.startsWith(`00${country.dial}`)) digits = digits.slice(2 + country.dial.length);
  else if (digits.startsWith(country.dial) && country.len !== null && digits.length > country.len) {
    digits = digits.slice(country.dial.length);
  }
  if (country.len === null) return digits;
  // Zéro d'acheminement : présent en national, absent à l'international.
  if (country.trunk && digits.length === country.len + 1 && digits.startsWith("0")) return digits.slice(1);
  // Ancienne écriture ivoirienne sans le zéro : +225 7 01 02 03 04.
  if (!country.trunk && digits.length === country.len - 1) return `0${digits}`;
  return digits;
}

export type ParsedPhone =
  | { ok: true; phone: string; pretty: string }
  | { ok: false; error: string };

/**
 * Numéro saisi pour un pays donné, ramené à la forme qui part en base et chez
 * la passerelle : les 10 chiffres pour la Côte d'Ivoire — ce que le
 * prestataire attend depuis toujours — et `+indicatif` suivi du numéro pour
 * les autres pays. L'erreur dit quoi corriger plutôt que « numéro invalide ».
 */
export function parsePhone(raw: string, country: PhoneCountry): ParsedPhone {
  const digits = nationalDigits(raw, country);
  if (!digits) return { ok: false, error: "Entrez le numéro qui paie." };

  if (country.len === null) {
    if (digits.length < 8) {
      return { ok: false, error: "Numéro trop court. Entrez l'indicatif du pays puis le numéro." };
    }
    if (digits.length > 15) {
      return { ok: false, error: "Numéro trop long : 15 chiffres au maximum, indicatif compris." };
    }
    return { ok: true, phone: `+${digits}`, pretty: prettyPhone(`+${digits}`, "") };
  }

  if (digits.length !== country.len) {
    const missing = country.len - digits.length;
    const word = Math.abs(missing) > 1 ? "chiffres" : "chiffre";
    return {
      ok: false,
      error:
        missing > 0
          ? `Il manque ${missing} ${word} : ${country.name}, ${country.len} chiffres.`
          : `Il y a ${-missing} ${word} de trop : ${country.name}, ${country.len} chiffres.`,
    };
  }

  // La Côte d'Ivoire garde ses 10 chiffres nus : c'est le format déjà stocké
  // et déjà envoyé à la passerelle, que ce changement ne doit pas déplacer.
  const phone = country.code === "CI" ? digits : `+${country.dial}${digits}`;
  return { ok: true, phone, pretty: prettyPhone(`+${country.dial}${digits}`, country.dial) };
}

/** Numéro international découpé pour la relecture : +225 07 01 02 03 04. */
export function prettyPhone(e164: string, dial: string): string {
  const rest = dial && e164.startsWith(`+${dial}`) ? e164.slice(dial.length + 1) : e164.slice(1);
  const shown = rest.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return dial ? `+${dial} ${shown}` : `+${shown}`;
}

/**
 * Numéro écrit à l'internationale (`+33…`, `0033…`) : le pays s'en déduit et
 * l'indicatif quitte le champ. `null` quand rien ne correspond, pour laisser
 * le pays déjà choisi en place.
 */
export function detectPhoneCountry(raw: string): { country: PhoneCountry; rest: string } | null {
  const text = raw.trim();
  let digits = text.replace(/\D/g, "");
  if (!text.startsWith("+") && !digits.startsWith("00")) return null;
  if (!text.startsWith("+") && digits.startsWith("00")) digits = digits.slice(2);

  let best: PhoneCountry | null = null;
  for (const country of PHONE_COUNTRIES) {
    if (!country.dial || !digits.startsWith(country.dial)) continue;
    if (!best || country.dial.length > best.dial.length) best = country;
  }
  if (!best || digits.length <= best.dial.length) return null;
  return { country: best, rest: digits.slice(best.dial.length) };
}

/**
 * Numéro reçu par le serveur, quelle que soit son écriture, ramené à la forme
 * stockée. Le pays se déduit de l'indicatif ; sans indicatif, c'est la Côte
 * d'Ivoire. `null` si le compte de chiffres ne correspond à rien : on refuse
 * plutôt que de deviner, un chiffre de trop désignerait une autre ligne.
 */
export function normalizePhone(raw: string): string | null {
  const detected = detectPhoneCountry(raw);
  const country = detected ? detected.country : DEFAULT_PHONE_COUNTRY;
  const parsed = parsePhone(detected ? detected.rest : raw, country);
  return parsed.ok ? parsed.phone : null;
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
