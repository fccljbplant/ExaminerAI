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
- **Status:** done.
- **Scope:** repository-hosted instructions, safety, queue, decisions and restricted validation runner.
- **Evidence:** Agent Pack installation entry in `docs/SESSION-LOG.md`.

### P0-02 — Live repository continuity review
- **Status:** done (historical read-only snapshot; refresh before merges).
- **Scope:** verify branch/PR/CI/deployment state and unresolved application risks.

### P0-03 — Consolidate existing branches into main
- **Status:** in progress — owner authorised 2026-11-11.
- **Scope:** integrate useful unique commits from every existing branch into `main`, preferably through existing PRs; avoid duplicate merges; preserve branch tips; document exclusions and conflicts.
- **Known inventory evidence:** 13 branches were listed in the initial inventory. `backup/v3-ui` and `master` share the same tip and must not be integrated twice. `backup/v3-ui`/ `master` include tracked `prisma/db/custom.db` and broad UI v3 changes, so they require file-level review and exclusion of the DB artifact before merge. `fix/vercel-build-readonly` contains build-safety source changes and needs code/test review. Documentation branches overlap continuity files and must be reconciled, not blindly merged.
- **Initial compare snapshot:** main was `e390031cbf6eb0203c046947fcd3bd4c260014c7`; PR #3 head was `db29e45810e7a86e42f35ad5f2c7aba5992d6806`, 590 ahead / 7 behind, GitHub mergeable=false. This is historical after policy commits; re-fetch live state before acting.
- **Gates:** every branch classified; no unexplained DB/binary/secrets; unique commits integrated once; merge conflicts resolved with both sides preserved; CI and tests run after coherent batches; final `main` status documented.
- **Excluded:** production database access/mutation, production deployment, source-branch deletion, force push/history rewrite.

### P0-04 — Stabilise consolidated main
- **Status:** blocked until P0-03 integration is complete.
- **Required:** run verified lint, unit/integration tests, typecheck, production build, route smoke checks, role-based responsive/a11y checks; fix release-blocking defects only with scoped approval.
- **Known risks to re-evaluate after consolidation:** comprehensive-report data classification/course scope/missing evidence; portfolio enrollment expiry semantics; schema migration readiness; Vercel build-time account/marketplace DB writes.

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
- **Status:** hold — release blocker; review the unique changes on `fix/vercel-build-readonly` before deciding integration.
- **Current known risk on PR #3 source:** Vercel build still invokes account bootstrap and marketplace metadata seed; account bootstrap historically contained a fixed password/reset behaviour. Verify exact branch contents before integration.
- **Required:** build-only deployment; operator-controlled bootstrap/seed; no embedded credentials; tests proving no DB writes during build; preview build without DATABASE_URL. No production DB access/write authorised.
