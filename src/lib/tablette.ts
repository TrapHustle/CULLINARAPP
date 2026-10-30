import { sealData, unsealData } from "iron-session";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { controlerValeurs, DUREE_JETON_S, suffrageTabletteSchema } from "./tablette-core";

/**
 * API des tablettes (`/api/tablette/...`) : accès à la base.
 *
 * Une tablette se connecte une fois avec le compte de l'organisateur, qui ne
 * voit que ses événements, ou avec le compte super-admin, qui voit tout. Elle
 * reçoit un jeton chiffré qu'elle renvoie à chaque requête ; l'utilisateur est
 * relu en base à chaque fois, si bien qu'un compte supprimé ou suspendu perd
 * l'accès tout de suite.
 *
 * Elle télécharge la configuration d'une sélection (candidats, votes en salle,
 * critères), vote hors ligne, puis envoie ses votes par lots.
 */

interface ContenuJeton {
  utilisateurId: string;
  organisationId: string;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET est absent ou trop court.");
  return s;
}

export function creerJeton(contenu: ContenuJeton): Promise<string> {
  return sealData(contenu, { password: secret(), ttl: DUREE_JETON_S });
}

/** L'appareil connecté : son utilisateur, et l'organisation qu'il voit (`null` : toutes). */
export interface Appareil {
  utilisateurId: string;
  organisationId: string | null;
  superAdmin: boolean;
}

/** Lit le jeton `Authorization: Bearer …` et relit l'utilisateur en base. */
export async function lireAppareil(request: Request): Promise<Appareil | null> {
  const entete = request.headers.get("authorization") ?? "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";
  if (!jeton || jeton.length > 4096) return null;

  let contenu: Partial<ContenuJeton>;
  try {
    contenu = await unsealData<Partial<ContenuJeton>>(jeton, { password: secret(), ttl: DUREE_JETON_S });
  } catch {
    return null;
  }
  if (!contenu.utilisateurId) return null;

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: contenu.utilisateurId },
    include: { organisation: { select: { actif: true } } },
  });
  if (!utilisateur || utilisateur.organisationId !== contenu.organisationId) return null;
  const superAdmin = utilisateur.role === "SUPERADMIN";
  if (!superAdmin && !utilisateur.organisation.actif) return null;
  return { utilisateurId: utilisateur.id, organisationId: superAdmin ? null : utilisateur.organisationId, superAdmin };
}

/** Filtre des sélections visibles par l'appareil. */
function visibles(appareil: Appareil): Prisma.SelectionWhereInput {
  return appareil.organisationId
    ? { evenement: { organisationId: appareil.organisationId } }
    : { evenement: { organisation: { actif: true } } };
}

/**
 * Les concours que la tablette propose : ouverts, vote en salle en cours. Une
 * sélection pas encore ouverte, ou dont le vote en salle est suspendu
 * (Pilotage → Suspendre), n'apparaît pas : on ne peut pas y voter.
 */
export async function listerConcours(appareil: Appareil) {
  const selections = await prisma.selection.findMany({
    where: { ...visibles(appareil), etat: "OUVERTE", voteSalleOuvert: true },
    orderBy: [{ debut: "asc" }, { creeLe: "asc" }],
    include: {
      evenement: { select: { nom: true, afficheUrl: true, organisation: { select: { nom: true } } } },
      _count: { select: { participations: { where: { disponible: true } } } },
    },
  });
  return selections.map((s) => ({
    selectionId: s.id,
    evenement: s.evenement.nom,
    selection: s.libelle,
    organisation: s.evenement.organisation.nom,
    lieu: s.lieu,
    debut: s.debut?.toISOString() ?? null,
    etat: s.etat,
    afficheUrl: s.evenement.afficheUrl,
    candidats: s._count.participations,
  }));
}

/** Tout ce qu'il faut à la tablette pour voter hors ligne sur une sélection. */
export async function lireConfiguration(appareil: Appareil, selectionId: string) {
  const s = await prisma.selection.findFirst({
    where: { id: selectionId, ...visibles(appareil) },
    include: {
      evenement: { select: { nom: true, afficheUrl: true } },
      participations: {
        where: { disponible: true },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
        include: { candidat: { select: { nom: true, ville: true, photoUrl: true } } },
      },
      typesVote: {
        where: { canal: "SALLE" },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
        include: { criteres: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
      },
      tables: { orderBy: { nom: "asc" } },
    },
  });
  if (!s) return null;
  return {
    selectionId: s.id,
    evenement: s.evenement.nom,
    selection: s.libelle,
    afficheUrl: s.evenement.afficheUrl,
    etat: s.etat,
    voteSalleOuvert: s.voteSalleOuvert,
    chrono: { actif: s.chronoActif, secondes: s.chronoSecondes },
    generation: s.generationDonnees,
    candidats: s.participations.map((p) => ({
      participationId: p.id,
      nom: p.candidat.nom,
      ville: p.candidat.ville,
      photoUrl: p.candidat.photoUrl,
      ordre: p.ordre,
    })),
    typesVote: s.typesVote.map((t) => ({
      typeVoteId: t.id,
      libelle: t.libelle,
      avecCriteres: t.avecCriteres,
      deroule: t.deroule,
      criteres: t.criteres.map((c) => ({ critereId: c.id, libelle: c.libelle, bareme: c.bareme })),
    })),
    tables: s.tables.map((t) => ({ tableId: t.id, nom: t.nom, juresAttendus: t.juresAttendus, typeVoteId: t.typeVoteId })),
  };
}

export interface Refus {
  id: string;
  raison: string;
  /** `false` : réessayer ne servira à rien, la tablette peut abandonner ce vote. */
  reessayer: boolean;
}

/**
 * Reçoit un lot de votes d'une tablette. Chaque vote est traité seul : un
 * vote refusé n'empêche pas les autres. Un vote déjà reçu (même identifiant)
 * est compté comme accepté, sans doublon.
 */
export async function recevoirSuffrages(appareil: Appareil, selectionId: string, bruts: unknown[]) {
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, ...visibles(appareil) },
    include: {
      participations: { select: { id: true } },
      typesVote: { where: { canal: "SALLE" }, include: { criteres: true } },
    },
  });
  if (!selection) return null;

  const participations = new Set(selection.participations.map((p) => p.id));
  const types = new Map(selection.typesVote.map((t) => [t.id, t]));
  const acceptes: string[] = [];
  const refuses: Refus[] = [];

  for (const brut of bruts) {
    const lu = suffrageTabletteSchema.safeParse(brut);
    const id = typeof (brut as { id?: unknown })?.id === "string" ? String((brut as { id: string }).id).slice(0, 64) : "?";
    if (!lu.success) {
      refuses.push({ id, raison: "Vote mal formé.", reessayer: false });
      continue;
    }
    const v = lu.data;

    const deja = await prisma.suffrage.findUnique({ where: { id: v.id }, select: { participation: { select: { selectionId: true } } } });
    if (deja) {
      // Déjà reçu : accepté, sauf s'il appartient à une autre sélection.
      if (deja.participation.selectionId === selectionId) acceptes.push(v.id);
      else refuses.push({ id: v.id, raison: "Ce vote appartient à un autre concours.", reessayer: false });
      continue;
    }

    if (selection.etat !== "OUVERTE") {
      // En préparation, le vote pourra passer une fois la sélection ouverte ; clôturée, plus jamais.
      refuses.push({
        id: v.id,
        raison: selection.etat === "PREPAREE" ? "Le concours n'est pas encore ouvert au vote." : "Le concours est clôturé.",
        reessayer: selection.etat === "PREPAREE",
      });
      continue;
    }
    const type = types.get(v.typeVoteId);
    if (!type) {
      refuses.push({ id: v.id, raison: "Ce type de vote n'existe plus.", reessayer: false });
      continue;
    }
    if (!participations.has(v.participationId)) {
      refuses.push({ id: v.id, raison: "Ce candidat ne fait plus partie du concours.", reessayer: false });
      continue;
    }
    const motif = controlerValeurs(type, v.valeurs);
    if (motif) {
      refuses.push({ id: v.id, raison: motif, reessayer: false });
      continue;
    }

    try {
      await prisma.suffrage.create({
        data: {
          id: v.id,
          participationId: v.participationId,
          typeVoteId: v.typeVoteId,
          poids: 1,
          origine: "TABLETTE",
          jureIndex: v.jure,
          valeurs: type.avecCriteres
            ? { create: type.criteres.map((c) => ({ critereId: c.id, valeur: v.valeurs![c.id] })) }
            : undefined,
        },
      });
      acceptes.push(v.id);
    } catch (erreur) {
      // Deux envois simultanés du même vote : le premier l'a enregistré.
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
        acceptes.push(v.id);
        continue;
      }
      throw erreur;
    }
  }
  return { acceptes, refuses };
}
