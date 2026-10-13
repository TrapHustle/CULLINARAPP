import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Comptes contre une vraie base. Sautés par défaut :
 *
 *   RUN_DB_TESTS=1 DATABASE_URL=postgresql://…/base_de_test npx vitest run src/lib/comptes.db.test.ts
 *
 * Tout ce qui est créé ici est supprimé à la fin.
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const SUFFIXE = `${Date.now()}@essai-comptes.test`;

describe.skipIf(!RUN)("comptes des organisations", () => {
  let prisma: typeof import("./prisma").prisma;
  let comptes: typeof import("./comptes");

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    comptes = await import("./comptes");
  });

  afterAll(async () => {
    const utilisateurs = await prisma.utilisateur.findMany({ where: { email: { endsWith: SUFFIXE } } });
    await prisma.organisation.deleteMany({ where: { id: { in: utilisateurs.map((u) => u.organisationId) } } });
    await prisma.$disconnect();
  });

  it("crée l'organisation et son propriétaire, puis authentifie", async () => {
    const email = `a${SUFFIXE}`;
    const cree = await comptes.creerCompte({ organisation: "Essai A", email, motDePasse: "mot de passe A", confirmation: "mot de passe A" });
    expect(cree.ok).toBe(true);
    if (!cree.ok) return;

    const utilisateur = await prisma.utilisateur.findUniqueOrThrow({ where: { id: cree.utilisateurId }, include: { organisation: true } });
    expect(utilisateur.role).toBe("PROPRIETAIRE");
    expect(utilisateur.organisation.nom).toBe("Essai A");
    expect(utilisateur.motDePasseHash).not.toContain("mot de passe A");

    const connecte = await comptes.authentifier({ email, motDePasse: "mot de passe A" });
    expect(connecte).toEqual({ ok: true, utilisateurId: cree.utilisateurId, organisationId: cree.organisationId });
  });

  it("refuse une deuxième inscription avec la même adresse", async () => {
    const email = `b${SUFFIXE}`;
    await comptes.creerCompte({ organisation: "Essai B", email, motDePasse: "mot de passe B", confirmation: "mot de passe B" });
    const doublon = await comptes.creerCompte({ organisation: "Autre", email, motDePasse: "mot de passe C", confirmation: "mot de passe C" });
    expect(doublon.ok).toBe(false);
    expect(await prisma.organisation.count({ where: { nom: "Autre" } })).toBe(0);
  });

  it("donne le même refus pour un mauvais mot de passe et une adresse inconnue", async () => {
    const email = `c${SUFFIXE}`;
    await comptes.creerCompte({ organisation: "Essai C", email, motDePasse: "mot de passe C", confirmation: "mot de passe C" });
    const mauvais = await comptes.authentifier({ email, motDePasse: "faux faux faux" });
    const inconnu = await comptes.authentifier({ email: `inconnu${SUFFIXE}`, motDePasse: "faux faux faux" });
    expect(mauvais).toEqual(inconnu);
    expect(mauvais.ok).toBe(false);
  });
});
