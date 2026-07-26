# ExaminerAI — Complete Application Audit (2026-07-26, Section 7 Synthesis)

> **Date:** 2026-07-26
> **Section:** 7 of 7 — Synthesis
> **Lenses:** PM, spiritual-leader/observer
> **Status:** Final report — combines all findings from Sections 1-6 (including 4b and 5b)

---

## Executive Summary

ExaminerAI is a **conceptually excellent platform with a strong architectural foundation** — centralized RBAC, 7-dimension psychological pipeline, multi-provider AI chain, per-user rate limiting, comprehensive audit logging, course-aware project configuration, and a working default-course selection system. The platform is **in production** and the core learning loop works end-to-end: students learn, teachers triage, counselors monitor, principals oversee.

However, this comprehensive 7-section audit (the most thorough to date) reveals that **defense-in-depth is inconsistently applied**. The helpers exist (assertCanAccessStudent, canAccessBatch, enforceAIRateLimit, createSafeguardingFlag) but are not used everywhere they should be. Previous fix batches (1-7) resolved 38 of the 51 items from the prior audit, but this V2 audit found new issues that were introduced or missed — particularly around institution scoping, safeguarding flag corroboration, and dead AI Assistant spec sections.

**Is this ready for production?** It's in production. The core flows work. But the safeguarding pathway has a critical gap (corroboration bypass + no principal UI), and several institution-scoping leaks remain. These are the priority fixes.

**What's the single most important thing to fix first?** Wire `createSafeguardingFlag()` into the messages + comments routes (currently each regex match creates a StudentAlert directly, bypassing the 2+ corroboration rule), and add a Safeguarding section to the Principal dashboard. This closes the spec violation AND enables the principal-facing UI in one change.

**What can safely wait?** Dead code cleanup (already partially done in Section 6b), file splits for >800-line files, module boundary enforcement, and the per-role simplification proposals from Section 4.

---

## Audit Score Summary

| Priority | Count | Description |
|----------|-------|-------------|
| CRITICAL | 7 | Active security holes or completely broken flows |
| HIGH | 12 | Security gaps, broken features, spec violations |
| MEDIUM | 14 | UX issues, missing features, code quality |
| LOW | 7 | Cosmetic, polish, minor hardening |
| **TOTAL** | **40** | |

---

## CRITICAL Findings (fix immediately)

| # | Finding | Section | Source |
|---|---------|---------|--------|
| CR-1 | **Safeguarding corroboration bypass**: messages + comments routes create one StudentAlert per regex match, never calling `createSafeguardingFlag()` which enforces the 2+ corroboration rule. A single aggressive message creates a flag. | 5, 5b | messages/route.ts, comments/route.ts |
| CR-2 | **Safeguarding flags invisible to principals**: `getSafeguardingFlagsForPrincipal()` is dead code. Flags are created as StudentAlert rows but no principal UI surfaces them. | 4, 5, 5b | PrincipalDashboard.tsx |
| CR-3 | **Null-institutionId in check-alerts** (N1): `institutionId: student.institutionId ?? undefined` — when student has null institutionId, crisis notifications go to ALL counselors globally. | 2 | check-alerts/route.ts:211 |
| CR-4 | **data-efficiency.ts:170 still has `?? undefined`** (N2): `userId: { in: scope.studentIds.length > 0 ? scope.studentIds : undefined }` — when scope.studentIds is empty, leaks ALL student health summaries. | 2 | data-efficiency.ts:170 |
| CR-5 | **assertCanAccessStudent uses legacy batchId** (N3): checks `teacher.batchId` not BatchTeacher junction. Breaks multi-teacher batches on all 28 routes using the helper. | 2 | auth.ts |
| CR-6 | **Counselor overview cross-institution leak**: `/api/counselor/overview` has no institutionId filter — any counselor sees ALL students globally. | 2, 5b | counselor/overview/route.ts |
| CR-7 | **Demo can change shared demo password**: `/api/auth/change-password` has no `demoWriteBlock`. Any visitor can lock out all future demo visitors. | 4 | auth/change-password/route.ts |

---

## HIGH Findings (fix soon)

| # | Finding | Section | Source |
|---|---------|---------|--------|
| HI-1 | **Crisis-flag notification cross-institution leak**: `/api/crisis-flags` POST sends notifications without institutionId filter. | 2, 5b | crisis-flags/route.ts |
| HI-2 | **`/api/students/alerts` no-scope leak**: no-userId branch returns ALL alerts institution-wide without scoping. | 2 | students/alerts/route.ts |
| HI-3 | **No counselor → principal escalation path**: CrisisFlag PATCH accepts only open/acknowledged/resolved. No "Escalate to Principal" button. | 5, 5b | CounselorDashboard.tsx |
| HI-4 | **Action Dialog only in TodayView**: The AI-drafts-humans-decide surface is teacher-only. Counselor + Principal have no AI-drafted message surface. | 5 | CounselorDashboard, PrincipalDashboard |
| HI-5 | **§6 Teacher Load spec is dead code**: `calculateTeacherLoad` / `getInstitutionTeacherLoadRoster` / `suggestCoTeacher` all exported but never called. Two parallel formulas that disagree. | 5, 6 | teacher-load.ts, /api/teacher/load |
| HI-6 | **§2 Data Efficiency + §7 In-Action Teaching fully dead**: All functions exported but never imported by any route or component. | 5, 6 | ai-assistant/ |
| HI-7 | **buildTeacherBatchSummary hardcodes role="teacher"**: Counselors, principals, admins calling `/api/teacher/assistant` get empty-batch response. | 5 | teacher-batch-summary.ts:85 |
| HI-8 | **TeacherCourseProgressView hardcodes 6-week web-dev plan**: Every student portfolio opens with wrong phase names for non-web-dev courses. | 4 | TeacherCourseProgressView.tsx |
| HI-9 | **StudentPortfolioPage "Week X / 6" hardcodes denominator**: Should use courseDurationWeeks. | 4 | StudentPortfolioPage.tsx |
| HI-10 | **6 institution-scoped read endpoints still missing filters**: counselor/overview, crisis-flags POST notification, students/alerts no-userId, users/[id] DELETE, users/[id]/batch PATCH, courses GET+POST. | 2 | Multiple |
| HI-11 | **Plaintext temp password storage**: PasswordResetRequest.tempPassword stores the temp password in plaintext. | 2 | password-reset flow |
| HI-12 | **RoleNavConfigPanel NAV_LABELS missing 9 keys**: Admin sees raw kebab-case labels when configuring nav. | 4 | RoleNavConfigPanel.tsx |

---

## MEDIUM Findings (fix when capacity allows)

| # | Finding | Section |
|---|---------|---------|
| ME-1 | 4 files >800 lines (modern-landing 1614, StudentPortfolioPage 1341, weekly-test 1166, CoursePlanner 1065) | 6 |
| ME-2 | Zero tests for generateCourseAlignedPlan (401 LOC) and self-paced anti-cheat (202 LOC) | 6 |
| ME-3 | AI Assistant scope resolver tests fail in CI (require seeded DB) — security-critical function has 0% reliable coverage | 6 |
| ME-4 | 3 remaining "anxiety" mentions in analysis-pipeline.ts:181 + growth-reports route:159 + one more | 3 |
| ME-5 | Comprehensive reports cached without `reviewed` flag — AI judgments persist without human review | 3 |
| ME-6 | Psych evidence has no `disputed` flag for teachers to contest AI-derived labels | 3 |
| ME-7 | Daily test scores have no override path | 3 |
| ME-8 | FinalResultPanel "Your Learning Style" heading invokes debunked construct (Pashler 2008) | 3, 4 |
| ME-9 | Final-result AI prompt lacks "Never state a clinical diagnosis" rule that 5 other prompts have | 3 |
| ME-10 | 14-day rolling consistency uses server-local TZ instead of student TZ | 3 |
| ME-11 | 8 skeleton barrel modules with 0 importers | 6 |
| ME-12 | 2 dead Prisma models (CaseReviewResponse, DailyTestAnswer) | 6 |
| ME-13 | teaching_assistant role is zombie (9 call sites, 0 users, 0 UI) | 6 |
| ME-14 | Co-teacher feature (suggestCoTeacher) built but never wired to UI | 5, 5b |

---

## LOW Findings (nice to have)

| # | Finding | Section |
|---|---------|---------|
| LO-1 | AppShell header subtitle says "Modern Web Dev & AI Bootcamp" regardless of course | 4 |
| LO-2 | AdminPrincipalTab week-bucketing hardcodes 6-week assumption | 4 |
| LO-3 | FinalResultPanel says "10 per week" hardcoded | 4 |
| LO-4 | CourseOutline has stale "Classic HTML view" link | 4 |
| LO-5 | 6 missing audit-log event types for AI-driven state changes | 3 |
| LO-6 | AI outputs in narrative/explain/final-result shown without "AI-generated" indicator | 3 |
| LO-7 | NotebookLM URL field collected + persisted + displayed but never rendered for students | 6b |

---

## What's Working Well

- **Core learning loop**: signup → daily tasks → Socratic tests → psych evidence → wellbeing tier → mentorship → certificate. Functional end-to-end.
- **RBAC architecture**: Centralized in rbac.ts, role normalization, assertCanAccessStudent with batch scoping. Solid foundation.
- **Audit logging**: Every sensitive action logged. Comprehensive.
- **AI provider chain**: DeepSeek primary + Z.ai API fallback. Token caching. Reasoning_content fallback.
- **Per-user rate limiting**: 3 categories, admin-configurable, unified via enforceAIRateLimit helper.
- **Course-aware project configuration**: projectEnabled/projectRequired/projectDefaultDurationWeeks on Course. Duration dropdown bounded to [2, courseWeeks-1].
- **Course-aligned AI project plan generator**: Tasks paired with course daily topics via courseTopicLink.
- **Default course selection**: isDefault flag on Course + auto-assignment on student approval.
- **Batch switcher**: Multi-batch teachers can filter by batch.
- **Certificate approval flow**: Student requests → teacher approves/rejects with eligibility check.
- **Growth report**: Private, honest reflection with strengths + growth areas + 7-dimension snapshot.
- **Action Dialog**: AI-drafted messages with note presets, teaching guidance, human-confirm rule.
- **Teacher Load Panel**: Self-awareness metrics (response time, touchpoint completion, crisis load).
- **Guardian dashboard**: Purpose-built parent view with report cards + conversation starters.
- **Settings panel**: Unified settings for all roles (profile, theme, password, security question).
- **Theme system**: 4 presets + light/dark/system with CSS variable injection.

---

## Recommended Fix Order

### Week 1 (Critical — security + safeguarding)
1. CR-1: Wire `createSafeguardingFlag()` into messages + comments routes
2. CR-2: Add Safeguarding section to PrincipalDashboard
3. CR-3: Fix null-institutionId in check-alerts (1-line fix)
4. CR-4: Fix data-efficiency.ts:170 (1-line fix)
5. CR-5: Refactor assertCanAccessStudent to use canAccessBatch
6. CR-6: Add institutionId filter to counselor/overview
7. CR-7: Add demoWriteBlock to auth/change-password

### Week 2 (High — broken features + spec violations)
8. HI-1: Add institutionId filter to crisis-flags POST
9. HI-2: Add scoping to students/alerts no-userId branch
10. HI-3: Add counselor → principal escalation
11. HI-7: Fix buildTeacherBatchSummary role parameter
12. HI-8: Replace TEACHER_BOOTCAMP_PLAN with course outline fetch
13. HI-9: Fix StudentPortfolioPage "Week X / 6" denominator
14. HI-12: Fix RoleNavConfigPanel NAV_LABELS

### Week 3+ (High continued + Medium)
15. HI-4: Wire ActionDialog into CounselorDashboard
16. HI-5: Unify teacher-load formulas
17. HI-6: Wire or remove dead AI Assistant sections (§2, §7)
18. HI-10: Add institution filters to 6 remaining endpoints
19. HI-11: Hash temp passwords
20. ME-1 through ME-14 as capacity allows

---

## Documentation Deliverables

The following audit documents are in the active `docs/` folder:

| Document | Section | Purpose |
|----------|---------|---------|
| `AUDIT-COMPLETE-2026-07-26-FINAL.md` | 7 (this file) | Prioritized synthesis report |
| `AUDIT-INVENTORY-2026-07-26-SECTION1.md` | 1 + 6 | API routes, UI, Prisma, AI paths, orphans, code quality |
| `AUDIT-SECURITY-2026-07-26-V2.md` | 2 | Security & access control findings |
| `CALCULATIONS-AND-AI-LOGIC.md` | 3 | Permanent reference: all formulas + AI inference review |
| `AUDIT-ROLES-2026-07-26-V2.md` | 4 | Per-role UI audit with proposals |
| `AUDIT-THEME-VISIBILITY-2026-07-26.md` | 4b | Theme + accessibility findings |
| `AUDIT-FLOWS-2026-07-26-V2.md` | 5 | Process flow tracing |
| `AUDIT-HIERARCHY-FLOW-2026-07-26.md` | 5b | Role hierarchy + cross-role handoffs |
| `SYSTEM-DOCUMENTATION.md` | 7 | Updated system documentation |

All prior audit documents have been moved to `docs/archive/`.

---

## Overall Assessment

ExaminerAI has a **strong architectural foundation** with well-designed RBAC, psychological pipeline, and AI provider chain. The product vision — AI teaches, students build, system understands — is compelling and well-documented.

The gap between **what's built** and **what's wired** has narrowed significantly since the prior audit (38 of 51 items fixed), but this V2 audit reveals that the fixes were applied **inconsistently** — the helpers exist but aren't used everywhere. The safeguarding pathway is the most critical gap: the corroboration rule (2+ signals within 14 days) is specified and implemented in `createSafeguardingFlag()`, but the actual message/comment routes bypass it entirely, creating one alert per regex match. Combined with no principal UI to surface safeguarding flags, the institution cannot fulfill its duty of care.

The institution-scoping leaks (null-institutionId pattern) keep recurring because the fix pattern (return empty arrays instead of `undefined` to Prisma) was applied to `scope.ts` but not propagated to every other file that does institution-scoped queries. A systematic pass to replace all `?? undefined` patterns in Prisma where clauses would close this class of bug permanently.

**The platform is ready for production with the understanding that the safeguarding pathway (CR-1 + CR-2) and institution scoping (CR-3 through CR-6) need immediate attention.** Everything else can be addressed iteratively.
