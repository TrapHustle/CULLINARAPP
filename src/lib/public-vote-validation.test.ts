import { describe, expect, it } from "vitest";
import { publicVotePaymentSchema, publicVoteSettingsSchema } from "./validation";

describe("paiement demandé par la page publique", () => {
  const valid = { candidateId: "c1", votes: 10, method: "ORANGE_MONEY", phone: "07 01 02 03 04" };

  it("accepte un lot de votes ordinaire", () => {
    expect(publicVotePaymentSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse zéro vote, plus de 100 votes et les votes non entiers", () => {
    for (const votes of [0, 101, 2.5, -3]) {
      expect(publicVotePaymentSchema.safeParse({ ...valid, votes }).success).toBe(false);
    }
  });

  it("exige le numéro qui paie", () => {
    expect(publicVotePaymentSchema.safeParse({ ...valid, phone: "" }).success).toBe(false);
    expect(publicVotePaymentSchema.safeParse({ ...valid, phone: undefined }).success).toBe(false);
  });

  it("accepte MTN MoMo", () => {
    expect(publicVotePaymentSchema.safeParse({ ...valid, method: "MTN" }).success).toBe(true);
  });

  it("refuse un moyen de paiement inconnu et un candidat absent", () => {
    expect(publicVotePaymentSchema.safeParse({ ...valid, method: "PAYPAL" }).success).toBe(false);
    expect(publicVotePaymentSchema.safeParse({ ...valid, candidateId: "" }).success).toBe(false);
  });

  it("n'accepte aucun montant venu de la page : seul le nombre de votes compte", () => {
    const parsed = publicVotePaymentSchema.parse({ ...valid, amount: 1, unitPrice: 1 });
    expect(parsed).toEqual(valid);
  });
});

describe("réglages du vote public", () => {
  const form = {
    publicVoteOpen: true,
    eventName: "Talent Traiteur 2026",
    publicVoteTagline: "Kabowd Production · 7ᵉ édition",
    publicVoteSubtitle: "",
    publicVotePrice: "200",
    publicVoteClosesAt: "2026-10-01T22:00",
    publicVoteShowCounts: true,
    publicVoteStyle: "MENU",
    publicVoteMethods: ["WAVE", "CARD"],
  };

  it("lit l'heure de clôture à l'heure d'Abidjan (GMT), quel que soit le fuseau du serveur", () => {
    const parsed = publicVoteSettingsSchema.parse(form);
    expect(parsed.publicVoteClosesAt?.toISOString()).toBe("2026-10-01T22:00:00.000Z");
  });

  it("accepte l'absence d'heure de clôture", () => {
    expect(publicVoteSettingsSchema.parse({ ...form, publicVoteClosesAt: "" }).publicVoteClosesAt).toBeNull();
  });

  it("refuse une heure de clôture illisible", () => {
    expect(publicVoteSettingsSchema.safeParse({ ...form, publicVoteClosesAt: "demain soir" }).success).toBe(false);
  });

  it("enregistre un texte vide comme absent, jamais comme une chaîne vide", () => {
    expect(publicVoteSettingsSchema.parse(form).publicVoteSubtitle).toBeNull();
  });

  it("borne le prix d'un vote et exige un nombre entier", () => {
    expect(publicVoteSettingsSchema.parse(form).publicVotePrice).toBe(200);
    for (const price of ["10", "150000", "199.5", ""]) {
      expect(publicVoteSettingsSchema.safeParse({ ...form, publicVotePrice: price }).success).toBe(false);
    }
  });

  it("refuse un style ou un moyen de paiement inconnu", () => {
    expect(publicVoteSettingsSchema.safeParse({ ...form, publicVoteStyle: "GALA" }).success).toBe(false);
    expect(publicVoteSettingsSchema.safeParse({ ...form, publicVoteMethods: ["WAVE", "PAYPAL"] }).success).toBe(false);
  });
});
