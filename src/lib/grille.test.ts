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

  it("tous les canaux se notent sur critères au choix (RG 4.2)", () => {
    for (const canal of ["SALLE", "EN_LIGNE", "GRATUIT", "UNIQUE", "QR"]) {
      expect(typeVoteSchema.parse({ libelle: "Public", canal, avecCriteres: true, part: "30" }).avecCriteres).toBe(true);
      expect(typeVoteSchema.parse({ libelle: "Public", canal, avecCriteres: false, part: "30" }).avecCriteres).toBe(false);
    }
  });

  it("seul le vote en ligne ne peut pas être restreint", () => {
    const qr = typeVoteSchema.parse({ libelle: "Invités", canal: "QR", avecCriteres: false, acces: "RESTREINT", part: "30" });
    expect(qr.acces).toBe("RESTREINT");
    const salle = typeVoteSchema.parse({ libelle: "Jury", canal: "SALLE", avecCriteres: true, acces: "RESTREINT", part: "40" });
    expect(salle.acces).toBe("RESTREINT");
    const enLigne = typeVoteSchema.parse({ libelle: "En ligne", canal: "EN_LIGNE", avecCriteres: false, acces: "RESTREINT", part: "30" });
    expect(enLigne.acces).toBe("OUVERT");
    expect(typeVoteSchema.safeParse({ libelle: "Invités", canal: "QR", avecCriteres: false, acces: "PRIVE", part: "30" }).success).toBe(false);
  });

  it("ne contrôle que les types activés : leurs parts font 100 %", () => {
    const jury = { libelle: "Jury", canal: "SALLE", avecCriteres: true, part: 60, criteres: [{}] };
    const enLigne = { libelle: "En ligne", canal: "EN_LIGNE", avecCriteres: false, part: 40, criteres: [] };
    // Un type décoché, même sans part ni critère, ne gêne pas.
    const unique = { libelle: "Secours", canal: "UNIQUE", actif: false, avecCriteres: true, part: 0, criteres: [] };
    expect(problemesGrille([jury, enLigne, unique])).toEqual([]);
    expect(problemesGrille([jury, { ...enLigne, actif: false }]).join(" ")).toMatch(/60 %/);
    expect(problemesGrille([{ ...jury, actif: false }])).toEqual(["Activez au moins un type de vote."]);
  });

  it("propose de passer en vote par voix un type noté sans critère", () => {
    const p = problemesGrille([{ libelle: "Jury", canal: "SALLE", avecCriteres: true, part: 100, criteres: [] }]);
    expect(p.join(" ")).toMatch(/ajoutez des critères, ou passez-le en vote par voix/);
  });

  it("vote unique et en ligne gratuit : critères et accès au choix", () => {
    const base = { libelle: "Secours", avecCriteres: true, acces: "RESTREINT", part: "20" };
    const unique = typeVoteSchema.parse({ ...base, canal: "UNIQUE" });
    expect(unique).toMatchObject({ canal: "UNIQUE", avecCriteres: true, acces: "RESTREINT", actif: true });
    const gratuit = typeVoteSchema.parse({ ...base, canal: "GRATUIT", actif: false });
    expect(gratuit).toMatchObject({ canal: "GRATUIT", avecCriteres: true, acces: "RESTREINT", actif: false });
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

  it("indique où corriger chaque manque", () => {
    const controles = controlesOuverture({ ...prete, participations: [], prixVote: 0 });
    const ko = controles.filter((c) => !c.ok).map((c) => c.onglet);
    expect(ko).toEqual(["candidats", "en-ligne"]);
  });

  it("ignore le vote en ligne payant décoché", () => {
    const sansEnLigne = types.map((t) => (t.canal === "EN_LIGNE" ? { ...t, actif: false } : t));
    const grille = sansEnLigne.map((t) => (t.libelle === "Jury" ? { ...t, part: 70 } : t));
    expect(peutOuvrir(controlesOuverture({ ...prete, types: grille, moyensPaiement: [] }))).toBe(true);
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
