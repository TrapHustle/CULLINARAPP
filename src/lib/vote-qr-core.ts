import { DEFAULT_PHONE_COUNTRY, normalizePhone, parsePhone } from "./public-vote-core";

/**
 * Vote par QR code : règles sans base ni réseau.
 *
 * Un type de vote "QR" a un lien `/q/<lien>` (et son QR code). On y vote une
 * seule fois par numéro, pour un candidat, sans critère. En accès "RESTREINT",
 * seuls les numéros de la liste autorisée peuvent voter.
 */

/** Plafond d'une liste importée ou collée d'un coup. */
export const NUMEROS_MAX_PAR_AJOUT = 5000;

/**
 * Identifiant d'un votant par QR, ou `null` si le numéro est invalide.
 *
 * Ouvert à tous : toujours lu comme ivoirien, comme la voix gratuite — un
 * même numéro préfixé d'un faux indicatif donnerait sinon un nouvel
 * identifiant à chaque essai, donc une nouvelle voix. Restreint : le numéro
 * doit figurer dans la liste, un faux indicatif ne mène nulle part ; on
 * accepte donc aussi les numéros étrangers, normalisés comme à l'import.
 */
export function identifiantQr(telephone: string, acces: string): string | null {
  if (acces === "RESTREINT") return normalizePhone(telephone);
  const analyse = parsePhone(telephone, DEFAULT_PHONE_COUNTRY);
  return analyse.ok ? analyse.phone : null;
}

export interface LigneNumero {
  telephone: string;
  nom: string | null;
}

export interface ListeLue {
  numeros: LigneNumero[];
  /** Lignes illisibles, avec leur numéro de ligne (à partir de 1). */
  invalides: { ligne: number; texte: string }[];
  /** Numéros présents plusieurs fois dans la saisie : gardés une fois. */
  doublons: number;
}

const ENTETE_TELEPHONE = /t[ée]l|phone|num[ée]ro|mobile|gsm|contact/i;
const ENTETE_NOM_EXACT = /^\s*(nom|name|nom complet|invit[ée]e?s?)\s*$/i;
const ENTETE_NOM = /nom|name|invit/i;

/**
 * Lit des lignes « numéro ; nom » (saisie libre, CSV ou tableur déjà converti
 * en lignes de cellules). Une première ligne d'en-têtes est reconnue et sert à
 * trouver les colonnes ; sinon, le numéro est la première colonne qui en a
 * l'air et le nom, la suivante.
 */
export function lireListe(lignes: string[][]): ListeLue {
  const resultat: ListeLue = { numeros: [], invalides: [], doublons: 0 };
  const vus = new Set<string>();

  let colTel = -1;
  let colNom = -1;
  let debut = 0;
  const premiere = lignes.find((l) => l.some((c) => c.trim() !== ""));
  if (premiere && !premiere.some((c) => normalizePhone(c))) {
    colTel = premiere.findIndex((c) => ENTETE_TELEPHONE.test(c));
    // « Nom » tout court d'abord : une colonne « Prénom » ne doit pas passer devant.
    colNom = premiere.findIndex((c, i) => i !== colTel && ENTETE_NOM_EXACT.test(c));
    if (colNom < 0) colNom = premiere.findIndex((c, i) => i !== colTel && ENTETE_NOM.test(c));
    if (colTel >= 0) debut = lignes.indexOf(premiere) + 1;
  }

  for (let i = debut; i < lignes.length; i++) {
    const cellules = lignes[i].map((c) => c.trim());
    if (cellules.every((c) => c === "")) continue;

    let tel: string | null = null;
    let indexTel = colTel;
    if (colTel >= 0) {
      tel = normalizePhone(cellules[colTel] ?? "");
    } else {
      indexTel = cellules.findIndex((c) => normalizePhone(c) !== null);
      tel = indexTel >= 0 ? normalizePhone(cellules[indexTel]) : null;
    }
    if (!tel) {
      resultat.invalides.push({ ligne: i + 1, texte: cellules.filter(Boolean).join(" ; ").slice(0, 60) });
      continue;
    }
    if (vus.has(tel)) {
      resultat.doublons++;
      continue;
    }
    vus.add(tel);

    const brut = colNom >= 0 ? cellules[colNom] : cellules.find((c, j) => j !== indexTel && c !== "" && !normalizePhone(c));
    const nom = brut ? brut.slice(0, 80) : null;
    resultat.numeros.push({ telephone: tel, nom });
  }
  return resultat;
}

/** Saisie libre du panneau : une ligne par numéro, nom facultatif après « ; », « , » ou une tabulation. */
export function lireSaisie(texte: string): ListeLue {
  return lireListe(texte.split(/\r?\n/).map((l) => l.split(/[;,\t]/)));
}

/** Une ligne CSV en cellules : guillemets, « "" » échappé et séparateur entre guillemets respectés. */
function cellulesCsv(ligne: string, separateur: string): string[] {
  const cellules: string[] = [];
  let courante = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entreGuillemets) {
      if (c === '"' && ligne[i + 1] === '"') {
        courante += '"';
        i++;
      } else if (c === '"') {
        entreGuillemets = false;
      } else {
        courante += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === separateur) {
      cellules.push(courante);
      courante = "";
    } else {
      courante += c;
    }
  }
  cellules.push(courante);
  return cellules;
}

/** Contenu d'un fichier CSV : séparateur « ; » (Excel français) ou « , ». */
export function lireCsv(texte: string): ListeLue {
  const lignes = texte.replace(new RegExp(`^${String.fromCharCode(0xfeff)}`), "").split(/\r?\n/);
  const separateur = lignes.some((l) => l.includes(";")) ? ";" : ",";
  return lireListe(lignes.map((l) => cellulesCsv(l, separateur)));
}

/** Un numéro tel qu'on l'affiche : +225 07 01 02 03 04. */
export function telephoneLisible(telephone: string): string {
  if (/^0\d{9}$/.test(telephone)) return `+225 ${telephone.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  return telephone;
}
