# Section 4: Process Flows and Journeys Audit — ExaminerAI

> **Date:** 2026-07-26
> **Lenses:** PM, educationist, behavior analyst, mentor
> **Scope:** Traced 5 end-to-end process flows + AI Assistant 7-section spec wiring

## 1. Student Journey: signup → certificate → growth report

| Step | Status | Notes |
|------|--------|-------|
| Self-signup | ✅ | PUT /api/auth/login, gated by signup_enabled |
| Pending → approval | ✅ | Teachers can approve own batch; admins anywhere |
| Auto-assignment to Default Batch | ⚠️ | Looks up batch by name "Default Batch" — if missing, student gets batchId=null |
| Daily check-in | ✅ | CheckInPanel + /api/daily-logs |
| Practice/Daily/Weekly tests | ✅ | All three test types work |
| Self-paced advance | ✅ | SelfPacedAdvanceButton + /api/self-paced |
| Project setup + tasks + Gantt | ✅ | ProjectSettingsCard renders inline when no project |
| Project weekly reports | ✅ | ProjectReportPanel + /api/project/reports |
| Certificate REQUEST | ✅ | CertificateCard calls POST /api/certificates/generate |
| Certificate APPROVAL by staff | 🔴 | NO UI surfaces pending requests to any staff member — students stay PENDING forever |
| View/share certificate | ✅ | /verify/[token] public verifier works |
| Growth report | 🔴 | /api/growth-reports/[userId] exists but no .tsx imports it — generated but never shown |

**Can a student go signup to certificate without hitting a wall?** NO — certificate approval and growth report are dead ends.

## 2. Teacher Flow: batch assignment → mentorship → load monitoring

| Step | Status | Notes |
|------|--------|-------|
| Create teacher account | ✅ | POST /api/users (admin-only for non-student) |
| Assign to batch (single/multi) | ✅ | BatchTeacher junction supports many-to-many |
| Multi-batch data scoping | ✅ | getTeacherBatchIds returns array; getBatchFilter builds correct Prisma filter |
| Multi-batch UI switcher | ❌ | NO batch switcher in teacher UI — merged list, no filtering |
| Daily teaching (Today view) | ✅ | TodayView + /api/stats?as=teacher |
| Grading/overrides | ✅ | edit-weekly-test, grades/override |
| Mentorship touchpoints | ✅ | VoiceTouchpointLogger → AI parse → confirm → save. Fully wired. |
| Case review | ✅ | POST anonymize → review → publish → browse |
| Teacher load self-view | 🔴 | /api/teacher/load returns real data, NO .tsx consumes it |
| Institution-wide load roster | ❌ | getInstitutionTeacherLoadRoster never imported |
| Co-teacher suggestion | ❌ | suggestCoTeacher never called |

## 3. Counselor Flow: wellbeing signal → case review → escalation → guardian

| Step | Status | Notes |
|------|--------|-------|
| Wellbeing signal collection | ✅ | WellbeingState, StudentAlert, CrisisFlag, PsychEvidence all populated |
| Daily struggle-signal scan | ✅ | /api/students/check-alerts runs at 09:00 UTC via Vercel cron |
| Counselor notified by daily scan | 🔴 | check-alerts notifies teacher+admin+principal but NOT counselor |
| Counselor notified on crisis flag | ✅ | crisis-flags route sends messages to counselor+principal+admin |
| Command center dashboard | ✅ | Rich real-time data from /api/counselor/overview |
| GROW touchpoint logging | ✅ | VoiceTouchpointLogger in Sessions tab |
| Case review | ✅ | Anonymized peer consultation works |
| Acknowledge/Resolve crisis from dashboard | ❌ | Crisis queue displayed but NO action buttons |
| Escalate case to principal | ❌ | No escalation button anywhere in CounselorDashboard |
| Involve a guardian | 🔴 | /api/guardian/create exists but NO .tsx calls it — no staff UI |
| Individual student portfolio | ❌ | No onStudentClick — counselor locked into aggregate views |

## 4. Principal/Admin Flow: institution setup → reporting → staff oversight

| Step | Status | Notes |
|------|--------|-------|
| Institution creation | ✅ | POST /api/institutions works |
| Institution settings edit | ⚠️ | API works but UI form inside AdminDashboard is admin-only nav — principal can't reach it |
| Principal dashboard | ✅ | Real aggregate data (totals, wellbeing, alerts, audit) |
| Per-course performance | 🔴 | Hardcoded to zero: teacher="—", studentCount=0, avgScore=0 |
| Per-teacher performance | 🔴 | Hardcoded to zero: courses=0, sessions=0, alertsRaised=0 |
| Enrollment count | 🔴 | Promise.resolve(0) — no Enrollment model |
| Principal creates course | ❌ | API allows it, but CoursePlanner nav is teacher/coordinator only, AdminCoursesPanel is admin-only nav |
| Principal creates batch | ❌ | Same — API allows, UI unreachable |
| Staff oversight: teacher behavior | ❌ | TeacherBehaviorTab is admin-only nav — principal can't see it |
| Safeguarding flags | ❌ | getSafeguardingFlagsForPrincipal never called by any route |
| Audit log | ✅ | Real data, last 20 entries |

## 5. AI Assistant Flow — 7-Section Spec Wiring Status

| Section | Module | Status | Wiring |
|---------|--------|--------|--------|
| 1. Scope Resolver | scope.ts | ⚠️ Partial | Called only by action-dialog route. Main /api/teacher/assistant bypasses it entirely |
| 2. Data Efficiency | data-efficiency.ts | ❌ Dead | All functions exported, none imported by any route. AICache table never used by assistant |
| 3. Escalation Engine | escalation.ts | 🔴 Broken | Cron auth mismatch: vercel.json sends ?secret= but route expects Authorization header. 401s every midnight |
| 4. Action Dialog | action-dialog.tsx | ❌ Dead | Component well-built but ZERO imports in any .tsx file. Completely unreachable |
| 5. Safeguarding | safeguarding.ts | 🔴 Spec-violating | Scan runs on messages+comments BUT: (a) flags stored against studentId not teacherId, (b) one flag per signal — no 2+ corroboration, (c) createSafeguardingFlag never called, (d) principal review UI doesn't exist |
| 6. Teacher Load | teacher-load.ts | ❌ Dead | calculateTeacherLoad, getInstitutionTeacherLoadRoster, suggestCoTeacher — all exported, none imported |
| 7. In-Action Teaching | teaching-guidance.ts | ❌ Dead | getGuidanceForFlagType, buildGuidancePromptSection — never called. Action dialog builds its own guidance inline |

### What each role can actually ask the AI Assistant

| Role | Surface | Uses 7-section spec? |
|------|---------|---------------------|
| Student | AITutor (/api/ai/tutor) | N/A (correctly excluded) |
| Teacher | AIAssistantBox + TeacherAITutor | NO — uses buildTeacherBatchSummary (legacy batchId, not BatchTeacher) |
| Counselor | Same /api/teacher/assistant endpoint | NO — counselor's batchId is null → "no students assigned" |
| Principal | Same endpoint | NO — same issue, principal's batchId is null |
| Guardian | None | N/A (correctly excluded) |

## Top 10 priority actions from this section

1. Add "counselor" to check-alerts recipient list — one line, immediate pastoral-care win
2. Fix escalation cron auth mismatch (?secret= vs Authorization header)
3. Fix safeguarding flag attribution (studentId → teacherId, add corroboration)
4. Add certificate approval UI for staff
5. Add guardian creation UI for staff
6. Wire ActionDialog into flag surfaces (MentorshipTabV2, CounselorDashboard)
7. Wire teacher-load UI (My Load card in TodayView, roster in PrincipalDashboard)
8. Add batch switcher for multi-batch teachers
9. Fix buildTeacherBatchSummary to use BatchTeacher (not legacy batchId)
10. Replace fake per-course/per-teacher performance in principal overview with real data
