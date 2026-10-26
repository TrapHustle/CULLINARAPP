import { prisma } from "./prisma";
import type { Resultat } from "./evenements";
import {
  codeLien,
  creationsDepuisModeles,
  creationsGrilleProposee,
  type PalierSaisi,
  type SaisieCritere,
  type SaisieReglagesEnLigne,
  type SaisieTypeVote,
} from "./grille-core";

/**
 * Grille de vote : accès à la base.
 *
 * Elle existe à deux niveaux (RG 3.1 à 3.3) :
 *  - l'**événement** porte la grille de référence (`TypeVoteModele`) ;
 *  - chaque **sélection** en reçoit une copie à sa création (`TypeVote`),
 *    qu'on peut ensuite modifier pour elle seule.
 *
 * La grille d'une sélection ne se modifie que tant qu'elle est en préparation :
 * une fois ouverte, des votes s'y rattachent (RG 8.7).
 */

export type Niveau = { kind: "evenement"; id: string } | { kind: "selection"; id: string };

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };
const FIGEE = {
  ok: false as const,
  erreur: "La sélection n'est plus en préparation : sa grille de vote est figée.",
};
const OK = { ok: true as const, valeur: undefined };

/** Vérifie que le niveau appartient à l'organisation et reste modifiable. */
async function controler(organisationId: string, niveau: Niveau): Promise<Resultat> {
  if (niveau.kind === "evenement") {
    const e = await prisma.evenement.findFirst({ where: { id: niveau.id, organisationId }, select: { id: true } });
    return e ? OK : INTROUVABLE;
  }
  const s = await prisma.selection.findFirst({
    where: { id: niveau.id, evenement: { organisationId } },
    select: { etat: true },
  });
  if (!s) return INTROUVABLE;
  return s.etat === "PREPAREE" ? OK : FIGEE;
}

// Lecture ---------------------------------------------------------------------

export async function lireGrille(organisationId: string, niveau: Niveau) {
  const ordre = [{ ordre: "asc" as const }, { id: "asc" as const }];
  if (niveau.kind === "evenement") {
    return prisma.typeVoteModele.findMany({
      where: { evenementId: niveau.id, evenement: { organisationId } },
      orderBy: ordre,
      include: { criteres: { orderBy: ordre } },
    });
  }
  return prisma.typeVote.findMany({
    where: { selectionId: niveau.id, selection: { evenement: { organisationId } } },
    orderBy: ordre,
    include: { criteres: { orderBy: ordre } },
  });
}

export type GrilleLue = Awaited<ReturnType<typeof lireGrille>>;

// Grille proposée -----------------------------------------------------------

/** Pose la grille proposée sur un événement qui n'en a pas encore. */
export async function poserGrilleProposee(organisationId: string, evenementId: string): Promise<Resultat> {
  const controle = await controler(organisationId, { kind: "evenement", id: evenementId });
  if (!controle.ok) return controle;
  if ((await prisma.typeVoteModele.count({ where: { evenementId } })) > 0) {
    return { ok: false, erreur: "Cet événement a déjà une grille de vote." };
  }
  await prisma.evenement.update({ where: { id: evenementId }, data: { typesModeles: { create: creationsGrilleProposee() } } });
  return OK;
}

/**
 * Recopie la grille de référence de l'événement dans une sélection (RG 3.2),
 * en remplaçant celle qu'elle avait. Seulement en préparation, sans vote.
 */
export async function reprendreGrilleEvenement(organisationId: string, selectionId: string): Promise<Resultat> {
  const controle = await controler(organisationId, { kind: "selection", id: selectionId });
  if (!controle.ok) return controle;

  const selection = await prisma.selection.findUniqueOrThrow({ where: { id: selectionId }, select: { evenementId: true } });
  const traces = await prisma.suffrage.count({ where: { participation: { selectionId } } });
  if (traces > 0) return { ok: false, erreur: "Cette sélection a déjà des votes : sa grille ne peut plus être remplacée." };
  if ((await prisma.tableJury.count({ where: { selectionId } })) > 0) {
    return { ok: false, erreur: "Des tables de jury utilisent cette grille : retirez-les d'abord." };
  }

  const modeles = await prisma.typeVoteModele.findMany({
    where: { evenementId: selection.evenementId },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
    include: { criteres: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
  });

  await prisma.$transaction([
    prisma.typeVote.deleteMany({ where: { selectionId } }),
    prisma.selection.update({ where: { id: selectionId }, data: { typesVote: { create: creationsDepuisModeles(modeles) } } }),
  ]);
  return OK;
}

// Types de vote ---------------------------------------------------------------

async function typesDuNiveau(niveau: Niveau) {
  return niveau.kind === "evenement"
    ? prisma.typeVoteModele.findMany({ where: { evenementId: niveau.id }, select: { id: true, canal: true, ordre: true } })
    : prisma.typeVote.findMany({ where: { selectionId: niveau.id }, select: { id: true, canal: true, ordre: true } });
}

/** Un seul type en ligne par grille : la page publique n'en propose qu'un. */
async function enLigneEnDouble(niveau: Niveau, saisie: SaisieTypeVote, typeId?: string): Promise<boolean> {
  if (saisie.canal !== "EN_LIGNE") return false;
  const types = await typesDuNiveau(niveau);
  return types.some((t) => t.canal === "EN_LIGNE" && t.id !== typeId);
}

const DOUBLON_EN_LIGNE = {
  ok: false as const,
  erreur: "Cette grille a déjà un type de vote en ligne : il ne peut y en avoir qu'un.",
};

export async function ajouterType(organisationId: string, niveau: Niveau, saisie: SaisieTypeVote): Promise<Resultat> {
  const controle = await controler(organisationId, niveau);
  if (!controle.ok) return controle;
  if (await enLigneEnDouble(niveau, saisie)) return DOUBLON_EN_LIGNE;

  const types = await typesDuNiveau(niveau);
  const ordre = Math.max(-1, ...types.map((t) => t.ordre)) + 1;
  const data = { ...saisie, payant: saisie.canal === "EN_LIGNE", ordre };

  if (niveau.kind === "evenement") {
    await prisma.typeVoteModele.create({ data: { ...data, evenementId: niveau.id } });
  } else {
    await prisma.typeVote.create({ data: { ...data, selectionId: niveau.id, lien: codeLien() } });
  }
  return OK;
}

export async function modifierType(
  organisationId: string,
  niveau: Niveau,
  typeId: string,
  saisie: SaisieTypeVote,
): Promise<Resultat> {
  const controle = await controler(organisationId, niveau);
  if (!controle.ok) return controle;
  if (await enLigneEnDouble(niveau, saisie, typeId)) return DOUBLON_EN_LIGNE;

  const data = { ...saisie, payant: saisie.canal === "EN_LIGNE" };
  if (niveau.kind === "evenement") {
    const { count } = await prisma.typeVoteModele.updateMany({ where: { id: typeId, evenementId: niveau.id }, data });
    if (count !== 1) return INTROUVABLE;
    // Sans critères, les critères existants n'ont plus de sens (RG 4.2).
    if (!saisie.avecCriteres) await prisma.critereModele.deleteMany({ where: { typeVoteId: typeId } });
  } else {
    const { count } = await prisma.typeVote.updateMany({ where: { id: typeId, selectionId: niveau.id }, data });
    if (count !== 1) return INTROUVABLE;
    if (!saisie.avecCriteres) await prisma.critere.deleteMany({ where: { typeVoteId: typeId } });
  }
  return OK;
}

export async function supprimerType(organisationId: string, niveau: Niveau, typeId: string): Promise<Resultat> {
  const controle = await controler(organisationId, niveau);
  if (!controle.ok) return controle;

  if (niveau.kind === "evenement") {
    const { count } = await prisma.typeVoteModele.deleteMany({ where: { id: typeId, evenementId: niveau.id } });
    return count === 1 ? OK : INTROUVABLE;
  }
  const [suffrages, tables] = await Promise.all([
    prisma.suffrage.count({ where: { typeVoteId: typeId } }),
    prisma.tableJury.count({ where: { typeVoteId: typeId } }),
  ]);
  if (suffrages + tables > 0) return { ok: false, erreur: "Ce type de vote est déjà utilisé : il ne peut plus être supprimé." };
  const { count } = await prisma.typeVote.deleteMany({ where: { id: typeId, selectionId: niveau.id } });
  return count === 1 ? OK : INTROUVABLE;
}

// Critères --------------------------------------------------------------------

/** Le type visé, s'il est bien du niveau et note sur des critères. */
async function typeAvecCriteres(niveau: Niveau, typeId: string) {
  const type =
    niveau.kind === "evenement"
      ? await prisma.typeVoteModele.findFirst({ where: { id: typeId, evenementId: niveau.id }, include: { criteres: true } })
      : await prisma.typeVote.findFirst({ where: { id: typeId, selectionId: niveau.id }, include: { criteres: true } });
  return type;
}

export async function ajouterCritere(
  organisationId: string,
  niveau: Niveau,
  typeId: string,
  saisie: SaisieCritere,
): Promise<Resultat> {
  const controle = await controler(organisationId, niveau);
  if (!controle.ok) return controle;
  const type = await typeAvecCriteres(niveau, typeId);
  if (!type) return INTROUVABLE;
  if (!type.avecCriteres) return { ok: false, erreur: "Ce type compte des voix : il n'a pas de critères." };

  const ordre = Math.max(-1, ...type.criteres.map((c) => c.ordre)) + 1;
  if (niveau.kind === "evenement") {
    await prisma.critereModele.create({ data: { ...saisie, ordre, typeVoteId: typeId } });
  } else {
    await prisma.critere.create({ data: { ...saisie, ordre, typeVoteId: typeId } });
  }
  return OK;
}

export async function modifierCritere(
  organisationId: string,
  niveau: Niveau,
  typeId: string,
  critereId: string,
  saisie: SaisieCritere,
): Promise<Resultat> {
  const controle = await controler(organisationId, niveau);
  if (!controle.ok) return controle;
  const type = await typeAvecCriteres(niveau, typeId);
  if (!type || !type.criteres.some((c) => c.id === critereId)) return INTROUVABLE;

  if (niveau.kind === "evenement") {
    await prisma.critereModele.update({ where: { id: critereId }, data: saisie });
  } else {
    await prisma.critere.update({ where: { id: critereId }, data: saisie });
  }
  return OK;
}

export async function supprimerCritere(
  organisationId: string,
  niveau: Niveau,
  typeId: string,
  critereId: string,
): Promise<Resultat> {
  const controle = await controler(organisationId, niveau);
  if (!controle.ok) return controle;
  const type = await typeAvecCriteres(niveau, typeId);
  if (!type || !type.criteres.some((c) => c.id === critereId)) return INTROUVABLE;

  if (niveau.kind === "evenement") {
    await prisma.critereModele.delete({ where: { id: critereId } });
  } else {
    if ((await prisma.valeur.count({ where: { critereId } })) > 0) {
      return { ok: false, erreur: "Ce critère a déjà des notes : il ne peut plus être supprimé." };
    }
    await prisma.critere.delete({ where: { id: critereId } });
  }
  return OK;
}

/** Échange un critère avec son voisin. Les ordres sont renumérotés au passage. */
export async function deplacerCritere(
  organisationId: string,
  niveau: Niveau,
  typeId: string,
  critereId: string,
  sens: "haut" | "bas",
): Promise<Resultat> {
  const controle = await controler(organisationId, niveau);
  if (!controle.ok) return controle;
  const type = await typeAvecCriteres(niveau, typeId);
  if (!type) return INTROUVABLE;

  const tries = [...type.criteres].sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id));
  const i = tries.findIndex((c) => c.id === critereId);
  const j = sens === "haut" ? i - 1 : i + 1;
  if (i < 0) return INTROUVABLE;
  if (j < 0 || j >= tries.length) return OK;
  [tries[i], tries[j]] = [tries[j], tries[i]];

  await prisma.$transaction(
    tries.map((c, ordre) =>
      niveau.kind === "evenement"
        ? prisma.critereModele.update({ where: { id: c.id }, data: { ordre } })
        : prisma.critere.update({ where: { id: c.id }, data: { ordre } }),
    ),
  );
  return OK;
}

// Réglages du vote en ligne -------------------------------------------------

/**
 * Prix, voix gratuite, compteurs, moyens de paiement, mode et paliers d'une
 * sélection. Le mode et les paliers ne changent plus une fois la sélection
 * ouverte (RG 8.7) ; le reste se règle jusqu'à la clôture.
 */
export async function reglerEnLigne(
  organisationId: string,
  selectionId: string,
  saisie: SaisieReglagesEnLigne,
  paliers: PalierSaisi[],
): Promise<Resultat> {
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: { paliers: true },
  });
  if (!selection) return INTROUVABLE;
  if (selection.etat === "CLOTUREE") return { ok: false, erreur: "La sélection est clôturée." };

  const preparee = selection.etat === "PREPAREE";
  if (!preparee && saisie.modeEnLigne !== selection.modeEnLigne) {
    return { ok: false, erreur: "Le mode de calcul ne change plus une fois la sélection ouverte." };
  }
  if (saisie.modeEnLigne === "B" && paliers.length === 0 && preparee) {
    return { ok: false, erreur: "Le mode B demande au moins un palier." };
  }

  const { prixVote, voixGratuite, compteursVisibles, modeEnLigne, moyensPaiement } = saisie;
  await prisma.$transaction([
    prisma.selection.update({
      where: { id: selectionId },
      data: { prixVote, voixGratuite, compteursVisibles, moyensPaiement, ...(preparee ? { modeEnLigne } : {}) },
    }),
    // Les paliers ne sont réécrits qu'en préparation.
    ...(preparee
      ? [
          prisma.palier.deleteMany({ where: { selectionId } }),
          prisma.palier.createMany({
            data: paliers.map((p, ordre) => ({ selectionId, voixMax: p.voixMax, points: p.points, ordre })),
          }),
        ]
      : []),
  ]);
  return OK;
}
