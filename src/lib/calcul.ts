/**
 * Moteur de calcul du SaaS — notes sur 100 et désignation du vainqueur.
 *
 * Remplace `scoring.ts` à terme. Toutes les fonctions sont **pures** : aucune
 * base de données, aucun effet de bord. Les règles citées (RG x.y) sont celles
 * de `docs/regles-de-gestion.md` dans le dépôt parent.
 *
 * Le principe (RG 8.6) : chaque type de vote est ramené sur **100** avant qu'on
 * lui applique sa part. Une grille sur 30 points et un décompte de 1 700 voix
 * deviennent ainsi comparables, et la note finale est elle aussi sur 100.
 */

/** Mode de conversion des voix en ligne en note sur 100 (RG 8.3). */
export type ModeEnLigne = "A" | "B" | "C";

/**
 * Un palier du mode B : `points` (sur 100) sont atteints à `voixMax` voix.
 * Entre deux plafonds, la note suit la règle de trois.
 */
export interface Palier {
  voixMax: number;
  points: number;
}

/**
 * Note sur 100 d'un type **avec critères** (RG 8.1).
 *
 *   note = moyenne obtenue ÷ barème total × 100
 *
 * `null` si le candidat n'a reçu aucun vote de ce type : il n'est pas noté par
 * ce type, ce qui n'est pas la même chose qu'un zéro.
 */
export function noteCriteres(totauxDesVotes: number[], baremeTotal: number): number | null {
  if (totauxDesVotes.length === 0 || baremeTotal <= 0) return null;
  const moyenne = totauxDesVotes.reduce((somme, total) => somme + total, 0) / totauxDesVotes.length;
  return (moyenne / baremeTotal) * 100;
}

/**
 * Note sur 100 en mode B : règle de trois entre les plafonds des paliers.
 *
 * On part de 0 voix = 0 point. Dans chaque palier, la note progresse en ligne
 * droite des points du palier précédent jusqu'aux siens. Au-delà du dernier
 * plafond, elle reste aux points du dernier palier.
 *
 * Exemple avec 250 → 15, 750 → 40 : 10 voix = 0,6 ; 500 voix = 27,5.
 */
export function notePaliers(voix: number, paliers: Palier[]): number {
  const tries = [...paliers].sort((a, b) => a.voixMax - b.voixMax);
  let plafondPrecedent = 0;
  let pointsPrecedents = 0;

  for (const palier of tries) {
    if (voix <= palier.voixMax) {
      const largeur = palier.voixMax - plafondPrecedent;
      if (largeur <= 0) return palier.points;
      return pointsPrecedents + ((voix - plafondPrecedent) * (palier.points - pointsPrecedents)) / largeur;
    }
    plafondPrecedent = palier.voixMax;
    pointsPrecedents = palier.points;
  }

  return pointsPrecedents;
}

/**
 * Notes sur 100 du vote en ligne, pour tous les candidats d'une sélection
 * (RG 8.3). Le calcul est collectif : les modes A et C dépendent des voix des
 * autres candidats.
 *
 * Retourne `null` si **personne** n'a voté en ligne : le type sort alors du
 * calcul (RG 8.4). Dès qu'au moins une voix existe, un candidat sans voix
 * reçoit 0 — sinon il vaudrait mieux n'avoir aucune voix qu'en avoir une.
 */
export function notesEnLigne(
  voixParCandidat: Map<string, number>,
  mode: ModeEnLigne,
  paliers: Palier[] = [],
): Map<string, number> | null {
  const voix = [...voixParCandidat.values()];
  const total = voix.reduce((somme, n) => somme + n, 0);
  if (total <= 0) return null;

  const leader = Math.max(...voix);
  const notes = new Map<string, number>();

  for (const [candidat, n] of voixParCandidat) {
    switch (mode) {
      case "A":
        notes.set(candidat, (n / total) * 100);
        break;
      case "B":
        notes.set(candidat, notePaliers(n, paliers));
        break;
      case "C":
        notes.set(candidat, (n / leader) * 100);
        break;
    }
  }

  return notes;
}

/** La note d'un candidat pour un type de vote, avec la part de ce type. */
export interface NoteDeType {
  /** Sur 100, ou `null` si ce type ne s'est pas prononcé sur ce candidat. */
  note: number | null;
  /** Part du type dans la note finale, en pourcentage (RG 4.5). */
  part: number;
}

/**
 * Note finale sur 100 (RG 8.4).
 *
 *   finale = Σ (note du type × sa part) ÷ Σ (parts retenues)
 *
 * Un type sans note ou à part nulle sort du calcul au lieu de valoir zéro.
 * `null` si aucun type n'est retenu : le candidat est « non noté » (RG 8.8).
 */
export function noteFinale(types: NoteDeType[]): { note: number; partsRetenues: number } | null {
  let cumul = 0;
  let partsRetenues = 0;

  for (const { note, part } of types) {
    if (note === null || part <= 0) continue;
    cumul += note * part;
    partsRetenues += part;
  }

  if (partsRetenues === 0) return null;
  return { note: cumul / partsRetenues, partsRetenues };
}

export interface LigneClassement<T> {
  candidat: T;
  note: number | null;
  /** À partir de 1, partagé par les ex æquo. `null` pour un non noté. */
  rang: number | null;
  /** Vrai si un autre candidat a exactement la même note : l'organisateur arbitre (RG 8.5). */
  egalite: boolean;
}

/**
 * Classement par note finale décroissante (RG 8.5). Les ex æquo partagent leur
 * rang et sont signalés ; les non notés sont placés à la fin, sans rang.
 *
 * L'égalité se compare sur la note arrondie au centième, celle qui s'affiche :
 * deux notes qui diffèrent à la quinzième décimale ne doivent ni départager
 * deux candidats ni cacher une égalité visible à l'écran.
 */
export function classer<T>(entrees: { candidat: T; note: number | null }[]): LigneClassement<T>[] {
  const notes = entrees
    .filter((e): e is { candidat: T; note: number } => e.note !== null)
    .map((e) => ({ ...e, cle: arrondi2(e.note) }))
    .sort((a, b) => b.cle - a.cle);

  const occurrences = new Map<number, number>();
  for (const e of notes) occurrences.set(e.cle, (occurrences.get(e.cle) ?? 0) + 1);

  const lignes: LigneClassement<T>[] = [];
  let rangPrecedent = 0;
  let clePrecedente: number | null = null;

  notes.forEach((e, index) => {
    const rang = e.cle === clePrecedente ? rangPrecedent : index + 1;
    rangPrecedent = rang;
    clePrecedente = e.cle;
    lignes.push({ candidat: e.candidat, note: e.note, rang, egalite: (occurrences.get(e.cle) ?? 0) > 1 });
  });

  for (const e of entrees) {
    if (e.note === null) lignes.push({ candidat: e.candidat, note: null, rang: null, egalite: false });
  }

  return lignes;
}

/** Arrondi d'affichage au centième. Jamais dans un calcul intermédiaire. */
export function arrondi2(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}
