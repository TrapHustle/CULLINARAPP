import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import type { Resultat } from "./evenements";

/**
 * Votes en salle saisis depuis le panneau (origine « SAISIE ») : les fiches du
 * jury recopiées par l'organisateur, et les voix comptées dans la salle. Les
 * tablettes produiront plus tard les mêmes votes, avec l'origine « TABLETTE ».
 *
 * Un vote saisi ne se modifie pas : on l'annule et on le ressaisit (RG 5.7).
 */

const INTROUVABLE = { ok: false as const, erreur: "Introuvable." };

/** Une ligne de fiche : les notes d'un candidat, critère par critère. */
export interface LigneFiche {
  participationId: string;
  valeurs: Map<string, number>;
}

/**
 * Lit une fiche de notation envoyée par le formulaire : champs
 * `v_<participation>_<critère>`. Une ligne entièrement vide est ignorée ; une
 * ligne commencée doit être complète.
 */
export function lireFiche(
  form: FormData,
  participations: { id: string; nom: string }[],
  criteres: { id: string; libelle: string; bareme: number }[],
): { ok: true; lignes: LigneFiche[] } | { ok: false; erreur: string } {
  const lignes: LigneFiche[] = [];
  for (const p of participations) {
    const brutes = criteres.map((c) => String(form.get(`v_${p.id}_${c.id}`) ?? "").trim().replace(",", "."));
    if (brutes.every((v) => v === "")) continue;
    const valeurs = new Map<string, number>();
    for (const [i, c] of criteres.entries()) {
      const v = brutes[i];
      if (v === "") return { ok: false, erreur: `${p.nom} : la note « ${c.libelle} » manque.` };
      if (!/^\d{1,3}$/.test(v) || Number(v) > c.bareme) {
        return { ok: false, erreur: `${p.nom} : « ${c.libelle} » est une note entière de 0 à ${c.bareme}.` };
      }
      valeurs.set(c.id, Number(v));
    }
    lignes.push({ participationId: p.id, valeurs });
  }
  if (lignes.length === 0) return { ok: false, erreur: "La fiche est vide : notez au moins un candidat." };
  return { ok: true, lignes };
}

/** Sélection ouverte à la salle, type en salle de cette sélection. */
async function contexte(organisationId: string, selectionId: string, typeVoteId: string) {
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: {
      typesVote: { where: { id: typeVoteId }, include: { criteres: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } } },
      participations: { include: { candidat: { select: { nom: true } } }, orderBy: [{ ordre: "asc" }, { id: "asc" }] },
    },
  });
  if (!selection) return { ok: false as const, erreur: INTROUVABLE.erreur };
  if (selection.etat !== "OUVERTE") return { ok: false as const, erreur: "La sélection n'est pas ouverte au vote." };
  if (!selection.voteSalleOuvert) return { ok: false as const, erreur: "Le vote en salle est suspendu : reprenez-le dans l'onglet Pilotage." };
  const type = selection.typesVote[0];
  if (!type || type.canal !== "SALLE") return { ok: false as const, erreur: "Type de vote introuvable." };
  return { ok: true as const, selection, type };
}

export async function lireContexteFiche(organisationId: string, selectionId: string, typeVoteId: string) {
  return contexte(organisationId, selectionId, typeVoteId);
}

/**
 * Enregistre la fiche d'un juré : un vote par candidat noté, avec une valeur
 * par critère (RG 5.5). Un même juré ne note pas deux fois le même candidat.
 */
export async function saisirFiche(
  organisationId: string,
  selectionId: string,
  typeVoteId: string,
  jure: number,
  lignes: LigneFiche[],
): Promise<Resultat<number>> {
  const ctx = await contexte(organisationId, selectionId, typeVoteId);
  if (!ctx.ok) return { ok: false, erreur: ctx.erreur };
  if (!ctx.type.avecCriteres) return { ok: false, erreur: "Ce type compte des voix : saisissez un nombre de voix." };

  const parId = new Map(ctx.selection.participations.map((p) => [p.id, p]));
  for (const l of lignes) {
    const p = parId.get(l.participationId);
    if (!p) return INTROUVABLE;
    if (!p.disponible) return { ok: false, erreur: `${p.candidat.nom} n'est pas disponible au vote (RG 2.5).` };
  }

  // Verrou par (type, juré) : deux envois simultanés de la même fiche
  // passent l'un après l'autre, le second voit le premier et est refusé.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${typeVoteId}:${jure}`}))`;
    const deja = await tx.suffrage.findMany({
      where: {
        typeVoteId,
        origine: { in: ["SAISIE", "TABLETTE"] },
        jureIndex: jure,
        annuleLe: null,
        participationId: { in: lignes.map((l) => l.participationId) },
      },
      select: { participationId: true },
    });
    if (deja.length > 0) {
      const noms = deja.map((d) => parId.get(d.participationId)?.candidat.nom).join(", ");
      return { ok: false as const, erreur: `Le juré n° ${jure} a déjà noté : ${noms}. Annulez l'ancienne fiche pour la corriger.` };
    }
    for (const l of lignes) {
      await tx.suffrage.create({
        data: {
          id: randomUUID(),
          participationId: l.participationId,
          typeVoteId,
          poids: 1,
          origine: "SAISIE",
          jureIndex: jure,
          valeurs: { create: [...l.valeurs].map(([critereId, valeur]) => ({ critereId, valeur })) },
        },
      });
    }
    return { ok: true as const, valeur: lignes.length };
  });
}

/** Voix comptées dans la salle pour un candidat, sur un type sans critère. */
export async function saisirVoix(
  organisationId: string,
  selectionId: string,
  typeVoteId: string,
  participationId: string,
  voix: number,
): Promise<Resultat> {
  const ctx = await contexte(organisationId, selectionId, typeVoteId);
  if (!ctx.ok) return { ok: false, erreur: ctx.erreur };
  if (ctx.type.avecCriteres) return { ok: false, erreur: "Ce type se note sur des critères : remplissez une fiche." };
  const p = ctx.selection.participations.find((x) => x.id === participationId);
  if (!p) return INTROUVABLE;
  if (!p.disponible) return { ok: false, erreur: `${p.candidat.nom} n'est pas disponible au vote (RG 2.5).` };

  await prisma.suffrage.create({
    data: { id: randomUUID(), participationId, typeVoteId, poids: voix, origine: "SAISIE" },
  });
  return { ok: true, valeur: undefined };
}

/** Annule un vote saisi (RG 5.7). Les voix payées ne s'annulent pas d'ici : ce sont des paiements. */
export async function annulerSaisie(organisationId: string, suffrageId: string): Promise<Resultat> {
  const s = await prisma.suffrage.findFirst({
    where: { id: suffrageId, participation: { selection: { evenement: { organisationId } } } },
    include: { participation: { select: { selection: { select: { etat: true } } } } },
  });
  if (!s) return INTROUVABLE;
  if (s.origine !== "SAISIE" && s.origine !== "TABLETTE") return { ok: false, erreur: "Seuls les votes en salle s'annulent ici." };
  if (s.participation.selection.etat !== "OUVERTE") return { ok: false, erreur: "La sélection n'est plus ouverte : ses votes sont figés." };
  if (s.annuleLe) return { ok: true, valeur: undefined };
  await prisma.suffrage.update({ where: { id: suffrageId }, data: { annuleLe: new Date() } });
  return { ok: true, valeur: undefined };
}

/** Les votes en salle d'une sélection, les plus récents d'abord. */
export function listerSaisies(organisationId: string, selectionId: string) {
  return prisma.suffrage.findMany({
    where: {
      origine: { in: ["SAISIE", "TABLETTE"] },
      participation: { selectionId, selection: { evenement: { organisationId } } },
    },
    orderBy: { creeLe: "desc" },
    take: 300,
    include: {
      participation: { select: { candidat: { select: { nom: true } } } },
      typeVote: { select: { libelle: true, avecCriteres: true } },
      valeurs: { include: { critere: { select: { libelle: true, bareme: true, ordre: true } } } },
    },
  });
}
