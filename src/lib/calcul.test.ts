import { describe, expect, it } from "vitest";
import { arrondi2, classer, noteCriteres, noteFinale, notePaliers, notesEnLigne, type Palier } from "./calcul";

/** Les paliers de l'annexe Inovyx, avec un plafond au dernier palier. */
const PALIERS: Palier[] = [
  { voixMax: 250, points: 15 },
  { voixMax: 750, points: 40 },
  { voixMax: 2000, points: 70 },
  { voixMax: 4000, points: 100 },
];

describe("type avec critères, ramené sur 100 (RG 8.1)", () => {
  it("27 sur 30 donne 90", () => {
    expect(noteCriteres([27], 30)).toBe(90);
  });

  it("fait la moyenne des votes avant de ramener sur 100", () => {
    expect(noteCriteres([20, 22, 21], 30)).toBeCloseTo(70);
  });

  it("ne note pas un candidat sans vote, au lieu de lui mettre zéro", () => {
    expect(noteCriteres([], 30)).toBeNull();
  });
});

describe("mode B : paliers et règle de trois (RG 8.3)", () => {
  it("0 voix donne 0 point", () => {
    expect(notePaliers(0, PALIERS)).toBe(0);
  });

  it("applique la règle de trois dans le premier palier : 10 voix = 0,6", () => {
    expect(notePaliers(10, PALIERS)).toBeCloseTo(0.6);
  });

  it("atteint exactement les points du palier à son plafond", () => {
    expect(notePaliers(250, PALIERS)).toBe(15);
    expect(notePaliers(750, PALIERS)).toBe(40);
    expect(notePaliers(2000, PALIERS)).toBe(70);
  });

  it("applique la règle de trois dans les paliers suivants : 500 voix = 27,5", () => {
    expect(notePaliers(500, PALIERS)).toBeCloseTo(27.5);
  });

  it("ne saute pas d'un coup au passage d'un plafond", () => {
    expect(notePaliers(251, PALIERS) - notePaliers(250, PALIERS)).toBeLessThan(0.1);
  });

  it("reste au maximum au-delà du dernier plafond", () => {
    expect(notePaliers(9000, PALIERS)).toBe(100);
  });

  it("accepte des paliers saisis dans le désordre", () => {
    expect(notePaliers(500, [...PALIERS].reverse())).toBeCloseTo(27.5);
  });
});

describe("vote en ligne : modes A, B et C (RG 8.3)", () => {
  const voix = new Map([
    ["A", 600],
    ["B", 250],
    ["C", 150],
  ]);

  it("mode A : part dans le total des voix", () => {
    const notes = notesEnLigne(voix, "A")!;
    expect(notes.get("A")).toBe(60);
    expect(notes.get("B")).toBe(25);
    expect(notes.get("C")).toBe(15);
  });

  it("mode C : le premier obtient 100, les autres au prorata", () => {
    const notes = notesEnLigne(voix, "C")!;
    expect(notes.get("A")).toBe(100);
    expect(notes.get("B")).toBeCloseTo(41.67, 2);
  });

  it("mode B : chaque candidat dépend seulement de ses propres voix", () => {
    const notes = notesEnLigne(voix, "B", PALIERS)!;
    expect(notes.get("A")).toBeCloseTo(15 + (350 * 25) / 500);
    expect(notes.get("B")).toBe(15);
  });

  it("sort du calcul si personne n'a voté en ligne", () => {
    expect(notesEnLigne(new Map([["A", 0], ["B", 0]]), "A")).toBeNull();
  });

  it("donne 0 à un candidat sans voix dès que d'autres en ont", () => {
    // Corrige le défaut de l'ancien moteur : 0 voix retirait la part en ligne
    // du calcul, ce qui valait mieux qu'en avoir une seule.
    const notes = notesEnLigne(new Map([["A", 100], ["B", 0]]), "A")!;
    expect(notes.get("B")).toBe(0);
  });
});

describe("note finale (RG 8.4)", () => {
  it("applique les parts", () => {
    const finale = noteFinale([
      { note: 25, part: 30 },
      { note: 90, part: 40 },
      { note: 60, part: 30 },
    ]);
    expect(finale!.note).toBeCloseTo(61.5);
    expect(finale!.partsRetenues).toBe(100);
  });

  it("renormalise sur les types qui se sont prononcés", () => {
    const finale = noteFinale([
      { note: 90, part: 40 },
      { note: null, part: 30 },
    ]);
    expect(finale!.note).toBe(90);
    expect(finale!.partsRetenues).toBe(40);
  });

  it("ignore un type à part nulle", () => {
    expect(noteFinale([{ note: 80, part: 50 }, { note: 10, part: 0 }])!.note).toBe(80);
  });

  it("ne note pas un candidat qu'aucun type n'a noté (RG 8.8)", () => {
    expect(noteFinale([{ note: null, part: 40 }])).toBeNull();
  });
});

describe("classement (RG 8.5)", () => {
  it("classe par note décroissante, les non notés à la fin", () => {
    const lignes = classer([
      { candidat: "C", note: 55.5 },
      { candidat: "X", note: null },
      { candidat: "B", note: 61.5 },
      { candidat: "A", note: 61 },
    ]);
    expect(lignes.map((l) => [l.candidat, l.rang])).toEqual([
      ["B", 1],
      ["A", 2],
      ["C", 3],
      ["X", null],
    ]);
  });

  it("signale les ex æquo, qui partagent leur rang", () => {
    const lignes = classer([
      { candidat: "A", note: 70 },
      { candidat: "B", note: 70 },
      { candidat: "C", note: 50 },
    ]);
    expect(lignes.map((l) => [l.candidat, l.rang, l.egalite])).toEqual([
      ["A", 1, true],
      ["B", 1, true],
      ["C", 3, false],
    ]);
  });

  it("compare les égalités sur la note affichée, au centième", () => {
    const lignes = classer([
      { candidat: "A", note: 70.0000000001 },
      { candidat: "B", note: 70 },
    ]);
    expect(lignes.every((l) => l.rang === 1 && l.egalite)).toBe(true);
  });
});

describe("exemple de référence du document Inovyx", () => {
  // Parts : en ligne 30 %, salle 30 %, jury 40 %. Grille sur 30. 1 000 voix, mode A.
  const enLigne = notesEnLigne(new Map([["A", 600], ["B", 250], ["C", 150]]), "A")!;
  const jury = { A: 21, B: 27, C: 18 };
  const salle = { A: 15, B: 18, C: 27 };

  const lignes = classer(
    (["A", "B", "C"] as const).map((c) => ({
      candidat: c,
      note:
        noteFinale([
          { note: enLigne.get(c)!, part: 30 },
          { note: noteCriteres([jury[c]], 30), part: 40 },
          { note: noteCriteres([salle[c]], 30), part: 30 },
        ])?.note ?? null,
    })),
  );

  it("désigne B vainqueur avec 61,5, devant A (61,0) et C (55,5)", () => {
    expect(lignes.map((l) => [l.candidat, arrondi2(l.note!), l.rang])).toEqual([
      ["B", 61.5, 1],
      ["A", 61, 2],
      ["C", 55.5, 3],
    ]);
  });
});
