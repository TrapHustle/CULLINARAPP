-- Part du vote du public en ligne dans la note finale.
ALTER TABLE "Session" ADD COLUMN "shareOnline" DOUBLE PRECISION NOT NULL DEFAULT 20;

-- La part « public en salle » passe de 40 à 20 par défaut (jury 60 / public 20
-- / en ligne 20). N'affecte que les futures sessions ; la ligne existante est
-- ajustée explicitement pour adopter la nouvelle répartition.
ALTER TABLE "Session" ALTER COLUMN "sharePublic" SET DEFAULT 20;
UPDATE "Session" SET "sharePublic" = 20 WHERE "sharePublic" = 40;
