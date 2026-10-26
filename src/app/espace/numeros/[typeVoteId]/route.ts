import { exigerUtilisateur } from "@/lib/espace";
import { prisma } from "@/lib/prisma";
import { lireNumeros } from "@/lib/vote-qr";

/** Échappe une cellule CSV. Un texte saisi par l'organisateur est neutralisé s'il ressemble à une formule. */
function cellule(valeur: string, saisi = false): string {
  const sure = saisi && /^[=+\-@]/.test(valeur) ? `'${valeur}` : valeur;
  return /[";\n]/.test(sure) ? `"${sure.replace(/"/g, '""')}"` : sure;
}

/** Liste des numéros autorisés d'un vote, en CSV pour Excel (point-virgule, BOM). Jamais le candidat choisi. */
export async function GET(_requete: Request, { params }: { params: Promise<{ typeVoteId: string }> }) {
  const { typeVoteId } = await params;
  const utilisateur = await exigerUtilisateur();
  const numeros = await lireNumeros(utilisateur.organisationId, typeVoteId);
  if (!numeros) return new Response("Introuvable.", { status: 404 });
  const type = await prisma.typeVote.findUniqueOrThrow({ where: { id: typeVoteId }, select: { libelle: true } });

  const lignes = [
    ["Téléphone", "Nom", "Statut", "Heure du vote", "Ajouté par"],
    ...numeros.map((n) => [
      // Excel lit « +… » comme une formule : numéro ivoirien sans indicatif
      // (les espaces le gardent en texte), numéro étranger en formule texte.
      /^0\d{9}$/.test(n.telephone) ? n.telephone.replace(/(\d{2})(?=\d)/g, "$1 ") : `="${n.telephone}"`,
      n.nom ?? "",
      n.voteLe ? "A voté" : "Pas encore voté",
      n.voteLe ? n.voteLe.toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" }) : "",
      n.source === "SAISIE" ? "Saisie" : n.source,
    ]),
  ];
  // Colonnes nom et « ajouté par » : saisies par l'organisateur, donc neutralisées.
  const csv = String.fromCharCode(0xfeff) + lignes.map((l) => l.map((c, i) => cellule(c, i === 1 || i === 4)).join(";")).join("\r\n");
  const nom = `numeros-${type.libelle}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
