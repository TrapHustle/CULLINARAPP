/**
 * Limitation des tentatives de connexion.
 *
 * Le problème que ce module corrige : l'adresse du visiteur était lue en tête
 * de `X-Forwarded-For`, un en-tête que le client écrit lui-même. Il suffisait
 * d'en changer la valeur à chaque essai pour obtenir un compteur neuf et tenter
 * autant de mots de passe qu'on voulait. Tant que le serveur ne vivait que sur
 * le réseau de la salle, cela n'avait guère de portée ; en ligne, c'est la
 * seule barrière devant le mot de passe.
 */

/**
 * Au plus 15 essais manqués **par adresse et par identifiant** sur 10 minutes.
 *
 * Compter par adresse seule bloquait tout un bureau : derrière un même Wi-Fi,
 * tous les ordinateurs sortent sur internet avec la même adresse, et les
 * erreurs d'une personne fermaient la porte à ses collègues.
 */
export const ATTEMPT_LIMIT = 15;
/**
 * Plafond par adresse, tous identifiants confondus : sans lui, changer
 * d'identifiant à chaque essai donnerait un compteur neuf à chaque fois.
 */
export const ADDRESS_LIMIT = 100;
export const ATTEMPT_WINDOW_MS = 10 * 60_000;

/**
 * Adresse du visiteur, telle que **le serveur de façade** la rapporte.
 *
 * `X-Real-Ip` d'abord : nginx comme Vercel l'écrasent à chaque requête, ce que
 * le client envoie sous ce nom est donc jeté. Sinon, le **dernier** élément de
 * `X-Forwarded-For` : nginx ajoute à la fin l'adresse de la connexion qu'il
 * voit réellement, et personne ne peut retirer cette valeur-là. Lire le premier
 * élément, comme avant, revenait à croire le client sur parole.
 */
export function realClientIp(header: (name: string) => string | null | undefined): string {
  const direct = header("x-real-ip")?.trim();
  if (direct) return direct;

  const forwarded = header("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  // Aucun en-tête exploitable : tout le monde partage alors le même compteur.
  // C'est volontairement sévère — mieux vaut ralentir tout le monde que de
  // laisser le mot de passe sans protection.
  return "inconnu";
}

/**
 * Essais manqués, gardés en mémoire du processus. Un redémarrage les oublie :
 * c'est assez pour décourager une attaque au clavier, et ça évite d'écrire en
 * base à chaque tentative.
 */
const failures = new Map<string, { count: number; since: number }>();

/** Empêche la mémoire de croître indéfiniment sous une attaque distribuée. */
const MAX_TRACKED = 10_000;

function bucket(scope: string, key: string): string {
  return `${scope}:${key}`;
}

export type AttemptCheck = { blocked: false } | { blocked: true; minutes: number };

/** Dit si cette adresse doit patienter, et combien de temps. */
export function checkAttempts(
  scope: string,
  key: string,
  now = Date.now(),
  limit = ATTEMPT_LIMIT,
): AttemptCheck {
  const name = bucket(scope, key);
  const seen = failures.get(name);
  if (!seen) return { blocked: false };

  if (now - seen.since >= ATTEMPT_WINDOW_MS) {
    failures.delete(name);
    return { blocked: false };
  }
  if (seen.count < limit) return { blocked: false };

  const minutes = Math.ceil((ATTEMPT_WINDOW_MS - (now - seen.since)) / 60_000);
  return { blocked: true, minutes };
}

export function noteFailure(
  scope: string,
  key: string,
  now = Date.now(),
  limit = ATTEMPT_LIMIT,
): void {
  // Purge grossière : au-delà du plafond, on repart de zéro plutôt que de
  // laisser une attaque distribuée remplir la mémoire du serveur.
  if (failures.size >= MAX_TRACKED) failures.clear();

  const name = bucket(scope, key);
  const current = failures.get(name);
  const count = (current?.count ?? 0) + 1;
  failures.set(name, { count, since: current?.since ?? now });

  // Trace dans les journaux pm2 : si l'adresse est « inconnu » ou celle du
  // serveur de façade, tous les visiteurs partagent ce compteur et un seul
  // blocage ferme la porte à tout le monde.
  if (count === limit) {
    console.warn(`[connexion] ${scope} : accès bloqué ${ATTEMPT_WINDOW_MS / 60_000} min pour ${key}`);
  }
}

/* ------------------------------------------------------------------ */
/* Connexion : adresse + identifiant                                    */
/* ------------------------------------------------------------------ */

/** L'identifiant tapé, tel qu'il sert de clé : sans casse ni espaces autour. */
function loginKey(address: string, username: string): string {
  return `${address}|${username.trim().toLowerCase().slice(0, 200)}`;
}

/** Bloqué si cet identifiant, ou cette adresse dans son ensemble, a trop échoué. */
export function checkLogin(
  scope: string,
  address: string,
  username: string,
  now = Date.now(),
): AttemptCheck {
  const forAddress = checkAttempts(`${scope}-adresse`, address, now, ADDRESS_LIMIT);
  if (forAddress.blocked) return forAddress;
  return checkAttempts(scope, loginKey(address, username), now);
}

export function noteLoginFailure(scope: string, address: string, username: string, now = Date.now()): void {
  noteFailure(scope, loginKey(address, username), now);
  noteFailure(`${scope}-adresse`, address, now, ADDRESS_LIMIT);
}

/**
 * Une connexion réussie efface l'ardoise de **cet** identifiant seulement : le
 * plafond par adresse continue de compter les essais sur d'autres identifiants.
 */
export function clearLoginFailures(scope: string, address: string, username: string): void {
  clearFailures(scope, loginKey(address, username));
}

export function clearFailures(scope: string, key: string): void {
  failures.delete(bucket(scope, key));
}

/** Réservé aux tests : vide les compteurs entre deux cas. */
export function resetAllAttempts(): void {
  failures.clear();
}

/** Message affiché à qui a trop essayé. */
export function waitMessage(minutes: number): string {
  return `Trop d'essais. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}
