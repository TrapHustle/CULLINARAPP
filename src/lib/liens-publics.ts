import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * Liens publics de vote et leurs QR codes : un par type de vote. Le vote en
 * ligne garde sa page `/v/<slug>` ; les votes "QR" et en salle ont la leur,
 * `/q/<lien>`, à ouvrir sur une tablette de la salle ou sur le téléphone des
 * votants. Le vote en salle peut toujours être saisi depuis le panneau.
 */

/** Adresse du site à mettre dans les liens : celle fixée en ligne, sinon celle de la requête. */
export async function adresseBase(): Promise<string> {
  const fixe = process.env.APP_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (fixe) return fixe;
  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocole = h.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  return `${protocole}://${hote}`;
}

export function cheminVote(type: { canal: string; lien: string }, slug: string): string {
  return type.canal === "EN_LIGNE" ? `/v/${slug}` : `/q/${type.lien}`;
}

/** QR code en PNG (data URL), bleu nuit sur blanc comme la charte du panneau. */
export function imageQr(url: string, largeur = 640): Promise<string> {
  return QRCode.toDataURL(url, {
    width: largeur,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0b2a66", light: "#ffffff" },
  });
}
