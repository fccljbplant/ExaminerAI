# Section 5b — Hierarchy + Cross-Role Flow Audit

**Date:** 2026-07-26
**Auditor:** sub-agent (hierarchy + cross-role)
**Scope:** Document the actual authority/visibility hierarchy as implemented, then trace every cross-role handoff end-to-end and classify each gap.

---

## 1. Actual Hierarchy (as implemented, not assumed)

### 1.1 Role groupings (from `src/lib/rbac.ts`)

| Grouping | Members | Notes |
|---|---|---|
| `ADMIN_ROLES` | `principal`, `administrator`, `demo` | "Institution-wide" / system-wide access. Demo is read-only. |
| `TECHNICAL_ROLES` | `administrator` only | Demo is deliberately excluded. |
| `STAFF_ROLES` | `teaching_assistant`, `teacher`, `course_coordinator`, `counselor`, `principal`, `administrator`, `demo` | Anyone who isn't a student/pending/guardian. |
| `USER_MANAGEMENT_ROLES` | `principal`, `administrator`, `teacher` | Teachers can approve pending students in their batch. |

Legacy aliases normalized transparently in `normalizeRole()`: `institution_admin`→`principal`, `platform_admin`→`administrator`, `admin`→`administrator`.

### 1.2 Org chart (authority + visibility, as actually implemented)

```
                    administrator (platform-level — system config, AI config,
                                   feature flags, global settings)
                            │
                            │  (no formal reporting line — administrator is
                            │   operational, not pastoral)
                            ▼
                    principal (institution-level — sets escalation policy,
                               mandatory 2nd crisis recipient, manages roles
                               within their institution)
                            │
              ┌─────────────┼─────────────────────┬──────────────────────┐
              ▼             ▼                     ▼                      ▼
        counselor     course_coordinator        teacher             teaching_assistant
        (institution- (course/batch structure   (multi-batch via     (same scope as
         wide pastoral  within institution)     BatchTeacher         teacher, narrower
         access)                                 junction)            job)
                            │
                            ▼
                      student (one batch via User.batchId)
                            │
                            ▼
                      guardian (GuardianLink → one student, view-only)
```

### 1.3 Who-can-see-whom matrix (actual behavior, cross-referenced with code)

| Viewer | Sees students in | Sees teachers in | Sees alerts for | Sees safeguarding flags |
|---|---|---|---|---|
| **student** | self only (`assertCanAccessStudent` line 223-228) | none directly | self only | never |
| **guardian** | linked child only (via `GuardianLink`, auth.ts:264-273) | linked child's batch teacher (name + email only, via `/api/guardian/overview`) | linked child's praise_notes + active alerts (text only) | never |
| **teaching_assistant** | students in their batches (`getBatchFilter` / `BatchTeacher` junction) | self only | **all open alerts system-wide via `/api/students/alerts` (no scope filter!)** | never (filtered out at API) |
| **teacher** | students in their batches (BatchTeacher + legacy `User.batchId`) | self only | **all open alerts system-wide via `/api/students/alerts` (no scope filter!)** | never (filtered out at API) |
| **course_coordinator** | via `AccessGrant` only | via `AccessGrant` | same leak as teacher | never (filtered out) |
| **counselor** | **ALL students system-wide via `/api/counselor/overview` (no institution filter!)** — see §3.1 | all teachers in their institution (per `scope.ts`) | same leak + counselor overview aggregates across institutions | never (filtered out) |
| **principal** | all students in their institution (via `/api/principal/overview` — correct) | all teachers in their institution (correct) | all alerts in their institution + safeguarding alerts (technically accessible but not surfaced — see §3.3) | **theoretically accessible via `/api/students/alerts` but never queried by `PrincipalDashboard`** |
| **administrator** | all students (no institution filter in many endpoints) | all teachers | same as principal | same as principal |
| **demo** | read-only preview of admin/principal dashboards | same | same | same |

### 1.4 Key scoping primitives

- **`assertCanAccessStudent(payload, studentId)`** (`src/lib/auth.ts:218-289`) — used by per-student routes (`/api/students/[id]/*`, `/api/mentorship/touchpoints`, `/api/crisis-flags`, `/api/certificates/generate`, etc.). Enforces batch / AccessGrant / GuardianLink boundaries. **Per-student routes are well-scoped.**
- **`getBatchFilter(userId, role)`** (`src/lib/batch-teachers.ts:46-51`) — used by list endpoints (`/api/stats?as=teacher`, `/api/certificates/pending`, etc.) to scope by BatchTeacher junction. **Batch-scoped list endpoints are well-scoped.**
- **`resolveAssistantScope(callerId, callerRole)`** (`src/lib/ai-assistant/scope.ts:64-252`) — the carefully-designed institution-aware scope resolver. **Only called from `/api/assistant/action-dialog/route.ts` — ONE production route.** The counselor/principal/crisis-flags dashboards do their own queries, often bypassing this resolver.

---

## 2. Cross-Role Handoff Trace

For each handoff: source → sink, with classification:
- **(a) never triggers** — the action never starts.
- **(b) triggers but goes to wrong role / wrong scope** — the action fires but lands somewhere it shouldn't (or fails to land where it should).
- **(c) triggers correctly but no UI surfaces it** — the DB state is correct but no human sees it.
- **(d) fully working** — end-to-end functional.

### 2.1 Escalation Engine (amber → red)

**Path:** `runEscalationEngine()` in `src/lib/ai-assistant/escalation.ts` → cron `0 0 * * *` (vercel.json line 23-25) → `POST/GET /api/assistant/escalation/run?secret=...`.

**Trigger logic:**
1. Duration: amber (`severity="warning"`) + 7+ days unresolved → red.
2. Repeat: 2nd repeat within 30d → 2-day timer; 3rd+ repeat → immediate red.

**Sink:**
- Updates `StudentAlert.severity` from `"warning"` → `"red"`.
- Updates `WellbeingState.tier` to `"red"` for the flagged user.
- Logs the escalation.

**Downstream visibility:**
- `/api/students/alerts` returns the alert with new severity → TeacherDashboard's alert list, AppShell alert badge, MentorshipTabV2's alert list.
- `/api/principal/overview` counts the alert as a "crisis alert" (`severity === "red"`).
- `/api/counselor/overview` shows the alert in the alert queue with red badge.

**Classification:** **(d) fully working — but with a silent-update caveat.**

Caveat: there is NO push notification when an escalation fires. The principal/counselor/teacher must already be polling their dashboard. If they're not actively viewing, they don't know escalation happened until they next refresh. This is a soft gap, not a hard break.

**Sub-issue (b):** `checkOnWriteEscalation()` (the on-write immediate-escalation path) is only called by `createSafeguardingFlag()` — which is itself never called from any production code path (see §2.3). So the "3rd+ repeat → immediate red" trigger only fires during the daily cron, not on write. **A 3rd repeat occurrence at 9 AM waits until midnight to escalate.** This is a sequence gap.

---

### 2.2 Crisis flag → Counselor + Principal

**Path:** `POST /api/crisis-flags` (`src/app/api/crisis-flags/route.ts:50-158`).

**Trigger:** Teacher / counselor / principal / administrator flags a student. UI surface: `PsychologicalTab.tsx` "Flag" button.

**Sink:**
1. `db.crisisFlag.create(...)` — the flag itself.
2. `db.mentorshipTouchpoint.create(...)` — auto-creates an `alert_response` touchpoint so the Mentorship tab shows it.
3. Sends in-app `db.message.create(...)` to all counselors + principals + administrators.

**Classification:** **(b) triggers but goes to wrong scope.**

**Bug:** Lines 131-135 — the recipient query is:
```js
const recipients = await db.user.findMany({
  where: { role: { in: notifyRoles }, blocked: false },
  select: { id: true },
});
```

There is **no `institutionId` filter**. A crisis flag for a student at Institution A sends an in-app message to **every counselor, principal, and administrator across every institution in the system**. The intended design (per rbac.ts comments) is that the principal of the student's institution is the "mandatory second crisis-notification recipient" — not all principals everywhere.

**Severity:** High. This is a privacy leak (other institutions learn a student at a different institution is in crisis) + an alarm-fatigue issue (principals get notified about students they cannot access).

**Secondary observation:** The MentorshipTouchpoint auto-creation is good — it lands in the student's mentorship timeline. The CounselorDashboard's "Recent Sessions" panel pulls from `/api/counselor/overview`, which (per §3.1) loads ALL touchpoints across ALL institutions. So the counselor sees the touchpoint, but so does every other counselor in the system.

---

### 2.3 Safeguarding flag → Principal

**Path:** `POST /api/messages` and `POST /api/comments` → `analyzeMessageForSafeguarding()` → `db.studentAlert.create({ type: "safeguarding", userId: <teacher's id> })`.

**Trigger logic (as designed in `src/lib/ai-assistant/safeguarding.ts`):**
1. Deterministic regex pre-filter flags aggressive/trauma/neglect/dismissive/inappropriate patterns.
2. `createSafeguardingFlag()` requires **2+ corroborating signals** before creating a flag.
3. Principal reviews via `getSafeguardingFlagsForPrincipal()`.

**Actual implementation (as wired in `messages/route.ts:88-121` and `comments/route.ts:101-132`):**
1. The regex pre-filter runs.
2. **For EVERY signal in a single message, a separate `StudentAlert` is created immediately** — no corroboration count check.
3. Each alert gets `severity = signal.severity` — so a single message containing one `trauma_inducing` pattern instantly creates a `"red"` severity safeguarding alert.
4. The alert is attributed to the teacher (`userId = user.id`, per C8 fix).
5. The alert is stored with `type = "safeguarding"`.

**Sink (where it lands):**
- `/api/students/alerts` filters `type=safeguarding` to principal-only — so principals CAN see these when they query.
- `/api/principal/overview` loads ALL alerts (including safeguarding) but **only categorizes by `psychological`/`educational`/`mentorship`** in the `byType` stat. Safeguarding alerts are NOT in `byType`.
- `PrincipalDashboard.tsx` does NOT have a "Safeguarding" tab, section, or list. Safeguarding alerts are mixed into the `openAlerts` count with no visual distinction.
- `getSafeguardingFlagsForPrincipal()` and `createSafeguardingFlag()` are exported but **never called by any production code path** (confirmed by grep — only references are in `safeguarding.ts` itself, the module barrel `index.ts`, and docs).

**Classification:** **(c) triggers but no UI surfaces it specifically.** With three sub-bugs:

1. **Corroboration bypass (logic bug, not just UI).** The 2+ corroboration requirement is documented as a deliberate safeguard against false positives from a single message. The actual implementation creates one alert per regex hit per message, instantly, with no aggregation. A teacher writing "stop talking" once creates a `warning`-severity safeguarding alert. A teacher writing "you're too sensitive" creates another. These never get aggregated into a single `createSafeguardingFlag()` call.

2. **No principal-specific surface.** The principal's dashboard has no way to see "these are safeguarding alerts against teacher X." The data is in the DB; the API can return it; but the UI doesn't render it as a distinct category.

3. **The dedicated `getSafeguardingFlagsForPrincipal()` function and `createSafeguardingFlag()` function are dead code.** They exist in the module barrel export but are never imported by any route or component.

**Severity:** Critical for the safeguarding pathway specifically. The whole Section 5 of the AI Assistant spec is effectively bypassed.

---

### 2.4 Teacher logs a touchpoint → Counselor / Principal

**Path:** `POST /api/mentorship/touchpoints` (`src/app/api/mentorship/touchpoints/route.ts:67-129`).

**Trigger:** Teacher / TA / counselor / principal / administrator logs a touchpoint via the Mentorship tab's "Log touchpoint" button (or `VoiceTouchpointLogger`).

**Sink:**
1. `db.mentorshipTouchpoint.create(...)` — persisted.
2. `logAudit(...)` — audit-logged.
3. **NO message or notification is sent.** No push to counselor or principal.

**Downstream visibility:**
- Counselor's "Recent Sessions" list (in `SessionsView` of `CounselorDashboard.tsx`) — pulls from `/api/counselor/overview`'s `recentTouchpoints` field, which loads the 50 most recent touchpoints across ALL students.
- Principal's `mentorSessions` count (in `/api/principal/overview`) — counted but not listed individually.
- Mentor's own MentorshipView (`H15 fix` — fetches `/api/mentorship/touchpoints`).
- Follow-up dates surface in counselor's "Follow-ups Due" panel.

**Classification:** **(d) fully working — within the counselor's dashboard refresh cycle.**

Caveat: there is no push notification. The counselor must already have their dashboard open. There is also the cross-institution leak (see §3.1) — a counselor at Institution A sees touchpoints from Institution B in their "Recent Sessions" list.

---

### 2.5 Teacher requests a co-teacher

**Path:** None in UI. The API exists at `POST /api/batches/[id]/teachers` (`src/app/api/batches/[id]/teachers/route.ts`) but **no UI component calls it** (confirmed by grep — only references are in the route file itself).

**The `suggestCoTeacher()` function** (`src/lib/ai-assistant/teacher-load.ts:220-296`) — a curated green-tier co-teacher recommendation — is **also never called by any production code path**. It's exported in the module barrel but no route or component imports it.

**Classification:** **(a) never triggers.** The feature is completely unwired from the UI.

**Sub-issue:** The API endpoint allows a teacher who is already a BatchTeacher on a batch to add another teacher directly — there's no "request" workflow (no approval step). This is fine for trusted-teacher scenarios but means the "request a co-teacher" handoff concept doesn't exist. The closest the system gets is:
1. The `teacher-load.ts` module computes a teacher's load tier.
2. `suggestCoTeacher()` would (if called) recommend a green-tier colleague.
3. The recommending principal/teacher would then call `POST /api/batches/[id]/teachers` to add them.

Steps 2 and 3 are not wired.

---

### 2.6 Safeguarding flag reaches the Principal

Already covered in §2.3. Summary: the flag is created in the DB (over-aggressively, bypassing the corroboration design), but the Principal's dashboard has no dedicated surface to view safeguarding flags specifically. **(c) triggers but no UI surfaces it.**

---

### 2.7 Guardian touchpoint → Guardian

**Path:** Staff logs a `MentorshipTouchpoint` with `type = "praise_note"` → `/api/guardian/overview` loads the 3 most recent praise notes for the linked student → they appear in the guardian's "wins" list.

**Trigger:** Staff member (typically teacher or counselor) opens the Mentorship tab and logs a touchpoint with `type = "praise_note"`.

**Sink:** Guardian fetches `/api/guardian/overview` → praise notes appear in `wins[]` (lines 188-190 of `/api/guardian/overview/route.ts`).

**Classification:** **(d) fully working — but only for praise_note type.**

Caveats:
1. **Only `praise_note` touchpoints reach the guardian.** Other touchpoint types (`checkin`, `alert_response`, `escalation`, `psychological`, `crisis_response`, etc.) are filtered out by the `where: { userId: studentId, type: "praise_note" }` query at line 121-122. A counselor who logs a `goal_setting` touchpoint doesn't reach the guardian.
2. **No push notification.** The guardian must open their dashboard to see the praise note.
3. **No "send a message to guardian" UI surface.** Staff can send a regular message via `/api/messages` to the guardian's userId (and `/api/users` does allow staff to find guardian userIds — `H8 fix`), but there's no dedicated "contact guardian" CTA in the student portfolio. The GuardianCreationPanel only creates/removes guardian accounts.

**Severity:** Medium. The praise_note path works as designed. The lack of a structured "contact guardian" flow is a UX gap, not a sequence break.

---

### 2.8 Certificate / growth-report generation at course completion

**Path:** Manual only. No automation triggers on course completion.

**Certificate flow:**
1. Student manually clicks "Request Certificate" in `ReportCardPanel.tsx`.
2. `POST /api/certificates/generate` (no userId) → creates a PENDING certificate request.
3. Staff sees it in `/api/certificates/pending` → `CertificateApprovals.tsx` (`C4 fix`).
4. Staff clicks "Approve" → `POST /api/certificates/generate?userId=X` → generates the actual certificate with grade + score.

**Growth-report flow:**
1. Student or staff opens the `GrowthReportPanel` (`H11 fix`).
2. `GET /api/growth-reports/[userId]` → if no report exists, generates one on-demand and returns it.

**Classification:** **(a) never triggers automatically.** Both require manual user action.

**Sub-issue:** When a student reaches their final course week + completes all weekly tests, nothing happens automatically. No nudge to the student to request a certificate. No notification to staff to approve. No growth-report pre-generation. The student has to discover the "Request Certificate" button on their own.

The `/api/students/check-alerts` cron (which runs daily) is the natural place for this automation, but it doesn't include a "course complete → nudge to request certificate" signal. It only flags inactivity + struggle signals.

**Severity:** Medium. The functionality exists; the trigger is missing.

---

## 3. Sequence Gaps (consolidated)

### 3.1 Counselor overview has no institution filter — **(b) cross-institution leak**

**File:** `src/app/api/counselor/overview/route.ts:33-40`.

**Code:**
```js
const students = await db.user.findMany({
  where: { role: "student", blocked: false },
  // NO institutionId filter!
  select: { id: true, name: true, email: true, currentWeek: true, batchId: true, lastLogin: true },
  orderBy: { name: "asc" },
});
```

All downstream queries (`wellbeingStates`, `crisisFlags`, `studentAlerts`, `healthSummaries`, `touchpoints`, `psychEvidence`, `caseReviews`) use `studentIds` derived from this unfiltered list.

**Impact:** A counselor at Institution A sees:
- All students across all institutions in their Caseload tab.
- All crisis flags across all institutions in their Crisis Queue.
- All alerts across all institutions in their Alert Queue.
- All touchpoints across all institutions in their Recent Sessions.
- All follow-ups due across all institutions.

This is a serious cross-institution data leak. Per `rbac.ts:131-170`, counselors should be institution-scoped (and `resolveAssistantScope` correctly enforces this — but `/api/counselor/overview` doesn't use it).

**Fix:** Add `institutionId: <caller's institutionId>` to the `where` clause. If `institutionId` is null, return empty (matching the C1 fix pattern in `scope.ts`).

---

### 3.2 Crisis flag notification has no institution filter — **(b) cross-institution leak**

**File:** `src/app/api/crisis-flags/route.ts:131-135`.

**Code:**
```js
const notifyRoles = ["counselor", "principal", "administrator"];
const recipients = await db.user.findMany({
  where: { role: { in: notifyRoles }, blocked: false },
  // NO institutionId filter!
  select: { id: true },
});
```

**Impact:** A crisis flag for a student at Institution A sends an in-app message to **every counselor, principal, and administrator across every institution**. Other institutions learn that a student at a different institution is in crisis.

**Fix:** Add `institutionId: <student's institutionId>` to the `where` clause.

---

### 3.3 `/api/students/alerts` (no userId) has no scope filter — **(b) cross-batch / cross-institution leak**

**File:** `src/app/api/students/alerts/route.ts:46-62`.

**Code:** The "no userId" branch returns all open alerts (up to 50) with no filter by caller's batch, institution, or AccessGrant. The only filter is `type != "safeguarding"` for non-principals.

**Impact:** A teacher at Institution A calling `GET /api/students/alerts` sees alerts for students at Institution B. The AppShell polls this endpoint every 60 seconds for the alert badge count — so the badge number includes alerts the teacher cannot act on.

This is inconsistent with `assertCanAccessStudent` (which DOES enforce scope on per-student routes) and with `getBatchFilter` (which DOES scope list endpoints).

**Fix:** Apply `getBatchFilter(userId, role)` (for teachers/TAs) or institutionId filter (for counselors/coordinators) to the query.

---

### 3.4 Safeguarding: corroboration bypass + no principal UI surface — **(c) triggers but no UI surfaces it**

**Files:**
- `src/app/api/messages/route.ts:88-121` — creates one StudentAlert per regex hit, no corroboration.
- `src/app/api/comments/route.ts:101-132` — same.
- `src/lib/ai-assistant/safeguarding.ts:162-206` — `createSafeguardingFlag()` (with 2+ corroboration check) is never called.
- `src/lib/ai-assistant/safeguarding.ts:212-241` — `getSafeguardingFlagsForPrincipal()` is never called.
- `src/components/examiner/PrincipalDashboard.tsx` — no Safeguarding section.

**Impact:**
1. A single aggressive phrase in a single message creates an instant safeguarding alert, bypassing the "2+ corroborating signals" design.
2. The principal has no UI to view safeguarding alerts as a distinct category. They're mixed into the `openAlerts` count.
3. The dedicated principal-facing safeguarding function is dead code.

**Fix:**
- Either (a) replace the inline `db.studentAlert.create()` calls in `messages/route.ts` and `comments/route.ts` with a call to `createSafeguardingFlag()` (aggregating signals per teacher per 14-day window), or (b) accept the per-signal alerts but add a "Safeguarding" section to `PrincipalDashboard.tsx` that calls `getSafeguardingFlagsForPrincipal()`.

---

### 3.5 Co-teacher feature is completely unwired — **(a) never triggers**

**Files:**
- `src/app/api/batches/[id]/teachers/route.ts` — POST/GET endpoints exist; no UI callers.
- `src/app/api/batches/[id]/teachers/[teacherId]/route.ts` — DELETE endpoint exists; no UI callers.
- `src/lib/ai-assistant/teacher-load.ts:220-296` — `suggestCoTeacher()` exists; no callers.

**Impact:** A teacher cannot add a co-teacher via the UI. A principal cannot manage batch teacher assignments via the UI. The "AI suggests co-teachers" feature advertised on the landing page doesn't exist in production code.

**Fix:** Either (a) build the UI (a "Manage Batch Teachers" panel in `AdminPrincipalTab.tsx` + a "Suggest Co-Teacher" button in `TeacherLoadPanel.tsx` when load is amber/red), or (b) remove the dead API + function and update the landing page claim.

---

### 3.6 Certificate / growth-report auto-trigger missing — **(a) never triggers**

**Files:**
- `src/app/api/students/check-alerts/route.ts` — daily cron, but doesn't check for course completion.
- `src/app/api/certificates/generate/route.ts` — only creates a request when the student manually POSTs.
- `src/app/api/growth-reports/[userId]/route.ts` — only generates on-demand when GETted.

**Impact:** When a student reaches their final course week + completes all weekly tests, nothing happens automatically. No nudge to the student. No notification to staff. The student has to discover the "Request Certificate" button.

**Fix:** Add a "course complete" signal to `runAlertCheck()` in `/api/students/check-alerts`:
- Detect: `user.currentWeek >= totalWeeks && completedTests >= totalWeeks && no existing PENDING certificate request`.
- Action: send a message to the student nudging them to request a certificate + send a message to their teacher letting them know the student is ready.

---

### 3.7 Escalation on-write check is dead code — **(a) never triggers (for the on-write path)**

**File:** `src/lib/ai-assistant/escalation.ts:240-261` — `checkOnWriteEscalation()`.

Only called by `createSafeguardingFlag()` (which is itself never called — see §3.4). The cron-based `runEscalationEngine()` does cover the 3rd-repeat-immediate case, but only at midnight.

**Impact:** A 3rd+ repeat occurrence of an amber flag at 9 AM waits until midnight to escalate. The "immediate" escalation is up to 15 hours delayed.

**Fix:** Wire `checkOnWriteEscalation()` into every StudentAlert creation site (or at least into `/api/students/check-alerts` after it creates alerts).

---

### 3.8 Teacher requests a co-teacher — folded into §3.5

### 3.9 Touchpoint → Counselor — **(d) fully working** (modulo the §3.1 cross-institution leak)

### 3.10 Praise note → Guardian — **(d) fully working** (modulo only `praise_note` type touching the guardian)

---

## 4. Summary Table

| # | Handoff | Classification | Severity |
|---|---|---|---|
| 2.1 | Escalation amber→red (cron) | (d) working | — |
| 2.1b | Escalation on-write immediate | (a) dead code | Medium |
| 2.2 | Crisis flag → counselor + principal | (b) cross-institution leak | **High** |
| 2.3 | Safeguarding flag → Principal | (c) no UI surface + corroboration bypass | **Critical** |
| 2.4 | Teacher touchpoint → counselor | (d) working (modulo §3.1 leak) | — |
| 2.5 | Teacher requests co-teacher | (a) never triggers | Medium |
| 2.6 | Safeguarding → Principal (surface) | (c) — folded into 2.3 | — |
| 2.7 | Guardian touchpoint (praise_note) | (d) working | — |
| 2.8 | Certificate/growth-report auto-trigger | (a) never triggers | Medium |
| 3.1 | Counselor overview scope | (b) cross-institution leak | **High** |
| 3.2 | Crisis flag notification scope | (b) cross-institution leak | **High** |
| 3.3 | `/api/students/alerts` (no userId) scope | (b) cross-batch leak | **High** |
| 3.4 | Safeguarding corroboration + UI | (c) + logic bug | **Critical** |
| 3.5 | Co-teacher feature unwired | (a) never triggers | Medium |
| 3.6 | Certificate auto-trigger missing | (a) never triggers | Medium |
| 3.7 | Escalation on-write dead | (a) dead code | Medium |

**Counts:** 4× (a), 4× (b), 2× (c), 3× (d).

**Critical:** 2 (safeguarding pathway + corroboration bypass)
**High:** 3 (three cross-institution/cross-batch scope leaks)
**Medium:** 5 (dead code + missing automations + unwired UI)
**Working:** 3 (touchpoint→counselor, praise_note→guardian, cron escalation)

---

## 5. Recommended Fix Order

1. **CRITICAL — §3.4 Safeguarding pathway:** Wire `createSafeguardingFlag()` into `messages/route.ts` and `comments/route.ts` (replace inline `db.studentAlert.create` calls). Add a "Safeguarding" section to `PrincipalDashboard.tsx` that calls `getSafeguardingFlagsForPrincipal()`.

2. **HIGH — §3.1, §3.2, §3.3 Cross-institution leaks:** Add `institutionId` filter to `/api/counselor/overview` (line 33), `/api/crisis-flags` POST recipient query (line 131), and `/api/students/alerts` no-userId branch (line 46). Use `getBatchFilter` for teacher-scope and `institutionId` for counselor/coordinator scope.

3. **MEDIUM — §3.6 Certificate auto-trigger:** Add a "course complete" signal to `runAlertCheck()` that nudges the student to request a certificate and notifies their teacher.

4. **MEDIUM — §3.5 Co-teacher UI:** Build a "Manage Batch Teachers" panel in `AdminPrincipalTab.tsx` that calls `/api/batches/[id]/teachers` GET/POST/DELETE. Optionally wire `suggestCoTeacher()` into `TeacherLoadPanel.tsx` as a "Suggest Co-Teacher" button when load is amber/red.

5. **MEDIUM — §3.7 Escalation on-write:** Wire `checkOnWriteEscalation()` into every `db.studentAlert.create()` site (or at minimum into `/api/students/check-alerts` after it creates new alerts).

6. **LOW — Touchpoint type filter for guardian:** Consider widening `/api/guardian/overview`'s touchpoint query beyond just `praise_note` (e.g., include `goal_setting` outcomes so guardians see goal progress). Or add a separate "Mentor notes for guardian" touchpoint type that's explicitly guardian-visible.

---

## 6. Notes on What's Already Working

- `assertCanAccessStudent` is consistently applied on per-student routes (good IDOR protection).
- `getBatchFilter` correctly scopes teacher list endpoints.
- `resolveAssistantScope` is correctly designed (C1 fix handles null institutionId).
- The C8 fix correctly attributes safeguarding alerts to the teacher (not the student).
- The H3 fix correctly adds counselors to the check-alerts recipient list.
- The H15 fix correctly populates the MentorshipView with touchpoints.
- The cron-based escalation engine runs daily and updates severity + wellbeing tier.
- The praise_note → guardian pathway works end-to-end.
- The certificate request → staff approval flow works once the student manually triggers it.

The hierarchy is mostly correctly designed at the **primitive** level (`rbac.ts`, `auth.ts`, `batch-teachers.ts`, `scope.ts`). The gaps are at the **wiring** level — dashboards that don't use the primitives, and feature specs that are implemented but never called from production code.
