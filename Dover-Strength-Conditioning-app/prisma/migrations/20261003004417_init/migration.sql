-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'COACH');

-- CreateEnum
CREATE TYPE "PullupTrack" AS ENUM ('BODYWEIGHT', 'WEIGHTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "position" TEXT,
    "bodyweight" DOUBLE PRECISION,
    "pullupTrack" "PullupTrack" NOT NULL DEFAULT 'BODYWEIGHT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestEntry" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "lift" TEXT NOT NULL,
    "fiveRM" DOUBLE PRECISION NOT NULL,
    "e1RM" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEntry" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "rpe" INTEGER NOT NULL,
    "durationMin" DOUBLE PRECISION NOT NULL,
    "load" DOUBLE PRECISION NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramState" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "trackKey" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE INDEX "TestEntry_athleteId_lift_idx" ON "TestEntry"("athleteId", "lift");

-- CreateIndex
CREATE INDEX "SessionEntry_athleteId_date_idx" ON "SessionEntry"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "TestEntry" ADD CONSTRAINT "TestEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEntry" ADD CONSTRAINT "SessionEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
