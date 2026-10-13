import { describe, expect, it } from "vitest";
import {
  enabledMethods,
  formatClosingDate,
  formatNumber,
  initials,
  isPublicVoteOpen,
  detectPhoneCountry,
  INOVYX_SHARE,
  makePaymentReference,
  maskPhone,
  normalizePhone,
  parsePhone,
  phoneCountry,
  splitRevenue,
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

  it("garde les dix chiffres nus pour la Côte d'Ivoire et passe les autres pays en +indicatif", () => {
    const ci = parsePhone("07 01 02 03 04", phoneCountry("CI"));
    expect(ci).toEqual({ ok: true, phone: "0701020304", pretty: "+225 07 01 02 03 04" });

    const fr = parsePhone("06 12 34 56 78", phoneCountry("FR"));
    expect(fr.ok && fr.phone).toBe("+33612345678");
  });

  it("retire le zéro d'acheminement là où il n'appartient pas au numéro", () => {
    // La France l'ajoute en national et le perd à l'international…
    expect(parsePhone("0470123456", phoneCountry("BE"))).toMatchObject({ phone: "+32470123456" });
    // …la Côte d'Ivoire le garde dans ses dix chiffres.
    expect(parsePhone("0701020304", phoneCountry("CI"))).toMatchObject({ phone: "0701020304" });
  });

  it("dit combien de chiffres manquent plutôt que « numéro invalide »", () => {
    const court = parsePhone("07 01 02", phoneCountry("CI"));
    expect(court.ok).toBe(false);
    expect(!court.ok && court.error).toBe("Il manque 4 chiffres : Côte d'Ivoire, 10 chiffres.");

    const long = parsePhone("77 123 45 678", phoneCountry("SN"));
    expect(!long.ok && long.error).toBe("Il y a 1 chiffre de trop : Sénégal, 9 chiffres.");
  });

  it("accepte un pays libre entre huit et quinze chiffres", () => {
    expect(parsePhone("+41 79 123 45 67", phoneCountry("XX"))).toMatchObject({ phone: "+41791234567" });
    expect(parsePhone("123", phoneCountry("XX")).ok).toBe(false);
    expect(parsePhone("1234567890123456", phoneCountry("XX")).ok).toBe(false);
  });

  it("déduit le pays d'un numéro écrit avec son indicatif", () => {
    expect(detectPhoneCountry("+33 6 12 34 56 78")).toMatchObject({ rest: "612345678" });
    expect(detectPhoneCountry("+33 6 12 34 56 78")?.country.code).toBe("FR");
    expect(detectPhoneCountry("00225 0701020304")?.country.code).toBe("CI");
    // Sans indicatif, le pays déjà choisi reste en place.
    expect(detectPhoneCountry("0701020304")).toBeNull();
  });

  it("accepte côté serveur un numéro étranger écrit à l'internationale", () => {
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("+221 77 123 45 67")).toBe("+221771234567");
    // L'indicatif ivoirien revient toujours aux dix chiffres déjà stockés.
    expect(normalizePhone("+225 07 01 02 03 04")).toBe("0701020304");
    expect(normalizePhone("+33 6 12 34")).toBeNull();
  });
});

describe("recettes et part du prestataire", () => {
  it("retient 10 % pour Inovyx Tech", () => {
    expect(INOVYX_SHARE).toBe(0.1);
    expect(splitRevenue(486_200)).toEqual({ inovyx: 48_620, organiser: 437_580 });
  });

  it("fait toujours retomber les deux parts sur le total, même avec un arrondi", () => {
    // 1 275 × 10 % = 127,5 : l'arrondi va à Inovyx, le reste à l'organisateur.
    expect(splitRevenue(1_275)).toEqual({ inovyx: 128, organiser: 1_147 });
    for (const total of [0, 1, 7, 199, 1_275, 48_615, 999_999]) {
      const { inovyx, organiser } = splitRevenue(total);
      expect(inovyx + organiser).toBe(total);
    }
  });
});

describe("numéro masqué de l'espace organisateur", () => {
  it("ne laisse voir que les deux premiers et les deux derniers chiffres", () => {
    expect(maskPhone("0779609706")).toBe("07 \u2022\u2022\u2022\u2022\u2022\u2022 06");
    expect(maskPhone("+33612345678")).toBe("+33 \u2022\u2022\u2022\u2022\u2022\u2022\u2022 78");
  });

  it("ne rend jamais le milieu du numéro et ne casse pas sur une valeur absente", () => {
    expect(maskPhone(null)).toBe("\u2014");
    expect(maskPhone("")).toBe("\u2014");
    expect(maskPhone("0779609706")).not.toContain("796097");
  });
});
