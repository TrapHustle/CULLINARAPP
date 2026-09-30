-- Vote du public en ligne (page /voter) : ville des candidats, réglages de la
-- page, et paiements des votes. Uniquement des ajouts : aucune donnée existante
-- n'est modifiée.

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "city" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "publicVoteClosesAt" TIMESTAMP(3),
ADD COLUMN     "publicVoteMethods" TEXT[] DEFAULT ARRAY['WAVE', 'ORANGE_MONEY', 'MTN']::TEXT[],
ADD COLUMN     "publicVoteOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicVotePrice" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "publicVoteShowCounts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicVoteStyle" TEXT NOT NULL DEFAULT 'MENU',
ADD COLUMN     "publicVoteSubtitle" TEXT,
ADD COLUMN     "publicVoteTagline" TEXT;

-- CreateTable
CREATE TABLE "PublicVotePayment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "candidateId" TEXT,
    "candidateName" TEXT NOT NULL,
    "votes" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "PublicVotePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicVotePayment_reference_key" ON "PublicVotePayment"("reference");

-- CreateIndex
CREATE INDEX "PublicVotePayment_candidateId_status_idx" ON "PublicVotePayment"("candidateId", "status");

-- CreateIndex
CREATE INDEX "PublicVotePayment_createdAt_idx" ON "PublicVotePayment"("createdAt");

-- CreateIndex
CREATE INDEX "PublicVotePayment_phone_createdAt_idx" ON "PublicVotePayment"("phone", "createdAt");

-- AddForeignKey
ALTER TABLE "PublicVotePayment" ADD CONSTRAINT "PublicVotePayment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

