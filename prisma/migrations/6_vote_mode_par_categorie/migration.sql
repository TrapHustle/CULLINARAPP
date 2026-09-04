-- Le déroulé du vote se règle désormais par catégorie de table : le jury
-- spécial peut tout déguster puis tout noter pendant que la salle avance plat
-- par plat. L'ancien réglage global devient celui du public, ce qui préserve
-- le comportement déjà choisi.
ALTER TABLE "Session" RENAME COLUMN "voteMode" TO "voteModePublic";

ALTER TABLE "Session"
  ADD COLUMN "voteModeSpecial" TEXT NOT NULL DEFAULT 'BY_CANDIDATE';
