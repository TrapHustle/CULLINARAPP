import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface AdminSession {
  loggedIn?: boolean;
  username?: string;
}

const secret = process.env.SESSION_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    "SESSION_SECRET est absent ou fait moins de 32 caractères. Renseignez-le dans le fichier .env.",
  );
}

/**
 * Le cookie n'est marqué `secure` que si le serveur est servi en HTTPS.
 *
 * En hébergement en ligne (Vercel, Railway…), c'est le cas et il faut l'activer.
 * Si le serveur est relancé en réseau local sur `http://`, un cookie `secure`
 * ne serait jamais transmis et la connexion deviendrait impossible : positionner
 * alors `ALLOW_INSECURE_COOKIE=true`.
 */
const secureCookie =
  process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIE !== "true";

export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: "concours_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    maxAge: 60 * 60 * 12, // 12 h, la durée d'un événement
  },
};

export async function getSession() {
  return getIronSession<AdminSession>(await cookies(), sessionOptions);
}

/** Vrai si l'organisateur est authentifié. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.loggedIn === true;
}
