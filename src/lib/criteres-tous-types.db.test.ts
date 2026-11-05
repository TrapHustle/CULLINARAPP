import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Critères sur tous les types de vote, contre une vraie base. Sauté par défaut :
 *
 *   RUN_DB_TESTS=1 DATABASE_URL=postgresql://…/base_de_test npx vitest run src/lib/criteres-tous-types.db.test.ts
 *
 * Tout ce qui est créé ici est supprimé à la fin.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const vide = { lieu: null, debut: null, fin: null };

describe.skipIf(!RUN)("critères sur tous les types de vote", () => {
  let prisma: typeof import("./prisma").prisma;
  let ev: typeof import("./evenements");
  let grille: typeof import("./grille");
  let cand: typeof import("./candidats");
  let pil: typeof import("./pilotage");
  let qr: typeof import("./vote-qr");
  let pub: typeof import("./vote-public-saas");
  let res: typeof import("./resultats-saas");

  let org: string;
  let s1: string;
  let slug: string;
  let gratuit: { id: string; lien: string };
  let jury: { id: string; criteres: { id: string }[] };
  let enLigne: { id: string; criteres: { id: string; bareme: number }[] };
  const p: Record<string, string> = {};

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    ev = await import("./evenements");
    grille = await import("./grille");
    cand = await import("./candidats");
    pil = await import("./pilotage");
    qr = await import("./vote-qr");
    pub = await import("./vote-public-saas");
    res = await import("./resultats-saas");
    org = (await prisma.organisation.create({ data: { nom: "Essai critères" } })).id;
  });

  afterAll(async () => {
    const dans = { selection: { evenement: { organisationId: org } } };
    await prisma.valeur.deleteMany({ where: { suffrage: { participation: dans } } });
    await prisma.suffrage.deleteMany({ where: { participation: dans } });
    await prisma.paiement.deleteMany({ where: { organisationId: org } });
    await prisma.votant.deleteMany({ where: dans });
    await prisma.participation.deleteMany({ where: dans });
    await prisma.organisation.delete({ where: { id: org } });
    await prisma.$disconnect();
  });

  it("applique les critères du jury à tous les types sauf le vote en ligne payant", async () => {
    const e = await ev.creerEvenement(org, { nom: "Gala critères", edition: 1, sousTitre: null, date: null });
    const r = await ev.creerSelection(org, e.id, { ...vide, libelle: "Finale", nbQualifies: 1 });
    if (!r.ok) throw new Error("sélection");
    s1 = r.valeur.id;
    const niveau = { kind: "selection" as const, id: s1 };

    // Jury 40, salle 10, en ligne 30, gratuit 20.
    const [j, salle] = await grille.lireGrille(org, niveau);
    const r1 = await grille.modifierType(org, niveau, salle.id, {
      libelle: salle.libelle,
      canal: "SALLE",
      actif: true,
      avecCriteres: false,
      acces: "OUVERT",
      part: 10,
    });
    expect(r1.ok).toBe(true);
    const r2 = await grille.ajouterType(org, niveau, {
      libelle: "Gratuit",
      canal: "GRATUIT",
      actif: true,
      avecCriteres: false,
      acces: "OUVERT",
      part: 20,
    });
    expect(r2.ok).toBe(true);
    expect((await grille.ajouterCritere(org, niveau, j.id, { libelle: "Originalité", bareme: 5 })).ok).toBe(true);

    const fait = await grille.appliquerCriteresATous(org, niveau, j.id);
    expect(fait).toEqual({ ok: true, valeur: { appliques: 2, ignores: [] } });

    const types = await grille.lireGrille(org, niveau);
    const attendu = [
      ["Goût", 20],
      ["Présentation", 10],
      ["Originalité", 5],
    ];
    for (const t of types.filter((t) => t.canal !== "EN_LIGNE")) {
      expect(t.avecCriteres).toBe(true);
      expect(t.criteres.map((c) => [c.libelle, c.bareme])).toEqual(attendu);
    }
    const payant = types.find((t) => t.canal === "EN_LIGNE")!;
    expect([payant.avecCriteres, payant.criteres]).toEqual([false, []]);

    // Le vote payant noté sur critères reste possible, réglé à la main.
    const r3 = await grille.modifierType(org, niveau, payant.id, {
      libelle: payant.libelle,
      canal: "EN_LIGNE",
      actif: true,
      avecCriteres: true,
      acces: "OUVERT",
      part: payant.part,
    });
    expect(r3.ok).toBe(true);
    for (const [libelle, bareme] of attendu) {
      expect((await grille.ajouterCritere(org, niveau, payant.id, { libelle: libelle as string, bareme: bareme as number })).ok).toBe(true);
    }
    const relus = await grille.lireGrille(org, niveau);
    jury = relus.find((t) => t.id === j.id)!;
    enLigne = relus.find((t) => t.canal === "EN_LIGNE")!;
    const g = await prisma.typeVote.findFirstOrThrow({ where: { selectionId: s1, canal: "GRATUIT" } });
    gratuit = { id: g.id, lien: g.lien };

    // Une autre organisation n'y touche pas.
    const autre = (await prisma.organisation.create({ data: { nom: "Essai critères B" } })).id;
    expect((await grille.appliquerCriteresATous(autre, niveau, j.id)).ok).toBe(false);
    await prisma.organisation.delete({ where: { id: autre } });
  });

  it("ouvre la sélection avec des candidats", async () => {
    for (const nom of ["Awa", "Koffi"]) {
      expect((await cand.creerEtInscrire(org, s1, { nom, ville: null }, null)).ok).toBe(true);
    }
    for (const x of await cand.listerParticipations(org, s1)) p[x.candidat.nom] = x.id;
    const reglages = { prixVote: 200, voixGratuite: false, compteursVisibles: true, modeEnLigne: "A" as const, moyensPaiement: ["WAVE" as const] };
    expect((await grille.reglerEnLigne(org, s1, reglages, [])).ok).toBe(true);
    expect((await pil.ouvrir(org, s1)).ok).toBe(true);
    slug = (await prisma.selection.findUniqueOrThrow({ where: { id: s1 } })).slug;
  });

  it("gratuit avec critères : une note par candidat et par numéro", async () => {
    const [gout, pres, orig] = jury.criteres.map((c) => c.id);
    // Les critères du type gratuit sont des copies : on note avec les siens.
    const t = await prisma.typeVote.findUniqueOrThrow({ where: { id: gratuit.id }, include: { criteres: { orderBy: { ordre: "asc" } } } });
    const [g, pr, o] = t.criteres.map((c) => c.id);
    expect([g, pr, o]).not.toEqual([gout, pres, orig]);

    expect(await qr.verifierNumeroQr(gratuit.lien, "0701020304")).toEqual({ ok: true, notes: [] });
    expect(await qr.noterQr(gratuit.lien, p.Awa, "0701020304", { [g]: 18, [pr]: 8, [o]: 4 })).toEqual({ ok: true, candidat: "Awa" });
    expect((await qr.noterQr(gratuit.lien, p.Awa, "0701020304", { [g]: 1, [pr]: 1, [o]: 1 })).ok).toBe(false);
    expect((await qr.noterQr(gratuit.lien, p.Koffi, "0701020304", { [g]: 10, [pr]: 5, [o]: 9 })).ok).toBe(false); // 9 > 5
    expect(await qr.noterQr(gratuit.lien, p.Koffi, "0701020304", { [g]: 10, [pr]: 5, [o]: 0 })).toEqual({ ok: true, candidat: "Koffi" });
    expect(await qr.verifierNumeroQr(gratuit.lien, "0701020304")).toEqual({ ok: true, notes: expect.arrayContaining([p.Awa, p.Koffi]) });
    expect((await qr.voterQr(gratuit.lien, p.Awa, "0506070809")).ok).toBe(false);

    const notes = await prisma.suffrage.findMany({ where: { typeVoteId: gratuit.id }, include: { valeurs: true } });
    expect(notes.map((n) => n.origine)).toEqual(["GRATUIT", "GRATUIT"]);
    expect(notes.every((n) => n.valeurs.length === 3)).toBe(true);
  });

  it("en ligne payant avec critères : la page publique propose les critères, un paiement achète une note", async () => {
    const page = await pub.lirePagePublique(slug);
    expect(page?.criteres?.map((c) => c.libelle)).toEqual(["Goût", "Présentation", "Originalité"]);

    const [g, pr, o] = enLigne.criteres.map((c) => c.id);
    const base = { slug, participationId: p.Awa, voix: 7, moyen: "WAVE", telephone: "0701020304" };
    expect((await pub.demanderPaiement(base)).ok).toBe(false);
    expect((await pub.demanderPaiement({ ...base, valeurs: { [g]: 21, [pr]: 5, [o]: 5 } })).ok).toBe(false);

    const r = await pub.demanderPaiement({ ...base, valeurs: { [g]: 15, [pr]: 9, [o]: 3 } });
    if (!r.ok || r.type !== "confirme") throw new Error("paiement simulé attendu");
    expect(r.recu).toMatchObject({ voix: 1, montant: 200, note: true, simule: true });

    const s = await prisma.suffrage.findFirstOrThrow({ where: { typeVoteId: enLigne.id }, include: { valeurs: true, paiement: true } });
    expect(s.poids).toBe(1);
    expect(s.valeurs.map((v) => v.valeur).sort((a, b) => a - b)).toEqual([3, 9, 15]);
    expect(s.paiement?.notes).toEqual({ [g]: 15, [pr]: 9, [o]: 3 });
  });

  it("un paiement réel confirmé plus tard crée la note qu'il gardait", async () => {
    const [g, pr, o] = enLigne.criteres.map((c) => c.id);
    const attente = await prisma.paiement.create({
      data: {
        organisationId: org,
        selectionId: s1,
        participationId: p.Koffi,
        reference: `DV-T${Date.now().toString(36).toUpperCase()}`,
        candidatNom: "Koffi",
        voix: 1,
        prixUnitaire: 200,
        montant: 200,
        moyen: "WAVE",
        telephone: "+2250701020304",
        notes: { [g]: 20, [pr]: 10, [o]: 5 },
      },
    });
    expect(await pub.confirmerPaiement(attente.id, "TX-1")).toBe(true);
    expect(await pub.confirmerPaiement(attente.id, "TX-1")).toBe(false);
    const s = await prisma.suffrage.findUniqueOrThrow({ where: { paiementId: attente.id }, include: { valeurs: true } });
    expect(s.valeurs.reduce((a, v) => a + v.valeur, 0)).toBe(35);
    expect((await pub.etatPaiement(attente.reference))?.note).toBe(true);
  });

  it("classe le vote en ligne noté sur la moyenne des notes, pas sur leur nombre", async () => {
    const officiel = await res.calculerResultats(s1);
    const note = (nom: string) =>
      officiel.classement.find((l) => l.candidat.nom === nom)?.candidat.types.find((t) => t.typeVoteId === enLigne.id);
    // Seul le paiement réel compte : Koffi 35/35 = 100. Awa n'a qu'une note simulée.
    expect(note("Koffi")).toMatchObject({ note: 100, volume: 1 });
    expect(note("Awa")?.note).toBeNull();

    const essai = await res.calculerResultats(s1, { inclureSimules: true });
    const awa = essai.classement.find((l) => l.candidat.nom === "Awa")?.candidat.types.find((t) => t.typeVoteId === enLigne.id);
    expect(awa?.note).toBeCloseTo((27 / 35) * 100, 5);
  });
});
