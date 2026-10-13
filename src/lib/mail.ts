import nodemailer from "nodemailer";

/**
 * Envoi de mail, pour les alertes de l'application.
 *
 * Ce qui dicte la forme de ce module :
 *  - le compte SMTP n'existe pas sur tous les environnements (poste de
 *    développement, réseau local sans internet) : l'absence de configuration
 *    n'est pas une erreur, c'est un envoi qui n'a pas lieu ;
 *  - un mail qui ne part pas ne doit jamais faire échouer le geste de
 *    l'utilisateur. Une demande de retrait enregistrée vaut mieux qu'une
 *    demande perdue parce que le serveur de mail était injoignable. Toutes les
 *    fonctions renvoient donc un résultat, et ne lèvent jamais ;
 *  - un serveur SMTP lent bloquerait la page : les délais sont bornés.
 */

export type MailResult = { ok: true } | { ok: false; error: string };

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

/** Au-delà, on abandonne : la page de l'organisateur ne doit pas attendre. */
const TIMEOUT_MS = 12_000;

/**
 * Configuration lue **à la demande**, jamais à l'import : Next.js charge les
 * modules de route à la construction, où les variables d'environnement ne sont
 * pas encore fournies.
 */
export function mailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD ?? "";
  if (!host || !user || !password) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port: Number.isInteger(port) && port > 0 ? port : 587,
    // 465 est le port du TLS implicite ; 587 passe par STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user,
    password,
    // Beaucoup de serveurs refusent une adresse d'expéditeur qui n'est pas
    // celle du compte authentifié : c'est le repli le plus sûr.
    from: process.env.MAIL_FROM?.trim() || user,
  };
}

/** Destinataire des alertes de retrait. */
export function withdrawalMailTo(): string | null {
  return process.env.WITHDRAWAL_MAIL_TO?.trim() || null;
}

/** Copies (CC) des alertes de retrait, séparées par des virgules. */
export function withdrawalMailCc(): string | null {
  return process.env.WITHDRAWAL_MAIL_CC?.trim() || null;
}

export async function sendMail(message: {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<MailResult> {
  const config = mailConfig();
  if (!config) {
    return { ok: false, error: "Aucun compte d'envoi configuré (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)." };
  }

  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });

    await transport.sendMail({
      from: config.from,
      to: message.to,
      cc: message.cc || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    transport.close();
    return { ok: true };
  } catch (error) {
    // Le détail reste côté serveur : l'organisateur n'a pas à lire une erreur SMTP.
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[mail] envoi impossible :", reason);
    return { ok: false, error: reason };
  }
}
