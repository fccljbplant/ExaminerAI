# Agent task queue

This queue is intentionally conservative. A card is executable only when its status is `todo`, it names an owner-approved scope, and all referenced specifications exist.

## Queue rules
- Exactly one card per session.
- Existing branch only: `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Phase 0 is read-only inventory and evidence gathering.
- Phase 1+ requires explicit owner approval of the specific card before implementation.
- A failed check, missing prerequisite, unclear data classification, or scope conflict changes the card to `blocked`; dependent work must not proceed.
- Do not put arbitrary shell commands in cards. Gates must be selected from verified repository scripts and executed through the logged runner.
- Preserve the original question log and append new questions; do not replace it.

## Current cards

### P0-01 — Verify and maintain repository Agent Pack
- **Status:** done (documentation/tooling installation only)
- **Scope:** install persistent repository instructions, safety policy, queue and restricted validation runner.
- **Excluded:** application code, schema/database changes, branch operations, PR merge, Vercel deployment.
- **Evidence:** see the latest Agent Pack installation entry in `docs/SESSION-LOG.md`.

### P0-02 — Reconcile live PR #3 continuity and unresolved blockers
- **Status:** todo (read-only)
- **Scope:** verify exact live PR/main heads, Actions and Vercel states; reconcile stale commit references in progress/status docs; confirm outstanding report privacy, portfolio course scope, schema migration and deploy-build database-write blockers.
- **Required sources:** `AGENT-INSTRUCTIONS.md`, `docs/PROJECT-CONTINUITY.md`, `docs/PROJECT-STATUS.md`, `docs/SESSION-LOG.md`, `proj_progress.md`, `docs/UPGRADE-2026-10/QUESTIONS.md`.
- **Gates:** live GitHub evidence; exact-head Actions/Vercel status; source paths and tests verified.
- **Approval:** read-only only; any implementation requires a separate owner-approved card.

### P1-01 — Comprehensive-report privacy and course-scope correction
- **Status:** hold
- **Blocker:** owner decision on managementAttitude fields and staff/platform visibility; approved task card and source-level renderer scope.
- **Required:** preserve unavailable values; no learner psychological profiling; course/tenant scoping and consent checks; route and renderer tests.

### P1-02 — Staff portfolio authorised-course intersection
- **Status:** hold
- **Blocker:** approved implementation card and confirmation of expired CourseEnrollment semantics.
- **Required:** intersect staff-authorised courses with learner enrolments; filter every course-bearing record; preserve learner self-view; test tenant isolation, grant revocation and no shared course.

### P1-03 — Schema migration and deployment data-safety review
- **Status:** hold
- **Blocker:** production schema/history unknown; no executable validated migration or owner-approved target/backup/restore window.
- **Required:** additive migration, legacy NULL-course preservation, rollback plan, no DB writes during Vercel build, explicit release approval.
