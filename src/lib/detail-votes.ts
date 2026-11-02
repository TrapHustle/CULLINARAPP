import { prisma } from "./prisma";

/**
 * Le détail des votes derrière une note du classement : chaque vote des
 * tablettes et des liens (avec ses notes par critère), chaque paiement du
 * vote en ligne. Les votes annulés ou corrigés restent listés, marqués : la
 * trace compte autant que le résultat (RG 5.7).
 */

export interface VoteDetaille {
  id: string;
  participationId: string;
  /** « Votant 2 », le nom d'un juré spécial, ou un numéro masqué. */
  votant: string;
  /** Table ou tablette, « Lien du vote », « Saisie »… */
  provenance: string;
  /** Notes dans l'ordre des critères du type ; `null` sans critère. */
  valeurs: number[] | null;
  total: number | null;
  poids: number;
  creeLe: string;
  annuleLe: string | null;
  /** Ce vote en remplace un autre : c'est une correction. */
  correction: boolean;
}

export interface PaiementDetaille {
  id: string;
  participationId: string | null;
  reference: string;
  creeLe: string;
  moyen: string;
  telephone: string;
  voix: number;
  montant: number;
  /** "PENDING" | "CONFIRMED" | "FAILED" */
  statut: string;
  simule: boolean;
  /** Compté dans la note : confirmé, et réel (ou simulé en mode essai). */
  compte: boolean;
}

export interface TypeDetaille {
  typeVoteId: string;
  libelle: string;
  part: number;
  canal: string;
  avecCriteres: boolean;
  criteres: { libelle: string; bareme: number }[];
  baremeTotal: number;
  votes: VoteDetaille[];
  /** Vote en ligne payant seulement. */
  paiements: PaiementDetaille[] | null;
  /** Voix comptées de tous les candidats pour ce type : base du calcul en part de voix. */
  voixSelection: number;
  /** "A" | "B" | "C" pour le vote en ligne payant, "A" (part des voix) pour les autres voix. */
  mode: string;
}

export interface DetailVotes {
  prixVote: number;
  types: TypeDetaille[];
}

/** Numéro de téléphone masqué : on voit qui a voté sans exposer le numéro entier. */
export function masquerTelephone(telephone: string | null | undefined): string {
  if (!telephone) return "—";
  // Indicatif de la Côte d'Ivoire retiré : le numéro se lit comme on le compose.
  const chiffres = telephone.replace(/\D/g, "").replace(/^225(?=\d{10}$)/, "");
  if (chiffres.length < 6) return "••••";
  return `${chiffres.slice(0, 2)} ${chiffres.slice(2, 4)} •• •• ${chiffres.slice(-2)}`;
}

const PROVENANCE: Record<string, string> = {
  PAIEMENT: "Paiement",
  GRATUIT: "Voix gratuite",
  IMPORT: "Import",
  SAISIE: "Saisie manuelle",
  QR: "Lien du vote",
};

/**
 * Détail des votes d'une sélection, pour un candidat ou pour tous. `null` si
 * la sélection n'appartient pas à l'organisation.
 */
export async function detailVotes(
  organisationId: string,
  selectionId: string,
  options: { participationId?: string; inclureSimules?: boolean } = {},
): Promise<DetailVotes | null> {
  const selection = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    select: {
      prixVote: true,
      modeEnLigne: true,
      typesVote: {
        where: { actif: true },
        orderBy: { ordre: "asc" },
        include: { criteres: { orderBy: { ordre: "asc" } } },
      },
    },
  });
  if (!selection) return null;

  const pour = options.participationId ? { participationId: options.participationId } : {};
  const [suffrages, paiements] = await Promise.all([
    prisma.suffrage.findMany({
      where: { participation: { selectionId }, ...pour },
      orderBy: { creeLe: "asc" },
      include: {
        valeurs: { select: { critereId: true, valeur: true } },
        table: { select: { nom: true } },
        votant: { select: { identifiant: true } },
        paiement: { select: { simule: true } },
      },
    }),
    prisma.paiement.findMany({ where: { selectionId, ...pour }, orderBy: { creeLe: "asc" } }),
  ]);

  const avecSimules = options.inclureSimules === true;
  // Voix comptées de toute la sélection, type par type : le calcul en part de
  // voix dépend des autres candidats, même quand on n'en détaille qu'un.
  const voixParType = new Map<string, number>();
  for (const s of await prisma.suffrage.groupBy({
    by: ["typeVoteId"],
    where: { participation: { selectionId }, annuleLe: null, ...(avecSimules ? {} : { NOT: { paiement: { simule: true } } }) },
    _sum: { poids: true },
  })) {
    voixParType.set(s.typeVoteId, s._sum.poids ?? 0);
  }

  return {
    prixVote: selection.prixVote,
    types: selection.typesVote.map((type) => {
      const enLignePayant = type.canal === "EN_LIGNE";
      const votes = suffrages
        .filter((s) => s.typeVoteId === type.id)
        // Les voix payées sont détaillées par leur paiement.
        .filter((s) => !(enLignePayant && s.origine === "PAIEMENT"))
        .filter((s) => avecSimules || !s.paiement?.simule)
        .map((s): VoteDetaille => {
          const valeurs = type.avecCriteres
            ? type.criteres.map((c) => s.valeurs.find((v) => v.critereId === c.id)?.valeur ?? 0)
            : null;
          return {
            id: s.id,
            participationId: s.participationId,
            votant:
              s.jureNom ??
              (s.jureIndex != null
                ? `Votant ${s.jureIndex}`
                : s.votant
                  ? masquerTelephone(s.votant.identifiant)
                  : (PROVENANCE[s.origine] ?? s.origine)),
            provenance: s.origine === "TABLETTE" ? (s.table?.nom ?? "Tablette") : (PROVENANCE[s.origine] ?? s.origine),
            valeurs,
            total: valeurs ? valeurs.reduce((a, b) => a + b, 0) : null,
            poids: s.poids,
            creeLe: s.creeLe.toISOString(),
            annuleLe: s.annuleLe?.toISOString() ?? null,
            correction: s.remplaceId !== null,
          };
        });

      return {
        typeVoteId: type.id,
        libelle: type.libelle,
        part: type.part,
        canal: type.canal,
        avecCriteres: type.avecCriteres,
        criteres: type.criteres.map((c) => ({ libelle: c.libelle, bareme: c.bareme })),
        baremeTotal: type.criteres.reduce((somme, c) => somme + c.bareme, 0),
        votes,
        paiements: enLignePayant
          ? paiements.map((p) => ({
              id: p.id,
              participationId: p.participationId,
              reference: p.reference,
              creeLe: p.creeLe.toISOString(),
              moyen: p.moyen,
              telephone: masquerTelephone(p.telephone),
              voix: p.voix,
              montant: p.montant,
              statut: p.statut,
              simule: p.simule,
              compte: p.statut === "CONFIRMED" && (avecSimules || !p.simule),
            }))
          : null,
        voixSelection: voixParType.get(type.id) ?? 0,
        mode: enLignePayant ? selection.modeEnLigne : "A",
      };
    }),
  };
}

export const MOYENS: Record<string, string> = {
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MTN: "MTN MoMo",
  CARD: "Carte",
};
