# PR #3 — WeeklyTest and ReportCard schema rollout plan

**Status:** Release gate / proposal only. This document is not authorisation to access or change production data. PR #3 must remain draft and unmerged until the owner explicitly approves the exact production migration and rollout window.

## Why this needs a controlled rollout

The current Prisma source schema changes existing uniqueness contracts; this is not a purely additive schema change:

- `WeeklyTest`: replaces `@@unique([userId, week])` with `@@unique([userId, courseId, week, attempt])`, adds `attempt` (default 1), and adds nullable human-score-correction audit fields.
- `ReportCard`: replaces `@@unique([userId, week])` with `@@unique([userId, courseId, week])`; makes `grade` and `score` nullable; adds version/update metadata and the version relation.
- `ReportCardVersion`: adds an immutable per-version snapshot table, unique by `[reportCardId, version]`, with a parent foreign key and learner/course/week index.

The existing `courseId` fields are nullable. In PostgreSQL, a composite unique index permits multiple rows when a participating value is NULL. Therefore the new composite keys do not, by themselves, preserve the former learner/week uniqueness for legacy rows whose `courseId` remains NULL. Application routes now require explicit course context for the new course-scoped write paths, but the migration should also consider partial unique indexes for the NULL-course legacy subset if legacy writes remain supported.

## Current code safeguards

- Course-specific WeeklyTest identity is learner + course + week + attempt. Staff score correction requires a currently authorised learner/course intersection and either an explicit attempt or the latest attempt in that selected course/week.
- Course-specific ReportCard identity is learner + course + week. Report-card writes are selected-course scoped and retain immutable version snapshots.
- Existing `courseId = NULL` rows are retained as legacy/unassigned data. No course is guessed; no rows are backfilled, merged, reassigned or deleted.
- Report-card version updates use compare-and-swap on both record ID and current version. A lost race returns `REPORT_CARD_VERSION_CONFLICT` and does not write a version snapshot.
- `prisma/schema.prisma` is the canonical model source. `scripts/generate-derived-schemas.mjs` derives the production and demo schema model bodies from it. The tracked derived schemas have now been regenerated to match the source, including the ReportCardVersion `source` field and relation delete behaviour.
- `scripts/vercel-build.sh` no longer runs `prisma db push`. A Vercel build must not silently mutate production constraints or leave a deployed app running against an unknown schema version after a non-blocking DDL failure.

## Required preflight before any production approval

1. Verify the actual production PostgreSQL schema and migration history using an owner-approved, read-only inspection. Do not infer production state from repository files.
2. Take and verify a recoverable database backup/snapshot. Record table row counts for WeeklyTest and ReportCard and confirm restore access before proceeding.
3. Check for duplicate non-NULL course identities before adding the new unique indexes:
   - WeeklyTest grouped by `userId, courseId, week, attempt`.
   - ReportCard grouped by `userId, courseId, week`.
   Any duplicates are a hard stop; do not merge, delete, or guess which record is authoritative.
4. Check all existing WeeklyTest attempts are positive and confirm the intended initial value for existing records (the schema default is 1). Do not infer course IDs for NULL-course rows.
5. Confirm whether NULL-course legacy records still have any supported write path. If yes, preserve the old learner/week uniqueness for that subset with reviewed PostgreSQL partial unique indexes (for example, unique on `userId, week` WHERE `courseId IS NULL`). Confirm Prisma's treatment of these SQL-managed indexes and prevent later schema-sync tooling from removing them.
6. Confirm whether every pre-existing ReportCard needs a baseline ReportCardVersion snapshot. Recommended: insert one version-1 snapshot per existing card in the migration, using explicit migration actor metadata (not a fabricated human identity), so history does not begin only after the rollout.
7. Validate the exact migration against a production-like staging clone with representative legacy NULL-course rows, two courses for one learner/week, multiple WeeklyTest attempts, and existing ReportCards. Verify no row loss and all unique/FK/index definitions.

## Recommended rollout sequence

1. **Freeze assessment writes** for the migration window. Keep the existing application in service for reads only, or use an owner-approved maintenance mode.
2. **Apply a reviewed, versioned PostgreSQL migration** (not an automatic Vercel-build `db push`). The migration must:
   - add the new nullable/defaulted columns and ReportCardVersion table/index/FK;
   - preserve all existing assessment rows and NULL-course identities;
   - create baseline version snapshots if approved in preflight;
   - install new course-specific unique constraints only after duplicate checks;
   - preserve NULL-course legacy uniqueness with partial indexes if legacy writes remain supported;
   - remove the old learner/week unique constraints only as part of the controlled cutover.
3. Deploy the matching application commit while assessment writes remain frozen. Run targeted read/write smoke tests for course isolation, attempt selection, version history, and conflict handling.
4. Resume assessment writes only after the new schema and application are verified together. Record migration ID, backup ID, row counts, smoke-test evidence and owner approval in the release log.

## Rollback / recovery

- Before any course-specific duplicate rows are written, the application may be rolled back to the prior release while retaining the new nullable columns and version table. Do not drop the new fields/table or delete snapshots as part of rollback.
- Reinstating the old `[userId, week]` unique constraints is safe only if a preflight proves that no learner has multiple course-specific WeeklyTest/ReportCard rows for the same week and no other conflicting rows exist. If conflicts exist, do not delete or merge records to force rollback.
- After multiple course-specific rows have been written for one learner/week, the old global uniqueness constraints cannot be restored without changing product data. In that state, use a forward-fix application release and keep the expanded schema; do not attempt a destructive schema rollback.
- If the migration or deploy fails mid-window, keep assessment writes frozen, restore the last verified backup only under a separate explicit owner decision, and reconcile row counts before reopening writes.

## Current blockers / explicit approval

- No production database was inspected or changed during this PR work.
- No executable production migration is included in this PR diff. The repository defines `db:migrate:prod`, but the current production migration baseline and actual database state have not been verified. A migration file must be authored and tested only after those prerequisites are available.
- The current `schema.prod.prisma` and `.demo.prisma` are derived from `schema.prisma`; their model bodies are now aligned. The source currently defines the ReportCardVersion parent relation with `onDelete: Cascade`; confirm this deletion policy before production migration because it controls whether deleting a parent ReportCard also deletes its snapshots.
- The owner must explicitly approve the exact migration, target environment, backup/restore plan, and execution window. This approval has **not** been given by the instruction to continue fixing PR #3.
- Until these gates are satisfied, do not run `prisma db push`, `prisma migrate deploy`, `db:push:prod`, `db:sync:prod`, any schema sync script, or any production database operation. Keep PR #3 draft, unmerged and undeployed.


## 2026-11-11 status

The source branch has passed its exact-head GitHub CI, but no production schema migration has been approved or executed. Keep the PR draft/unmerged until the PostgreSQL migration is reviewed as additive with rollback, legacy NULL-course rows are explicitly handled, backup/restore and staging rehearsal are complete, and the owner approves the exact production target and execution window. No production database was accessed.


## 2026-11-11 — selective application work merged; production schema still blocked

- Current main includes PR #17 and PR #19 selective dashboard/roster and weekly-test safety ports. Neither changes Prisma schema or migration history.
- PR #3 remains open/draft/non-mergeable at its recorded head; 604 commits ahead / 46 behind current main. Do not treat the successful CI of selective PRs as approval for this schema transition.
- The production PostgreSQL schema/migration history remains uninspected. No Neon/production database was accessed, no backup was taken, and no migration/schema sync was run.
- The owner must answer the open data-scope, legacy NULL-course, baseline snapshot and ReportCardVersion delete-policy questions, and explicitly approve the exact additive migration, backup/restore and staging rehearsal, target and execution window before any production operation.
