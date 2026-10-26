import { describe, expect, it } from "vitest";
import { identifiantQr, lireCsv, lireListe, lireSaisie, telephoneLisible } from "./vote-qr-core";

describe("vote par QR code", () => {
  it("lit la saisie libre : numéro puis nom facultatif", () => {
    const r = lireSaisie("07 01 02 03 04 ; Awa Koné\n0506070809\n\n+225 01 44 55 66 77, Yao");
    expect(r.numeros).toEqual([
      { telephone: "0701020304", nom: "Awa Koné" },
      { telephone: "0506070809", nom: null },
      { telephone: "0144556677", nom: "Yao" },
    ]);
    expect(r.invalides).toEqual([]);
  });

  it("écarte les doublons et signale les lignes illisibles avec leur numéro", () => {
    const r = lireSaisie("0701020304\n+2250701020304\n12345\nAwa");
    expect(r.numeros).toHaveLength(1);
    expect(r.doublons).toBe(1);
    expect(r.invalides.map((i) => i.ligne)).toEqual([3, 4]);
  });

  it("trouve les colonnes par leurs en-têtes, dans n'importe quel ordre", () => {
    const r = lireListe([
      ["Nom de l'invité", "Table", "Téléphone"],
      ["Awa Koné", "12", "07 01 02 03 04"],
      ["Mariam Touré", "3", "0788990011"],
    ]);
    expect(r.numeros).toEqual([
      { telephone: "0701020304", nom: "Awa Koné" },
      { telephone: "0788990011", nom: "Mariam Touré" },
    ]);
  });

  it("préfère la colonne « Nom » à « Prénom » et reconnaît « GSM »", () => {
    const r = lireListe([
      ["GSM", "Prénom", "Nom"],
      ["0701020304", "Awa", "Koné"],
    ]);
    expect(r.numeros).toEqual([{ telephone: "0701020304", nom: "Koné" }]);
    expect(r.invalides).toEqual([]);
  });

  it("lit un CSV d'Excel français (BOM, point-virgule, guillemets)", () => {
    const r = lireCsv(String.fromCharCode(0xfeff) + 'téléphone;nom\r\n"0701020304";"Koné; Awa"\r\n0506070809;\r\n');
    expect(r.numeros).toEqual([
      { telephone: "0701020304", nom: "Koné; Awa" },
      { telephone: "0506070809", nom: null },
    ]);
  });

  it("ouvert à tous : le numéro est toujours lu comme ivoirien", () => {
    expect(identifiantQr("07 01 02 03 04", "OUVERT")).toBe("0701020304");
    expect(identifiantQr("+225 07 01 02 03 04", "OUVERT")).toBe("0701020304");
    // Un faux indicatif ne donne pas un nouvel identifiant (donc pas une nouvelle voix).
    expect(identifiantQr("+33 6 12 34 56 78", "OUVERT")).toBeNull();
  });

  it("restreint : un numéro étranger de la liste peut voter", () => {
    expect(identifiantQr("+33 6 12 34 56 78", "RESTREINT")).toBe("+33612345678");
    expect(identifiantQr("0701020304", "RESTREINT")).toBe("0701020304");
  });

  it("affiche un numéro ivoirien avec son indicatif", () => {
    expect(telephoneLisible("0701020304")).toBe("+225 07 01 02 03 04");
    expect(telephoneLisible("+33612345678")).toBe("+33612345678");
  });
});
