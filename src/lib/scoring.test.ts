import { describe, expect, it } from "vitest";
import {
  computeCandidateScore,
  computeCriterionAverage,
  DEFAULT_SHARES,
  maxTotalForCriteria,
  rankCandidates,
  round2,
  shareForTableType,
  voteTotal,
  type ScoredVote,
  type SharesByType,
} from "./scoring";

/** Les 3 critères de l'édition en cours. */
const CRITERIA = ["gout", "presentation", "creativite"];

function vote(tableType: "LAMBDA" | "SPECIAL", a: number, b: number, c: number): ScoredVote {
  return { tableType, scores: { gout: a, presentation: b, creativite: c } };
}

const lambda = (a: number, b: number, c: number) => vote("LAMBDA", a, b, c);
const special = (a: number, b: number, c: number) => vote("SPECIAL", a, b, c);

/** Répète un même vote `n` fois, pour simuler une table entière. */
function repeat(v: ScoredVote, n: number): ScoredVote[] {
  return Array.from({ length: n }, () => ({ ...v }));
}

/** Parts explicites, pour ne jamais dépendre en silence des valeurs de départ. */
const PARTS_40_60: SharesByType = { LAMBDA: 40, SPECIAL: 60 };
const PARTS_50_50: SharesByType = { LAMBDA: 50, SPECIAL: 50 };

/* ========================================================================== */
/* Total d'un vote                                                            */
/* ========================================================================== */

describe("total d'un vote", () => {
  it("totalise les notes brutes sur 15 avec 3 critères, sans les remettre à l'échelle", () => {
    expect(maxTotalForCriteria(CRITERIA.length)).toBe(15);
    expect(voteTotal(lambda(5, 5, 5), CRITERIA)).toBe(15);
    expect(voteTotal(lambda(4, 3, 5), CRITERIA)).toBe(12);
  });

  it("compte 0 pour un critère non noté à l'expiration du chronomètre", () => {
    expect(voteTotal(lambda(5, 0, 5), CRITERIA)).toBe(10);
  });

  it("ne code pas le total maximal en dur : il suit le nombre de critères et l'échelle", () => {
    expect(maxTotalForCriteria(4)).toBe(20);
    expect(maxTotalForCriteria(3, 10)).toBe(30);
  });
});

/* ========================================================================== */
/* Le modèle : des parts, pas des poids par vote                              */
/* ========================================================================== */

describe("notes maximales dans une seule catégorie", () => {
  it("donne la note maximale quand tout le monde met 5 partout", () => {
    const score = computeCandidateScore(
      [...repeat(lambda(5, 5, 5), 12), ...repeat(special(5, 5, 5), 3)],
      CRITERIA,
      PARTS_40_60,
    );

    expect(score?.averageRaw).toBe(15);
    expect(score?.voterCount).toBe(15);
    expect(score?.shareTotal).toBe(100);
  });

  it("donne quand même la note maximale si seul le public a voté 5 partout", () => {
    // La part du jury est renormalisée, pas comptée zéro : un candidat que le
    // jury n'a pas encore noté ne doit pas être puni pour cette attente.
    const score = computeCandidateScore(repeat(lambda(5, 5, 5), 12), CRITERIA, PARTS_40_60);

    expect(score?.averageRaw).toBe(15);
    expect(score?.shareTotal).toBe(40);
  });

  it("donne la note maximale si seul le jury a voté 5 partout", () => {
    const score = computeCandidateScore(repeat(special(5, 5, 5), 3), CRITERIA, PARTS_40_60);

    expect(score?.averageRaw).toBe(15);
    expect(score?.shareTotal).toBe(60);
  });
});

describe("combinaison des deux catégories", () => {
  it("applique la part à la moyenne de chaque catégorie", () => {
    // Public 15/15, jury 3/15, parts 40 / 60 :
    //   (15 × 40 + 3 × 60) / 100 = 780 / 100 = 7,8
    const score = computeCandidateScore(
      [...repeat(lambda(5, 5, 5), 10), ...repeat(special(1, 1, 1), 4)],
      CRITERIA,
      PARTS_40_60,
    );

    expect(score?.averageRaw).toBeCloseTo(7.8, 10);
  });

  it("tombe sur la moyenne des deux catégories quand les parts sont égales", () => {
    // Public 15, jury 9, parts 50 / 50 → 12
    const score = computeCandidateScore(
      [...repeat(lambda(5, 5, 5), 8), ...repeat(special(3, 3, 3), 2)],
      CRITERIA,
      PARTS_50_50,
    );

    expect(score?.averageRaw).toBe(12);
  });
});

describe("l'influence d'une catégorie ne dépend pas de sa taille", () => {
  it("donne la même note à un jury de 1 personne et à un jury de 10, à moyenne égale", () => {
    const publicVotes = repeat(lambda(3, 3, 3), 15); // moyenne 9

    const juryDeUn = computeCandidateScore(
      [...publicVotes, special(5, 5, 5)],
      CRITERIA,
      PARTS_40_60,
    );
    const juryDeDix = computeCandidateScore(
      [...publicVotes, ...repeat(special(5, 5, 5), 10)],
      CRITERIA,
      PARTS_40_60,
    );

    // (9 × 40 + 15 × 60) / 100 = 1260 / 100 = 12,6 — dans les deux cas.
    expect(juryDeUn?.averageRaw).toBeCloseTo(12.6, 10);
    expect(juryDeDix?.averageRaw).toBeCloseTo(12.6, 10);
    expect(juryDeUn?.averageRaw).toBe(juryDeDix?.averageRaw);
  });

  it("ne fait plus peser un vote spécial comme deux votes lambda", () => {
    // C'est la différence avec l'ancien modèle par poids : un vote du jury ne
    // vaut plus « deux votes du public », il porte la part entière du jury.
    const score = computeCandidateScore(
      [lambda(1, 1, 1), special(5, 5, 5)],
      CRITERIA,
      PARTS_40_60,
    );

    // (3 × 40 + 15 × 60) / 100 = 10,2 — et non la moyenne pondérée de 3 votes.
    expect(score?.averageRaw).toBeCloseTo(10.2, 10);
  });

  it("ignore le nombre de votants à l'intérieur d'une catégorie", () => {
    const troisConvives = computeCandidateScore(repeat(lambda(4, 4, 4), 3), CRITERIA, PARTS_40_60);
    const trenteConvives = computeCandidateScore(
      repeat(lambda(4, 4, 4), 30),
      CRITERIA,
      PARTS_40_60,
    );

    expect(troisConvives?.averageRaw).toBe(12);
    expect(trenteConvives?.averageRaw).toBe(12);
  });
});

describe("parts particulières", () => {
  it("lit la part d'une catégorie, et 0 pour une catégorie inconnue", () => {
    expect(shareForTableType("LAMBDA", PARTS_40_60)).toBe(40);
    expect(shareForTableType("SPECIAL", PARTS_40_60)).toBe(60);
    expect(shareForTableType("LAMBDA", DEFAULT_SHARES)).toBe(40);
  });

  it("neutralise une catégorie à 0 %, sans diviser par zéro", () => {
    const parts: SharesByType = { LAMBDA: 0, SPECIAL: 100 };

    // Le public est ignoré : seule la moyenne du jury compte.
    const score = computeCandidateScore(
      [...repeat(lambda(5, 5, 5), 10), ...repeat(special(3, 3, 3), 2)],
      CRITERIA,
      parts,
    );
    expect(score?.averageRaw).toBe(9);

    // Et un candidat noté uniquement par la catégorie neutralisée n'est pas
    // noté 0 : il n'est pas noté du tout.
    expect(computeCandidateScore(repeat(lambda(5, 5, 5), 10), CRITERIA, parts)).toBeNull();
  });

  it("renormalise des parts qui ne totalisent pas 100", () => {
    // 1 et 3, soit un quart / trois quarts : public 8, jury 12
    //   (8 × 1 + 12 × 3) / 4 = 44 / 4 = 11
    const parts: SharesByType = { LAMBDA: 1, SPECIAL: 3 };
    const score = computeCandidateScore(
      [lambda(3, 3, 2), special(4, 4, 4)],
      CRITERIA,
      parts,
    );

    expect(score?.averageRaw).toBe(11);
    expect(score?.shareTotal).toBe(4);
  });

  it("accepte une part fractionnaire", () => {
    const parts: SharesByType = { LAMBDA: 33.5, SPECIAL: 66.5 };
    const score = computeCandidateScore([lambda(3, 3, 3), special(5, 5, 5)], CRITERIA, parts);

    // (9 × 33,5 + 15 × 66,5) / 100 = (301,5 + 997,5) / 100 = 12,99
    expect(score?.averageRaw).toBeCloseTo(12.99, 10);
  });
});

/* ========================================================================== */
/* Équité, absence de vote, classement                                        */
/* ========================================================================== */

describe("candidat sans vote", () => {
  it("retourne null plutôt que 0, et ne divise jamais par zéro", () => {
    expect(computeCandidateScore([], CRITERIA, PARTS_40_60)).toBeNull();
  });

  it("place le candidat non noté en fin de classement, sans rang", () => {
    const classement = rankCandidates(
      [
        { candidate: "noté", votes: [lambda(4, 4, 4)] },
        { candidate: "jamais noté", votes: [] },
      ],
      CRITERIA,
      PARTS_40_60,
    );

    expect(classement[0].candidate).toBe("noté");
    expect(classement[0].rank).toBe(1);
    expect(classement[1].candidate).toBe("jamais noté");
    expect(classement[1].rank).toBeNull();
    expect(classement[1].score).toBeNull();
  });
});

describe("classement", () => {
  it("attribue le même rang aux ex æquo, et fait sauter le suivant", () => {
    const classement = rankCandidates(
      [
        { candidate: "A", votes: [lambda(5, 5, 5)] },
        { candidate: "B", votes: [lambda(5, 5, 5)] },
        { candidate: "C", votes: [lambda(1, 1, 1)] },
      ],
      CRITERIA,
      PARTS_40_60,
    );

    expect(classement.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it("classe sur la moyenne exacte, sans passer par l'arrondi d'affichage", () => {
    // Public : (15 + 15 + 13) / 3 = 43/3, une valeur qui n'est pas ronde.
    const b = computeCandidateScore(
      [lambda(5, 5, 5), lambda(5, 5, 5), lambda(5, 5, 3)],
      CRITERIA,
      PARTS_40_60,
    );

    expect(b!.averageRaw).toBeCloseTo(14.3333, 4);
    // Le moteur ne pré-arrondit pas : c'est l'affichage qui arrondit, et lui seul.
    expect(b!.averageRaw).not.toBe(round2(b!.averageRaw));

    const classement = rankCandidates(
      [
        { candidate: "A", votes: [lambda(5, 5, 5), lambda(5, 5, 3)] }, // 14
        { candidate: "B", votes: [lambda(5, 5, 5), lambda(5, 5, 5), lambda(5, 5, 3)] },
      ],
      CRITERIA,
      PARTS_40_60,
    );

    expect(classement[0].candidate).toBe("B");
    expect(classement[0].rank).toBe(1);
    expect(classement[1].rank).toBe(2);
  });
});

/* ========================================================================== */
/* Détail par critère                                                         */
/* ========================================================================== */

describe("détail par critère", () => {
  it("suit le même modèle que la note globale", () => {
    // Public met 5 en goût, jury met 1 : (5 × 40 + 1 × 60) / 100 = 2,6
    const moyenne = computeCriterionAverage(
      [...repeat(lambda(5, 1, 1), 10), ...repeat(special(1, 5, 5), 2)],
      "gout",
      PARTS_40_60,
    );

    expect(moyenne).toBeCloseTo(2.6, 10);
  });

  it("retourne null sans aucun vote", () => {
    expect(computeCriterionAverage([], "gout", PARTS_40_60)).toBeNull();
  });

  it("compte un critère non noté comme 0 dans sa catégorie", () => {
    // Deux votes publics : 4 et 0 en goût → moyenne 2. Seul le public vote.
    const moyenne = computeCriterionAverage(
      [lambda(4, 5, 5), lambda(0, 5, 5)],
      "gout",
      PARTS_40_60,
    );

    expect(moyenne).toBe(2);
  });
});

/* ========================================================================== */
/* Arrondi                                                                    */
/* ========================================================================== */

describe("arrondi d'affichage", () => {
  it("arrondit à deux décimales", () => {
    expect(round2(12.344)).toBe(12.34);
    expect(round2(12.345)).toBe(12.35);
    expect(round2(12)).toBe(12);
  });
});
