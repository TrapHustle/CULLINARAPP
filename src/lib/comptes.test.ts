import { describe, expect, it } from "vitest";
import { connexionSchema, inscriptionSchema, MOT_DE_PASSE_MIN } from "./comptes-core";
import { hacherMotDePasse, verifierMotDePasse } from "./mot-de-passe";

describe("mots de passe", () => {
  it("vérifie le bon mot de passe et refuse un autre", async () => {
    const empreinte = await hacherMotDePasse("une phrase de passe");
    expect(empreinte.startsWith("scrypt$")).toBe(true);
    expect(await verifierMotDePasse("une phrase de passe", empreinte)).toBe(true);
    expect(await verifierMotDePasse("une phrase de pass", empreinte)).toBe(false);
  });

  it("ne stocke jamais le mot de passe et sale chaque empreinte", async () => {
    const a = await hacherMotDePasse("une phrase de passe");
    const b = await hacherMotDePasse("une phrase de passe");
    expect(a).not.toContain("une phrase");
    expect(a).not.toBe(b);
  });

  it("refuse une empreinte mal formée au lieu de planter", async () => {
    expect(await verifierMotDePasse("x", "n'importe quoi")).toBe(false);
  });
});

describe("saisie d'inscription", () => {
  const valide = {
    organisation: "  Kabowd Production ",
    email: " Contact@Kabowd.CI ",
    motDePasse: "x".repeat(MOT_DE_PASSE_MIN),
    confirmation: "x".repeat(MOT_DE_PASSE_MIN),
  };

  it("accepte une saisie correcte et normalise l'adresse", () => {
    const r = inscriptionSchema.parse(valide);
    expect(r.email).toBe("contact@kabowd.ci");
    expect(r.organisation).toBe("Kabowd Production");
  });

  it("refuse un mot de passe trop court", () => {
    const r = inscriptionSchema.safeParse({ ...valide, motDePasse: "court", confirmation: "court" });
    expect(r.success).toBe(false);
  });

  it("refuse deux mots de passe différents", () => {
    const r = inscriptionSchema.safeParse({ ...valide, confirmation: "y".repeat(MOT_DE_PASSE_MIN) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirmation"]);
  });

  it("refuse une adresse invalide", () => {
    expect(inscriptionSchema.safeParse({ ...valide, email: "pas-une-adresse" }).success).toBe(false);
  });
});

describe("saisie de connexion", () => {
  it("normalise l'adresse comme à l'inscription", () => {
    expect(connexionSchema.parse({ email: "A@B.CI", motDePasse: "x" }).email).toBe("a@b.ci");
  });
});
