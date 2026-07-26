# ExaminerAI — Complete Audit Report

> **Date:** 2026-07-26
> **Scope:** Full codebase audit — 7 sections, 8 professional lenses
> **Sections:** 1-Inventory · 2-Security · 3-Roles · 4-Flows · 5-AI Logic · 6-Code Quality · 6b-Cleanup · 7-Synthesis

---

## Overall Assessment

ExaminerAI is a **conceptually excellent platform with significant implementation gaps**. The architecture is sound: centralized RBAC, 7-dimension psychological pipeline, multi-provider AI chain, per-user rate limiting, comprehensive audit logging. The product vision — AI teaches, students build, system understands — is compelling and well-documented.

However, the gap between **what's built** and **what's wired** is the platform's biggest risk. Multiple sophisticated subsystems were architected, implemented, documented, exported via barrel files — and then never integrated. The 7-section AI Assistant spec is the most dramatic example (5 of 7 sections are dead code), but the pattern repeats: teacher-load monitoring, growth reports, guardian creation, certificate approval, action dialog, case review escalation, batch switching.

**Is this ready for production?** It's in production. The core learning loop (tests → psych evidence → wellbeing → mentorship) works. Students can learn, teachers can triage, counselors can monitor. But several critical paths are broken or missing, and the security surface has real exploitable gaps.

**What's the single most important thing to fix first?** The null-institutionId bug in scope.ts — it's a cross-institution data leak that affects the AI Assistant's data scoping. One file, ~10 sites, critical severity.

**What can safely wait?** Skeleton loaders, tab pattern consolidation, dead code cleanup — these are cosmetic. The P2 items that affect UX but not security (messages pagination for portfolios, ARIA tab semantics) can also wait.

> **UPDATE 2026-07-26 (post-fix batch 1):** 7 of the 10 CRITICAL findings are now FIXED (C1, C2, C3, C7, C8, C9, C10). See `docs/COURSE-PROJECT-CONFIG-2026-07-26.md` for details. Remaining CRITICAL items: C4 (certificate approval UI), C5 (teacher create assignments), C6 (principal academic tab fake data). These are next-priority. HIGH/MEDIUM/LOW items still pending.

> **UPDATE 2026-07-26 (post-fix batch 2):** All 10 CRITICAL findings are now FIXED. C4 (certificate approval UI), C5 (teacher create assignments), C6 (principal academic tab fake data) resolved in this batch. See `docs/COURSE-ALIGNED-PROJECT-PLAN-2026-07-26.md` for details. HIGH/MEDIUM/LOW items still pending.

> **UPDATE 2026-07-26 (post-fix batch 3):** 5 HIGH findings now FIXED (H6, H8, H13, H14, H15). Plus a new "default course selection" feature ensures newly-approved students automatically land in a course. See `docs/DEFAULT-COURSE-AND-AUDIT-BATCH3-2026-07-26.md` for details. 11 HIGH + 15 MEDIUM + 10 LOW items still pending.

> **UPDATE 2026-07-26 (post-fix batch 4):** 8 more HIGH findings now FIXED (H1, H3, H5, H7, H10, H11, H12, H16). 13 of 16 HIGH items resolved. Only H2 (IDOR gaps), H4 (AI Assistant dead code), H9 (Action Dialog) remain. See `docs/AUDIT-FIXES-BATCH4-2026-07-26.md` for details. 3 HIGH + 15 MEDIUM + 10 LOW items still pending.

> **UPDATE 2026-07-26 (post-fix batch 5):** ALL 16 HIGH findings now FIXED. H2 (IDOR gaps on derived entity IDs), H4 (AI Assistant 7-section spec fully wired), H9 (Action Dialog wired into TodayView) resolved. See `docs/AUDIT-FIXES-BATCH5-2026-07-26.md` for details. Only 15 MEDIUM + 10 LOW items remain.

> **UPDATE 2026-07-26 (post-fix batch 6):** 4 more items FIXED (M1, L1, L7, L8). Batch switcher for multi-batch teachers, growth report courseId, admin role switcher option, counselor sessions refresh. See `docs/AUDIT-FIXES-BATCH6-2026-07-26.md` for details. 14 MEDIUM + 7 LOW items remain.

> **UPDATE 2026-07-26 (post-fix batch 7):** 8 more items FIXED (M2, M3, M4, M13, M14, M15, L6, L10). Principal admin nav, counselor action buttons, coordinator student visibility, psych-analyzer wording, AI prompt learning style, growth report title, check-in count accuracy. See `docs/AUDIT-FIXES-BATCH7-2026-07-26.md` for details. 9 MEDIUM + 4 LOW items remain. 38 of 51 total items FIXED.

---

## Prioritized Findings

### CRITICAL (fix immediately — active security holes or completely broken flows)

| # | Finding | Section | Source | Status |
|---|---------|---------|--------|--------|
| C1 | Null-institutionId bug in scope.ts — `institutionId ?? undefined` becomes "no filter" in Prisma → cross-institution data leak | 2 | scope.ts, data-efficiency.ts (10 sites) | ✅ FIXED 2026-07-26 |
| C2 | `/api/admin/cleanup-psych-data` runs `deleteMany({})` — any admin can wipe ALL psych data across ALL institutions | 2 | admin/cleanup-psych-data/route.ts | ✅ FIXED 2026-07-26 |
| C3 | `/api/tasks` DELETE wipes comments on ANY task (not scoped to userId) | 2 | tasks/route.ts | ✅ FIXED 2026-07-26 |
| C4 | Certificate approval has NO UI — students request, nobody can approve from the interface | 3, 4 | certificates/generate + all .tsx | ✅ FIXED 2026-07-26 (batch 2) |
| C5 | Teacher cannot create assignments — `createTask()` missing required `batchId` | 3 | AssignmentsTab.tsx | ✅ FIXED 2026-07-26 (batch 2) |
| C6 | Principal Academic tab shows entirely fake data (all zeros) | 3, 4 | principal/overview/route.ts | ✅ FIXED 2026-07-26 (batch 2) |
| C7 | Escalation cron silently 401s every night — `?secret=` in vercel.json vs `Authorization` header in route | 4 | vercel.json + escalation/run/route.ts | ✅ FIXED 2026-07-26 |
| C8 | Safeguarding flags stored against studentId instead of teacherId — spec violation, wrong person attributed | 4 | messages/route.ts, comments/route.ts | ✅ FIXED 2026-07-26 |
| C9 | `/api/ai/debug` leaks API key prefix (8 chars) + suffix (4 chars) | 2 | ai/debug/route.ts | ✅ FIXED 2026-07-26 |
| C10 | `RoleNavConfigPanel` missing 9 nav keys — saving config can brick any role's sidebar | 3 | role-nav-config/route.ts | ✅ FIXED 2026-07-26 |

### HIGH (fix soon — security gaps, broken features, spec violations)

| # | Finding | Section | Status |
|---|---------|---------|--------|
| H1 | 16 AI routes missing `checkUserAILimit` — monetary DoS possible | 1, 2 | ✅ FIXED 2026-07-26 (batch 4) |
| H2 | 14+ IDOR gaps on routes accepting derived entity IDs (interactionId, dailyLogId, flagId, etc.) | 2 | ✅ FIXED 2026-07-26 (batch 5) |
| H3 | Counselor NOT notified of gradual wellbeing decline (only crisis flags) | 4 | ✅ FIXED 2026-07-26 (batch 4) |
| H4 | AI Assistant 7-section spec: 5 of 7 sections are dead code (never imported) | 4 | ✅ FIXED 2026-07-26 (batch 5) |
| H5 | `buildTeacherBatchSummary` uses legacy `batchId` instead of BatchTeacher — AI Assistant broken for multi-batch teachers | 4 | ✅ FIXED 2026-07-26 (batch 4) |
| H6 | No guardian creation UI — API exists but no staff can use it | 3, 4 | ✅ FIXED 2026-07-26 (batch 3) |
| H7 | No student portfolio access from CounselorDashboard — locked into aggregate views | 3, 4 | ✅ FIXED 2026-07-26 (batch 4) |
| H8 | Messages compose broken for students + guardians — `/api/users` returns 403 | 3 | ✅ FIXED 2026-07-26 (batch 3) |
| H9 | Action Dialog component never imported — 4th AI Assistant section completely unreachable | 4 | ✅ FIXED 2026-07-26 (batch 5) |
| H10 | Teacher Load module completely disconnected — both spec and live route have no UI consumer | 4 | ✅ FIXED 2026-07-26 (batch 4) |
| H11 | Growth report generated but never shown to anyone | 4 | ✅ FIXED 2026-07-26 (batch 4) |
| H12 | `callAI()` called without `userId:` on 14 routes — AIUsageLog rows have null userId | 2 | ✅ FIXED 2026-07-26 (batch 4) |
| H13 | Settings nav item renders Home for all roles — no settings UI | 3 | ✅ FIXED 2026-07-26 (batch 3) |
| H14 | Guardian "Report Cards" nav item renders identical Overview page | 3 | ✅ FIXED 2026-07-26 (batch 3) |
| H15 | Teacher Mentorship tab `load()` is a no-op — no follow-up data shown | 3 | ✅ FIXED 2026-07-26 (batch 3) |
| H16 | Teacher Students tab: wellbeing + flag filters always empty (fields not in API response) | 3 | ✅ FIXED 2026-07-26 (batch 4) |

### MEDIUM (fix when capacity allows — UX issues, missing features)

| # | Finding | Section | Status |
|---|---------|---------|--------|
| M1 | No batch switcher for multi-batch teachers | 4 | ✅ FIXED 2026-07-26 (batch 6) |
| M2 | Principal can't reach course/batch/user management UI (admin-only nav) | 3, 4 | ✅ FIXED 2026-07-26 (batch 7) |
| M3 | Counselor dashboard has no action buttons (acknowledge/resolve/escalate) | 3, 4 | ✅ FIXED 2026-07-26 (batch 7) |
| M4 | Course Coordinator has no student visibility at all | 3 | ✅ FIXED 2026-07-26 (batch 7) |
| M5 | Two parallel teacher-load formulas that disagree | 5 | ⚠️ PENDING |
| M6 | Comprehensive reports cached without human review flag | 5 | ⚠️ PENDING |
| M7 | Psych evidence has no dispute mechanism | 5 | ⚠️ PENDING |
| M8 | Daily test scores have no override path | 5 | ⚠️ PENDING |
| M9 | 7 critical paths with ZERO test coverage (blocked-status, IDOR, rate-limit, AI provider, wellbeing tier, skill mastery, unified grader) | 6 | ⚠️ PENDING |
| M10 | `TEACHER_BOOTCAMP_PLAN` hardcoded 6-week web dev plan | 3 | ⚠️ PENDING |
| M11 | 4 files >800 lines (modern-landing 1614, StudentPortfolioPage 1336, weekly-test 1166, CoursePlanner 863) | 6 | ⚠️ PENDING |
| M12 | `src/modules/project/` half-extracted (410+ lines unused module code + inline route duplicates) | 6 | ⚠️ PENDING |
| M13 | "anxiety" keyword in psych-analyzer is diagnostic-sounding | 5 | ✅ FIXED 2026-07-26 (batch 7) |
| M14 | "learning style" question in ai-prompts is debunked (Pashler 2008) | 5 | ✅ FIXED 2026-07-26 (batch 7) |
| M15 | Demo can't preview admin dashboard despite banner claiming "any dashboard" | 3 | ✅ FIXED 2026-07-26 (batch 7, via L7 fix) |

### LOW (nice to have — cosmetic, polish, minor hardening)

| # | Finding | Section | Status |
|---|---------|---------|--------|
| L1 | 5 real TODOs in code | 6 | ✅ FIXED 2026-07-26 (batch 6) |
| L2 | 3 dead Prisma models (CaseReviewResponse, DailyTestAnswer, CourseWeek-as-Prisma) | 6 | ⚠️ PENDING |
| L3 | 22+ dead lib exports (10 in rbac.ts alone) | 6 | ⚠️ PENDING |
| L4 | 5 dead UI components + 30 dead shadcn primitives | 6 | ⚠️ PENDING |
| L5 | z-ai-web-dev-sdk likely never fires on Vercel prod (sandbox-only) | 6 | ⚠️ PENDING |
| L6 | Growth reports title uses strengths text as title | 3 | ✅ FIXED 2026-07-26 (batch 7) |
| L7 | Admin role switcher missing "Admin" option | 3 | ✅ FIXED 2026-07-26 (batch 6) |
| L8 | Counselor Sessions tab no refresh after logging (onLogged is no-op) | 3 | ✅ FIXED 2026-07-26 (batch 6) |
| L9 | Guardian AI Tutor is student-facing practice chat (questionable fit) | 3 | ⚠️ PENDING |
| L10 | Attention score "recent" low-confidence logs are actually lifetime | 5 | ✅ FIXED 2026-07-26 (batch 7) |

---

## Audit Score Summary

| Priority | Count | Status |
|----------|-------|--------|
| CRITICAL | 10 | Need immediate fixes |
| HIGH | 16 | Need fixes within 1-2 weeks |
| MEDIUM | 15 | Fix when capacity allows |
| LOW | 10 | Nice to have |
| **TOTAL** | **51** | |

## What's Working Well

- **Core learning loop**: signup → daily tasks → Socratic tests → psych evidence → wellbeing tier → mentorship → certificate. The main student journey (minus approval + growth report) is functional.
- **Psychological pipeline**: 7 dimensions, 14-day rolling window, wellbeing tier with decay, skill mastery with rolling blend. Well-designed and evidence-grounded.
- **RBAC architecture**: Centralized in rbac.ts, role normalization, assertCanAccessStudent with batch scoping. Solid foundation.
- **Audit logging**: Every sensitive action logged. Comprehensive.
- **AI provider chain**: DeepSeek primary + Z.ai fallback. Reasoning_content fallback for V4 models. Token caching.
- **Per-user rate limiting**: 3 categories (test/tutor/assistant), admin-configurable, demo AI toggle.
- **Mentorship touchpoint flow**: Voice logger → AI parse → confirm → save. Fully wired, one of the best flows.
- **Safeguarding scan**: Deterministic pre-filter runs on every staff→student message. (Implementation has bugs, but the scan itself works.)
- **Self-paced learning**: Day advancement, anti-cheat flags persisted as alerts, early weekly test unlock.
- **Comprehensive report**: 7-section AI-generated private report with accomplishments, areas to improve, management attitude.

## Recommended Fix Order

### Week 1 (Critical — security + completely broken flows)
1. C1: Fix null-institutionId in scope.ts
2. C2: Scope cleanup-psych-data to institution
3. C3: Scope tasks DELETE comments to userId
4. C7: Fix escalation cron auth mismatch
5. C8: Fix safeguarding flag attribution (studentId → teacherId)
6. C9: Remove API key leak in ai/debug
7. C4: Add certificate approval UI for staff
8. C5: Fix assignments createTask missing batchId

### Week 2 (High — broken features + spec violations)
9. H1: Add checkUserAILimit to 16 AI routes
10. H3: Add counselor to check-alerts recipient list
11. H5: Fix buildTeacherBatchSummary to use BatchTeacher
12. H6: Add guardian creation UI
13. H8: Fix messages compose for students + guardians
14. H4: Wire AI Assistant 7-section spec (at minimum: scope resolver + action dialog + teacher load)
15. C10: Fix RoleNavConfigPanel missing nav keys
16. C6: Replace fake principal academic data with real queries

### Week 3+ (Medium — UX gaps + missing features)
17. H7: Add student portfolio access from CounselorDashboard
18. H10: Wire teacher-load UI
19. H11: Wire growth report UI
20. M1: Add batch switcher
21. M2: Give principal course/batch management UI
22. M3: Add action buttons to counselor dashboard
23. H13: Fix Settings nav item
24. H14: Fix guardian Report Cards duplicate
25. H15: Fix mentorship load() no-op
26. H16: Fix students tab wellbeing filters

### Ongoing (Low — cleanup + polish)
- Dead code removal (3 models, 22 exports, 5 components, 30 shadcn primitives)
- Test coverage for 7 critical paths
- File splits for 4 files >800 lines
- Module boundary enforcement (src/modules/project/ decision)
- z-ai-web-dev-sdk removal (after confirming zero prod usage)
- TODO resolutions (5 remaining)
- Cosmetic fixes (growth report title, admin switcher, counselor refresh, etc.)

---

## Documentation Deliverables

| File | Section | Purpose |
|------|---------|---------|
| `docs/AUDIT-INVENTORY-2026-07-26.md` | 1 + 6 | Complete codebase inventory + code quality findings |
| `docs/AUDIT-SECURITY-2026-07-26.md` | 2 | Security & access control audit (9C/23H/17M/9L) |
| `docs/AUDIT-ROLES-2026-07-26.md` | 3 | Role-by-role UI audit (8 roles, 5 critical bugs) |
| `docs/AUDIT-FLOWS-2026-07-26.md` | 4 | Process flow audit (5 flows, 10 priority gaps) |
| `docs/CALCULATIONS-AND-AI-LOGIC.md` | 5 | Permanent reference: all formulas + AI inference review |
| `docs/AUDIT-COMPLETE-2026-07-26.md` | 7 | This synthesis document |
