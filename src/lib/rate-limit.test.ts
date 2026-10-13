import { beforeEach, describe, expect, it } from "vitest";
import {
  ATTEMPT_LIMIT,
  ATTEMPT_WINDOW_MS,
  checkAttempts,
  clearFailures,
  noteFailure,
  realClientIp,
  resetAllAttempts,
  waitMessage,
} from "./rate-limit";

/** Petit utilitaire : des en-têtes sous forme d'objet. */
const headers = (valeurs: Record<string, string>) => (nom: string) => valeurs[nom] ?? null;

describe("realClientIp", () => {
  it("croit X-Real-Ip en premier : le serveur de façade l'écrase à chaque requête", () => {
    const lire = headers({ "x-real-ip": "41.66.1.2", "x-forwarded-for": "9.9.9.9, 41.66.1.2" });
    expect(realClientIp(lire)).toBe("41.66.1.2");
  });

  it("prend le DERNIER élément de X-Forwarded-For, celui ajouté par nginx", () => {
    const lire = headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 41.66.1.2" });
    expect(realClientIp(lire)).toBe("41.66.1.2");
  });

  it("ignore une adresse inventée par le client en tête de liste", () => {
    // C'était la faille : l'attaquant écrivait ce qu'il voulait, et le premier
    // élément servait de clé. Chaque essai repartait donc d'un compteur neuf.
    const essais = ["10.0.0.1", "10.0.0.2", "10.0.0.3"].map((faux) =>
      realClientIp(headers({ "x-forwarded-for": `${faux}, 41.66.1.2` })),
    );
    expect(new Set(essais).size).toBe(1);
    expect(essais[0]).toBe("41.66.1.2");
  });

  it("tolère les espaces et les éléments vides", () => {
    expect(realClientIp(headers({ "x-forwarded-for": " 1.1.1.1 ,  , 41.66.1.2 " }))).toBe("41.66.1.2");
  });

  it("ignore un X-Real-Ip vide et retombe sur X-Forwarded-For", () => {
    expect(realClientIp(headers({ "x-real-ip": "   ", "x-forwarded-for": "41.66.1.2" }))).toBe("41.66.1.2");
  });

  it("renvoie « inconnu » quand aucun en-tête n'est exploitable", () => {
    expect(realClientIp(headers({}))).toBe("inconnu");
    expect(realClientIp(headers({ "x-forwarded-for": "  ,  " }))).toBe("inconnu");
  });
});

describe("compteur d'essais", () => {
  beforeEach(() => resetAllAttempts());

  it("laisse passer tant que la limite n'est pas atteinte", () => {
    for (let i = 0; i < ATTEMPT_LIMIT - 1; i += 1) noteFailure("orga", "41.66.1.2");
    expect(checkAttempts("orga", "41.66.1.2")).toEqual({ blocked: false });
  });

  it("bloque une fois la limite atteinte", () => {
    for (let i = 0; i < ATTEMPT_LIMIT; i += 1) noteFailure("orga", "41.66.1.2");
    const verdict = checkAttempts("orga", "41.66.1.2");
    expect(verdict.blocked).toBe(true);
    if (verdict.blocked) expect(verdict.minutes).toBeGreaterThan(0);
  });

  it("sépare les deux espaces : bloquer l'organisateur ne bloque pas l'administration", () => {
    for (let i = 0; i < ATTEMPT_LIMIT; i += 1) noteFailure("orga", "41.66.1.2");
    expect(checkAttempts("admin", "41.66.1.2")).toEqual({ blocked: false });
  });

  it("sépare les adresses", () => {
    for (let i = 0; i < ATTEMPT_LIMIT; i += 1) noteFailure("orga", "41.66.1.2");
    expect(checkAttempts("orga", "41.66.9.9")).toEqual({ blocked: false });
  });

  it("rouvre l'accès une fois la fenêtre écoulée", () => {
    const debut = Date.now();
    for (let i = 0; i < ATTEMPT_LIMIT; i += 1) noteFailure("orga", "41.66.1.2", debut);
    expect(checkAttempts("orga", "41.66.1.2", debut).blocked).toBe(true);
    expect(checkAttempts("orga", "41.66.1.2", debut + ATTEMPT_WINDOW_MS)).toEqual({ blocked: false });
  });

  it("une connexion réussie efface l'ardoise", () => {
    for (let i = 0; i < ATTEMPT_LIMIT; i += 1) noteFailure("orga", "41.66.1.2");
    clearFailures("orga", "41.66.1.2");
    expect(checkAttempts("orga", "41.66.1.2")).toEqual({ blocked: false });
  });
});

describe("waitMessage", () => {
  it("accorde le pluriel", () => {
    expect(waitMessage(1)).toContain("1 minute.");
    expect(waitMessage(7)).toContain("7 minutes.");
  });
});
