# TraineesAI — Pre-reset Repository Baseline

**Snapshot date:** 11 November 2026  
**Repository:** fccljbplant/ExaminerAI  
**Default branch:** main  
**Purpose:** A verified starting point for the reset. This is not a full source-code audit.

## 1. Live repository evidence

- Repository permissions: linked GitHub connection reports admin, maintain, push and pull access.
- Default branch: main.
- Live main HEAD at snapshot: 740deac3ac003a9ec94ba4413892101c91e632ca.
- Latest main commit: merge of PR #20, which records PR #19 merge and remaining PR #3 decisions.
- Main combined status: Vercel reports failure with the build-rate-limit URL. Do not describe the latest main HEAD as deployment-ready based on this status.
- The connected workflow-run query returned no PR-triggered Actions runs for this exact main commit. That is not proof that no workflow exists or that tests failed; query workflow history directly during the reset/audit.
- PR #19 exact-head Actions run 43065448723 was recorded in the merged PR history as passing install, isolated test database, lint, 400 tests, TypeScript, production build, route smoke tests and authenticated role screenshots. This validates PR #19's head, not automatically the later docs-only main commit.
- No production database was inspected in this audit snapshot.

## 2. Branches at snapshot

The live branch listing returned these 20 refs, including main. The reset instruction is to retain main only.

1. backup/v3-ui
2. consolidation/agent-pack-mainline
3. consolidation/learner-home-failure-safe-2026-11-11
4. consolidation/record-agent-pack-merge
5. consolidation/record-pr17-merge-2026-11-11
6. consolidation/record-pr19-merge-and-pr3-blockers-2026-11-11
7. consolidation/weekly-test-course-safety-2026-11-11
8. docs/record-learner-home-heading
9. docs/record-pr11-merge
10. docs/record-production-ready
11. fix/ui-simplification-safe
12. fix/vercel-build-readonly
13. main
14. master
15. ux-audit/fix-dashboard-truthfulness-and-agent-safety
16. ux-audit/learner-courses-compatibility
17. ux-audit/learner-home-error-handling
18. ux-audit/project-continuity-refresh
19. ux-audit/ui-simplification-consolidated
20. vercel/vercel-web-analytics-integrati-flq88k

Recheck this list immediately before deletion. It can change after this snapshot.

## 3. Open pull requests

| PR | State | Branch | Head SHA | Current comparison to main | Notes |
|---|---|---|---|---|---|
| #3 | Open, draft, not mergeable | ux-audit/fix-dashboard-truthfulness-and-agent-safety | 4912698a08be04c9ba43632495400bbff4042837 | 604 ahead, 53 behind, 168 changed files, diverged | Do not merge wholesale. Close PR and delete source branch during reset after private archive. |
| #6 | Open, draft, not mergeable | backup/v3-ui | 39f2d0faab32b6b4f2054b07b2eedeb108de4300 | Previously reported diverged; refresh exact comparison before reset | Contains tracked prisma/db/custom.db and broad shared-shell/UI changes. Close PR and delete source branch during reset after the data artifact is handled safely. |

Closed/merged PR history is retained on GitHub and in main ancestry. The open PR record is closed, not erased, when reset.

## 4. Useful work already on main — do not rebuild

Verified merged work includes:
- PR #2: Vercel Analytics integration.
- PR #7: role-aware portal home routing and safe UI simplification.
- PR #8: learner course catalog compatibility redirect.
- PR #9: learner-home project/profile failure handling returns a service error instead of false empty success.
- PR #11: Vercel build is read-only; admin bootstrap is explicit and does not reset existing accounts.
- PR #14–#16: deployment/consolidation and Agent Pack documentation.
- PR #17: selected PR #3 dashboard/roster corrections, including real roster aggregates, course scoping and truthful KPI counts.
- PR #19: selected PR #3 Learn weekly-test course identity/enrollment checks, final-content-day sequencing, no-grade-on-AI-failure behavior, unavailable-score handling and regression tests.
- PR #20: records the PR #19 merge and remaining PR #3 blockers.

Other historical merges are visible in GitHub and must be verified against current code before relying on their details.

### Verified implementation examples on main

- Vercel build script now generates Prisma clients and runs Next build without schema push or account/marketplace seeding.
- Explicit admin bootstrap requires a strong supplied password and does not modify an existing account.
- Learn weekly test start/answer routes are course-aware and server-check course enrollment and final content-day sequencing.
- Weekly assessment AI-unavailable behavior returns a service error without storing a fabricated grade or awarding completion XP.
- Weekly scoring helpers preserve missing scores as unavailable and genuine zero as zero.
- Learner-home profile and project lookup failures return service-unavailable rather than false successful empty state.
- Learner course catalog compatibility route exists.
- Course-based learner difficulty uses five levels (Warm-up, Core, Stretch, Advanced, Expert).
- LearnerHome dashboard component exists; dashboard inventory and source-of-truth selection still need audit.
- Weekly learner calibration/coherence calculation exists in psych-weekly.ts; its route-level consent, scope and visibility need audit.
- Instructor AI assistant endpoint and pseudonym helper exist; end-to-end scope, prompts, provider configuration, logging and data minimization need audit.
- Browser TTS filtering exists; locale/voice selection and playback behavior need audit.
- Current package already contains libraries such as TanStack Table, Recharts, DnD Kit, Framer Motion, React Query and next-intl. Verify imports and use before adding dependencies.

## 5. High-priority mainline audit targets

These are investigation targets, not final audit conclusions.

| Area | Mainline evidence to inspect | Why |
|---|---|---|
| Authentication fallback | src/lib/auth.ts | Verify DB-outage fallback, revocation, blocked accounts and role freshness fail safely. |
| Cron access | src/lib/cron-auth.ts | Verify production secrets are mandatory and routes fail closed. |
| AI context secret | src/modules/ai/privacy.ts | Verify no production fallback to a development secret. |
| Provider/model config | src/modules/assessment/lib/ai-provider.ts | Comments and model IDs appear stale/contradictory; inspect actual request order and payloads. |
| Embeddings | src/modules/ai/lib/rag.ts | Verify dedicated credentials, surfaced failures and tenant/course-safe retrieval. |
| Instructor scope | src/modules/course/lib/instructor-access.ts and every consuming route | Verify role aliases and admin behavior align with four-role and tenant rules. |
| Organisation assignment | src/app/api/org/assign-course/route.ts | Verify tenant membership, course ownership, transactionality and audit. |
| Enrollment APIs | src/app/api/enrollments/[userId]/route.ts and all eight entry paths | Verify one lifecycle, scope, idempotency, seat/count concurrency and approvals. |
| Instructor learner detail | src/app/api/v2/instructor/students/[id]/route.ts | Verify selected-course filters and consent/feature gating for confidence/support fields. |
| Legacy portfolio | src/app/api/students/[id]/portfolio/route.ts | Verify route reachability, selected-course filters and role/grant boundaries. |
| Final result | src/app/api/students/final-result/route.ts | Verify course scope, unavailable-score handling and support-field classification. |
| Email/notifications | src/lib/email.ts | Verify whether email delivery is real or only in-app/webhook best effort. |
| Course content | src/app/api/learn/today/next-slide/route.ts and LearnSlide model | Verify shared content, concurrency, idempotency and first-learner personalization. |
| Dashboard sources | src/modules/learn/components/dashboard/LearnerHome.tsx and portal consumers | Verify one canonical dashboard journey and no duplicate/conflicting source of truth. |

## 6. Cleanup constraints

- Retire stale plan documents only after a link/reference and unique-content audit.
- Keep unique decisions, migration history, approved requirements and session logs.
- Mark old work queues as superseded; do not leave them appearing executable.
- Never delete database files, generated artifacts, dependencies or source files until their content/use and consequences have been checked.
- Do not delete the PR #3 schema rollout record or owner decision history. They remain useful evidence even after PR #3 is closed.
- Never copy a tracked database binary into a public repository or an uncontrolled archive.
