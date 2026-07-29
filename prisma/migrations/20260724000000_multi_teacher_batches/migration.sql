-- Migration: Multi-teacher batches (BatchTeacher + deliveryMode + data backfill)
-- Date: 2026-07-24
--
-- This migration adds:
-- 1. BatchTeacher junction table (many-to-many between Batch and teacher Users)
-- 2. deliveryMode column on Batch (default "online")
-- 3. Data backfill: for every existing staff user with a non-null batchId,
--    insert a BatchTeacher row so they retain access to their current batch.
--
-- User.batchId is NOT removed — it stays for students (one-batch-each).
-- For teachers, User.batchId becomes legacy (BatchTeacher is the source of truth).

-- ============================================================
-- 1. Add deliveryMode column to Batch
-- ============================================================
ALTER TABLE "Batch" ADD COLUMN "deliveryMode" TEXT NOT NULL DEFAULT 'online';

-- ============================================================
-- 2. Create BatchTeacher junction table
-- ============================================================
CREATE TABLE "BatchTeacher" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "BatchTeacher_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one teacher per batch (no duplicates)
CREATE UNIQUE INDEX "BatchTeacher_batchId_teacherId_key" ON "BatchTeacher"("batchId", "teacherId");

-- Foreign keys
ALTER TABLE "BatchTeacher" ADD CONSTRAINT "BatchTeacher_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE;
ALTER TABLE "BatchTeacher" ADD CONSTRAINT "BatchTeacher_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Index for reverse lookups (which batches does a teacher belong to?)
CREATE INDEX "BatchTeacher_teacherId_idx" ON "BatchTeacher"("teacherId");

-- ============================================================
-- 3. Data backfill: migrate existing teacher.batchId to BatchTeacher
--    For every User with role IN (teacher, teaching_assistant,
--    coordinator, counselor) that has a non-null batchId,
--    insert a BatchTeacher row. This preserves existing access.
-- ============================================================
INSERT INTO "BatchTeacher" ("id", "batchId", "teacherId")
SELECT
    gen_random_uuid()::text,
    "batchId",
    "id"
FROM "User"
WHERE "batchId" IS NOT NULL
  AND "role" IN ('teacher', 'teaching_assistant', 'coordinator', 'counselor')
  AND NOT EXISTS (
    SELECT 1 FROM "BatchTeacher" bt
    WHERE bt."batchId" = "User"."batchId"
      AND bt."teacherId" = "User"."id"
  );

-- ============================================================
-- Verification queries (run AFTER applying)
-- ============================================================
-- SELECT COUNT(*) FROM "BatchTeacher";  -- should match count of staff with batchId
-- SELECT COUNT(*) FROM "Batch" WHERE "deliveryMode" = 'online';  -- all existing batches
-- SELECT u.name, u.role, b.name as batch_name
--   FROM "BatchTeacher" bt
--   JOIN "User" u ON bt."teacherId" = u.id
--   JOIN "Batch" b ON bt."batchId" = b.id;  -- verify backfill
