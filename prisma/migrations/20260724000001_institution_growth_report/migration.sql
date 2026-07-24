-- Migration: Institution model + GrowthReport + FCCL-MIS setup
-- Date: 2026-07-24
--
-- This migration adds:
-- 1. Institution table (new)
-- 2. GrowthReport table (new)
-- 3. institutionId column on User, Course, Certificate (nullable, additive)
-- 4. Data: creates the FCCL-MIS institution row
-- 5. Backfill: sets institutionId on all existing User, Course, Certificate rows
--    to point at the FCCL-MIS institution
--
-- NOTE: The FCCL contact email is a placeholder — Real email from fccl.com.pk
-- before running this migration. The task requires asking the user first.

-- ============================================================
-- 1. Create Institution table
-- ============================================================
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "contactEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2. Create GrowthReport table
-- ============================================================
CREATE TABLE "GrowthReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "strengths" TEXT NOT NULL,
    "growthAreas" TEXT NOT NULL,
    "dimensionSnapshot" TEXT NOT NULL,
    "behavioralNotes" TEXT,
    CONSTRAINT "GrowthReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GrowthReport_userId_idx" ON "GrowthReport"("userId");
ALTER TABLE "GrowthReport" ADD CONSTRAINT "GrowthReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- ============================================================
-- 3. Add institutionId columns (nullable — additive, non-breaking)
-- ============================================================
ALTER TABLE "User" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Course" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "institutionId" TEXT;

-- Add foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL;
ALTER TABLE "Course" ADD CONSTRAINT "Course_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL;

-- Add growthReport relation (1:1 — User can have at most one growth report)
-- Using a unique constraint on userId to enforce 1:1
CREATE UNIQUE INDEX "GrowthReport_userId_key" ON "GrowthReport"("userId");

-- ============================================================
-- 4. Create the FCCL-MIS institution
--    REPLACE 'info@fccl.com.pk' WITH THE REAL CONTACT EMAIL
-- ============================================================
INSERT INTO "Institution" ("id", "name", "logoUrl", "contactEmail", "createdAt")
VALUES (
    'inst_fccl_mis_001',
    'FCCL-MIS',
    NULL,
    'info@fccl.com.pk',  -- Real email from fccl.com.pk
    CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. Backfill: set institutionId on all existing rows
-- ============================================================
UPDATE "User" SET "institutionId" = 'inst_fccl_mis_001' WHERE "institutionId" IS NULL;
UPDATE "Course" SET "institutionId" = 'inst_fccl_mis_001' WHERE "institutionId" IS NULL;
UPDATE "Certificate" SET "institutionId" = 'inst_fccl_mis_001' WHERE "institutionId" IS NULL;

-- ============================================================
-- Verification queries (run AFTER applying)
-- ============================================================
-- SELECT * FROM "Institution";  -- should show FCCL-MIS
-- SELECT COUNT(*) FROM "User" WHERE "institutionId" IS NULL;  -- should be 0
-- SELECT COUNT(*) FROM "Course" WHERE "institutionId" IS NULL;  -- should be 0
-- SELECT COUNT(*) FROM "Certificate" WHERE "institutionId" IS NULL;  -- should be 0
