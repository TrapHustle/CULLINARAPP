import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Parcours complet d'un retrait, contre une vraie base.
 *
 * Ces contrôles touchent la base pointée par `DATABASE_URL` : ils sont donc
 * sautés par défaut et ne tournent que sur demande explicite.
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/withdrawal-flow.db.test.ts
 *
 * Seules les sessions sont simulées — le reste (calcul du solde, écriture,
 * traitement côté administration) passe par le vrai code et le vrai SQL. Tout
 * ce qui est créé ici est supprimé à la fin, y compris en cas d'échec.
 */

const RUN = process.env.RUN_DB_TESTS === "1";

/** Session ouverte à la fois pour l'organisateur et pour l'administration. */
vi.mock("./session", () => ({
  getSession: async () => ({ orga: true, loggedIn: true, save: async () => {} }),
}));

// `revalidatePath` n'a pas de sens hors d'une requête Next.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const MARKER = "ESSAI-RETRAIT";

describe.skipIf(!RUN)("parcours d'un retrait", () => {
  let prisma: typeof import("./prisma").prisma;
  let actions: typeof import("./withdrawal-actions");
  const paymentIds: string[] = [];

  beforeAll(async () => {
    const { config } = await import("dotenv");
    config({ quiet: true });
    // Aucun mail pendant les tests : on vérifie le parcours, pas l'envoi.
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    prisma = (await import("./prisma")).prisma;
    actions = await import("./withdrawal-actions");

    // Recette de départ : 1 000 000 FCFA confirmés, donc 900 000 pour
    // l'organisateur après la part de 10 % d'Inovyx Tech.
    for (let i = 0; i < 2; i += 1) {
      const row = await prisma.publicVotePayment.create({
        data: {
          reference: `${MARKER}-${Date.now()}-${i}`,
          candidateName: MARKER,
          votes: 2500,
          unitPrice: 200,
          amount: 500_000,
          method: "WAVE",
          status: "CONFIRMED",
          simulated: false,
        },
      });
      paymentIds.push(row.id);
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.withdrawalRequest.deleteMany({ where: { note: { contains: MARKER } } });
    await prisma.publicVotePayment.deleteMany({ where: { id: { in: paymentIds } } });
  });

  it("part d'un solde égal à la part de l'organisateur", async () => {
    const balance = await actions.currentBalance();
    expect(balance.organiser).toBe(900_000);
    expect(balance.pending).toBe(0);
    expect(balance.available).toBe(900_000);
  });

  it("refuse un montant au-dessus du solde", async () => {
    const result = await actions.requestWithdrawalAction({
      amount: "900001",
      method: "WAVE",
      phone: "0707123456",
      countryCode: "CI",
      note: MARKER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("900 000");
  });

  it("refuse la carte bancaire", async () => {
    const result = await actions.requestWithdrawalAction({
      amount: "10000",
      method: "CARD",
      phone: "0707123456",
      countryCode: "CI",
      note: MARKER,
    });
    expect(result.ok).toBe(false);
  });

  it("refuse un pays hors mobile money", async () => {
    const result = await actions.requestWithdrawalAction({
      amount: "10000",
      method: "WAVE",
      phone: "612345678",
      countryCode: "FR",
      note: MARKER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("France");
  });

  it("refuse un numéro incomplet", async () => {
    const result = await actions.requestWithdrawalAction({
      amount: "10000",
      method: "WAVE",
      phone: "0707",
      countryCode: "CI",
      note: MARKER,
    });
    expect(result.ok).toBe(false);
  });

  it("enregistre la demande et retire la somme du disponible", async () => {
    const result = await actions.requestWithdrawalAction({
      amount: "250 000",
      method: "WAVE",
      phone: "07 07 12 34 56",
      countryCode: "CI",
      note: `${MARKER} première demande`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.amount).toBe(250_000);
    expect(result.available).toBe(650_000);
    // Aucun compte SMTP : la demande est enregistrée sans alerte, pas perdue.
    expect(result.notified).toBe(false);

    const balance = await actions.currentBalance();
    expect(balance.pending).toBe(250_000);
    expect(balance.available).toBe(650_000);
  });

  it("n'accepte pas une deuxième demande tant que la première attend", async () => {
    const result = await actions.requestWithdrawalAction({
      amount: "1000",
      method: "MTN",
      phone: "0707123456",
      countryCode: "CI",
      note: MARKER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("déjà en attente");
  });

  it("montre la demande à traiter côté administration, numéro complet", async () => {
    const overview = await actions.withdrawalOverview();
    const waiting = overview.waiting.find((row) => row.note?.includes(MARKER));
    expect(waiting).toBeDefined();
    expect(waiting?.amount).toBe(250_000);
    expect(waiting?.phone).toBe("0707123456");
    expect(waiting?.notified).toBe(false);
  });

  it("marque le reversement comme fait et bascule le solde", async () => {
    const overview = await actions.withdrawalOverview();
    const waiting = overview.waiting.find((row) => row.note?.includes(MARKER));
    const form = new FormData();
    form.set("id", waiting!.id);
    form.set("adminNote", `${MARKER} virement Wave`);
    await actions.markWithdrawalPaidAction(form);

    const balance = await actions.currentBalance();
    expect(balance.paid).toBe(250_000);
    expect(balance.pending).toBe(0);
    expect(balance.available).toBe(650_000);
  });

  it("ne rouvre pas une demande déjà close", async () => {
    const after = await actions.withdrawalOverview();
    const settled = after.settled.find((row) => row.note?.includes(MARKER));
    expect(settled?.status).toBe("PAID");

    const form = new FormData();
    form.set("id", settled!.id);
    await actions.rejectWithdrawalAction(form);

    const again = await actions.withdrawalOverview();
    expect(again.settled.find((row) => row.id === settled!.id)?.status).toBe("PAID");
  });

  it("autorise une nouvelle demande une fois la première traitée", async () => {
    const result = await actions.requestWithdrawalAction({
      amount: "650000",
      method: "ORANGE_MONEY",
      phone: "0707123456",
      countryCode: "CI",
      note: `${MARKER} deuxième demande`,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.available).toBe(0);
  });

  it("refuse avec un motif, et rend la somme au solde", async () => {
    const overview = await actions.withdrawalOverview();
    const waiting = overview.waiting.find((row) => row.note?.includes("deuxième"));
    const form = new FormData();
    form.set("id", waiting!.id);
    form.set("adminNote", `${MARKER} numéro erroné`);
    await actions.rejectWithdrawalAction(form);

    const balance = await actions.currentBalance();
    expect(balance.pending).toBe(0);
    expect(balance.available).toBe(650_000);

    const after = await actions.withdrawalOverview();
    const rejected = after.settled.find((row) => row.id === waiting!.id);
    expect(rejected?.status).toBe("REJECTED");
    expect(rejected?.adminNote).toContain("numéro erroné");
  });

  it("ne laisse jamais un solde négatif", async () => {
    const balance = await actions.currentBalance();
    expect(balance.available).toBeGreaterThanOrEqual(0);
  });
});
