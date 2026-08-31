import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface AdminSession {
  loggedIn?: boolean;
  username?: string;
}

/**
 * Options de session, calculées **à la demande**.
 *
 * On ne lit ni ne valide `SESSION_SECRET` à l'import : Next.js charge ce module
 * au build (« collect configuration »), et lever une erreur parce que le secret
 * n'est pas encore présent ferait échouer toute la construction sur Vercel. Le
 * secret n'est requis qu'à l'exécution, où l'hébergeur le fournit.
 *
 * Le cookie n'est marqué `secure` qu'en HTTPS. En hébergement en ligne (Vercel,
 * Railway…) c'est le cas. Si le serveur est relancé en réseau local sur
 * `http://`, un cookie `secure` ne serait jamais transmis : positionner alors
 * `ALLOW_INSECURE_COOKIE=true`.
 */
function buildSessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET est absent ou fait moins de 32 caractères. Renseignez-le dans le fichier .env.",
    );
  }

  const secureCookie =
    process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIE !== "true";

  return {
    password: secret,
    cookieName: "concours_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 60 * 60 * 12, // 12 h, la durée d'un événement
    },
  };
}

export async function getSession() {
  return getIronSession<AdminSession>(await cookies(), buildSessionOptions());
}

/** Vrai si l'organisateur est authentifié. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.loggedIn === true;
}
