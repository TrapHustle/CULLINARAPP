import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Vote par QR code contre une vraie base. Sauté par défaut :
 *
 *   RUN_DB_TESTS=1 DATABASE_URL=postgresql://…/base_de_test npx vitest run src/lib/vote-qr.db.test.ts
 *
 * Tout ce qui est créé ici est supprimé à la fin.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const vide = { lieu: null, debut: null, fin: null };

describe.skipIf(!RUN)("vote par QR code", () => {
  let prisma: typeof import("./prisma").prisma;
  let ev: typeof import("./evenements");
  let grille: typeof import("./grille");
  let cand: typeof import("./candidats");
  let pil: typeof import("./pilotage");
  let qr: typeof import("./vote-qr");
  let res: typeof import("./resultats-saas");

  let orgA: string;
  let orgB: string;
  let s1: string;
  let invites: { id: string; lien: string };
  let publicQr: { id: string; lien: string };
  const p: Record<string, string> = {};

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    ev = await import("./evenements");
    grille = await import("./grille");
    cand = await import("./candidats");
    pil = await import("./pilotage");
    qr = await import("./vote-qr");
    res = await import("./resultats-saas");
    orgA = (await prisma.organisation.create({ data: { nom: "Essai QR A" } })).id;
    orgB = (await prisma.organisation.create({ data: { nom: "Essai QR B" } })).id;
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prisma.suffrage.deleteMany({ where: { participation: { selection: { evenement: { organisationId: org } } } } });
      await prisma.votant.deleteMany({ where: { selection: { evenement: { organisationId: org } } } });
      await prisma.participation.deleteMany({ where: { selection: { evenement: { organisationId: org } } } });
      await prisma.organisation.delete({ where: { id: org } });
    }
    await prisma.$disconnect();
  });

  it("ajoute un vote QR restreint et un vote QR ouvert à la grille", async () => {
    const e = await ev.creerEvenement(orgA, { nom: "Gala QR", edition: 1, sousTitre: null, date: null });
    const r = await ev.creerSelection(orgA, e.id, { ...vide, libelle: "Soirée", nbQualifies: 1 });
    if (!r.ok) throw new Error("sélection");
    s1 = r.valeur.id;
    const niveau = { kind: "selection" as const, id: s1 };

    // Grille : jury 40, salle 30, en ligne 30 → jury 40, salle 10, en ligne 10, invités 30, public 10.
    const [, salle, enLigne] = await grille.lireGrille(orgA, niveau);
    const garder = (t: typeof salle, part: number) => ({ libelle: t.libelle, canal: t.canal as "SALLE", avecCriteres: t.avecCriteres, acces: "OUVERT" as const, part });
    expect((await grille.modifierType(orgA, niveau, salle.id, garder(salle, 10))).ok).toBe(true);
    expect((await grille.modifierType(orgA, niveau, enLigne.id, { ...garder(enLigne, 10), canal: "EN_LIGNE" as never })).ok).toBe(true);
    expect((await grille.ajouterType(orgA, niveau, { libelle: "Invités", canal: "QR", avecCriteres: false, acces: "RESTREINT", part: 30 })).ok).toBe(true);
    expect((await grille.ajouterType(orgA, niveau, { libelle: "Public", canal: "QR", avecCriteres: false, acces: "OUVERT", part: 10 })).ok).toBe(true);

    const types = await prisma.typeVote.findMany({ where: { selectionId: s1 } });
    const i = types.find((t) => t.libelle === "Invités")!;
    const o = types.find((t) => t.libelle === "Public")!;
    expect([i.canal, i.acces, i.avecCriteres]).toEqual(["QR", "RESTREINT", false]);
    expect(i.lien).not.toBe(o.lien);
    invites = { id: i.id, lien: i.lien };
    publicQr = { id: o.id, lien: o.lien };

    for (const nom of ["Awa", "Koffi"]) {
      expect((await cand.creerEtInscrire(orgA, s1, { nom, ville: null }, null)).ok).toBe(true);
    }
    for (const x of await cand.listerParticipations(orgA, s1)) p[x.candidat.nom] = x.id;
  });

  it("tient la liste des numéros autorisés, sans toucher une autre organisation", async () => {
    const r = await qr.ajouterNumeros(orgA, invites.id, [
      { telephone: "0701020304", nom: "Awa Koné" },
      { telephone: "0506070809", nom: null },
      { telephone: "+33612345678", nom: "Diaspora" },
    ], "SAISIE");
    expect(r).toEqual({ ok: true, valeur: { ajoutes: 3, dejaPresents: 0 } });
    const encore = await qr.ajouterNumeros(orgA, invites.id, [{ telephone: "0701020304", nom: null }], "invites.xlsx");
    expect(encore).toEqual({ ok: true, valeur: { ajoutes: 0, dejaPresents: 1 } });

    expect((await qr.ajouterNumeros(orgA, publicQr.id, [{ telephone: "0701020304", nom: null }], "SAISIE")).ok).toBe(false);
    expect((await qr.ajouterNumeros(orgB, invites.id, [{ telephone: "0102030405", nom: null }], "SAISIE")).ok).toBe(false);
    expect(await qr.lireNumeros(orgB, invites.id)).toBeNull();
    expect((await qr.basculerQr(orgB, invites.id, true)).ok).toBe(false);
  });

  it("refuse de voter tant que la sélection ou le lien sont fermés", async () => {
    expect((await qr.verifierNumeroQr(invites.lien, "0701020304")).ok).toBe(false);
    const reglages = { prixVote: 200, voixGratuite: false, compteursVisibles: true, modeEnLigne: "A" as const, moyensPaiement: ["WAVE" as const] };
    expect((await grille.reglerEnLigne(orgA, s1, reglages, [])).ok).toBe(true);
    const jury = (await grille.lireGrille(orgA, { kind: "selection", id: s1 }))[0];
    expect(jury.criteres.length).toBeGreaterThan(0);
    expect((await pil.ouvrir(orgA, s1)).ok).toBe(true);
    // Sélection ouverte, mais lien encore fermé.
    expect(await qr.verifierNumeroQr(invites.lien, "0701020304")).toEqual({ ok: false, erreur: "Le vote est fermé." });
    expect((await qr.basculerQr(orgA, invites.id, true)).ok).toBe(true);
    expect((await qr.basculerQr(orgA, publicQr.id, true)).ok).toBe(true);
  });

  it("vote restreint : numéro inconnu refusé, une seule voix par numéro, même en double envoi", async () => {
    expect((await qr.verifierNumeroQr(invites.lien, "0799999999")).ok).toBe(false);
    expect((await qr.voterQr(invites.lien, p.Awa, "0799999999")).ok).toBe(false);
    expect((await qr.verifierNumeroQr(invites.lien, "12")).ok).toBe(false);

    expect(await qr.verifierNumeroQr(invites.lien, "+225 07 01 02 03 04")).toEqual({ ok: true });
    expect(await qr.voterQr(invites.lien, p.Awa, "07 01 02 03 04")).toEqual({ ok: true, candidat: "Awa" });
    expect((await qr.verifierNumeroQr(invites.lien, "0701020304")).ok).toBe(false);
    expect((await qr.voterQr(invites.lien, p.Koffi, "0701020304")).ok).toBe(false);

    const doubles = await Promise.all([qr.voterQr(invites.lien, p.Koffi, "0506070809"), qr.voterQr(invites.lien, p.Koffi, "0506070809")]);
    expect(doubles.filter((r) => r.ok)).toHaveLength(1);
    // Numéro étranger de la liste.
    expect((await qr.voterQr(invites.lien, p.Awa, "+33 6 12 34 56 78")).ok).toBe(true);

    const suffrages = await prisma.suffrage.findMany({ where: { typeVoteId: invites.id } });
    expect(suffrages.map((s) => [s.origine, s.poids])).toEqual([["QR", 1], ["QR", 1], ["QR", 1]]);
  });

  it("vote ouvert : tout numéro ivoirien vote une fois, indépendamment des autres votes", async () => {
    // A déjà voté au vote des invités : il peut voter une fois au vote du public.
    expect((await qr.voterQr(publicQr.lien, p.Koffi, "0701020304")).ok).toBe(true);
    expect((await qr.voterQr(publicQr.lien, p.Koffi, "0701020304")).ok).toBe(false);
    expect((await qr.voterQr(publicQr.lien, p.Koffi, "+33 6 12 34 56 78")).ok).toBe(false);
    expect((await qr.voterQr(publicQr.lien, p.Koffi, "0102030405")).ok).toBe(true);
    // Un candidat d'une autre sélection n'est pas accepté.
    expect((await qr.voterQr(publicQr.lien, "inexistant", "0102030406")).ok).toBe(false);
  });

  it("montre qui a voté, garde les numéros qui ont voté, compte les voix en part relative", async () => {
    const numeros = (await qr.lireNumeros(orgA, invites.id))!;
    const statut = Object.fromEntries(numeros.map((n) => [n.telephone, n.voteLe !== null]));
    expect(statut).toEqual({ "0701020304": true, "0506070809": true, "+33612345678": true });
    const awa = numeros.find((n) => n.telephone === "0701020304")!;
    expect((await qr.retirerNumero(orgA, invites.id, awa.id)).ok).toBe(false);

    expect((await qr.ajouterNumeros(orgA, invites.id, [{ telephone: "0788990011", nom: null }], "SAISIE")).ok).toBe(true);
    const nouveau = (await qr.lireNumeros(orgA, invites.id))!.find((n) => n.telephone === "0788990011")!;
    expect((await qr.retirerNumero(orgA, invites.id, nouveau.id)).ok).toBe(true);

    const liens = (await qr.lireLiens(orgA, s1))!;
    const i = liens.types.find((t) => t.id === invites.id)!;
    expect([i.autorises, i.votants]).toEqual([3, 3]);

    // Invités : Awa 2 voix, Koffi 1 → 66,67 et 33,33 sur 100.
    const r = await res.calculerResultats(s1);
    const note = (nom: string) => r.classement.find((l) => l.candidat.nom === nom)!.candidat.types.find((t) => t.typeVoteId === invites.id)!;
    expect(note("Awa")).toMatchObject({ volume: 2 });
    expect(note("Awa").note).toBeCloseTo(66.67, 1);
    expect(note("Koffi").note).toBeCloseTo(33.33, 1);
  });

  it("ferme le lien : plus aucune voix", async () => {
    expect((await qr.basculerQr(orgA, publicQr.id, false)).ok).toBe(true);
    expect((await qr.voterQr(publicQr.lien, p.Awa, "0102030499")).ok).toBe(false);
  });
});
