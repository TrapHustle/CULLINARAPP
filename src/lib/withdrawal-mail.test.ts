import { describe, expect, it } from "vitest";
import { withdrawalMail } from "./withdrawal-mail";

const base = {
  eventName: "Talent Traiteur 2026",
  amount: 250_000,
  method: "WAVE" as const,
  phone: "07 07 12 34 56",
  note: null,
  availableBefore: 466_000,
  createdAt: new Date("2026-10-07T14:32:00Z"),
};

describe("withdrawalMail", () => {
  it("annonce le montant et l'événement dès l'objet", () => {
    const mail = withdrawalMail(base);
    expect(mail.subject).toContain("250 000 FCFA");
    expect(mail.subject).toContain("Talent Traiteur 2026");
  });

  it("donne de quoi faire le virement sans ouvrir l'application", () => {
    const { text } = withdrawalMail(base);
    expect(text).toContain("Wave");
    expect(text).toContain("07 07 12 34 56");
    expect(text).toContain("250 000 FCFA");
  });

  it("calcule le solde restant", () => {
    const { text } = withdrawalMail(base);
    expect(text).toContain("Solde après : 216 000 FCFA");
  });

  it("ne descend pas sous zéro si le solde a bougé entre-temps", () => {
    const { text } = withdrawalMail({ ...base, amount: 500_000 });
    expect(text).toContain("Solde après : 0 FCFA");
  });

  it("reprend le message de l'organisateur quand il y en a un", () => {
    const mail = withdrawalMail({ ...base, note: "Avant vendredi si possible." });
    expect(mail.text).toContain("Avant vendredi si possible.");
    expect(mail.html).toContain("Avant vendredi si possible.");
  });

  it("omet le bloc de message quand il n'y en a pas", () => {
    expect(withdrawalMail(base).text).not.toContain("Message de l'organisateur");
  });

  it("échappe le HTML d'un message hostile", () => {
    const mail = withdrawalMail({ ...base, note: '<img src=x onerror="alert(1)">' });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x");
  });

  it("échappe aussi le nom de l'événement", () => {
    const mail = withdrawalMail({ ...base, eventName: 'Gala "2026" & <b>co</b>' });
    expect(mail.html).toContain("&lt;b&gt;co&lt;/b&gt;");
    expect(mail.html).toContain("&amp;");
  });
});
