import { describe, expect, it } from "vitest";
import {
  cleanWithdrawalNote,
  formatAmount,
  isWithdrawalMethod,
  isWithdrawalStatus,
  MAX_WITHDRAWAL_NOTE,
  MIN_WITHDRAWAL_AMOUNT,
  parseWithdrawalAmount,
  WITHDRAWAL_COUNTRIES,
  WITHDRAWAL_METHODS,
  withdrawalBalance,
} from "./withdrawal-core";

describe("moyens de retrait", () => {
  it("reprend les opérateurs de la passerelle sans la carte bancaire", () => {
    expect(WITHDRAWAL_METHODS).toEqual(["WAVE", "ORANGE_MONEY", "MTN"]);
    expect(isWithdrawalMethod("CARD")).toBe(false);
    expect(isWithdrawalMethod("WAVE")).toBe(true);
  });

  it("n'accepte que des pays couverts par le mobile money", () => {
    expect(WITHDRAWAL_COUNTRIES.every((country) => country.mobile)).toBe(true);
    expect(WITHDRAWAL_COUNTRIES.map((country) => country.code)).toContain("CI");
    expect(WITHDRAWAL_COUNTRIES.map((country) => country.code)).not.toContain("FR");
  });

  it("ne connaît que trois statuts", () => {
    expect(isWithdrawalStatus("PAID")).toBe(true);
    expect(isWithdrawalStatus("CONFIRMED")).toBe(false);
  });
});

describe("withdrawalBalance", () => {
  it("retire les reversements faits et les demandes en attente", () => {
    const balance = withdrawalBalance({ organiser: 1_116_000, paid: 450_000, pending: 200_000 });
    expect(balance.available).toBe(466_000);
  });

  it("ne descend jamais sous zéro", () => {
    const balance = withdrawalBalance({ organiser: 10_000, paid: 50_000, pending: 0 });
    expect(balance.available).toBe(0);
  });

  it("compte tout le disponible quand rien n'a été retiré", () => {
    expect(withdrawalBalance({ organiser: 900, paid: 0, pending: 0 }).available).toBe(900);
  });
});

describe("parseWithdrawalAmount", () => {
  const available = 466_000;

  it("accepte le montant tel qu'il est affiché, espaces compris", () => {
    expect(parseWithdrawalAmount("250 000", available)).toEqual({ ok: true, amount: 250_000 });
    expect(parseWithdrawalAmount("250 000", available)).toEqual({ ok: true, amount: 250_000 });
    expect(parseWithdrawalAmount("250.000", available)).toEqual({ ok: true, amount: 250_000 });
  });

  it("accepte exactement le solde", () => {
    expect(parseWithdrawalAmount("466000", available)).toEqual({ ok: true, amount: 466_000 });
  });

  it("refuse au-dessus du solde en nommant le solde", () => {
    const result = parseWithdrawalAmount("466001", available);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("466 000");
  });

  it("refuse en dessous du minimum", () => {
    const result = parseWithdrawalAmount("499", available);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MIN_WITHDRAWAL_AMOUNT));
  });

  it("refuse un solde trop faible même pour un petit montant", () => {
    const result = parseWithdrawalAmount("500", 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("solde");
  });

  it("refuse ce qui n'est pas un nombre entier de francs", () => {
    for (const bad of ["", "   ", "abc", "12,50", "-5000", "1e6"]) {
      expect(parseWithdrawalAmount(bad, available).ok).toBe(false);
    }
  });

  it("refuse un montant absurde sans déborder", () => {
    expect(parseWithdrawalAmount("9".repeat(25), available).ok).toBe(false);
  });
});

describe("cleanWithdrawalNote", () => {
  it("renvoie null pour un message vide", () => {
    expect(cleanWithdrawalNote("")).toBeNull();
    expect(cleanWithdrawalNote("   \n  ")).toBeNull();
    expect(cleanWithdrawalNote(undefined)).toBeNull();
  });

  it("borne la longueur", () => {
    const long = cleanWithdrawalNote("a".repeat(MAX_WITHDRAWAL_NOTE + 50));
    expect(long).toHaveLength(MAX_WITHDRAWAL_NOTE);
  });

  it("resserre les lignes vides en trop", () => {
    expect(cleanWithdrawalNote("un\n\n\n\ndeux")).toBe("un\n\ndeux");
  });
});

describe("formatAmount", () => {
  it("sépare les milliers par une espace simple", () => {
    expect(formatAmount(1_116_000)).toBe("1 116 000");
    expect(formatAmount(500)).toBe("500");
  });
});
