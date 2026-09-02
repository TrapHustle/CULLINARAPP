◇ injected env (7) from .env // tip: ⌁ auth for agents [www.vestauth.com]
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LAMBDA',
    "expectedJurors" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "VotingTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activeCandidateId" TEXT,
    "votingOpen" BOOLEAN NOT NULL DEFAULT false,
    "timerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timerSeconds" INTEGER NOT NULL DEFAULT 30,
    "eventName" TEXT,
    "eventDate" TIMESTAMP(3),
    "eventPhotoUrl" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jurorIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteScore" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "rawValue" INTEGER NOT NULL,

    CONSTRAINT "VoteScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableValidation" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candidate_order_idx" ON "Candidate"("order");

-- CreateIndex
CREATE INDEX "Criterion_order_idx" ON "Criterion"("order");

-- CreateIndex
CREATE INDEX "Vote_candidateId_idx" ON "Vote"("candidateId");

-- CreateIndex
CREATE INDEX "Vote_tableId_idx" ON "Vote"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_tableId_candidateId_jurorIndex_key" ON "Vote"("tableId", "candidateId", "jurorIndex");

-- CreateIndex
CREATE UNIQUE INDEX "VoteScore_voteId_criterionId_key" ON "VoteScore"("voteId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "TableValidation_tableId_candidateId_key" ON "TableValidation"("tableId", "candidateId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VotingTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteScore" ADD CONSTRAINT "VoteScore_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteScore" ADD CONSTRAINT "VoteScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableValidation" ADD CONSTRAINT "TableValidation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VotingTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableValidation" ADD CONSTRAINT "TableValidation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

