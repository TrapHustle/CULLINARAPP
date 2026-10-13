import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Événements et sélections contre une vraie base. Sautés par défaut :
 *
 *   RUN_DB_TESTS=1 DATABASE_URL=postgresql://…/base_de_test npx vitest run src/lib/evenements.db.test.ts
 *
 * Tout ce qui est créé ici est supprimé à la fin.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const vide = { libelle: "", lieu: null, debut: null, fin: null, nbQualifies: 0 };

describe.skipIf(!RUN)("événements et sélections", () => {
  let prisma: typeof import("./prisma").prisma;
  let ev: typeof import("./evenements");
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    ev = await import("./evenements");
    orgA = (await prisma.organisation.create({ data: { nom: "Essai événements A" } })).id;
    orgB = (await prisma.organisation.create({ data: { nom: "Essai événements B" } })).id;
  });

  afterAll(async () => {
    await prisma.organisation.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  it("numérote les sélections dans l'ordre et donne des liens uniques", async () => {
    const e = await ev.creerEvenement(orgA, { nom: "Concours", edition: 1, sousTitre: null, date: null });
    const s1 = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Finale" });
    const s2 = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Finale" });
    expect(s1.ok && s2.ok).toBe(true);

    const liste = await ev.listerSelections(orgA, e.id);
    expect(liste.map((s) => s.rang)).toEqual([1, 2]);
    expect(liste[0].slug).not.toBe(liste[1].slug);
  });

  it("échange deux sélections quand on en déplace une", async () => {
    const e = await ev.creerEvenement(orgA, { nom: "Ordre", edition: null, sousTitre: null, date: null });
    await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Une" });
    await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Deux" });
    const [une] = await ev.listerSelections(orgA, e.id);

    await ev.deplacerSelection(orgA, une.id, "bas");
    expect((await ev.listerSelections(orgA, e.id)).map((s) => s.libelle)).toEqual(["Deux", "Une"]);

    // Déplacer la dernière vers le bas ne fait rien.
    await ev.deplacerSelection(orgA, une.id, "bas");
    expect((await ev.listerSelections(orgA, e.id)).map((s) => s.libelle)).toEqual(["Deux", "Une"]);
  });

  it("ne laisse jamais une organisation toucher aux événements d'une autre", async () => {
    const e = await ev.creerEvenement(orgA, { nom: "Privé", edition: null, sousTitre: null, date: null });
    const s = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Une" });
    if (!s.ok) throw new Error("création refusée");

    expect(await ev.evenementDeLOrganisation(orgB, e.id)).toBeNull();
    expect(await ev.selectionDeLOrganisation(orgB, s.valeur.id)).toBeNull();
    expect(await ev.listerSelections(orgB, e.id)).toEqual([]);
    expect((await ev.listerEvenements(orgB)).some((x) => x.id === e.id)).toBe(false);

    expect((await ev.modifierEvenement(orgB, e.id, { nom: "Piraté", edition: null, sousTitre: null, date: null })).ok).toBe(false);
    expect((await ev.creerSelection(orgB, e.id, { ...vide, libelle: "Intruse" })).ok).toBe(false);
    expect((await ev.modifierSelection(orgB, s.valeur.id, { ...vide, libelle: "Piraté" })).ok).toBe(false);
    expect((await ev.supprimerSelection(orgB, s.valeur.id)).ok).toBe(false);
    expect((await ev.supprimerEvenement(orgB, e.id)).ok).toBe(false);

    const intact = await prisma.evenement.findUniqueOrThrow({ where: { id: e.id }, include: { selections: true } });
    expect(intact.nom).toBe("Privé");
    expect(intact.selections.map((x) => x.libelle)).toEqual(["Une"]);
  });

  it("refuse de supprimer une sélection déjà ouverte", async () => {
    const e = await ev.creerEvenement(orgA, { nom: "Ouverte", edition: null, sousTitre: null, date: null });
    const s = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Une" });
    if (!s.ok) throw new Error("création refusée");
    await prisma.selection.update({ where: { id: s.valeur.id }, data: { etat: "OUVERTE" } });

    expect((await ev.supprimerSelection(orgA, s.valeur.id)).ok).toBe(false);
  });

  it("refuse de supprimer un événement qui a reçu des votes", async () => {
    const e = await ev.creerEvenement(orgA, { nom: "Voté", edition: null, sousTitre: null, date: null });
    const s = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Une" });
    if (!s.ok) throw new Error("création refusée");
    const candidat = await prisma.candidat.create({ data: { organisationId: orgA, nom: "Essai" } });
    const participation = await prisma.participation.create({ data: { selectionId: s.valeur.id, candidatId: candidat.id } });
    const type = await prisma.typeVote.create({ data: { selectionId: s.valeur.id, libelle: "En ligne", canal: "EN_LIGNE" } });
    await prisma.suffrage.create({
      data: { id: `essai-${Date.now()}`, participationId: participation.id, typeVoteId: type.id, origine: "IMPORT" },
    });

    expect((await ev.supprimerEvenement(orgA, e.id)).ok).toBe(false);
    expect(await prisma.evenement.count({ where: { id: e.id } })).toBe(1);

    // Nettoyage : les votes bloquent la suppression en cascade, on les retire d'abord.
    await prisma.suffrage.deleteMany({ where: { participationId: participation.id } });
    await prisma.participation.delete({ where: { id: participation.id } });
    await prisma.candidat.delete({ where: { id: candidat.id } });
  });
});
