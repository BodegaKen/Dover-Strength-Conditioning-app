-- CreateEnum
CREATE TYPE "TrainingTrack" AS ENUM ('FULL', 'MULTI_SPORT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trainingTrack" "TrainingTrack" NOT NULL DEFAULT 'FULL';

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "trackKey" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "planDay" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'FULL',
    "pullupMode" TEXT NOT NULL DEFAULT 'BODYWEIGHT',
    "lift" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetLog_athleteId_date_idx" ON "SetLog"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_athleteId_trackKey_week_planDay_lift_setNumber_key" ON "SetLog"("athleteId", "trackKey", "week", "planDay", "lift", "setNumber");

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
