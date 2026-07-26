-- Migration: Add isDefault flag to Course
-- Date: 2026-07-26
--
-- This migration adds the `isDefault` column to the Course table. When true,
-- this course is the default for new students — when a student is approved
-- without a specific batch assignment, they're placed in the Default Batch,
-- which is linked to whichever course has isDefault=true.
--
-- Only ONE course can be the default at a time (enforced at the API level —
-- setting isDefault=true on one course unsets it on all others).
--
-- This column is additive with a default of false, so the migration is safe
-- to run on a populated database without breaking existing rows.

-- Add the isDefault column
ALTER TABLE "Course"
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark the existing "Modern Web Dev & AI Bootcamp (Default)" course
-- as the default if it exists. This ensures continuity for deployments that
-- already seeded the default course via /api/courses/seed-default.
UPDATE "Course"
SET "isDefault" = true
WHERE "name" = 'Modern Web Dev & AI Bootcamp (Default)';
