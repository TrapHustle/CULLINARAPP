import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Un concours entier, du compte à la proclamation, contre une vraie base.
 * Sauté par défaut :
 *
 *   RUN_DB_TESTS=1 DATABASE_URL=postgresql://…/base_de_test npx vitest run src/lib/concours.db.test.ts
 *
 * Tout ce qui est créé ici est supprimé à la fin.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const vide = { lieu: null, debut: null, fin: null };

describe.skipIf(!RUN)("concours de A à Z", () => {
  let prisma: typeof import("./prisma").prisma;
  let ev: typeof import("./evenements");
  let grille: typeof import("./grille");
  let cand: typeof import("./candidats");
  let pil: typeof import("./pilotage");
  let notes: typeof import("./notes");
  let pub: typeof import("./vote-public-saas");
  let res: typeof import("./resultats-saas");
  let rec: typeof import("./recettes");
  let plat: typeof import("./plateforme");

  let orgA: string;
  let orgB: string;
  let evenementId: string;
  let s1: string;
  let s2: string;
  let slug: string;
  const p: Record<string, string> = {};

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    ev = await import("./evenements");
    grille = await import("./grille");
    cand = await import("./candidats");
    pil = await import("./pilotage");
    notes = await import("./notes");
    pub = await import("./vote-public-saas");
    res = await import("./resultats-saas");
    rec = await import("./recettes");
    plat = await import("./plateforme");
    orgA = (await prisma.organisation.create({ data: { nom: "Essai concours A" } })).id;
    orgB = (await prisma.organisation.create({ data: { nom: "Essai concours B" } })).id;
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.suffrage.deleteMany({ where: { participation: { selection: { evenement: { organisationId: org } } } } });
      await prisma.votant.deleteMany({ where: { selection: { evenement: { organisationId: org } } } });
      await prisma.paiement.deleteMany({ where: { organisationId: org } });
      await prisma.demandeRetrait.deleteMany({ where: { organisationId: org } });
      await prisma.archiveSelection.deleteMany({ where: { organisationId: org } });
      await prisma.participation.deleteMany({ where: { selection: { evenement: { organisationId: org } } } });
      await prisma.organisation.delete({ where: { id: org } });
    }
    await prisma.$disconnect();
  });

  it("crée l'événement avec la grille proposée, recopiée dans chaque sélection", async () => {
    const e = await ev.creerEvenement(orgA, { nom: "Talent Essai", edition: 1, sousTitre: null, date: null });
    evenementId = e.id;
    const r1 = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Demi-finale", nbQualifies: 2 });
    const r2 = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Finale", nbQualifies: 1 });
    if (!r1.ok || !r2.ok) throw new Error("sélections");
    s1 = r1.valeur.id;
    s2 = r2.valeur.id;
    slug = (await prisma.selection.findUniqueOrThrow({ where: { id: s1 } })).slug;

    const modele = await grille.lireGrille(orgA, { kind: "evenement", id: e.id });
    const copie = await grille.lireGrille(orgA, { kind: "selection", id: s1 });
    expect(modele.map((t) => [t.libelle, t.part])).toEqual([["Jury", 40], ["Salle", 30], ["Vote en ligne", 30]]);
    expect(copie.map((t) => [t.libelle, t.part, t.criteres.length])).toEqual([
      ["Jury", 40, 2],
      ["Salle", 30, 2],
      ["Vote en ligne", 30, 0],
    ]);
  });

  it("isole les organisations (RG 0.2)", async () => {
    expect(await grille.lireGrille(orgB, { kind: "selection", id: s1 })).toEqual([]);
    expect((await pil.ouvrir(orgB, s1)).ok).toBe(false);
    expect((await cand.inscrire(orgB, s1, [])).ok).toBe(false);
  });

  it("modifie la grille de la sélection sans toucher celle de l'événement (RG 3.3)", async () => {
    const [jury] = await grille.lireGrille(orgA, { kind: "selection", id: s1 });
    expect((await grille.ajouterCritere(orgA, { kind: "selection", id: s1 }, jury.id, { libelle: "Créativité", bareme: 10 })).ok).toBe(true);
    const [juryModele] = await grille.lireGrille(orgA, { kind: "evenement", id: evenementId });
    expect(juryModele.criteres).toHaveLength(2);
    // Retour à la grille de l'événement pour la suite.
    expect((await grille.reprendreGrilleEvenement(orgA, s1)).ok).toBe(true);
  });

  it("refuse d'ouvrir une sélection incomplète, puis l'ouvre", async () => {
    const avant = await pil.lireSelectionPilotage(orgA, s1);
    expect(avant && pil.controlesDe(avant).every((c) => c.ok)).toBe(false);
    expect((await pil.ouvrir(orgA, s1)).ok).toBe(false);

    for (const nom of ["Awa", "Koffi", "Mariam"]) {
      expect((await cand.creerEtInscrire(orgA, s1, { nom, ville: "Bouaké" }, null)).ok).toBe(true);
    }
    for (const x of await cand.listerParticipations(orgA, s1)) p[x.candidat.nom] = x.id;

    const reglages = { prixVote: 200, voixGratuite: true, compteursVisibles: true, modeEnLigne: "A" as const, moyensPaiement: ["WAVE" as const] };
    expect((await grille.reglerEnLigne(orgA, s1, reglages, [])).ok).toBe(true);
    expect((await pil.ouvrir(orgA, s1)).ok).toBe(true);
    // Une fois ouverte, la grille et le mode sont figés (RG 8.7).
    const [jury] = await grille.lireGrille(orgA, { kind: "selection", id: s1 });
    expect((await grille.supprimerType(orgA, { kind: "selection", id: s1 }, jury.id)).ok).toBe(false);
    expect((await grille.reglerEnLigne(orgA, s1, { ...reglages, modeEnLigne: "C" }, [])).ok).toBe(false);
  });

  it("enregistre les fiches du jury et de la salle, sans doublon de juré", async () => {
    const types = await grille.lireGrille(orgA, { kind: "selection", id: s1 });
    const [jury, salle] = types;
    const fiche = (type: (typeof types)[number], notesPar: Record<string, [number, number]>) =>
      Object.entries(notesPar).map(([nom, v]) => ({
        participationId: p[nom],
        valeurs: new Map(type.criteres.map((c, i) => [c.id, v[i]])),
      }));

    expect((await notes.saisirFiche(orgA, s1, jury.id, 1, fiche(jury, { Awa: [18, 9], Koffi: [14, 7], Mariam: [10, 5] }))).ok).toBe(true);
    expect((await notes.saisirFiche(orgA, s1, jury.id, 2, fiche(jury, { Awa: [17, 8], Koffi: [13, 6], Mariam: [10, 5] }))).ok).toBe(true);
    expect((await notes.saisirFiche(orgA, s1, jury.id, 1, fiche(jury, { Awa: [1, 1] }))).ok).toBe(false);
    // Double envoi simultané de la fiche du juré 3 : une seule est enregistrée.
    const doubles = await Promise.all([
      notes.saisirFiche(orgA, s1, jury.id, 3, fiche(jury, { Awa: [17, 8], Koffi: [13, 6], Mariam: [10, 5] })),
      notes.saisirFiche(orgA, s1, jury.id, 3, fiche(jury, { Awa: [17, 8], Koffi: [13, 6], Mariam: [10, 5] })),
    ]);
    expect(doubles.filter((r) => r.ok)).toHaveLength(1);
    // On l'annule pour garder les calculs attendus plus bas.
    for (const s of await prisma.suffrage.findMany({ where: { jureIndex: 3, typeVoteId: jury.id } })) {
      expect((await notes.annulerSaisie(orgA, s.id)).ok).toBe(true);
    }
    expect((await notes.saisirFiche(orgA, s1, salle.id, 1, fiche(salle, { Awa: [14, 6], Koffi: [17, 8], Mariam: [20, 10] }))).ok).toBe(true);

    // Une saisie erronée s'annule (RG 5.7) et ne compte plus.
    expect((await notes.saisirFiche(orgA, s1, salle.id, 9, fiche(salle, { Awa: [0, 0] }))).ok).toBe(true);
    const erreur = await prisma.suffrage.findFirstOrThrow({ where: { jureIndex: 9, participationId: p.Awa } });
    expect((await notes.annulerSaisie(orgA, erreur.id)).ok).toBe(true);
  });

  it("accepte une voix gratuite par numéro, puis des voix payées", async () => {
    expect((await pub.voterGratuit(slug, p.Koffi, "07 01 02 03 04")).ok).toBe(true);
    expect((await pub.voterGratuit(slug, p.Awa, "0701020304")).ok).toBe(false);

    const simule = await pub.demanderPaiement({ slug, participationId: p.Mariam, voix: 50, moyen: "WAVE", telephone: "0705060708" });
    expect(simule.ok && simule.type === "confirme" && simule.recu.simule).toBe(true);
    expect((await pub.demanderPaiement({ slug, participationId: p.Mariam, voix: 1, moyen: "MTN", telephone: "0705060708" })).ok).toBe(false);

    // Paiement réel confirmé par la passerelle : une seule fois, même confirmé deux fois.
    const reel = await prisma.paiement.create({
      data: {
        organisationId: orgA,
        selectionId: s1,
        participationId: p.Awa,
        reference: `TEST-${Date.now()}`,
        candidatNom: "Awa",
        voix: 10,
        prixUnitaire: 200,
        montant: 2000,
        moyen: "WAVE",
        telephone: "0709090909",
      },
    });
    expect(await pub.confirmerPaiement(reel.id, "TX1")).toBe(true);
    expect(await pub.confirmerPaiement(reel.id, "TX1")).toBe(false);
    expect(await prisma.suffrage.count({ where: { paiementId: reel.id } })).toBe(1);
  });

  it("calcule le classement officiel sur 100, sans les voix simulées (RG 8)", async () => {
    const officiel = await res.calculerResultats(s1);
    const noms = officiel.classement.map((l) => l.candidat.nom);
    expect(noms).toEqual(["Awa", "Koffi", "Mariam"]);
    const awa = officiel.classement[0];
    // Jury 26/30, salle 20/30, en ligne 10 voix sur 11 (mode A).
    const attendu = ((26 / 30) * 100 * 40 + (20 / 30) * 100 * 30 + (10 / 11) * 100 * 30) / 100;
    expect(awa.note).toBeCloseTo(attendu, 6);

    const essai = await res.calculerResultats(s1, { inclureSimules: true });
    const mariam = essai.classement.find((l) => l.candidat.nom === "Mariam");
    expect(mariam?.candidat.types.find((t) => t.libelle === "Vote en ligne")?.volume).toBe(50);
  });

  it("clôture : votes refusés, classement figé, qualifiés reportés dans la finale", async () => {
    expect((await pil.cloturer(orgA, s1, [p.Awa, p.Koffi])).ok).toBe(true);
    expect((await pub.voterGratuit(slug, p.Awa, "0102030405")).ok).toBe(false);
    const archive = await prisma.archiveSelection.findFirstOrThrow({ where: { selectionId: s1 } });
    expect((archive.snapshot as { classement: unknown[] }).classement).toHaveLength(3);

    const r = await pil.reporterQualifies(orgA, s1);
    expect(r.ok && r.valeur).toBe(2);
    const finale = await cand.listerParticipations(orgA, s2);
    expect(finale.map((x) => x.candidat.nom).sort()).toEqual(["Awa", "Koffi"]);
    // Les votes ne se cumulent pas (RG 9.4).
    expect(finale.every((x) => x._count.suffrages === 0)).toBe(true);
  });

  it("calcule les recettes, la part reversée et traite un retrait", async () => {
    const r = await rec.recettesOrganisation(orgA);
    expect(r.brut).toBe(2000);
    expect(r.partOrganisateur).toBe(1800);
    expect(r.simules.nb).toBe(1);

    const trop = await rec.demanderRetrait(orgA, "test", { montant: "5000", moyen: "WAVE", telephone: "0701010101", note: "" });
    expect(trop.ok).toBe(false);
    // Double clic : deux demandes simultanées, une seule passe.
    const deux = await Promise.all([
      rec.demanderRetrait(orgA, "test", { montant: "1000", moyen: "WAVE", telephone: "0701010101", note: "" }),
      rec.demanderRetrait(orgA, "test", { montant: "1000", moyen: "WAVE", telephone: "0701010101", note: "" }),
    ]);
    expect(deux.filter((r) => r.ok)).toHaveLength(1);
    const encore = await rec.demanderRetrait(orgA, "test", { montant: "500", moyen: "WAVE", telephone: "0701010101", note: "" });
    expect(encore.ok).toBe(false);

    const demande = await prisma.demandeRetrait.findFirstOrThrow({ where: { organisationId: orgA, statut: "PENDING" } });
    expect((await plat.traiterRetrait(demande.id, "PAID", "virement fait")).ok).toBe(true);
    expect((await plat.traiterRetrait(demande.id, "REJECTED", "")).ok).toBe(false);
    expect((await rec.recettesOrganisation(orgA)).solde.available).toBe(800);
  });

  it("une organisation suspendue ferme ses pages de vote", async () => {
    expect((await ev.creerSelection(orgA, evenementId, { ...vide, libelle: "Repêchage", nbQualifies: 0 })).ok).toBe(true);
    await prisma.organisation.update({ where: { id: orgA }, data: { actif: false } });
    const page = await pub.lirePagePublique(slug);
    expect(page?.ouvert).toBe(false);
    await prisma.organisation.update({ where: { id: orgA }, data: { actif: true } });
  });
});
