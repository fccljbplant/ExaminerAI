-- Migration: Rename Cohort → Batch (schema + data)
-- Date: 2026-07-23
--
-- This is a MECHANICAL RENAME. No business logic changes.
-- Uses ALTER TABLE RENAME + ALTER TABLE RENAME COLUMN to preserve all data.
-- A drop+recreate would lose real production data — this migration does NOT.
--
-- Tables affected:
--   1. Cohort → Batch (table rename)
--   2. User.cohortId → User.batchId (column rename)
--   3. GroupTask.cohortId → GroupTask.batchId (column rename)
--   4. Event.cohortId → Event.batchId (column rename)
--
-- Data migration:
--   5. RoleNavConfig.navItems: replace "cohort" → "batch" (view key rename)
--      Without this, any admin-customized nav config that references the
--      old "cohort" view key will break — the nav item won't match any view.
--
-- Indexes: SQLite auto-renames indexes with the table. PostgreSQL indexes
-- keep their original name but still work. The @@index declarations in the
-- schema will be recreated by Prisma on the next db push if needed.
--
-- Foreign keys: SQLite disables FK enforcement during ALTER TABLE RENAME
-- (the columns are renamed in place, FK constraints follow). PostgreSQL
-- FK constraints are preserved across column renames.

-- ============================================================
-- 1. Rename the Cohort table to Batch
-- ============================================================
ALTER TABLE "Cohort" RENAME TO "Batch";

-- ============================================================
-- 2. Rename cohortId columns on all referencing tables
-- ============================================================
ALTER TABLE "User" RENAME COLUMN "cohortId" TO "batchId";
ALTER TABLE "GroupTask" RENAME COLUMN "cohortId" TO "batchId";
ALTER TABLE "Event" RENAME COLUMN "cohortId" TO "batchId";

-- ============================================================
-- 3. Data migration: RoleNavConfig.navItems
--    Replace the old "cohort" view key with "batch" in any stored nav configs.
--    The navItems column is a JSON array of view-key strings, e.g.:
--      ["cohort", "ai-tutor", "course-outline", "messages", "settings"]
--    After migration:
--      ["batch", "ai-tutor", "course-outline", "messages", "settings"]
--
--    SQLite doesn't have a native JSON replace, so we use string REPLACE.
--    This is safe because "cohort" only appears as a view key in this column
--    (never as part of a longer string).
-- ============================================================
UPDATE "RoleNavConfig" SET "navItems" = REPLACE("navItems", '"cohort"', '"batch"') WHERE "navItems" LIKE '%cohort%';

-- ============================================================
-- Verification queries (run AFTER applying the migration)
-- ============================================================
-- SELECT COUNT(*) FROM "Batch";           -- should match pre-migration Cohort count
-- SELECT COUNT(*) FROM "User";            -- unchanged
-- SELECT COUNT(*) FROM "GroupTask";       -- unchanged
-- SELECT COUNT(*) FROM "Event";           -- unchanged
-- SELECT "batchId" FROM "User" LIMIT 1;   -- column renamed, no NULLs introduced
-- SELECT "navItems" FROM "RoleNavConfig" WHERE "navItems" LIKE '%cohort%';  -- should return 0 rows
