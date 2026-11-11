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
- **Status:** done — Agent Pack instructions and safety/queue/decision docs merged to `main` by PR #15 (`930dcdbcdeec9f48b2ffa5f0f3c7697d46f4b9b1`). Local runner deliberately deferred pending branch-neutral safety review.
- **Scope:** repository-hosted instructions, safety, queue and decisions. The local runner is deferred until a branch-neutral version is reviewed.
- **Evidence:** Agent Pack installation entry in `docs/SESSION-LOG.md`.

### P0-02 — Live repository continuity review
- **Status:** done — refreshed 2026-11-11; recheck before each subsequent integration.
- **Scope:** verify branch/PR/CI/deployment state and unresolved application risks.

### P0-03 — Consolidate existing branches into main
- **Status:** in progress — refreshed 2026-11-11 against `main` `930dcdbcdeec9f48b2ffa5f0f3c7697d46f4b9b1`. PR #14 and docs-only PR #15 are merged. PR #15 exact-head Actions run `42978335750` attempt 2 passed lint, unit tests, typecheck, production build, all app-page route smoke tests, authenticated role screenshots and artifact upload; Vercel status for the merge commit is pending. PR #3 is open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 ahead / 11 behind); PR #6 is open/draft/non-mergeable at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 19 behind).
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


## 2026-11-11 — Agent Pack merged; consolidation inventory deepened

- PR #15 (`docs: align repository agent pack with consolidation workflow`) was marked ready only after exact-head CI passed, then merged using expected head `07196bd61d2464106b5d9279c72dae8b93dfc843`. Merge commit and current `main`: `930dcdbcdeec9f48b2ffa5f0f3c7697d46f4b9b1`.
- PR #15 Actions run `42978335750`, retry attempt 2, passed dependency install, isolated test DB setup, lint, unit tests, TypeScript, production build, all app-page route smoke tests, authenticated role screenshots and artifact upload. First attempt failed screenshot capture; retry passed. Vercel status on the new docs-only main commit was pending at verification; no deployment was requested or performed.
- Root `AGENTS.md` and `docs/agent-pack/{README,SAFETY,QUEUE,DECISIONS}.md` are now on `main`. The proposed `scripts/agent/run-logged.mjs` remains excluded because its hard-coded PR #3 branch restriction is incompatible with consolidation.
- Verified branch content by Git blob SHA: all changed application files from `fix/ui-simplification-safe`, `ux-audit/learner-courses-compatibility`, `ux-audit/learner-home-error-handling`, Vercel Analytics and the Vercel build-safety branch are already identical to `main`. Do not merge duplicate code again; older documentation-only differences are historical records, not code gaps.
- Compared full recursive Git trees: PR #3 differs from `main` in 167 blobs and omits 6 files present on `main`; PR #6 differs in 88 blobs and omits 17 files present on `main`. PR #6 additionally includes tracked `prisma/db/custom.db`. Neither branch is safe for wholesale merge.
- No application source, DB/schema, dependency, production setting or deployment changed in PR #15. No source branch deleted, no force update/history rewrite, and no production DB access.
- Next: use a Git-capable three-way merge workflow to selectively salvage PR #3 changes after schema/privacy/task sequencing review; separately assess V3 components from PR #6 without the database artifact or removed tests. Then stabilise `main` with role-based tests and accessibility review.
