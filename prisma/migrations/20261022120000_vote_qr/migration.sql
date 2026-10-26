-- SaaS : un lien (et un QR code) par type de vote, vote "QR" à voix unique,
-- ouvert à tous ou restreint à une liste de numéros autorisés.
--
-- Données existantes : rien n'est supprimé. Chaque type de vote reçoit un
-- lien, et chaque votant (voix gratuite en ligne) est rattaché au type de vote
-- de sa voix. La seule règle qui change est l'unicité des votants : une voix
-- par numéro et par TYPE de vote, au lieu d'une par numéro et par sélection —
-- identique tant qu'une sélection n'a qu'un vote en ligne.

-- Types de vote ---------------------------------------------------------------

ALTER TABLE "TypeVoteModele" ADD COLUMN "acces" TEXT NOT NULL DEFAULT 'OUVERT';

ALTER TABLE "TypeVote" ADD COLUMN "acces" TEXT NOT NULL DEFAULT 'OUVERT',
ADD COLUMN "lien" TEXT,
ADD COLUMN "ouvert" BOOLEAN NOT NULL DEFAULT false;

-- Un code de lien pour chaque type existant.
UPDATE "TypeVote" SET "lien" = substr(md5(random()::text || "id"), 1, 10);

ALTER TABLE "TypeVote" ALTER COLUMN "lien" SET NOT NULL;
CREATE UNIQUE INDEX "TypeVote_lien_key" ON "TypeVote"("lien");

-- Votants ---------------------------------------------------------------------

ALTER TABLE "Votant" ADD COLUMN "typeVoteId" TEXT;

-- Le type de vote de la voix donnée par ce numéro…
UPDATE "Votant" v
SET "typeVoteId" = s."typeVoteId"
FROM "Suffrage" s
WHERE s."votantId" = v."id";

-- …ou, pour un votant sans voix (ne devrait pas exister), le premier vote en
-- ligne de sa sélection.
UPDATE "Votant" v
SET "typeVoteId" = (
  SELECT t."id" FROM "TypeVote" t
  WHERE t."selectionId" = v."selectionId" AND t."canal" = 'EN_LIGNE'
  ORDER BY t."ordre", t."id"
  LIMIT 1
)
WHERE v."typeVoteId" IS NULL;

-- On ne supprime jamais un votant : s'il en reste un sans type, la migration
-- s'arrête et on regarde ce cas à la main.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Votant" WHERE "typeVoteId" IS NULL) THEN
    RAISE EXCEPTION 'Votant sans type de vote : migration arrêtée, rien n''a été modifié.';
  END IF;
END $$;

ALTER TABLE "Votant" ALTER COLUMN "typeVoteId" SET NOT NULL;

DROP INDEX "Votant_selectionId_identifiant_key";
CREATE UNIQUE INDEX "Votant_typeVoteId_identifiant_key" ON "Votant"("typeVoteId", "identifiant");
CREATE INDEX "Votant_selectionId_idx" ON "Votant"("selectionId");

ALTER TABLE "Votant" ADD CONSTRAINT "Votant_typeVoteId_fkey" FOREIGN KEY ("typeVoteId") REFERENCES "TypeVote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Numéros autorisés (vote restreint) ----------------------------------------

CREATE TABLE "NumeroAutorise" (
    "id" TEXT NOT NULL,
    "typeVoteId" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "nom" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SAISIE',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumeroAutorise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NumeroAutorise_typeVoteId_telephone_key" ON "NumeroAutorise"("typeVoteId", "telephone");

ALTER TABLE "NumeroAutorise" ADD CONSTRAINT "NumeroAutorise_typeVoteId_fkey" FOREIGN KEY ("typeVoteId") REFERENCES "TypeVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
