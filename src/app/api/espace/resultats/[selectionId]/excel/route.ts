import ExcelJS from "exceljs";
import { detailVotes, MOYENS } from "@/lib/detail-votes";
import { utilisateurConnecte } from "@/lib/espace";
import { vueResultats } from "@/lib/resultats-vue";

export const dynamic = "force-dynamic";

const STATUTS: Record<string, string> = { CONFIRMED: "confirmé", PENDING: "en attente", FAILED: "échoué" };
const arrondi = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/** Nom de feuille Excel : 31 caractères, sans `[]:*?/\`, unique dans le classeur. */
function nomFeuille(libelle: string, pris: Set<string>): string {
  const base = libelle.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Vote";
  let nom = base;
  for (let i = 2; pris.has(nom.toLowerCase()); i++) nom = `${base} ${i}`;
  pris.add(nom.toLowerCase());
  return nom;
}

function entete(feuille: ExcelJS.Worksheet) {
  const ligne = feuille.getRow(1);
  ligne.font = { bold: true };
  ligne.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EDFF" } };
  feuille.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * GET /api/espace/resultats/:selectionId/excel — classeur des résultats : le
 * classement, puis une feuille par type de vote avec chaque vote (ou chaque
 * paiement pour le vote en ligne), annulés et corrections compris.
 */
export async function GET(request: Request, context: { params: Promise<{ selectionId: string }> }) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ error: "Connexion requise" }, { status: 401 });
  if (!utilisateur.organisation.actif && utilisateur.role !== "SUPERADMIN") {
    return Response.json({ error: "Compte suspendu" }, { status: 403 });
  }

  const { selectionId } = await context.params;
  const essai = new URL(request.url).searchParams.get("essai") === "1";
  const [vue, detail] = await Promise.all([
    vueResultats(utilisateur.organisationId, selectionId, { inclureSimules: essai }),
    detailVotes(utilisateur.organisationId, selectionId, { inclureSimules: essai }),
  ]);
  if (!vue || !detail) return Response.json({ error: "Introuvable" }, { status: 404 });

  const nomCandidat = new Map(vue.lignes.map((l) => [l.participationId, l.nom]));
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "DIGITALYX-VOTE";
  classeur.created = new Date();
  const pris = new Set<string>();

  const classement = classeur.addWorksheet(nomFeuille("Classement", pris));
  classement.columns = [
    { header: "Rang", key: "rang", width: 8 },
    { header: "Candidat", key: "nom", width: 30 },
    { header: "Ville", key: "ville", width: 18 },
    ...vue.types.flatMap((t) => [
      { header: `${t.libelle} · ${t.part} % (sur 100)`, key: `n-${t.id}`, width: 20 },
      { header: `${t.libelle} (${t.canal === "EN_LIGNE" ? "voix" : "votes"})`, key: `v-${t.id}`, width: 14 },
    ]),
    { header: "Note finale (sur 100)", key: "finale", width: 18 },
    { header: "Égalité", key: "egalite", width: 10 },
    { header: "Qualifié", key: "qualifie", width: 10 },
  ];
  for (const l of vue.lignes) {
    const ligne: Record<string, unknown> = {
      rang: l.rang ?? "non noté",
      nom: l.nom,
      ville: l.ville ?? "",
      finale: arrondi(l.note),
      egalite: l.egalite ? "oui" : "",
      qualifie: l.qualifie ? "oui" : "",
    };
    for (const t of vue.types) {
      const n = l.types.find((x) => x.typeVoteId === t.id);
      ligne[`n-${t.id}`] = arrondi(n?.note ?? null);
      ligne[`v-${t.id}`] = n?.volume ?? 0;
    }
    classement.addRow(ligne);
  }
  entete(classement);
  classement.addRow([]);
  classement.addRow([
    vue.figeLe
      ? `Résultats officiels figés le ${vue.figeLe.toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}`
      : `Classement provisoire au ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}${vue.inclutSimules ? " · paiements simulés comptés (essai)" : ""}`,
  ]);

  for (const type of detail.types) {
    const feuille = classeur.addWorksheet(nomFeuille(type.libelle, pris));
    const etat = (v: { annuleLe: string | null; correction: boolean }) =>
      v.annuleLe ? "annulé (non compté)" : v.correction ? "correction" : "compté";

    if (type.paiements) {
      feuille.columns = [
        { header: "Candidat", key: "nom", width: 28 },
        { header: "Date", key: "date", width: 18 },
        { header: "Référence", key: "ref", width: 18 },
        { header: "Moyen", key: "moyen", width: 14 },
        { header: "Téléphone", key: "tel", width: 16 },
        { header: "Voix", key: "voix", width: 8 },
        { header: "Montant (FCFA)", key: "montant", width: 14 },
        { header: "Statut", key: "statut", width: 12 },
        { header: "Compté", key: "compte", width: 10 },
      ];
      for (const p of type.paiements) {
        feuille.addRow({
          nom: p.participationId ? (nomCandidat.get(p.participationId) ?? "") : "",
          date: new Date(p.creeLe),
          ref: p.reference,
          moyen: MOYENS[p.moyen] ?? p.moyen,
          tel: p.telephone,
          voix: p.voix,
          montant: p.montant,
          statut: p.simule ? "simulé" : (STATUTS[p.statut] ?? p.statut),
          compte: p.compte ? "oui" : "non",
        });
      }
    } else if (type.avecCriteres) {
      feuille.columns = [
        { header: "Candidat", key: "nom", width: 28 },
        { header: "Votant", key: "votant", width: 24 },
        { header: "Provenance", key: "provenance", width: 16 },
        ...type.criteres.map((c, i) => ({ header: `${c.libelle} /${c.bareme}`, key: `c${i}`, width: 14 })),
        { header: `Total /${type.baremeTotal}`, key: "total", width: 10 },
        { header: "Date", key: "date", width: 18 },
        { header: "État", key: "etat", width: 20 },
      ];
      for (const v of type.votes) {
        const ligne: Record<string, unknown> = {
          nom: nomCandidat.get(v.participationId) ?? "",
          votant: v.votant,
          provenance: v.provenance,
          total: v.total,
          date: new Date(v.creeLe),
          etat: etat(v),
        };
        (v.valeurs ?? []).forEach((x, i) => (ligne[`c${i}`] = x));
        feuille.addRow(ligne);
      }
    } else {
      feuille.columns = [
        { header: "Candidat", key: "nom", width: 28 },
        { header: "Votant", key: "votant", width: 24 },
        { header: "Provenance", key: "provenance", width: 16 },
        { header: "Voix", key: "voix", width: 8 },
        { header: "Date", key: "date", width: 18 },
        { header: "État", key: "etat", width: 20 },
      ];
      for (const v of type.votes) {
        feuille.addRow({
          nom: nomCandidat.get(v.participationId) ?? "",
          votant: v.votant,
          provenance: v.provenance,
          voix: v.poids,
          date: new Date(v.creeLe),
          etat: etat(v),
        });
      }
    }
    feuille.getColumn("date").numFmt = "dd/mm/yyyy hh:mm";
    entete(feuille);
  }

  const nom = `${vue.selection.evenementNom} ${vue.selection.libelle}`
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const octets = await classeur.xlsx.writeBuffer();
  return new Response(octets, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="resultats-${nom || "selection"}${essai ? "-essai" : ""}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
