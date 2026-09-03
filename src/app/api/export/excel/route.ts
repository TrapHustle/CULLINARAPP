import ExcelJS from "exceljs";
import { computeResults } from "@/lib/results";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/excel
 *
 * Classeur `.xlsx` des résultats : classement général, détail par critère et
 * détail par table (§4.4).
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Non authentifié" }, { status: 401 });
  }

  const results = await computeResults();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Concours culinaire";
  workbook.created = new Date();

  /* --- Classement général --- */
  const ranking = workbook.addWorksheet("Classement");
  ranking.columns = [
    { header: "Rang", key: "rank", width: 8 },
    { header: "Candidat", key: "name", width: 30 },
    { header: `Note finale /${results.maxTotal}`, key: "final", width: 14 },
    { header: `Jury spécial /${results.maxTotal}`, key: "special", width: 16 },
    { header: `Public /${results.maxTotal}`, key: "public", width: 14 },
    { header: "Votants", key: "voters", width: 10 },
    { header: "Poids total", key: "weight", width: 12 },
  ];
  ranking.getRow(1).font = { bold: true };

  for (const entry of results.ranking) {
    ranking.addRow({
      rank: entry.rank ?? "—",
      name: entry.name,
      final: entry.finalScore ?? "non noté",
      special: entry.specialScore ?? "non noté",
      public: entry.publicScore ?? "non noté",
      voters: entry.voterCount,
      weight: entry.weightTotal,
    });
  }

  /* --- Détail par critère --- */
  const byCriterion = workbook.addWorksheet("Par critère");
  byCriterion.columns = [
    { header: "Candidat", key: "name", width: 30 },
    ...results.criteria.map((criterion) => ({
      header: `${criterion.name} /${results.scoreMax}`,
      key: criterion.id,
      width: 18,
    })),
  ];
  byCriterion.getRow(1).font = { bold: true };

  for (const entry of results.ranking) {
    const row: Record<string, string | number> = { name: entry.name };
    for (const criterion of entry.byCriterion) {
      row[criterion.criterionId] = criterion.averageOutOf5 ?? "non noté";
    }
    byCriterion.addRow(row);
  }

  /* --- Détail par table --- */
  const byTable = workbook.addWorksheet("Par table");
  byTable.columns = [
    { header: "Candidat", key: "candidate", width: 30 },
    { header: "Table", key: "table", width: 24 },
    { header: "Type", key: "type", width: 16 },
    { header: `Moyenne /${results.maxTotal}`, key: "average", width: 16 },
    { header: "Votes", key: "votes", width: 10 },
  ];
  byTable.getRow(1).font = { bold: true };

  for (const entry of results.ranking) {
    for (const table of entry.byTable) {
      byTable.addRow({
        candidate: entry.name,
        table: table.tableName,
        type: table.type === "SPECIAL" ? "Jury spécial (×2)" : "Lambda",
        average: table.averageRaw ?? "non noté",
        votes: table.voterCount,
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `resultats-concours-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
