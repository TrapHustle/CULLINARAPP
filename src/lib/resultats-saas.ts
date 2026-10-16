import { prisma } from "./prisma";
import {
  classer,
  noteCriteres,
  noteFinale,
  notesEnLigne,
  type LigneClassement,
  type ModeEnLigne,
} from "./calcul";

/**
 * Résultats d'une sélection, lus dans le modèle SaaS (tables `Suffrage`,
 * `Valeur`, `TypeVote`…) et calculés par `calcul.ts`.
 */

export interface NoteParType {
  typeVoteId: string;
  libelle: string;
  part: number;
  /** Sur 100, `null` si ce type ne s'est pas prononcé sur ce candidat. */
  note: number | null;
  /** Nombre de votes (avec critères) ou de voix (sans critère). */
  volume: number;
}

export interface ResultatCandidat {
  participationId: string;
  candidatId: string;
  nom: string;
  ville: string | null;
  photoUrl: string | null;
  qualifie: boolean;
  types: NoteParType[];
}

export interface ResultatsSelection {
  selectionId: string;
  classement: LigneClassement<ResultatCandidat>[];
  /** Voix des paiements simulés comptées (mode essai), jamais dans un résultat officiel. */
  inclutSimules: boolean;
}

export interface OptionsCalcul {
  /**
   * Compter les voix des paiements simulés. Réservé à l'aperçu d'essai du
   * panneau : un résultat officiel (clôture, archive) ne les compte jamais.
   */
  inclureSimules?: boolean;
}

export async function calculerResultats(selectionId: string, options: OptionsCalcul = {}): Promise<ResultatsSelection> {
  const selection = await prisma.selection.findUniqueOrThrow({
    where: { id: selectionId },
    include: {
      paliers: true,
      typesVote: { include: { criteres: true }, orderBy: { ordre: "asc" } },
      participations: { include: { candidat: true }, orderBy: { ordre: "asc" } },
    },
  });

  const suffrages = await prisma.suffrage.findMany({
    where: { participation: { selectionId }, annuleLe: null },
    select: {
      participationId: true,
      typeVoteId: true,
      poids: true,
      valeurs: { select: { valeur: true } },
      // Un paiement simulé s'affiche sur la page publique mais ne compte
      // jamais dans un résultat officiel.
      paiement: { select: { simule: true } },
    },
  });

  const inclutSimules = options.inclureSimules === true;
  const officiels = inclutSimules ? suffrages : suffrages.filter((s) => !s.paiement?.simule);
  const mode = selection.modeEnLigne as ModeEnLigne;

  // Notes par type, calculées type par type pour tous les candidats : le vote
  // en ligne en modes A et C dépend des voix des autres.
  const notes = new Map<string, Map<string, { note: number | null; volume: number }>>();

  for (const type of selection.typesVote) {
    const parCandidat = new Map<string, { note: number | null; volume: number }>();
    const duType = officiels.filter((s) => s.typeVoteId === type.id);

    if (type.avecCriteres) {
      const baremeTotal = type.criteres.reduce((somme, c) => somme + c.bareme, 0);
      for (const p of selection.participations) {
        const totaux = duType
          .filter((s) => s.participationId === p.id)
          .map((s) => s.valeurs.reduce((somme, v) => somme + v.valeur, 0));
        parCandidat.set(p.id, { note: noteCriteres(totaux, baremeTotal), volume: totaux.length });
      }
    } else {
      const voix = new Map(selection.participations.map((p) => [p.id, 0]));
      for (const s of duType) voix.set(s.participationId, (voix.get(s.participationId) ?? 0) + s.poids);
      const enLigne = notesEnLigne(voix, mode, selection.paliers);
      for (const p of selection.participations) {
        parCandidat.set(p.id, { note: enLigne?.get(p.id) ?? null, volume: voix.get(p.id) ?? 0 });
      }
    }

    notes.set(type.id, parCandidat);
  }

  const entrees = selection.participations.map((p) => {
    const types: NoteParType[] = selection.typesVote.map((type) => {
      const n = notes.get(type.id)?.get(p.id);
      return { typeVoteId: type.id, libelle: type.libelle, part: type.part, note: n?.note ?? null, volume: n?.volume ?? 0 };
    });
    return {
      candidat: {
        participationId: p.id,
        candidatId: p.candidatId,
        nom: p.candidat.nom,
        ville: p.candidat.ville,
        photoUrl: p.candidat.photoUrl,
        qualifie: p.qualifie,
        types,
      },
      note: noteFinale(types)?.note ?? null,
    };
  });

  return { selectionId, classement: classer(entrees), inclutSimules };
}
