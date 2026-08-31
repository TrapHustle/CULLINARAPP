import { describe, expect, it } from "vitest";
import {
  computeCandidateScore,
  computeCriterionAverage,
  maxTotalForCriteria,
  rankCandidates,
  round2,
  voteTotal,
  weightForTableType,
  type ScoredVote,
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

describe("conversion des notes brutes", () => {
  it("multiplie chaque note brute par 2 et totalise sur 30 avec 3 critères", () => {
    expect(maxTotalForCriteria(CRITERIA.length)).toBe(30);
    // 4→8, 5→10, 3→6
    expect(voteTotal(lambda(4, 5, 3), CRITERIA)).toBe(24);
  });

  it("compte 0 pour un critère non noté à l'expiration du chronomètre", () => {
    const partiel: ScoredVote = { tableType: "LAMBDA", scores: { gout: 5 } };
    // 5→10, les deux autres critères absents → 0
    expect(voteTotal(partiel, CRITERIA)).toBe(10);
  });

  it("ne code pas le total maximal en dur : il suit le nombre de critères", () => {
    expect(maxTotalForCriteria(2)).toBe(20);
    expect(maxTotalForCriteria(5)).toBe(50);
  });
});

describe("pondération du jury spécial", () => {
  it("donne un poids de 1 à une table lambda et de 2 à la table spéciale", () => {
    expect(weightForTableType("LAMBDA")).toBe(1);
    expect(weightForTableType("SPECIAL")).toBe(2);
  });

  it("fait peser un vote spécial exactement comme deux votes lambda identiques", () => {
    const avecSpecial = computeCandidateScore([lambda(2, 2, 2), special(5, 5, 5)], CRITERIA);
    const avecDeuxLambda = computeCandidateScore(
      [lambda(2, 2, 2), lambda(5, 5, 5), lambda(5, 5, 5)],
      CRITERIA,
    );

    expect(avecSpecial?.finalOutOf20).toBeCloseTo(avecDeuxLambda!.finalOutOf20, 10);
  });
});

describe("exemple chiffré du cahier des charges (§4.3)", () => {
  it("calcule 26,8/30 soit 17,87/20 pour 3 votes lambda et 1 vote spécial", () => {
    const votes = [
      lambda(4, 5, 3), // 24
      lambda(3, 4, 4), // 22
      lambda(5, 5, 4), // 28
      special(5, 5, 5), // 30, poids 2 → contribue 60
    ];

    const score = computeCandidateScore(votes, CRITERIA);

    // Σ contributions = 24 + 22 + 28 + 60 = 134 ; Σ poids = 5
    expect(score).not.toBeNull();
    expect(score!.weightTotal).toBe(5);
    expect(score!.voterCount).toBe(4);
    expect(score!.averageRaw).toBeCloseTo(26.8, 10);
    expect(round2(score!.finalOutOf20)).toBe(17.87);
  });
});

describe("équité entre candidats au nombre de votants différent (§4.3)", () => {
  it("classe selon la moyenne, jamais selon la somme brute des notes", () => {
    // Candidat A : 18 votants à 20/30 → somme brute 360
    // Candidat B : 13 votants à 24/30 → somme brute 312
    // La somme brute placerait A devant B, alors que B est mieux noté.
    const a = repeat(lambda(4, 3, 3), 18); // 8 + 6 + 6 = 20
    const b = repeat(lambda(4, 4, 4), 13); // 8 + 8 + 8 = 24

    const sommeBruteA = a.reduce((t, v) => t + voteTotal(v, CRITERIA), 0);
    const sommeBruteB = b.reduce((t, v) => t + voteTotal(v, CRITERIA), 0);
    expect(sommeBruteA).toBe(360);
    expect(sommeBruteB).toBe(312);
    expect(sommeBruteA).toBeGreaterThan(sommeBruteB); // le piège à éviter

    const classement = rankCandidates(
      [
        { candidate: "A", votes: a },
        { candidate: "B", votes: b },
      ],
      CRITERIA,
    );

    // B doit sortir premier malgré une somme brute inférieure.
    expect(classement[0].candidate).toBe("B");
    expect(classement[1].candidate).toBe("A");
    expect(round2(classement[0].score!.finalOutOf20)).toBe(16);
    expect(round2(classement[1].score!.finalOutOf20)).toBe(13.33);
  });

  it("donne la même note à moyenne égale, quel que soit le nombre de votants", () => {
    const peu = computeCandidateScore(repeat(lambda(4, 4, 4), 3), CRITERIA);
    const beaucoup = computeCandidateScore(repeat(lambda(4, 4, 4), 47), CRITERIA);

    expect(peu!.finalOutOf20).toBeCloseTo(beaucoup!.finalOutOf20, 10);
    expect(peu!.voterCount).toBe(3);
    expect(beaucoup!.voterCount).toBe(47);
  });
});

describe("candidat sans vote", () => {
  it("retourne null plutôt que 0, et ne divise jamais par zéro", () => {
    expect(computeCandidateScore([], CRITERIA)).toBeNull();
    expect(computeCriterionAverage([], "gout")).toBeNull();
  });

  it("place le candidat non noté en fin de classement, sans rang", () => {
    const classement = rankCandidates(
      [
        { candidate: "sans-vote", votes: [] },
        { candidate: "note", votes: [lambda(3, 3, 3)] },
      ],
      CRITERIA,
    );

    expect(classement[0].candidate).toBe("note");
    expect(classement[0].rank).toBe(1);
    expect(classement[1].candidate).toBe("sans-vote");
    expect(classement[1].rank).toBeNull();
    expect(classement[1].score).toBeNull();
  });
});

describe("classement", () => {
  it("attribue le même rang aux ex æquo", () => {
    const classement = rankCandidates(
      [
        { candidate: "X", votes: [lambda(4, 4, 4)] },
        { candidate: "Y", votes: [lambda(4, 4, 4)] },
        { candidate: "Z", votes: [lambda(2, 2, 2)] },
      ],
      CRITERIA,
    );

    expect(classement[0].rank).toBe(1);
    expect(classement[1].rank).toBe(1);
    expect(classement[2].rank).toBe(3);
    expect(classement[2].candidate).toBe("Z");
  });
});

describe("détail par critère", () => {
  it("calcule la moyenne pondérée d'un critère sur 10", () => {
    // gout : lambda 3 (→6, poids 1) et spécial 5 (→10, poids 2)
    // (6×1 + 10×2) / 3 = 26/3 ≈ 8,67
    const moyenne = computeCriterionAverage([lambda(3, 1, 1), special(5, 1, 1)], "gout");
    expect(round2(moyenne!)).toBe(8.67);
  });
});
