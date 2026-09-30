import { describe, expect, it } from "vitest";
import {
  enabledMethods,
  formatClosingDate,
  formatNumber,
  initials,
  isPublicVoteOpen,
  makePaymentReference,
  normalizePhone,
  rankByVotes,
  toPublicVoteStyle,
  votePercent,
  votesLabel,
  type PublicVoteSettings,
} from "./public-vote-core";

const NOW = new Date("2026-10-01T20:00:00Z");

function settings(overrides: Partial<PublicVoteSettings> = {}): PublicVoteSettings {
  return {
    publicVoteOpen: true,
    publicVoteClosesAt: null,
    publicVoteMethods: ["WAVE", "ORANGE_MONEY", "CARD"],
    ...overrides,
  };
}

describe("ouverture du vote", () => {
  it("accepte les paiements quand l'organisateur a ouvert le vote", () => {
    expect(isPublicVoteOpen(settings(), NOW)).toBe(true);
  });

  it("refuse tout paiement tant que le vote n'est pas ouvert", () => {
    expect(isPublicVoteOpen(settings({ publicVoteOpen: false }), NOW)).toBe(false);
  });

  it("se ferme seul à l'heure de clôture, sans attendre l'organisateur", () => {
    const closesAt = new Date("2026-10-01T22:00:00Z");
    expect(isPublicVoteOpen(settings({ publicVoteClosesAt: closesAt }), NOW)).toBe(true);
    expect(isPublicVoteOpen(settings({ publicVoteClosesAt: closesAt }), closesAt)).toBe(false);
  });

  it("reste fermé si aucun moyen de paiement n'est proposé", () => {
    expect(isPublicVoteOpen(settings({ publicVoteMethods: [] }), NOW)).toBe(false);
    expect(isPublicVoteOpen(settings({ publicVoteMethods: ["INCONNU"] }), NOW)).toBe(false);
  });
});

describe("moyens de paiement", () => {
  it("garde l'ordre d'affichage et écarte les valeurs inconnues", () => {
    expect(enabledMethods(["CARD", "INCONNU", "WAVE"])).toEqual(["WAVE", "CARD"]);
  });
});

describe("style de la page", () => {
  it("retombe sur le style clair pour toute valeur inattendue", () => {
    expect(toPublicVoteStyle("CARTES")).toBe("CARTES");
    expect(toPublicVoteStyle("MENU")).toBe("MENU");
    expect(toPublicVoteStyle("cartes")).toBe("CLAIR");
    expect(toPublicVoteStyle(null)).toBe("CLAIR");
  });
});

describe("heure de clôture en toutes lettres", () => {
  it("donne le jour, le mois et l'année, à l'heure d'Abidjan", () => {
    expect(formatClosingDate(new Date("2026-10-02T22:00:00Z"))).toBe("vendredi 2 octobre 2026 à 22 h");
  });

  it("écrit « 1er » le premier du mois et garde les minutes utiles", () => {
    expect(formatClosingDate(new Date("2026-10-01T21:30:00Z"))).toBe("jeudi 1er octobre 2026 à 21 h 30");
  });
});

describe("classement du public", () => {
  // Les votes de la 1re sélection de Bouaké (Talent Traiteur 2026).
  const candidates = [
    { name: "Doua Agnès Triphène", order: 1, votes: 58 },
    { name: "Tekpo", order: 2, votes: 820 },
    { name: "Sangaré Férima Leyla", order: 3, votes: 639 },
    { name: "Kadja Hugues", order: 4, votes: 183 },
  ];

  it("place le plus voté en haut et le moins voté en bas", () => {
    expect(rankByVotes(candidates).map((c) => [c.name, c.rank])).toEqual([
      ["Tekpo", 1],
      ["Sangaré Férima Leyla", 2],
      ["Kadja Hugues", 3],
      ["Doua Agnès Triphène", 4],
    ]);
  });

  it("donne le même rang à deux candidats à égalité, sans avantager l'ordre de passage", () => {
    const tie = [
      { name: "A", order: 2, votes: 10 },
      { name: "B", order: 1, votes: 10 },
      { name: "C", order: 3, votes: 4 },
    ];
    expect(rankByVotes(tie).map((c) => [c.name, c.rank])).toEqual([
      ["B", 1],
      ["A", 1],
      ["C", 3],
    ]);
  });

  it("ne modifie pas la liste reçue", () => {
    const copy = candidates.map((c) => ({ ...c }));
    rankByVotes(candidates);
    expect(candidates).toEqual(copy);
  });
});

describe("affichage des nombres", () => {
  it("groupe les milliers avec une espace", () => {
    expect(formatNumber(58)).toBe("58");
    expect(formatNumber(1700)).toBe("1 700");
    expect(formatNumber(340000)).toBe("340 000");
    expect(formatNumber(1234567)).toBe("1 234 567");
  });

  it("accorde « vote » au nombre", () => {
    expect(votesLabel(0)).toBe("0 vote");
    expect(votesLabel(1)).toBe("1 vote");
    expect(votesLabel(820)).toBe("820 votes");
  });

  it("calcule la part d'un candidat sans diviser par zéro", () => {
    expect(votePercent(820, 1700)).toBe(48);
    expect(votePercent(5, 0)).toBe(0);
  });

  it("remplace un portrait manquant par les initiales", () => {
    expect(initials("Sangaré Férima Leyla")).toBe("SF");
    expect(initials("Tekpo")).toBe("T");
  });
});

describe("référence de paiement", () => {
  it("a la forme VP- suivie de six caractères faciles à dicter", () => {
    let i = 0;
    const reference = makePaymentReference((size) => i++ % size);
    expect(reference).toMatch(/^VP-[A-HJKMNP-Z2-9]{6}$/);
    expect(reference).toBe("VP-ABCDEF");
  });
});

describe("numéro de téléphone", () => {
  it("accepte les écritures courantes et garde les 10 chiffres", () => {
    for (const raw of ["07 01 02 03 04", "07.01.02.03.04", "+225 07 01 02 03 04", "00225 0701020304", "+225 7 01 02 03 04"]) {
      expect(normalizePhone(raw)).toBe("0701020304");
    }
  });

  it("refuse un numéro trop court ou trop long plutôt que de le deviner", () => {
    expect(normalizePhone("07 01 02 03")).toBeNull();
    expect(normalizePhone("07 01 02 03 04 5")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});
