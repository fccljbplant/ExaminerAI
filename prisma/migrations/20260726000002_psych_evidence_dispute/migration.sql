-- Migration: Add dispute fields to PsychEvidence
-- Date: 2026-07-26
--
-- ME-6 fix (audit 2026-07-26): teachers can contest AI-derived psych labels.
-- When disputed=true, the evidence is still visible but marked as "Disputed"
-- in the UI, and the disputeNote explains why the teacher disagrees.
--
-- All columns are additive with defaults, so this migration is safe to run
-- on a populated database without breaking existing rows.

ALTER TABLE "PsychEvidence"
  ADD COLUMN "disputed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disputeNote" TEXT,
  ADD COLUMN "disputedBy" TEXT,
  ADD COLUMN "disputedAt" TIMESTAMP(3);
