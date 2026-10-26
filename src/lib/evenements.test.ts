import { describe, expect, it } from "vitest";
import { evenementSchema, selectionSchema, selectionVitrine, slugifier, slugLibre, statutEvenement, versChampDateHeure } from "./evenements-core";

describe("lien public d'une sélection", () => {
  it("retire accents, ponctuation et majuscules", () => {
    expect(slugifier("Talent Traiteur 2026 1ʳᵉ sélection · Bouaké")).toBe("talent-traiteur-2026-1re-selection-bouake");
  });

  it("ne rend jamais un lien vide", () => {
    expect(slugifier("···")).toBe("selection");
  });

  it("ajoute un numéro quand le lien est déjà pris", () => {
    expect(slugLibre("finale", new Set())).toBe("finale");
    expect(slugLibre("finale", new Set(["finale", "finale-2"]))).toBe("finale-3");
  });
});

describe("saisie d'un événement", () => {
  it("accepte les champs facultatifs vides", () => {
    expect(evenementSchema.parse({ nom: "Talent Traiteur", edition: "", sousTitre: " ", date: "" })).toEqual({
      nom: "Talent Traiteur",
      edition: null,
      sousTitre: null,
      date: null,
    });
  });

  it("lit l'édition et la date", () => {
    const e = evenementSchema.parse({ nom: "TT", edition: "7", sousTitre: "", date: "2026-10-20" });
    expect(e.edition).toBe(7);
    expect(e.date?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  it("refuse une édition qui n'est pas un nombre", () => {
    expect(evenementSchema.safeParse({ nom: "TT", edition: "7e", sousTitre: "", date: "" }).success).toBe(false);
  });
});

describe("saisie d'une sélection", () => {
  const base = { libelle: "Finale", lieu: "", debut: "", fin: "", nbQualifies: "" };

  it("met 0 qualifié par défaut", () => {
    expect(selectionSchema.parse(base).nbQualifies).toBe(0);
  });

  it("lit l'heure d'Abidjan comme de l'UTC et la restitue à l'identique", () => {
    const s = selectionSchema.parse({ ...base, debut: "2026-10-20T18:30" });
    expect(s.debut?.toISOString()).toBe("2026-10-20T18:30:00.000Z");
    expect(versChampDateHeure(s.debut)).toBe("2026-10-20T18:30");
  });

  it("refuse une fin avant le début", () => {
    const r = selectionSchema.safeParse({ ...base, debut: "2026-10-20T18:30", fin: "2026-10-20T18:00" });
    expect(r.success).toBe(false);
  });
});

describe("statut d'un événement dans « Mes événements »", () => {
  it("en cours dès qu'une sélection est ouverte, passé quand toutes sont clôturées", () => {
    expect(statutEvenement(["CLOTUREE", "OUVERTE", "PREPAREE"])).toBe("EN_COURS");
    expect(statutEvenement(["CLOTUREE", "CLOTUREE"])).toBe("PASSE");
    expect(statutEvenement(["CLOTUREE", "PREPAREE"])).toBe("A_VENIR");
    expect(statutEvenement([])).toBe("A_VENIR");
  });

  it("met en vitrine la sélection ouverte, sinon la prochaine, sinon la dernière", () => {
    expect(selectionVitrine([{ etat: "CLOTUREE", n: 1 }, { etat: "OUVERTE", n: 2 }])?.n).toBe(2);
    expect(selectionVitrine([{ etat: "CLOTUREE", n: 1 }, { etat: "PREPAREE", n: 2 }])?.n).toBe(2);
    expect(selectionVitrine([{ etat: "CLOTUREE", n: 1 }, { etat: "CLOTUREE", n: 2 }])?.n).toBe(2);
    expect(selectionVitrine([])).toBeNull();
  });
});
