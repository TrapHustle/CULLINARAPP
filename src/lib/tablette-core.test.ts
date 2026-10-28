import { describe, expect, it } from "vitest";
import { controlerValeurs, lotTabletteSchema, LOT_MAX, suffrageTabletteSchema } from "./tablette-core";

const jury = {
  avecCriteres: true,
  criteres: [
    { id: "gout", libelle: "Goût", bareme: 10 },
    { id: "pres", libelle: "Présentation", bareme: 5 },
  ],
};
const publicVoix = { avecCriteres: false, criteres: [] };

describe("controlerValeurs", () => {
  it("accepte une note complète dans les barèmes", () => {
    expect(controlerValeurs(jury, { gout: 10, pres: 0 })).toBeNull();
  });

  it("refuse une note manquante, hors barème ou sur un critère inconnu", () => {
    expect(controlerValeurs(jury, { gout: 8 })).toMatch(/Présentation/);
    expect(controlerValeurs(jury, { gout: 11, pres: 3 })).toMatch(/0 à 10/);
    expect(controlerValeurs(jury, { gout: 5, pres: 3, autre: 1 })).toMatch(/inconnu/);
    expect(controlerValeurs(jury, null)).toMatch(/manquent/);
  });

  it("un vote par voix n'a pas de notes", () => {
    expect(controlerValeurs(publicVoix, null)).toBeNull();
    expect(controlerValeurs(publicVoix, {})).toBeNull();
    expect(controlerValeurs(publicVoix, { gout: 3 })).toMatch(/voix/);
  });

  it("un vote avec critères sans critère n'accepte rien", () => {
    expect(controlerValeurs({ avecCriteres: true, criteres: [] }, {})).toMatch(/critères/);
  });
});

describe("schémas", () => {
  it("lit un vote de tablette", () => {
    const v = { id: "6f1c1d0e-6a4b-4c8e-9b1a-2f3d4e5f6a7b", typeVoteId: "t", participationId: "p", jure: 2, valeurs: { gout: 7 } };
    expect(suffrageTabletteSchema.safeParse(v).success).toBe(true);
    expect(suffrageTabletteSchema.safeParse({ ...v, id: "pas-un-uuid" }).success).toBe(false);
    expect(suffrageTabletteSchema.safeParse({ ...v, jure: 0 }).success).toBe(false);
    expect(suffrageTabletteSchema.safeParse({ ...v, valeurs: null }).success).toBe(true);
  });

  it("borne la taille d'un lot", () => {
    expect(lotTabletteSchema.safeParse({ suffrages: Array(LOT_MAX).fill({}) }).success).toBe(true);
    expect(lotTabletteSchema.safeParse({ suffrages: Array(LOT_MAX + 1).fill({}) }).success).toBe(false);
  });
});
