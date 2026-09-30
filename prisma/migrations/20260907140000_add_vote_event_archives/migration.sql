CREATE TABLE "VoteEventArchive" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "VoteEventArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoteEventArchive_eventDate_idx" ON "VoteEventArchive"("eventDate");
CREATE INDEX "VoteEventArchive_closedAt_idx" ON "VoteEventArchive"("closedAt");
