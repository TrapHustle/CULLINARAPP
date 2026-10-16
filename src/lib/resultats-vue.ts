import { prisma } from "./prisma";
import type { Instantane } from "./pilotage";
import { calculerResultats } from "./resultats-saas";

/**
 * Le classement d'une sélection tel qu'on l'affiche : calculé en direct tant
 * qu'elle est ouverte, relu dans son archive une fois clôturée (RG 9.5).
 */

export interface LigneVue {
  participationId: string;
  rang: number | null;
  note: number | null;
  egalite: boolean;
  nom: string;
  ville: string | null;
  photoUrl: string | null;
  qualifie: boolean;
  types: { typeVoteId: string; note: number | null; volume: number }[];
}

export interface VueResultats {
  selection: { id: string; libelle: string; etat: string; nbQualifies: number; evenementNom: string; afficheUrl: string | null };
  types: { id: string; libelle: string; part: number; canal: string }[];
  lignes: LigneVue[];
  /** Date de clôture si le classement vient de l'archive. */
  figeLe: Date | null;
  inclutSimules: boolean;
}

export async function vueResultats(
  organisationId: string,
  selectionId: string,
  options: { inclureSimules?: boolean } = {},
): Promise<VueResultats | null> {
  const s = await prisma.selection.findFirst({
    where: { id: selectionId, evenement: { organisationId } },
    include: {
      evenement: { select: { nom: true, afficheUrl: true } },
      typesVote: { orderBy: { ordre: "asc" }, select: { id: true, libelle: true, part: true, canal: true } },
      participations: { include: { candidat: { select: { photoUrl: true } } } },
      archives: { orderBy: { clotureLe: "desc" }, take: 1 },
    },
  });
  if (!s) return null;

  const selection = {
    id: s.id,
    libelle: s.libelle,
    etat: s.etat,
    nbQualifies: s.nbQualifies,
    evenementNom: s.evenement.nom,
    afficheUrl: s.evenement.afficheUrl,
  };
  const parId = new Map(s.participations.map((p) => [p.id, p]));
  const archive = s.etat === "CLOTUREE" ? s.archives[0] : undefined;

  if (archive) {
    const instantane = archive.snapshot as unknown as Instantane;
    return {
      selection,
      types: instantane.types,
      figeLe: archive.clotureLe,
      inclutSimules: false,
      lignes: instantane.classement.map((l) => ({
        ...l,
        photoUrl: parId.get(l.participationId)?.candidat.photoUrl ?? null,
        // La qualification se lit en base : elle peut avoir été corrigée après la clôture.
        qualifie: parId.get(l.participationId)?.qualifie ?? false,
      })),
    };
  }

  const r = await calculerResultats(selectionId, options);
  return {
    selection,
    types: s.typesVote,
    figeLe: null,
    inclutSimules: r.inclutSimules,
    lignes: r.classement.map((l) => ({
      participationId: l.candidat.participationId,
      rang: l.rang,
      note: l.note,
      egalite: l.egalite,
      nom: l.candidat.nom,
      ville: l.candidat.ville,
      photoUrl: l.candidat.photoUrl,
      qualifie: l.candidat.qualifie,
      types: l.candidat.types.map((t) => ({ typeVoteId: t.typeVoteId, note: t.note, volume: t.volume })),
    })),
  };
}

/** Le classement en CSV (séparateur « ; », lisible par Excel en français). */
export function versCsv(vue: VueResultats): string {
  const echapper = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const nombre = (n: number | null) => (n === null ? "" : (Math.round(n * 100) / 100).toString().replace(".", ","));
  const entete = [
    "Rang",
    "Candidat",
    "Ville",
    ...vue.types.flatMap((t) => [`${t.libelle} (sur 100)`, `${t.libelle} (volume)`]),
    "Note finale (sur 100)",
    "Égalité",
    "Qualifié",
  ];
  const lignes = vue.lignes.map((l) => [
    l.rang?.toString() ?? "non noté",
    l.nom,
    l.ville ?? "",
    ...vue.types.flatMap((t) => {
      const n = l.types.find((x) => x.typeVoteId === t.id);
      return [nombre(n?.note ?? null), (n?.volume ?? 0).toString()];
    }),
    nombre(l.note),
    l.egalite ? "oui" : "",
    l.qualifie ? "oui" : "",
  ]);
  return "﻿" + [entete, ...lignes].map((cols) => cols.map((c) => echapper(String(c))).join(";")).join("\r\n");
}
