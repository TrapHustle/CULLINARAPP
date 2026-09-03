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

describe("total d'un vote", () => {
  it("totalise les notes brutes (1–5) sur 15 avec 3 critères, sans les remettre à l'échelle", () => {
    expect(maxTotalForCriteria(CRITERIA.length)).toBe(15);
    expect(voteTotal(lambda(4, 5, 3), CRITERIA)).toBe(12);
  });

  it("compte 0 pour un critère non noté à l'expiration du chronomètre", () => {
    const partiel: ScoredVote = { tableType: "LAMBDA", scores: { gout: 5 } };
    // 5, les deux autres critères absents → 0
    expect(voteTotal(partiel, CRITERIA)).toBe(5);
  });

  it("ne code pas le total maximal en dur : il suit le nombre de critères", () => {
    expect(maxTotalForCriteria(2)).toBe(10);
    expect(maxTotalForCriteria(5)).toBe(25);
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

    expect(avecSpecial?.averageRaw).toBeCloseTo(avecDeuxLambda!.averageRaw, 10);
  });
});

describe("exemple chiffré du cahier des charges (§4.3, révisé sur l'échelle /15)", () => {
  it("calcule 13,4/15 pour 3 votes lambda et 1 vote spécial", () => {
    const votes = [
      lambda(4, 5, 3), // 12
      lambda(3, 4, 4), // 11
      lambda(5, 5, 4), // 14
      special(5, 5, 5), // 15, poids 2 → contribue 30
    ];

    const score = computeCandidateScore(votes, CRITERIA);

    // Σ contributions = 12 + 11 + 14 + 30 = 67 ; Σ poids = 5
    expect(score).not.toBeNull();
    expect(score!.weightTotal).toBe(5);
    expect(score!.voterCount).toBe(4);
    expect(round2(score!.averageRaw)).toBe(13.4);
  });
});

describe("équité entre candidats au nombre de votants différent (§4.3)", () => {
  it("classe selon la moyenne, jamais selon la somme brute des notes", () => {
    // Candidat A : 18 votants à 10/15 → somme brute 180
    // Candidat B : 13 votants à 12/15 → somme brute 156
    // La somme brute placerait A devant B, alors que B est mieux noté.
    const a = repeat(lambda(4, 3, 3), 18); // 4 + 3 + 3 = 10
    const b = repeat(lambda(4, 4, 4), 13); // 4 + 4 + 4 = 12

    const sommeBruteA = a.reduce((t, v) => t + voteTotal(v, CRITERIA), 0);
    const sommeBruteB = b.reduce((t, v) => t + voteTotal(v, CRITERIA), 0);
    expect(sommeBruteA).toBe(180);
    expect(sommeBruteB).toBe(156);
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
    expect(round2(classement[0].score!.averageRaw)).toBe(12);
    expect(round2(classement[1].score!.averageRaw)).toBe(10);
  });

  it("donne la même note à moyenne égale, quel que soit le nombre de votants", () => {
    const peu = computeCandidateScore(repeat(lambda(4, 4, 4), 3), CRITERIA);
    const beaucoup = computeCandidateScore(repeat(lambda(4, 4, 4), 47), CRITERIA);

    expect(peu!.averageRaw).toBeCloseTo(beaucoup!.averageRaw, 10);
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
  it("calcule la moyenne pondérée d'un critère sur 5", () => {
    // gout : lambda 3 (poids 1) et spécial 5 (poids 2)
    // (3×1 + 5×2) / 3 = 13/3 ≈ 4,33
    const moyenne = computeCriterionAverage([lambda(3, 1, 1), special(5, 1, 1)], "gout");
    expect(round2(moyenne!)).toBe(4.33);
  });
});
