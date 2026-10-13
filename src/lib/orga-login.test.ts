import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reproduit l'attaque que la correction doit arrêter : essayer des mots de
 * passe en changeant l'en-tête `X-Forwarded-For` à chaque coup, pour repartir
 * d'un compteur neuf.
 *
 * Les en-têtes et la session sont simulés ; tout le reste est le vrai code de
 * connexion.
 */

let entetes: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (nom: string) => entetes[nom] ?? null }),
}));

vi.mock("./session", () => ({
  getSession: async () => ({ orga: false, save: async () => {} }),
}));

// La connexion n'interroge pas la base, mais le module l'importe.
vi.mock("./prisma", () => ({ prisma: {} }));
vi.mock("./public-vote", () => ({ onlineVotesByCandidate: async () => new Map() }));
vi.mock("./withdrawal-actions", () => ({ currentBalance: async () => ({}) }));

const { orgaLoginAction } = await import("./orga-actions");
const { ATTEMPT_LIMIT, resetAllAttempts } = await import("./rate-limit");

/** Une requête venue de 41.66.1.2, avec l'en-tête que nginx ajoute à la fin. */
function depuis(ipReelle: string, inventee?: string) {
  entetes = {
    "x-forwarded-for": inventee ? `${inventee}, ${ipReelle}` : ipReelle,
  };
}

const MAUVAIS = { username: "organisateur", password: "pas-le-bon" };

describe("connexion organisateur : résistance au bourrage de mots de passe", () => {
  beforeEach(() => {
    resetAllAttempts();
    process.env.ORGA_USERNAME = "organisateur";
    process.env.ORGA_PASSWORD = "le-vrai-mot-de-passe";
  });

  it("bloque après la limite d'essais manqués depuis la même adresse", async () => {
    for (let essai = 1; essai <= ATTEMPT_LIMIT; essai += 1) {
      depuis("41.66.1.2");
      const resultat = await orgaLoginAction(MAUVAIS);
      expect(resultat.ok).toBe(false);
      if (!resultat.ok) expect(resultat.error).toContain("incorrect");
    }

    depuis("41.66.1.2");
    const suivant = await orgaLoginAction(MAUVAIS);
    expect(suivant.ok).toBe(false);
    if (!suivant.ok) expect(suivant.error).toContain("Trop d'essais");
  });

  it("bloque même si l'attaquant invente une adresse différente à chaque essai", async () => {
    // C'est exactement ce que la version précédente laissait passer : elle
    // lisait le PREMIER élément, celui que l'attaquant écrit lui-même.
    for (let essai = 1; essai <= ATTEMPT_LIMIT; essai += 1) {
      depuis("41.66.1.2", `10.0.0.${essai}`);
      await orgaLoginAction(MAUVAIS);
    }

    depuis("41.66.1.2", "10.0.0.99");
    const suivant = await orgaLoginAction(MAUVAIS);
    expect(suivant.ok).toBe(false);
    if (!suivant.ok) expect(suivant.error).toContain("Trop d'essais");
  });

  it("ne pénalise pas un visiteur légitime venu d'une autre adresse", async () => {
    for (let essai = 1; essai <= ATTEMPT_LIMIT; essai += 1) {
      depuis("41.66.1.2");
      await orgaLoginAction(MAUVAIS);
    }

    depuis("41.66.7.7");
    const autre = await orgaLoginAction(MAUVAIS);
    expect(autre.ok).toBe(false);
    if (!autre.ok) expect(autre.error).toContain("incorrect");
  });

  it("laisse entrer avec le bon mot de passe et efface l'ardoise", async () => {
    for (let essai = 1; essai < ATTEMPT_LIMIT; essai += 1) {
      depuis("41.66.1.2");
      await orgaLoginAction(MAUVAIS);
    }

    depuis("41.66.1.2");
    const bon = await orgaLoginAction({
      username: "organisateur",
      password: "le-vrai-mot-de-passe",
    });
    expect(bon.ok).toBe(true);

    // L'ardoise est effacée : on peut encore se tromper autant de fois ensuite.
    for (let essai = 1; essai <= ATTEMPT_LIMIT; essai += 1) {
      depuis("41.66.1.2");
      const resultat = await orgaLoginAction(MAUVAIS);
      if (!resultat.ok) expect(resultat.error).toContain("incorrect");
    }
  });

  it("préfère X-Real-Ip, que le serveur de façade écrase", async () => {
    for (let essai = 1; essai <= ATTEMPT_LIMIT; essai += 1) {
      entetes = { "x-real-ip": "41.66.1.2", "x-forwarded-for": `10.0.0.${essai}` };
      await orgaLoginAction(MAUVAIS);
    }

    entetes = { "x-real-ip": "41.66.1.2", "x-forwarded-for": "10.0.0.99" };
    const suivant = await orgaLoginAction(MAUVAIS);
    expect(suivant.ok).toBe(false);
    if (!suivant.ok) expect(suivant.error).toContain("Trop d'essais");
  });
});
