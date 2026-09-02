-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "eventPhotoUrl" TEXT;

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

