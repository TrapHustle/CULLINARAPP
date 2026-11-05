import { randomInt, randomUUID } from "node:crypto";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  DEFAULT_PHONE_COUNTRY,
  MIN_PAYMENT_AMOUNT,
  normalizePhone,
  parsePhone,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "./public-vote-core";
import { checkSirapPayment, createSirapPayment } from "./sirap";

/**
 * Vote du public en ligne, sur le modèle SaaS (RG 6 et 7).
 *
 * Une sélection a un lien public `/v/<slug>`. On y vote pour un candidat
 * disponible, avec la voix gratuite (une par numéro de téléphone, si
 * l'organisateur l'accorde) ou en payant un lot de voix. Une voix payée ne
 * compte qu'une fois le paiement confirmé (RG 6.3) : c'est à ce moment que le
 * vote (`Suffrage`) est créé, une seule fois, rattaché au paiement.
 *
 * Un vote en ligne noté sur critères vend des notes au lieu de voix : le
 * votant note le candidat, puis paie une note au prix d'une voix. La note
 * attend sur le paiement (`Paiement.notes`) jusqu'à sa confirmation.
 */

export type ModePaiement = "simulation" | "sirap";

/**
 * Paiements réels seulement si le serveur l'autorise (`PAIEMENT_MODE=sirap`)
 * ET si la plateforme l'a activé pour cette organisation. Sinon, simulation :
 * rien n'est prélevé et ces voix ne comptent jamais dans un résultat officiel.
 */
export function modePaiement(paiementConfig: unknown): ModePaiement {
  const serveur = process.env.PAIEMENT_MODE === "sirap";
  const organisation = (paiementConfig as { mode?: unknown } | null)?.mode === "sirap";
  return serveur && organisation ? "sirap" : "simulation";
}

/** Au plus 5 demandes de paiement par numéro toutes les 10 minutes. */
const LIMITE_TELEPHONE = 5;
const FENETRE_MS = 10 * 60_000;
/** Plafond d'un lot de voix : une faute de frappe ne doit pas coûter une fortune. */
export const VOIX_MAX_PAR_PAIEMENT = 1000;
/** Au-delà, un paiement resté en attente est considéré comme échoué (RG 6.4). */
const ATTENTE_MAX_JOURS = 3;

// Lecture de la page publique ---------------------------------------------

/** Mise en cache le temps d'une requête : les métadonnées et la page partagent la lecture. */
export const lirePagePublique = cache(lirePagePubliqueSansCache);

async function lirePagePubliqueSansCache(slug: string) {
  const selection = await prisma.selection.findUnique({
    where: { slug },
    include: {
      evenement: { include: { organisation: { select: { nom: true, actif: true, paiementConfig: true } } } },
      typesVote: {
        where: { canal: "EN_LIGNE", actif: true },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
        select: {
          id: true,
          libelle: true,
          avecCriteres: true,
          criteres: { orderBy: [{ ordre: "asc" }, { id: "asc" }], select: { id: true, libelle: true, bareme: true } },
        },
      },
      participations: {
        where: { disponible: true },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
        include: { candidat: { select: { nom: true, ville: true, photoUrl: true } } },
      },
    },
  });
  if (!selection) return null;

  const enLigne = selection.typesVote[0] ?? null;
  // La page publique compte aussi les voix simulées : une répétition doit se
  // voir à l'écran. Les résultats officiels, eux, ne les comptent jamais.
  const sommes = enLigne
    ? await prisma.suffrage.groupBy({
        by: ["participationId"],
        where: { typeVoteId: enLigne.id, annuleLe: null },
        _sum: { poids: true },
      })
    : [];
  const voix = new Map(sommes.map((s) => [s.participationId, s._sum.poids ?? 0]));

  return {
    selection,
    enLigne,
    ouvert: voteOuvert(selection, enLigne !== null),
    mode: modePaiement(selection.evenement.organisation.paiementConfig),
    /** Vote noté sur critères : les critères à noter, sinon `null` (vote par voix). */
    criteres: enLigne?.avecCriteres ? enLigne.criteres : null,
    candidats: selection.participations.map((p) => ({
      participationId: p.id,
      ordre: p.ordre,
      nom: p.candidat.nom,
      ville: p.candidat.ville,
      photoUrl: p.candidat.photoUrl,
      voix: voix.get(p.id) ?? 0,
    })),
  };
}

/** RG 7.2 : sélection ouverte, vote en ligne actif, date de fin non dépassée, organisation active. */
export function voteOuvert(
  s: { etat: string; voteEnLigneOuvert: boolean; fin: Date | null; evenement: { organisation: { actif: boolean } } },
  aUnTypeEnLigne: boolean,
  maintenant = new Date(),
): boolean {
  return (
    aUnTypeEnLigne &&
    s.etat === "OUVERTE" &&
    s.voteEnLigneOuvert &&
    s.evenement.organisation.actif &&
    (s.fin === null || s.fin > maintenant)
  );
}

/** Ce qu'il faut pour accepter un vote : sélection ouverte, participation disponible. */
async function cible(slug: string, participationId: string) {
  const page = await prisma.selection.findUnique({
    where: { slug },
    include: {
      evenement: { include: { organisation: { select: { id: true, actif: true, paiementConfig: true } } } },
      typesVote: {
        where: { canal: "EN_LIGNE", actif: true },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
        select: { id: true, avecCriteres: true, criteres: { select: { id: true, libelle: true, bareme: true } } },
      },
      participations: { where: { id: participationId }, include: { candidat: { select: { nom: true } } } },
    },
  });
  if (!page) return { ok: false as const, erreur: "Ce vote n'existe pas." };
  const type = page.typesVote[0];
  if (!type || !voteOuvert(page, true)) return { ok: false as const, erreur: "Le vote est fermé." };
  const participation = page.participations[0];
  if (!participation || !participation.disponible) {
    return { ok: false as const, erreur: "Ce candidat n'est plus proposé au vote." };
  }
  return { ok: true as const, selection: page, typeVoteId: type.id, type, participation };
}

type Notes = Record<string, number>;

/**
 * Contrôle la note d'un vote noté sur critères : une valeur entière par
 * critère, de 0 à son barème. Pour un vote par voix, il n'y a rien à noter.
 */
function lireNotes(
  type: { avecCriteres: boolean; criteres: { id: string; libelle: string; bareme: number }[] },
  valeurs: unknown,
): { ok: true; notes: Notes | null } | { ok: false; erreur: string } {
  if (!type.avecCriteres) return { ok: true, notes: null };
  if (type.criteres.length === 0) return { ok: false, erreur: "Ce vote n'a pas encore de critères : prévenez l'organisateur." };
  const saisies = (valeurs && typeof valeurs === "object" ? valeurs : {}) as Record<string, unknown>;
  const notes: Notes = {};
  for (const c of type.criteres) {
    const v = saisies[c.id];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > c.bareme) {
      return { ok: false, erreur: `« ${c.libelle} » : choisissez une note de 0 à ${c.bareme}.` };
    }
    notes[c.id] = v;
  }
  return { ok: true, notes };
}

/** Les valeurs à créer avec le vote, pour les critères qui existent encore. */
function valeursDuVote(notes: unknown, criteres: { id: string }[]) {
  if (!notes || typeof notes !== "object") return undefined;
  const n = notes as Record<string, unknown>;
  const create = criteres
    .filter((c) => typeof n[c.id] === "number")
    .map((c) => ({ critereId: c.id, valeur: n[c.id] as number }));
  return create.length > 0 ? { create } : undefined;
}

// Voix gratuite ------------------------------------------------------------------

export type ResultatVote = { ok: true; message: string } | { ok: false; erreur: string };

/**
 * Une voix gratuite par numéro et par vote en ligne (RG 7.4 ; une sélection n'en a qu'un), sans code SMS (risque accepté).
 *
 * L'identifiant est toujours lu comme un numéro ivoirien (`parsePhone` avec le
 * pays par défaut), jamais deviné via `normalizePhone`/`detectPhoneCountry` :
 * un même numéro local préfixé d'un faux indicatif (`+1`, `+229`, `+33`…)
 * produirait sinon un identifiant différent à chaque essai et contournerait la
 * contrainte d'unicité ci-dessous (plusieurs voix gratuites pour un seul
 * numéro). Le paiement, qui n'a pas cette contrainte, garde `normalizePhone`
 * et continue d'accepter tous les pays de `PHONE_COUNTRIES`.
 */
export async function voterGratuit(
  slug: string,
  participationId: string,
  telephone: string,
  valeurs?: unknown,
): Promise<ResultatVote> {
  const c = await cible(slug, participationId);
  if (!c.ok) return c;
  if (!c.selection.voixGratuite) return { ok: false, erreur: "Ce vote n'accorde pas de voix gratuite." };
  const lu = lireNotes(c.type, valeurs);
  if (!lu.ok) return lu;

  const analyse = parsePhone(telephone, DEFAULT_PHONE_COUNTRY);
  if (!analyse.ok) return { ok: false, erreur: "Entrez un numéro ivoirien valide. Exemple : 07 00 00 00 00." };
  const identifiant = analyse.phone;

  try {
    await prisma.$transaction(async (tx) => {
      const votant = await tx.votant.create({ data: { selectionId: c.selection.id, typeVoteId: c.typeVoteId, identifiant } });
      await tx.suffrage.create({
        data: {
          id: randomUUID(),
          participationId,
          typeVoteId: c.typeVoteId,
          poids: 1,
          origine: "GRATUIT",
          votantId: votant.id,
          valeurs: valeursDuVote(lu.notes, c.type.criteres),
        },
      });
    });
  } catch (erreur) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
      return { ok: false, erreur: "Ce numéro a déjà utilisé sa voix gratuite. Pour voter encore, achetez des voix." };
    }
    throw erreur;
  }
  return {
    ok: true,
    message: lu.notes
      ? `Merci ! Votre note pour ${c.participation.candidat.nom} est comptée.`
      : `Merci ! Votre voix pour ${c.participation.candidat.nom} est comptée.`,
  };
}

// Paiement ------------------------------------------------------------------------

export interface Recu {
  reference: string;
  candidat: string;
  voix: number;
  montant: number;
  moyen: PaymentMethod;
  statut: "PENDING" | "CONFIRMED" | "FAILED";
  simule: boolean;
  /** Le paiement achetait une note sur critères, pas des voix. */
  note: boolean;
}

export type ResultatPaiement =
  | { ok: true; type: "confirme"; recu: Recu }
  | { ok: true; type: "redirection"; url: string; reference: string }
  | { ok: false; erreur: string };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function nouvelleReference() {
  let r = "DV-";
  for (let i = 0; i < 7; i++) r += ALPHABET[randomInt(ALPHABET.length)];
  return r;
}

function recu(p: {
  reference: string;
  candidatNom: string;
  voix: number;
  montant: number;
  moyen: string;
  statut: string;
  simule: boolean;
  notes?: unknown;
}): Recu {
  return {
    reference: p.reference,
    candidat: p.candidatNom,
    voix: p.voix,
    montant: p.montant,
    moyen: (PAYMENT_METHODS as readonly string[]).includes(p.moyen) ? (p.moyen as PaymentMethod) : "WAVE",
    statut: p.statut === "CONFIRMED" || p.statut === "FAILED" ? p.statut : "PENDING",
    simule: p.simule,
    note: p.notes !== null && p.notes !== undefined,
  };
}

/**
 * Demande le paiement d'un lot de voix. La page n'envoie que la quantité : le
 * montant est recalculé ici à partir du prix de la sélection (RG 6.5).
 */
export async function demanderPaiement(input: {
  slug: string;
  participationId: string;
  voix: number;
  moyen: string;
  telephone: string;
  /** Vote noté sur critères : la note, une valeur par critère. */
  valeurs?: unknown;
}): Promise<ResultatPaiement> {
  const c = await cible(input.slug, input.participationId);
  if (!c.ok) return c;
  const lu = lireNotes(c.type, input.valeurs);
  if (!lu.ok) return lu;
  // Noté sur critères : un paiement achète une note, jamais un lot.
  if (lu.notes) input = { ...input, voix: 1 };

  if (!Number.isInteger(input.voix) || input.voix < 1 || input.voix > VOIX_MAX_PAR_PAIEMENT) {
    return { ok: false, erreur: `Choisissez entre 1 et ${VOIX_MAX_PAR_PAIEMENT} voix.` };
  }
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.moyen) || !c.selection.moyensPaiement.includes(input.moyen)) {
    return { ok: false, erreur: "Ce moyen de paiement n'est pas proposé." };
  }
  const moyen = input.moyen as PaymentMethod;
  const telephone = normalizePhone(input.telephone);
  if (!telephone) return { ok: false, erreur: "Numéro invalide. Exemple : 07 00 00 00 00." };

  const montant = input.voix * c.selection.prixVote;
  if (montant < MIN_PAYMENT_AMOUNT) return { ok: false, erreur: `Le paiement minimum est de ${MIN_PAYMENT_AMOUNT} FCFA.` };

  const recents = await prisma.paiement.count({
    where: { telephone, creeLe: { gte: new Date(Date.now() - FENETRE_MS) } },
  });
  if (recents >= LIMITE_TELEPHONE) return { ok: false, erreur: "Trop de demandes pour ce numéro. Réessayez dans quelques minutes." };

  const base = {
    organisationId: c.selection.evenement.organisation.id,
    selectionId: c.selection.id,
    participationId: c.participation.id,
    candidatNom: c.participation.candidat.nom,
    voix: input.voix,
    prixUnitaire: c.selection.prixVote,
    montant,
    moyen,
    telephone,
    notes: lu.notes ?? undefined,
  };

  if (modePaiement(c.selection.evenement.organisation.paiementConfig) === "simulation") {
    for (let essai = 0; essai < 5; essai++) {
      try {
        const paiement = await prisma.$transaction(async (tx) => {
          const p = await tx.paiement.create({
            data: { ...base, reference: nouvelleReference(), statut: "CONFIRMED", simule: true, confirmeLe: new Date() },
          });
          await tx.suffrage.create({
            data: {
              id: randomUUID(),
              participationId: c.participation.id,
              typeVoteId: c.typeVoteId,
              poids: input.voix,
              origine: "PAIEMENT",
              paiementId: p.id,
              valeurs: valeursDuVote(lu.notes, c.type.criteres),
            },
          });
          return p;
        });
        return { ok: true, type: "confirme", recu: recu(paiement) };
      } catch (erreur) {
        // Référence déjà prise (improbable) : on en tire une autre.
        if (!(erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002")) throw erreur;
      }
    }
    return { ok: false, erreur: "Le paiement n'a pas abouti. Réessayez dans un instant." };
  }

  const demande = await createSirapPayment({
    phone: telephone,
    method: moyen,
    amount: montant,
    label: `DV|${c.selection.id}|${c.participation.id}|${lu.notes ? "note" : `x${input.voix}`}`,
  });
  if (!demande.ok) return { ok: false, erreur: demande.error };

  // Enregistré avant d'envoyer le votant payer : sans cette trace, un paiement
  // confirmé ne compterait jamais.
  try {
    await prisma.paiement.create({
      data: { ...base, reference: demande.reference, refPrestataire: demande.transaction || null, statut: "PENDING" },
    });
  } catch (erreur) {
    console.error(`Paiement ${demande.reference} non enregistré`, erreur);
    return { ok: false, erreur: "Le paiement n'a pas pu être enregistré. Ne payez pas : réessayez dans un instant." };
  }
  return { ok: true, type: "redirection", url: demande.url, reference: demande.reference };
}

/**
 * Confirme un paiement et crée son vote, une seule fois : la confirmation est
 * conditionnelle (PENDING → CONFIRMED) et le vote est unique par paiement.
 */
export async function confirmerPaiement(paiementId: string, refPrestataire: string | null): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.paiement.updateMany({
      where: { id: paiementId, statut: "PENDING" },
      data: { statut: "CONFIRMED", confirmeLe: new Date(), ...(refPrestataire ? { refPrestataire } : {}) },
    });
    if (count !== 1) return false;
    const p = await tx.paiement.findUniqueOrThrow({ where: { id: paiementId } });
    // Candidat retiré entre-temps : le paiement reste une trace comptable (RG 6.7).
    if (!p.participationId || !p.selectionId) return true;
    const type = await tx.typeVote.findFirst({
      where: { selectionId: p.selectionId, canal: "EN_LIGNE", actif: true },
      select: { id: true, avecCriteres: true, criteres: { select: { id: true } } },
    });
    if (!type) return true;
    await tx.suffrage.create({
      data: {
        id: randomUUID(),
        participationId: p.participationId,
        typeVoteId: type.id,
        poids: p.voix,
        origine: "PAIEMENT",
        paiementId: p.id,
        // La note payée, critère par critère. Un critère supprimé entre-temps
        // est ignoré : il compte alors 0 dans la moyenne.
        valeurs: type.avecCriteres ? valeursDuVote(p.notes, type.criteres) : undefined,
      },
    });
    return true;
  });
}

/**
 * Redemande à la passerelle le statut des paiements en attente : au retour du
 * votant, depuis le panneau et par la tâche planifiée. Renvoie le nombre de
 * paiements dont le statut a changé.
 */
export async function rafraichirPaiementsSaas(references?: string[]): Promise<number> {
  // Les paiements trop anciens échouent d'un coup (RG 6.4) : ils ne doivent
  // pas occuper les places des vérifications suivantes.
  const expire = await prisma.paiement.updateMany({
    where: {
      statut: "PENDING",
      simule: false,
      creeLe: { lt: new Date(Date.now() - ATTENTE_MAX_JOURS * 86_400_000) },
      ...(references ? { reference: { in: references } } : {}),
    },
    data: { statut: "FAILED" },
  });
  let changes = expire.count;

  // Les plus récents d'abord : ce sont ceux qu'un votant attend. Les anciens
  // restés en suspens chez l'opérateur ne bloquent pas les nouveaux.
  const enAttente = await prisma.paiement.findMany({
    where: { statut: "PENDING", simule: false, ...(references ? { reference: { in: references } } : {}) },
    orderBy: { creeLe: "desc" },
    take: 50,
  });

  for (const p of enAttente) {
    const r = await checkSirapPayment(p.reference);
    if (!r || r.status === "pending") continue;
    if (r.status === "success") {
      if (await confirmerPaiement(p.id, r.transaction || null)) changes++;
    } else {
      const { count } = await prisma.paiement.updateMany({ where: { id: p.id, statut: "PENDING" }, data: { statut: "FAILED" } });
      changes += count;
    }
  }
  return changes;
}

/** Où en est un paiement, par sa référence (jamais le numéro). */
export async function etatPaiement(reference: string): Promise<Recu | null> {
  if (typeof reference !== "string" || reference.length === 0 || reference.length > 64) return null;
  let p = await prisma.paiement.findUnique({ where: { reference } });
  if (!p) return null;
  if (p.statut === "PENDING" && !p.simule && (await rafraichirPaiementsSaas([reference])) > 0) {
    p = await prisma.paiement.findUnique({ where: { reference } });
    if (!p) return null;
  }
  return recu(p);
}
