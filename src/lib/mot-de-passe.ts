import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hachage des mots de passe des comptes, avec `scrypt` (inclus dans Node : pas
 * de dépendance à installer sur le VPS).
 *
 * Le format stocké porte ses propres paramètres — `scrypt$N$r$p$sel$empreinte`
 * — pour qu'un durcissement futur reste compatible avec les comptes existants.
 */

const N = 16384;
const R = 8;
const P = 1;
const LONGUEUR = 64;

function deriver(motDePasse: string, sel: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(motDePasse.normalize("NFKC"), sel, LONGUEUR, options, (erreur, cle) =>
      erreur ? reject(erreur) : resolve(cle),
    );
  });
}

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(16);
  const cle = await deriver(motDePasse, sel, { N, r: R, p: P });
  return ["scrypt", N, R, P, sel.toString("base64"), cle.toString("base64")].join("$");
}

export async function verifierMotDePasse(motDePasse: string, stocke: string): Promise<boolean> {
  const [algo, n, r, p, sel, empreinte] = stocke.split("$");
  if (algo !== "scrypt" || !sel || !empreinte) return false;

  const attendu = Buffer.from(empreinte, "base64");
  const cle = await deriver(motDePasse, Buffer.from(sel, "base64"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return cle.length === attendu.length && timingSafeEqual(cle, attendu);
}
