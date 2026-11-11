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
- **Status:** in progress — current `main` is `f3323587722b349cc14fbf0e88f9c445fbf9a326`. PRs #14–#17 are merged (PR #17 carries reviewed dashboard/roster fixes selectively ported from PR #3). PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 ahead / 29 behind); its schema/report/privacy/portfolio changes are not approved for wholesale merge. PR #6 remains held at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 37 behind). Continue selective review from a current-main base.
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


## 2026-11-11 — PR #3 selective dashboard/roster fixes ported

- Current `main` is `b8fa2529cd4bc6c91bb1ada017123ed9058c5561` after PR #16. PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 ahead / 16 behind); no wholesale merge was attempted.
- A current-main-based selective branch ports the learner-home failure correction and instructor roster/KPI fixes from PR #3: no false empty-enrolment success on profile lookup failure; database aggregation for latest daily activity without the 200-row cap; instructor activity/task data restricted to taught courses; deterministic latest scored weekly test; and full at-risk KPI count separate from the five-item preview.
- Added learner-home and instructor-roster route regression coverage plus roster-metric tests. Full Vitest: 35 files / 384 tests passed against disposable local SQLite. Full ESLint exited 0 with existing warnings; standalone TypeScript and `git diff --check` passed.
- Local Next.js compilation succeeded, but the 2 GB sandbox killed the build worker during Next.js TypeScript validation (1024 MB heap OOM; 1536 MB attempt SIGKILL). Standalone TypeScript passed; exact-head GitHub Actions production build remains required.
- No schema/dependency change and no Neon/production database access, migration, seed, deployment, force update or source-branch deletion.


## 2026-11-11 — PR #17 merged; selective PR #3 consolidation continues

- PR #17 (selective learner/instructor dashboard port from PR #3) merged into `main` at `f3323587722b349cc14fbf0e88f9c445fbf9a326`. Exact PR head: `08701613fe438b237f16d52986be868377b8ff2f`.
- GitHub Actions run `43061463558` passed on the exact head: dependency install, isolated test DB setup, lint, unit tests, TypeScript, production build, every app-page route smoke test, authenticated role screenshots and artifact upload. The earlier run `43061193897` exposed a regression caused by taking an old PR #3 learner-home route wholesale; the route was corrected from current main with only the profile-lookup failure behavior applied, preserving the existing project-query failure safeguard. The corrected exact-head run passed.
- Existing Vercel project preview deployment `dpl_7GGs2wZPkhCx5rch4Kt9ADa3GRKH` reached `READY` for the corrected PR head. Git integration automatically created production-target deployment `dpl_4jcJQoasD3uHQJry9zWZQcuHjkQz` from merge commit `f3323587`; the build completed and was still in Vercel's deployment-output phase at the time of this log. No manual deployment or production-setting change was made.
- PR #3 remains open/draft/non-mergeable at `4912698a08be04c9ba43632495400bbff4042837` (604 commits ahead / 29 behind current main). PR #6 remains held at `39f2d0faab32b6b4f2054b07b2eedeb108de4300` (17 ahead / 37 behind). No wholesale PR #3 or PR #6 merge.
- PR #17 changed no Prisma schema, migration, dependency, provider, billing, learner-support or crisis-handling behavior. No Neon/production database was accessed, and no production data/schema operation, seed, manual deployment, force update or source-branch deletion occurred.
- Next selective PR #3 review: weekly-test course identity/enrollment checks and AI-unavailable no-grade behavior; verify the existing server-side weekly sequencing guard and add direct regression coverage. Keep portfolio expiry semantics, comprehensive-report field/scope policy and PR #3 schema changes on hold pending their required decisions.
