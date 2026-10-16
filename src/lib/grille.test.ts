import { describe, expect, it } from "vitest";
import { critereSchema, GRILLE_PROPOSEE, lirePaliers, problemesGrille, reglagesEnLigneSchema, sommeDesParts, typeVoteSchema } from "./grille-core";
import { lireFiche } from "./notes";
import { controlesOuverture, peutOuvrir, qualifiesProposes } from "./pilotage-core";

describe("grille de vote", () => {
  it("propose jury 40 %, salle 30 %, en ligne 30 % (RG 4.5), complète", () => {
    expect(sommeDesParts(GRILLE_PROPOSEE)).toBe(100);
    expect(problemesGrille(GRILLE_PROPOSEE)).toEqual([]);
  });

  it("signale parts ≠ 100, type à critères sans critère, deux types en ligne", () => {
    const p = problemesGrille([
      { libelle: "Jury", canal: "SALLE", avecCriteres: true, part: 50, criteres: [] },
      { libelle: "En ligne", canal: "EN_LIGNE", avecCriteres: false, part: 30, criteres: [] },
      { libelle: "En ligne 2", canal: "EN_LIGNE", avecCriteres: false, part: 10, criteres: [] },
    ]);
    expect(p.join(" ")).toMatch(/90 %/);
    expect(p.join(" ")).toMatch(/Jury.*aucun/);
    expect(p.join(" ")).toMatch(/Un seul type de vote en ligne/);
  });

  it("le vote en ligne n'a jamais de critères (RG 4.2)", () => {
    const r = typeVoteSchema.parse({ libelle: "Public", canal: "EN_LIGNE", avecCriteres: true, part: "30" });
    expect(r.avecCriteres).toBe(false);
  });

  it("lit une part décimale à la française", () => {
    expect(typeVoteSchema.parse({ libelle: "Jury", canal: "SALLE", avecCriteres: true, part: "33,5" }).part).toBe(33.5);
    expect(typeVoteSchema.safeParse({ libelle: "Jury", canal: "SALLE", avecCriteres: true, part: "120" }).success).toBe(false);
  });

  it("borne le barème entre 1 et 100", () => {
    expect(critereSchema.safeParse({ libelle: "Goût", bareme: "20" }).success).toBe(true);
    expect(critereSchema.safeParse({ libelle: "Goût", bareme: "0" }).success).toBe(false);
    expect(critereSchema.safeParse({ libelle: "Goût", bareme: "101" }).success).toBe(false);
  });

  it("lit les paliers, ignore les lignes vides, refuse un ordre décroissant", () => {
    const ok = lirePaliers(["250", "750", "", ""], ["15", "40", "", ""]);
    expect(ok).toEqual({ ok: true, paliers: [{ voixMax: 250, points: 15 }, { voixMax: 750, points: 40 }] });
    expect(lirePaliers(["750", "250"], ["15", "40"]).ok).toBe(false);
    expect(lirePaliers(["250", "750"], ["40", "15"]).ok).toBe(false);
    expect(lirePaliers(["250"], ["120"]).ok).toBe(false);
  });

  it("exige au moins un moyen de paiement et un prix dans les bornes", () => {
    const base = { prixVote: "200", voixGratuite: false, compteursVisibles: true, modeEnLigne: "A", moyensPaiement: ["WAVE"] };
    expect(reglagesEnLigneSchema.safeParse(base).success).toBe(true);
    expect(reglagesEnLigneSchema.safeParse({ ...base, moyensPaiement: [] }).success).toBe(false);
    expect(reglagesEnLigneSchema.safeParse({ ...base, prixVote: "10" }).success).toBe(false);
  });
});

describe("contrôle d'ouverture", () => {
  const types = GRILLE_PROPOSEE.map((t) => ({ ...t, criteres: t.criteres }));
  const prete = {
    etat: "PREPAREE",
    fin: null,
    modeEnLigne: "A",
    prixVote: 200,
    moyensPaiement: ["WAVE"],
    paliers: [],
    types,
    participations: [{ disponible: true }, { disponible: true }],
  };

  it("laisse ouvrir une sélection complète", () => {
    expect(peutOuvrir(controlesOuverture(prete))).toBe(true);
  });

  it("bloque sans deux candidats disponibles, en mode B sans palier, ou avec une fin passée", () => {
    expect(peutOuvrir(controlesOuverture({ ...prete, participations: [{ disponible: true }, { disponible: false }] }))).toBe(false);
    expect(peutOuvrir(controlesOuverture({ ...prete, modeEnLigne: "B" }))).toBe(false);
    expect(peutOuvrir(controlesOuverture({ ...prete, fin: new Date("2020-01-01") }))).toBe(false);
  });

  it("propose les N premiers, et tous les ex æquo de la dernière place", () => {
    const c = [
      { participationId: "a", rang: 1 },
      { participationId: "b", rang: 2 },
      { participationId: "c", rang: 2 },
      { participationId: "d", rang: 4 },
      { participationId: "e", rang: null },
    ];
    expect([...qualifiesProposes(c, 2)].sort()).toEqual(["a", "b", "c"]);
    expect([...qualifiesProposes(c, 1)]).toEqual(["a"]);
    expect(qualifiesProposes(c, 0).size).toBe(0);
    expect([...qualifiesProposes(c, 10)].sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("fiche du jury", () => {
  const participations = [
    { id: "p1", nom: "Awa" },
    { id: "p2", nom: "Koffi" },
  ];
  const criteres = [
    { id: "c1", libelle: "Goût", bareme: 20 },
    { id: "c2", libelle: "Présentation", bareme: 10 },
  ];
  const form = (champs: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(champs)) f.set(k, v);
    return f;
  };

  it("ignore les lignes vides et lit les autres", () => {
    const r = lireFiche(form({ v_p1_c1: "18", v_p1_c2: "9" }), participations, criteres);
    expect(r.ok && r.lignes).toEqual([{ participationId: "p1", valeurs: new Map([["c1", 18], ["c2", 9]]) }]);
  });

  it("refuse une ligne incomplète, une note au-dessus du barème, une fiche vide", () => {
    expect(lireFiche(form({ v_p1_c1: "18" }), participations, criteres).ok).toBe(false);
    expect(lireFiche(form({ v_p1_c1: "21", v_p1_c2: "5" }), participations, criteres).ok).toBe(false);
    expect(lireFiche(form({}), participations, criteres).ok).toBe(false);
  });
});
