/** Formats d'affichage de l'espace. Fuseau d'Abidjan (UTC toute l'année). */

const FUSEAU = "Africa/Abidjan";

const formatDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: FUSEAU });
const formatDateHeure = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: FUSEAU });
const formatNombre = new Intl.NumberFormat("fr-FR");

export const dateLongue = (date: Date) => formatDate.format(date);
export const dateHeure = (date: Date) => formatDateHeure.format(date);
export const nombre = (n: number) => formatNombre.format(n);

/** « Bonjour » ou « Bonsoir » selon l'heure d'Abidjan. */
export function salutation(maintenant = new Date()): string {
  const heure = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: FUSEAU }).format(maintenant));
  return heure >= 18 || heure < 4 ? "Bonsoir" : "Bonjour";
}
