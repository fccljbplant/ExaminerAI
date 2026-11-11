# Agent task queue

Exactly one active card per session. Owner-authorised consolidation supersedes historical no-merge restrictions. A card is executable when its scope is explicit, prerequisites exist, and its status is `todo`.

## Queue rules
- Current owner direction (2026-11-11): consolidate all useful existing branches into `main`, then stabilise the application.
- Inventory all existing branches and PRs against live `main`; identify unique commits, duplicate ancestry, overlaps, conflicts, CI evidence and risky files.
- Prefer auditable existing PR merges using expected-head SHA. Never force merge/push, rewrite history, or merge duplicate commits twice.
- Preserve unique useful work. Hold branches containing unexplained tracked database/binary files, secrets, unsafe production data operations, or unapproved dependency/provider/billing changes.
- Do not delete source branches until `main` is validated and the owner separately approves cleanup.
- No production DB operations, destructive schema operations, production setting changes or deployment are authorised by branch consolidation.
- Preserve historical logs and append new evidence; do not overwrite `QUESTIONS.md`.

## Current cards

### P0-01 — Repository Agent Pack
- **Status:** in progress — canonical docs reconciled from PR #3 onto a dedicated mainline PR; local runner deliberately excluded pending branch-neutral safety review.
- **Scope:** repository-hosted instructions, safety, queue and decisions. The local runner is deferred until a branch-neutral version is reviewed.
- **Evidence:** Agent Pack installation entry in `docs/SESSION-LOG.md`.

### P0-02 — Live repository continuity review
- **Status:** done (historical read-only snapshot; refresh before merges).
- **Scope:** verify branch/PR/CI/deployment state and unresolved application risks.

### P0-03 — Consolidate existing branches into main
- **Status:** in progress — refreshed 2026-11-11 against `main` `aa64d6aa7d4813c3f3b6b3738216de73375b7a1c`. PR #14 is merged. PR #3 is open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 ahead / 11 behind); PR #6 is open/draft/non-mergeable at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 19 behind).
- **Scope:** integrate useful unique commits from every existing branch into `main`, preferably through existing PRs; avoid duplicate merges; preserve branch tips; document exclusions and conflicts.
- **Known inventory evidence:** 13 branches were listed in the initial inventory. `backup/v3-ui` and `master` share the same tip and must not be integrated twice. `backup/v3-ui`/ `master` include tracked `prisma/db/custom.db` and broad UI v3 changes, so they require file-level review and exclusion of the DB artifact before merge. `fix/vercel-build-readonly` contains build-safety source changes and needs code/test review. Documentation branches overlap continuity files and must be reconciled, not blindly merged.
- **Current inventory:** 13 branch refs. `backup/v3-ui` and `master` are identical. `fix/ui-simplification-safe` and `ux-audit/ui-simplification-consolidated` overlap classroom/portal home files; the former has 2 commits ahead / 11 behind and the latter 6 / 11. `fix/vercel-build-readonly` is 6 / 7 and overlaps changes already represented by merged PR #11; verify commit equivalence before integrating. Learner courses compatibility is 1 / 10; learner-home error handling is 2 / 9. Documentation branches overlap status/session/progress. Analytics branch has package/lockfile changes and must be checked against merged PR #2. `backup/v3-ui` is 17 / 19 and includes `prisma/db/custom.db`, broad shell/theme/feature-flag changes, and test removals; keep held.
- **Gates:** every branch classified; no unexplained DB/binary/secrets; unique commits integrated once; merge conflicts resolved with both sides preserved; CI and tests run after coherent batches; final `main` status documented.
- **Excluded:** production database access/mutation, production deployment, source-branch deletion, force push/history rewrite.

### P0-04 — Stabilise consolidated main
- **Status:** blocked until P0-03 integration is complete.
- **Required:** run verified lint, unit/integration tests, typecheck, production build, route smoke checks, role-based responsive/a11y checks; fix release-blocking defects only with scoped approval.
- **Known risks to re-evaluate after consolidation:** comprehensive-report field classification and response scope; portfolio enrollment-expiry semantics; additive schema migration readiness and legacy NULL-course handling; backup/restore and staging rehearsal; authenticated production journeys and accessibility validation. PR #11 already removed build-time application-data writes from main.

### P1-01 — Comprehensive-report privacy and course scope
- **Status:** hold pending owner-approved field policy and dedicated implementation scope.
- **Required:** no learner psychological profiling; preserve unavailable values; enforce tenant/course/role/consent boundaries; route and renderer tests.

### P1-02 — Staff portfolio authorised-course intersection
- **Status:** primary correction present in PR #3 source/tests; expiry semantics unresolved.
- **Required:** verify whether expired `CourseEnrollment.expiresAt` records permit staff visibility and test the approved semantics.

### P1-03 — Schema migration and deployment data safety
- **Status:** hold.
- **Blocker:** production schema/history, backup/restore and migration rehearsal remain unverified.
- **Required:** additive migration, legacy NULL-course preservation, rollback plan and separate owner release approval.

### P1-04 — Remove build-time application-data writes
- **Status:** merged in PR #11; revalidate current main build path rather than re-integrating the older source branch.
- **Current main status:** PR #11 removed automatic schema push, account bootstrap and marketplace seeding from the Vercel build. The old branch's relevant source files have the same blob SHAs as `main`; no further integration is needed. No production DB operation is authorised.
- **Required:** build-only deployment; operator-controlled bootstrap/seed; no embedded credentials; tests proving no DB writes during build; preview build without DATABASE_URL. No production DB access/write authorised.


### P0-05 — Learner empty-state heading
- **Status:** identified; deferred until P0-03 integration is complete and the UI task is selected as the single active card.
- **Evidence:** authenticated screenshot artifact review recorded in `docs/PROJECT-STATUS.md`; `src/modules/learner-portal/home.tsx` renders the no-enrolment title as a paragraph while enrolled home uses an `h1`.
- **Required:** one meaningful page-level heading in the empty state, regression coverage for empty and enrolled states, then repeat role screenshots and manual keyboard/zoom/axe checks.
