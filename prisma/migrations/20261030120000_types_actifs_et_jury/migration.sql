-- Grille : chaque type de vote se coche (actif) ou se décoche. Tous les types
-- existants restent actifs : rien ne change pour les grilles en place.
--
-- Tablettes : nom du juré (mode « Jury spécial ») et lien vers le vote qu'une
-- correction remplace. Rien n'est supprimé.

ALTER TABLE "TypeVoteModele" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "TypeVote" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Suffrage" ADD COLUMN "jureNom" TEXT,
ADD COLUMN "remplaceId" TEXT;
