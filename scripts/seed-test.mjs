import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

try {
  let { rows } = await pool.query('SELECT id, name FROM "Candidate" LIMIT 1');
  let candidateId, candidateName;
  if (rows.length > 0) {
    candidateId = rows[0].id;
    candidateName = rows[0].name;
    console.log("Candidat existant:", candidateName);
  } else {
    const ins = await pool.query(
      `INSERT INTO "Candidate" (id, name, city, "order") VALUES (gen_random_uuid()::text, 'Tekpo', 'Yamoussoukro', 1) RETURNING id, name`
    );
    candidateId = ins.rows[0].id;
    candidateName = ins.rows[0].name;
    console.log("Candidat cree:", candidateName);
  }

  let created = 0;
  for (let i = 1; i <= 25; i++) {
    const ref = "TEST-" + String(i).padStart(4, "0");
    try {
      await pool.query(
        `INSERT INTO "PublicVotePayment" (id, reference, "candidateId", "candidateName", votes, "unitPrice", amount, method, phone, status, simulated)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 1, 200, 200, 'WAVE', '0700000000', 'CONFIRMED', false)`,
        [ref, candidateId, candidateName]
      );
      created++;
    } catch (e) {
      if (e.code === "23505") continue;
      throw e;
    }
  }
  console.log(`${created} paiements crees (25 x 200 = 5 000 FCFA)`);

  const agg = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM "PublicVotePayment" WHERE status = 'CONFIRMED' AND simulated = false`
  );
  console.log("Total confirme en base:", agg.rows[0].total, "FCFA");
} finally {
  await pool.end();
}
