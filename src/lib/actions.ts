"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrCreateSession, prisma, SESSION_ID } from "./prisma";
import { getSession } from "./session";
import { candidateSchema, criterionSchema, loginSchema, tableSchema } from "./validation";

export interface ActionState {
  error?: string;
  success?: string;
}

/** Comparaison à temps constant, pour ne pas exposer la longueur du mot de passe. */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

async function requireAuth() {
  const session = await getSession();
  if (!session.loggedIn) redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Authentification                                                     */
/* ------------------------------------------------------------------ */

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Identifiant et mot de passe sont obligatoires." };
  }

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return { error: "Le compte organisateur n'est pas configuré sur le serveur (.env)." };
  }

  const ok =
    safeEqual(parsed.data.username, expectedUser) &&
    safeEqual(parsed.data.password, expectedPassword);

  if (!ok) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }

  const session = await getSession();
  session.loggedIn = true;
  session.username = parsed.data.username;
  await session.save();

  redirect("/");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Configuration — candidats                                            */
/* ------------------------------------------------------------------ */

export async function createCandidateAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = candidateSchema.safeParse({
    name: formData.get("name"),
    order: formData.get("order") || 0,
    photoUrl: formData.get("photoUrl") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  await prisma.candidate.create({
    data: {
      name: parsed.data.name,
      order: parsed.data.order,
      photoUrl: parsed.data.photoUrl || null,
    },
  });

  revalidatePath("/configuration");
  return { success: `Candidat « ${parsed.data.name} » ajouté.` };
}

export async function deleteCandidateAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  await prisma.candidate.delete({ where: { id } });
  revalidatePath("/configuration");
}

/* ------------------------------------------------------------------ */
/* Configuration — tables                                               */
/* ------------------------------------------------------------------ */

export async function createTableAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = tableSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "LAMBDA",
    expectedJurors: formData.get("expectedJurors") || 1,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  await prisma.votingTable.create({ data: parsed.data });

  revalidatePath("/configuration");
  return { success: `Table « ${parsed.data.name} » ajoutée.` };
}

export async function deleteTableAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  await prisma.votingTable.delete({ where: { id } });
  revalidatePath("/configuration");
}

/* ------------------------------------------------------------------ */
/* Configuration — critères                                             */
/* ------------------------------------------------------------------ */

export async function createCriterionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = criterionSchema.safeParse({
    name: formData.get("name"),
    order: formData.get("order") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  await prisma.criterion.create({ data: parsed.data });

  revalidatePath("/configuration");
  return { success: `Critère « ${parsed.data.name} » ajouté.` };
}

export async function deleteCriterionAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  await prisma.criterion.delete({ where: { id } });
  revalidatePath("/configuration");
}

/* ------------------------------------------------------------------ */
/* Pilotage du vote                                                     */
/* ------------------------------------------------------------------ */

/**
 * Ouvre les votes pour un candidat, globalement sur toutes les tables (§5).
 *
 * `openedAt` n'est renseigné qu'à la première ouverture et n'est jamais remis à
 * zéro : c'est lui qui autorise l'acceptation des votes arrivant en retard,
 * après la fermeture (§11).
 */
export async function openVotingAction(formData: FormData) {
  await requireAuth();
  const candidateId = String(formData.get("candidateId"));

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return;

  await prisma.$transaction([
    prisma.candidate.update({
      where: { id: candidateId },
      data: { openedAt: candidate.openedAt ?? new Date() },
    }),
    prisma.session.update({
      where: { id: SESSION_ID },
      data: { activeCandidateId: candidateId, votingOpen: true },
    }),
  ]);

  revalidatePath("/");
}

export async function closeVotingAction() {
  await requireAuth();
  await getOrCreateSession();
  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { votingOpen: false },
  });
  revalidatePath("/");
}

export async function updateTimerAction(formData: FormData) {
  await requireAuth();
  await getOrCreateSession();

  const timerEnabled = formData.get("timerEnabled") === "on";
  const parsedSeconds = Number(formData.get("timerSeconds"));
  const timerSeconds =
    Number.isFinite(parsedSeconds) && parsedSeconds >= 5 && parsedSeconds <= 600
      ? Math.round(parsedSeconds)
      : 30;

  await prisma.session.update({
    where: { id: SESSION_ID },
    data: { timerEnabled, timerSeconds },
  });

  revalidatePath("/");
}
