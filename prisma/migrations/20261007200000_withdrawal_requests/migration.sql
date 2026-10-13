-- Demandes de retrait de l'organisateur vers son numéro mobile.
--
-- Le modèle existait déjà dans schema.prisma sans migration : la table n'a
-- donc jamais été créée. `IF NOT EXISTS` couvre le cas d'une base où elle
-- aurait été poussée à la main par `prisma db push`.
CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WithdrawalRequest_status_createdAt_idx"
    ON "WithdrawalRequest"("status", "createdAt");
