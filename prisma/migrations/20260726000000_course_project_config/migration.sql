-- Migration: Add project configuration fields to Course
-- Date: 2026-07-26
--
-- This migration adds three new columns to the Course table:
-- 1. projectEnabled              Boolean  @default(false)
--      Whether the capstone project feature is available for this course at all.
--      Courses with < 4 weeks cannot enable projects (enforced in API/UI, not DB).
--      When false, students do NOT see the Project nav item or any project banners.
--
-- 2. projectRequired             Boolean  @default(false)
--      Whether the project is MANDATORY for students in this course.
--      Only meaningful when projectEnabled = true.
--      When true, the alert system treats missing project tasks as attention-worthy.
--
-- 3. projectDefaultDurationWeeks Int      @default(4)
--      The default project duration suggested to students when they set up their project.
--      Must be between 2 and (courseWeeks - 1) — enforced in API/UI.
--
-- All three columns are additive and have defaults, so this migration is safe to run
-- on a populated database without breaking existing rows.

-- Add the three new columns with defaults
ALTER TABLE "Course"
  ADD COLUMN "projectEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "projectRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "projectDefaultDurationWeeks" INTEGER NOT NULL DEFAULT 4;
