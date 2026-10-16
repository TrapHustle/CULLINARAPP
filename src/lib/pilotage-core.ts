import { problemesGrille, type TypeAControler } from "./grille-core";
import { MIN_VOTE_PRICE } from "./public-vote-core";

/**
 * Pilotage d'une sélection : contrôle avant ouverture, qualifiés proposés.
 * Sans base ni réseau.
 */

export interface Controle {
  libelle: string;
  ok: boolean;
  /** Ce qu'il faut faire quand le contrôle échoue. */
  detail?: string;
}

export interface SelectionAControler {
  etat: string;
  fin: Date | null;
  modeEnLigne: string;
  prixVote: number;
  moyensPaiement: string[];
  paliers: unknown[];
  types: TypeAControler[];
  participations: { disponible: boolean }[];
}

/**
 * Tout ce qui doit être réglé avant d'ouvrir une sélection au vote. La
 * sélection ne s'ouvre que si chaque contrôle passe.
 */
export function controlesOuverture(s: SelectionAControler, maintenant = new Date()): Controle[] {
  const problemes = problemesGrille(s.types);
  const enLigne = s.types.some((t) => t.canal === "EN_LIGNE");
  const disponibles = s.participations.filter((p) => p.disponible).length;

  const controles: Controle[] = [
    {
      libelle: "Grille de vote complète, parts à 100 %",
      ok: problemes.length === 0,
      detail: problemes.join(" "),
    },
    {
      libelle: "Au moins deux candidats disponibles",
      ok: disponibles >= 2,
      detail: `${disponibles} candidat${disponibles > 1 ? "s" : ""} disponible${disponibles > 1 ? "s" : ""} : inscrivez-en dans l'onglet Candidats.`,
    },
  ];

  if (enLigne) {
    controles.push({
      libelle: "Vote en ligne réglé (prix, moyens de paiement, mode de calcul)",
      ok:
        s.prixVote >= MIN_VOTE_PRICE &&
        s.moyensPaiement.length > 0 &&
        (s.modeEnLigne !== "B" || s.paliers.length > 0),
      detail:
        s.moyensPaiement.length === 0
          ? "Cochez au moins un moyen de paiement dans l'onglet Vote en ligne."
          : s.modeEnLigne === "B" && s.paliers.length === 0
            ? "Le mode B demande au moins un palier (onglet Vote en ligne)."
            : `Le prix d'une voix doit valoir au moins ${MIN_VOTE_PRICE} FCFA.`,
    });
  }

  if (s.fin) {
    controles.push({
      libelle: "Fin du vote en ligne dans le futur",
      ok: s.fin > maintenant,
      detail: "La date de fin est passée : modifiez-la ci-dessous ou videz-la.",
    });
  }

  return controles;
}

export const peutOuvrir = (controles: Controle[]) => controles.every((c) => c.ok);

/**
 * Qualifiés proposés à la clôture : les `nb` premiers du classement. Les ex
 * æquo sur la dernière place qualificative sont tous proposés : l'organisateur
 * arbitre (RG 8.5) en décochant.
 */
export function qualifiesProposes(
  classement: { participationId: string; rang: number | null }[],
  nb: number,
): Set<string> {
  if (nb <= 0) return new Set();
  const notes = classement.filter((l) => l.rang !== null);
  const dernierRang = notes[Math.min(nb, notes.length) - 1]?.rang ?? 0;
  return new Set(notes.filter((l) => (l.rang ?? Infinity) <= dernierRang).map((l) => l.participationId));
}
