"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrCreateSession, prisma, SESSION_ID } from "./prisma";
import { getSession } from "./session";
import {
  ACCEPTED_IMAGE_TYPES,
  candidatePhotoSchema,
  candidateSchema,
  candidateUpdateSchema,
  criterionSchema,
  criterionUpdateSchema,
  devalidateSchema,
  loginSchema,
  MAX_IMAGE_BYTES,
  purgeTabletsSchema,
  releaseTablesSchema,
  resetEventSchema,
  resetVotesSchema,
  tableSchema,
  tableUpdateSchema,
  voteSettingsSchema,
} from "./validation";

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

/**
 * Renomme ou réordonne un candidat.
 *
 * Modifier plutôt que supprimer-recréer est ici une exigence de sécurité : la
 * suppression est en cascade et emporterait tous les votes déjà reçus. Corriger
 * une faute de frappe en plein événement ne doit jamais coûter un vote.
 */
export async function updateCandidateAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = candidateUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    order: formData.get("order") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  await prisma.candidate.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, order: parsed.data.order },
  });

  revalidatePath("/configuration");
  revalidatePath("/");
  return { success: `Candidat « ${parsed.data.name} » modifié.` };
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

/**
 * Modifie une table : nom, type (donc le poids de ses votes) et nombre de jurés.
 *
 * Le changement de type est rétroactif sur le classement, puisque le poids est
 * dérivé du type au moment du calcul et jamais figé dans le vote (§0.3). C'est
 * voulu : une table déclarée « jury spécial » par erreur se corrige sans
 * refaire voter personne.
 */
export async function updateTableAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = tableUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    type: formData.get("type") || "LAMBDA",
    expectedJurors: formData.get("expectedJurors") || 1,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const { id, ...data } = parsed.data;
  await prisma.votingTable.update({ where: { id }, data });

  revalidatePath("/configuration");
  revalidatePath("/");
  revalidatePath("/resultats");
  return { success: `Table « ${data.name} » modifiée.` };
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

/**
 * Renomme ou réordonne un critère.
 *
 * Seul le libellé bouge : les notes déjà saisies restent rattachées au même
 * identifiant de critère, donc aucun vote n'est perdu ni faussé.
 */
export async function updateCriterionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = criterionUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    order: formData.get("order") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  await prisma.criterion.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, order: parsed.data.order },
  });

  revalidatePath("/configuration");
  revalidatePath("/resultats");
  return { success: `Critère « ${parsed.data.name} » modifié.` };
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

/**
 * Ouvre les votes pour **tous** les candidats à la fois.
 *
 * C'est ce que suppose le déroulé « juré après juré » : chaque juré prend la
 * tablette et parcourt l'ensemble des candidats avant de la passer au suivant.
 *
 * `activeCandidateId` est **conservé** : les deux catégories peuvent suivre des
 * déroulés différents, et la salle a encore besoin de son candidat en cours
 * pendant que le jury spécial les parcourt tous. L'effacer priverait le public
 * de tout candidat notable.
 *
 * `openedAt` n'est posée que sur les candidats qui ne l'avaient pas : elle
 * atteste de la première ouverture et autorise l'acceptation des votes en
 * retard (§11) — la réécrire ferait mentir cette date.
 */
export async function openAllVotingAction() {
  await requireAuth();
  await getOrCreateSession();

  await prisma.$transaction([
    prisma.candidate.updateMany({
      where: { openedAt: null },
      data: { openedAt: new Date() },
    }),
    prisma.session.update({
      where: { id: SESSION_ID },
      data: { votingOpen: true },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/resultats");
}

/**
 * Libère une table de la tablette qui la tient.
 *
 * C'est la soupape de l'assignation exclusive : sans elle, une tablette tombée
 * en panne emporterait sa table jusqu'à la fin du concours, puisqu'aucune autre
 * ne peut la lui prendre. Le geste appartient à l'organisateur, seul à voir la
 * salle — une tablette ne peut pas en déloger une autre.
 *
 * Les votes déjà enregistrés ne sont pas touchés : on libère la place, on
 * n'efface rien.
 */
export async function releaseTableAction(formData: FormData) {
  await requireAuth();
  const tableId = String(formData.get("tableId"));
  if (!tableId) return;

  await prisma.votingTable.update({
    where: { id: tableId },
    data: { assignedDeviceId: null, assignedAt: null },
  });

  revalidatePath("/appairage");
}

/**
 * Clôt le candidat en cours et ouvre le suivant, en une seule opération.
 *
 * Séparer les deux gestes laissait un entre-deux : les votes étaient fermés
 * mais `activeCandidateId` pointait toujours sur le candidat terminé, si bien
 * que l'écran projeté continuait de l'afficher jusqu'à ce que quelqu'un pense
 * à ouvrir le suivant. Un seul bouton supprime cet état bâtard.
 *
 * Aucun contrôle bloquant sur les tables n'ayant pas validé : une table peut
 * être absente ou sa tablette en panne, et l'organisateur doit pouvoir avancer.
 * Le Pilotage l'avertit en les nommant — c'est à lui de décider.
 *
 * S'il n'y a pas de candidat suivant, le bureau retombe au repos : les votes
 * sont fermés et plus aucun candidat n'est actif, ce qui renvoie l'écran
 * projeté sur sa page d'attente plutôt que sur le dernier passage.
 */
export async function closeAndAdvanceAction() {
  await requireAuth();
  const session = await getOrCreateSession();

  const candidates = await prisma.candidate.findMany({ orderBy: { order: "asc" } });
  const currentIndex = session.activeCandidateId
    ? candidates.findIndex((candidate) => candidate.id === session.activeCandidateId)
    : -1;
  const next = currentIndex >= 0 ? candidates[currentIndex + 1] : candidates[0];

  if (!next) {
    await prisma.session.update({
      where: { id: SESSION_ID },
      data: { activeCandidateId: null, votingOpen: false },
    });
  } else {
    await prisma.$transaction([
      prisma.candidate.update({
        where: { id: next.id },
        // `openedAt` ne bouge plus une fois posée : elle atteste que les votes
        // ont bien été ouverts, ce dont dépend l'acceptation des votes tardifs.
        data: { openedAt: next.openedAt ?? new Date() },
      }),
      prisma.session.update({
        where: { id: SESSION_ID },
        data: { activeCandidateId: next.id, votingOpen: true },
      }),
    ]);
  }

  revalidatePath("/");
  revalidatePath("/resultats");
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

/**
 * Enregistre les poids du calcul et les bornes de la note (Configuration →
 * Vote).
 *
 * S'applique immédiatement à tous les votes déjà reçus : le poids et
 * l'échelle ne sont jamais stockés sur un vote, seulement dérivés au moment du
 * calcul (§0.3) — changer le réglage recalcule tout le palmarès sans rien
 * réécrire en base.
 *
 * Un réglage invalide (ex. note maximale ≤ minimale) est silencieusement
 * ignoré plutôt que de faire échouer la page : comme pour le chronomètre
 * voisin, ce formulaire n'affiche pas d'erreur inline, le champ concerné
 * reprend juste sa dernière valeur enregistrée après rechargement.
 */
export async function updateVoteSettingsAction(formData: FormData) {
  await requireAuth();
  await getOrCreateSession();

  const parsed = voteSettingsSchema.safeParse({
    weightPublic: formData.get("weightPublic"),
    weightSpecial: formData.get("weightSpecial"),
    scoreMin: formData.get("scoreMin"),
    scoreMax: formData.get("scoreMax"),
    voteModePublic: formData.get("voteModePublic"),
    voteModeSpecial: formData.get("voteModeSpecial"),
  });

  if (!parsed.success) return;

  await prisma.session.update({
    where: { id: SESSION_ID },
    data: parsed.data,
  });

  revalidatePath("/configuration");
  revalidatePath("/resultats");
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/* Correction d'une validation de table                                 */
/* ------------------------------------------------------------------ */

/**
 * Rouvre les votes d'une table pour un candidat, après une validation faite par
 * erreur (§5, étape 5).
 *
 * La validation est le seul geste irréversible du staff en salle : elle
 * verrouille la saisie sur la tablette. Sans cette action, une table validée
 * trop tôt — un juré parti aux toilettes, un appui malheureux — obligeait à
 * terminer le concours avec un vote manquant.
 *
 * Les votes déjà reçus ne sont pas touchés : seul le verrou saute. La tablette
 * s'en aperçoit au cycle suivant, l'état de session lui annonçant les tables
 * encore validées pour le candidat en cours.
 */
export async function devalidateTableAction(formData: FormData) {
  await requireAuth();

  const parsed = devalidateSchema.safeParse({
    tableId: formData.get("tableId"),
    candidateId: formData.get("candidateId"),
  });
  if (!parsed.success) return;

  // `deleteMany` plutôt que `delete` : dévalider une table qui ne l'est plus
  // (double clic, deux organisateurs sur le dashboard) ne doit pas lever.
  await prisma.tableValidation.deleteMany({ where: parsed.data });

  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/* Remise à zéro des votes                                              */
/* ------------------------------------------------------------------ */

/**
 * Efface tous les votes de l'événement, sans toucher à la configuration.
 *
 * C'est l'opération qui sépare la répétition du jour J : on répète avec de
 * vraies tablettes et de vrais jurés, puis on remet le compteur à zéro en
 * gardant candidats, tables et critères — que l'on vient justement de valider
 * sur le terrain.
 *
 * Sont remis à zéro, dans une seule transaction :
 *  - les votes (leurs notes partent en cascade) ;
 *  - les validations de table, sans quoi les tablettes resteraient verrouillées ;
 *  - `openedAt` de chaque candidat, ce qui referme la porte aux votes de la
 *    répétition qu'une tablette éteinte tenterait d'envoyer après coup (§11) ;
 *  - l'état de la session, ramené à « aucun candidat, votes fermés ».
 */
/**
 * Ordonne à toutes les tablettes d'effacer leur base locale.
 *
 * N'efface rien ici : change seulement le numéro de génération que les
 * tablettes comparent au leur à chaque cycle. Celles qui sont en ligne
 * obéissent en quelques secondes ; celles qui sont hors ligne le feront à leur
 * retour, **après avoir d'abord envoyé ce qu'elles avaient en attente** — sans
 * quoi la purge détruirait des votes que le serveur n'a jamais reçus.
 *
 * C'est le seul moyen de repartir propre sans manipuler chaque tablette, entre
 * une répétition et le jour J.
 */
export async function purgeTabletsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = purgeTabletsSchema.safeParse({
    confirmation: formData.get("confirmation") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confirmation invalide." };
  }

  await getOrCreateSession();

  const [, released] = await prisma.$transaction([
    prisma.session.update({
      where: { id: SESSION_ID },
      // L'horodatage suffit : seule compte la différence avec ce que la
      // tablette a retenu, jamais l'ordre ni la valeur.
      data: { dataGeneration: String(Date.now()) },
    }),
    // Les tables se libèrent avec la purge : une tablette qui oublie tout
    // oublie aussi sa table, et la laisser réservée à un appareil qui ne la
    // revendique plus bloquerait la salle sans raison.
    prisma.votingTable.updateMany({
      where: { assignedDeviceId: { not: null } },
      data: { assignedDeviceId: null, assignedAt: null },
    }),
  ]);

  revalidatePath("/configuration");
  revalidatePath("/appairage");

  return {
    success:
      `Ordre envoyé, ${released.count} table${released.count > 1 ? "s" : ""} libérée` +
      `${released.count > 1 ? "s" : ""}. Chaque tablette effacera ses données dès ` +
      "son prochain contact avec le serveur.",
  };
}

/**
 * Rend toutes les tables à la salle : chaque tablette devra rechoisir la sienne.
 *
 * Le plus doux des trois effacements — aucun vote, aucun candidat, aucune photo
 * n'est touché. C'est celui qu'on veut entre une répétition et le jour J, quand
 * les tablettes ne sont plus dans les mêmes mains qu'à l'essai.
 */
export async function releaseAllTablesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = releaseTablesSchema.safeParse({
    confirmation: formData.get("confirmation") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confirmation invalide." };
  }

  const { count } = await prisma.votingTable.updateMany({
    where: { assignedDeviceId: { not: null } },
    data: { assignedDeviceId: null, assignedAt: null },
  });

  revalidatePath("/appairage");
  revalidatePath("/configuration");

  return {
    success:
      count === 0
        ? "Aucune table n'était assignée."
        : `${count} table${count > 1 ? "s" : ""} libérée${count > 1 ? "s" : ""}.`,
  };
}

export async function resetVotesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = resetVotesSchema.safeParse({
    confirmation: formData.get("confirmation") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confirmation invalide." };
  }

  // La ligne de session peut ne pas encore exister sur une base neuve.
  await getOrCreateSession();

  const removed = await prisma.vote.count();

  await prisma.$transaction([
    prisma.vote.deleteMany({}),
    prisma.tableValidation.deleteMany({}),
    prisma.candidate.updateMany({ data: { openedAt: null } }),
    prisma.session.update({
      where: { id: SESSION_ID },
      data: { activeCandidateId: null, votingOpen: false },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/configuration");
  revalidatePath("/resultats");

  return {
    success:
      removed === 0
        ? "Aucun vote à effacer — la configuration est intacte."
        : `${removed} vote${removed > 1 ? "s" : ""} effacé${removed > 1 ? "s" : ""}. La configuration est intacte.`,
  };
}

/* ------------------------------------------------------------------ */
/* Photos des candidats                                                 */
/* ------------------------------------------------------------------ */

/**
 * Extrait l'identifiant d'image d'un chemin `/api/images/<id>`.
 *
 * Retourne `null` pour toute autre forme : une valeur héritée d'une ancienne
 * version, ou une adresse externe qui aurait été enregistrée avant que le
 * schéma ne les refuse, ne doit pas provoquer une suppression au hasard.
 */
function imageIdFromPath(path: string | null): string | null {
  if (!path) return null;
  const match = /^\/api\/images\/([A-Za-z0-9_-]+)$/.exec(path);
  return match ? match[1] : null;
}

/**
 * Remplace le portrait d'un candidat.
 *
 * Les octets vont en base, jamais sur le disque : c'est la seule façon de servir
 * la même image en hébergement (le disque de Vercel est éphémère) et en réseau
 * local sans internet. L'ancienne image est supprimée dans la foulée, sinon la
 * base enflerait d'un fichier orphelin à chaque correction de photo.
 */
export async function uploadCandidatePhotoAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = candidatePhotoSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Candidat introuvable." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisissez une image." };
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { error: "Format accepté : JPEG, PNG ou WebP." };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    const limit = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    return { error: `Image trop lourde (maximum ${limit} Mo).` };
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: parsed.data.id } });
  if (!candidate) return { error: "Candidat introuvable." };

  const data = Buffer.from(await file.arrayBuffer());

  const image = await prisma.image.create({
    data: { mimeType: file.type, data },
  });

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { photoUrl: `/api/images/${image.id}` },
  });

  // Après coup seulement : si la suppression échoue, le candidat a déjà sa
  // nouvelle photo, ce qui compte davantage qu'une ligne orpheline.
  const previousId = imageIdFromPath(candidate.photoUrl);
  if (previousId) {
    await prisma.image.deleteMany({ where: { id: previousId } });
  }

  revalidatePath("/configuration");
  revalidatePath("/");
  return { success: `Photo de « ${candidate.name} » mise à jour.` };
}

export async function removeCandidatePhotoAction(formData: FormData) {
  await requireAuth();

  const id = String(formData.get("id"));
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return;

  await prisma.candidate.update({ where: { id }, data: { photoUrl: null } });

  const imageId = imageIdFromPath(candidate.photoUrl);
  if (imageId) {
    await prisma.image.deleteMany({ where: { id: imageId } });
  }

  revalidatePath("/configuration");
  revalidatePath("/");
}

/* ------------------------------------------------------------------ */
/* Réinitialisation complète de l'événement                             */
/* ------------------------------------------------------------------ */

/**
 * Vide entièrement le bureau de vote : votes **et** configuration.
 *
 * Le cran au-dessus de la remise à zéro des votes. Celle-ci sert entre la
 * répétition et le concours ; celle-là sert à repartir d'une page blanche pour
 * un autre événement, quand candidats, tables et critères n'ont plus rien à
 * voir avec les précédents.
 *
 * Les images partent aussi : conservées, elles resteraient en base sans que
 * plus aucun candidat ne les référence.
 */
export async function resetEventAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAuth();

  const parsed = resetEventSchema.safeParse({
    confirmation: formData.get("confirmation") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confirmation invalide." };
  }

  await getOrCreateSession();

  await prisma.$transaction([
    // Les votes et validations partiraient en cascade avec les candidats et les
    // tables ; on les efface explicitement pour ne pas dépendre de l'ordre de
    // suppression choisi par la base.
    prisma.vote.deleteMany({}),
    prisma.tableValidation.deleteMany({}),
    prisma.candidate.deleteMany({}),
    prisma.votingTable.deleteMany({}),
    prisma.criterion.deleteMany({}),
    prisma.image.deleteMany({}),
    prisma.session.update({
      where: { id: SESSION_ID },
      data: { activeCandidateId: null, votingOpen: false },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/configuration");
  revalidatePath("/resultats");

  return { success: "Bureau de vote réinitialisé. Tout est à reconfigurer." };
}
