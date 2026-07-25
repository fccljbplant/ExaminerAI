# The ExaminerAI Mentorship & Mental Health Cycle

> **Purpose of this document:** Define the complete mentorship and mental
> health response pathways that close the loop on the psychological analysis
> cycle. Where `docs/PSYCHOLOGICAL-CYCLE.md` describes how evidence is
> gathered and surfaced, this document describes what happens **after** an
> alert fires — how teachers, counselors, principals, and the AI Assistant
> collaborate to mentor the student, support the teacher, and respond to
> crisis.

This is a companion to `docs/PSYCHOLOGICAL-CYCLE.md` and
`docs/SEVEN-DIMENSIONS.md`. Read all three together.

---

## 1. The two mentorship tracks

ExaminerAI runs two parallel mentorship tracks, each with its own actors,
triggers, and outcomes:

| Track | Primary actor | Trigger source | Scope |
|---|---|---|---|
| **Student mentorship & mental health** | Teacher (first responder) → Counsellor (escalation) → Principal (oversight) | Psychological evidence, attention score, crisis flags | The student's batch → institution-wide caseload |
| **Teacher mentorship & load management** | Principal (first responder) → Admin (intervention) | Teacher load score, safeguarding flags | The teacher's cohort → institution-wide staff review |

Both tracks share the same escalation engine (7-day amber timer, repeat-
occurrence escalation), the same action-dialog pattern (AI drafts, human
confirms with required note), and the same audit trail (every action
recorded in `MentorshipTouchpoint` or `AuditLog`).

---

## 2. Student mentorship cycle

### 2.1 Stage 1 — Signal emergence

A student mentorship cycle begins when one of four signals fires:

1. **Wellbeing tier transition** — A student's tier moves from amber to
   red, or from green to amber, after the 14-day evidence window is
   recomputed.
2. **Attention score spike** — The student crosses one of the
   attention-score thresholds (inactivity 3+ days = +30, score drop 15+
   points = +20, sustained low confidence = +20, etc.).
3. **Crisis flag creation** — A `CrisisFlag` is opened manually (by a
   teacher or counselor) or automatically (when the AI's psychAnalysis
   includes crisis-language indicators). This bypasses the tier system —
   the student is immediately Red.
4. **Teacher manual request** — A teacher opens a mentorship session
   directly from the student portfolio without any system trigger. This
   is always allowed; the system supports proactive mentorship, not
   only reactive.

### 2.2 Stage 2 — Triage routing

The signal is routed to the right actor based on severity and type:

| Signal | Routed to | Routing mechanism |
|---|---|---|
| Amber tier, attention score < 50 | Teacher | Triage queue sorted by attention score |
| Red tier, attention score ≥ 50 | Teacher + Counsellor (cc) | Triage queue + counselor caseload |
| Crisis flag | Counsellor + Principal (immediate) | Crisis flag dashboard, red-tier escalation |
| Safeguarding concern (about a teacher) | Principal only | Safeguarding scope, never the teacher |
| Repeat occurrence (3rd+) | Counsellor + Principal | Immediate escalation |

### 2.3 Stage 3 — AI-drafted action

When the teacher (or counselor) opens the alert, the AI Assistant
generates an **Action Dialog** with:

- **Headline** — Plain-language summary (e.g. "Alex has been inactive
  for 4 days and scored 42% on the weekly test")
- **Why** — The specific trigger data (which signal, when, what
  threshold)
- **Suggested action** — Editable recommendation (e.g. "Schedule a
  15-minute check-in. Use the GROW model — start with Reality: 'What's
  getting in the way when you sit down to study?'")
- **3 one-tap note presets** — AI-drafted note templates the teacher
  can accept with one click, or edit, or replace with free text
- **In-action guidance** (collapsed) — Flag-type-specific principles
  (e.g. for psychological flags: "Ask don't tell. Validate before
  solving.")
- **Confirm button** — **Disabled** until the teacher writes or
  accepts a note

### 2.4 Stage 4 — GROW mentorship session

If the teacher schedules a session, the platform's GROW coaching
framework structures the conversation:

| Stage | Purpose | Example prompt |
|---|---|---|
| **G — Goal** | What does the student want to achieve? | "Where would you like to be by the end of this week?" |
| **R — Reality** | Where are they now? What's the current situation? | "Walk me through what happened when you tried the database query." |
| **O — Options** | What approaches are available? | "What have you tried? What else could you try?" |
| **W — Will** | What will they commit to doing? | "What's one thing you'll do before our next check-in?" |

The teacher records the session as a `MentorshipTouchpoint` with:

- `type` — `psychological` or `educational` (both use GROW, but the
  framing differs)
- `note` — What was discussed (required)
- `outcome` — `ongoing` | `resolved` | `escalated` | `no_action_needed`
- `followUpAt` — Optional scheduled follow-up date

The session is visible to:
- The teacher (always)
- The counselor (if the student is on their caseload)
- The principal (institution-wide oversight)
- **Not** the student (mentorship notes are internal)
- **Not** the guardian (mentorship notes are not parent-facing)

### 2.5 Stage 5 — Outcome tracking

Each touchpoint has an outcome. The system tracks outcomes over time
so teachers and counselors can see whether their interventions are
working:

- **`ongoing`** — The session happened, follow-up is needed. The
  student remains in the current tier.
- **`resolved`** — The student's situation improved (e.g. they
  re-engaged, scores recovered). The teacher or counselor can mark
  the flag resolved.
- **`escalated`** — The teacher cannot resolve this alone; routes to
  counselor (for psychological) or principal (for safeguarding).
- **`no_action_needed`** — The flag was a false positive or the
  student self-corrected. Documented for audit, no further action.

### 2.6 Stage 6 — Follow-up scheduling

If `followUpAt` is set, the system creates a follow-up reminder that
appears in the teacher's "Today" view on the scheduled date. If the
teacher doesn't log a follow-up touchpoint within 7 days of the
scheduled date, the system auto-escalates the original flag (using
the same escalation engine).

This prevents the "I'll follow up next week" pattern from quietly
dropping off the radar.

---

## 3. Crisis response pathway

A `CrisisFlag` is the highest-severity signal in the system. It
bypasses the normal amber → red escalation — a crisis flag is Red
from the moment it's created.

### 3.1 What triggers a crisis flag

1. **AI-detected crisis language** — The weekly test's `psychAnalysis`
   includes phrases like "self-harm", "suicide", "end it all", or
   similar. The AI is instructed to flag these immediately.
2. **Counselor or teacher manual creation** — Any staff member who
   becomes aware of a crisis situation can manually open a
   `CrisisFlag` with category and severity.
3. **Sustained red tier** — A student in Red tier for 14+ consecutive
   days with no mentorship touchpoints gets an automatic crisis flag
   (category: `neglect`).

### 3.2 What happens when a crisis flag is created

1. The student's `WellbeingState.tier` is forced to Red regardless of
   evidence ratio.
2. **All counselors and the principal** receive an immediate
   notification (via the in-app notification system).
3. The student's batch teacher's triage queue is updated to show the
   crisis flag at the top.
4. An auto-touchpoint of type `crisis_response` is created, assigned
   to the counselor on call (or, if none, to the principal).
5. The AI Assistant generates a crisis-specific action dialog with
   the guidance: **"Act now, document after. Follow your
   institution's crisis protocol."**

### 3.3 What the crisis flag does NOT do

- It does **not** notify the student that they've been flagged.
- It does **not** notify the guardian automatically (the principal
  decides if/when to involve the family).
- It does **not** auto-contact emergency services. That decision is
  a human one.
- It does **not** go away on its own. A crisis flag must be
  explicitly resolved or dismissed by a counselor or principal.

### 3.4 Resolution

A crisis flag is resolved when:
- The counselor records a touchpoint with outcome `resolved` AND
  the student's wellbeing tier has returned to amber or green for 7
  consecutive days.
- OR the principal dismisses the flag with a documented note
  explaining why (e.g. false positive, external context).

Resolved crisis flags are kept in the audit trail permanently.

---

## 4. Teacher mentorship & load management

Teachers are people too. A bootcamp that burns out its teachers
fails its students. ExaminerAI treats teacher wellbeing as a
first-class concern.

### 4.1 Teacher load score

**File:** `src/lib/ai-assistant/teacher-load.ts`

Every teacher has a load score, computed continuously:

```
loadScore = (studentCount × 1)
          + (batchCount × 15)
          + (openAlerts × 5)
          + (crisisFlags × 25)
          + (overdueTouchpoints × 3)
```

| Tier | Score | Meaning |
|---|---|---|
| **Green** | < 50 | Sustainable load |
| **Amber** | 50–99 | Approaching overload — consider redistributing |
| **Red** | ≥ 100 | Overloaded — intervention needed |

The load score appears on:
- The teacher's own dashboard (transparent — they see their own tier)
- The principal's "Staff" view (for redistribution decisions)
- The AI Assistant's batch queries (principals can ask "which teachers
  are overloaded?")

### 4.2 What happens when a teacher hits Amber or Red

1. **Amber (50–99):** A teacher_load flag is created. The principal
   sees it in their staff overview. The AI Assistant can suggest co-
   teacher assignments — but **never** suggests a teacher who is
   themselves amber or red.
2. **Red (≥ 100):** The flag auto-escalates immediately (no 7-day
   timer for red-tier teacher load). The principal is expected to
   either:
   - Assign a co-teacher to share the batch
   - Move students to another batch
   - Reduce the teacher's batch count
   - Document why no action is needed (e.g. temporary spike during
     finals week)

### 4.3 Co-teacher suggestion engine

When the principal opens a teacher_load flag, the AI Assistant
generates a list of candidate co-teachers. The candidates are:

- In the same institution
- Currently in Green tier (load score < 50)
- Have relevant subject-matter overlap (if computable)
- **Never** in amber or red tier themselves

The AI explains why each candidate is a good fit (e.g. "Samina has
capacity — 18 students, 1 batch, 0 open alerts. She taught the
database module last cohort.").

The principal selects a co-teacher, the system creates a
`BatchTeacher` record, and the load score is recomputed for both
teachers on the next cycle.

### 4.4 Teacher wellbeing touchpoints

Teachers can also be the subject of `MentorshipTouchpoint` records,
not just the actor. When the principal has a load-management
conversation with a teacher, that's a touchpoint of type
`teacher_load` with:

- `note` — What was discussed
- `outcome` — `ongoing` | `resolved` (load reduced) | `escalated`
  (HR involvement needed)
- `followUpAt` — Optional follow-up date

These touchpoints are visible to:
- The principal (always)
- The teacher themselves (transparent)
- Admin (for HR/operations follow-through)
- **Not** to other teachers
- **Not** to counselors (counselors scope is student-facing)

---

## 5. Safeguarding pathway (staff → student)

**File:** `src/lib/ai-assistant/safeguarding.ts`

Safeguarding is the most sensitive pathway in the system. It
monitors teacher-to-student communication for patterns of
aggression, trauma-inducing language, neglect, or dismissiveness
toward student distress.

### 5.1 The two-layer filter

1. **Deterministic regex pre-filter** — Scans every teacher-to-
   student message and comment. Patterns cover aggressive language,
   trauma-inducing language, neglect, inappropriate tone, and
   dismissiveness. This is intentionally conservative — false
   negatives are acceptable, false positives are not.
2. **AI explanation layer** — When the regex matches, the AI is
   invoked to produce a contextual explanation of why the matched
   text is concerning. The AI cannot invent a flag the regex didn't
   find.

### 5.2 The two-plus corroboration rule

A single message **never** produces a safeguarding flag. The system
requires at least **two corroborating signals** within a rolling
window before creating a flag. This prevents reactive flags from a
single heated exchange.

The corroboration window is configurable but defaults to 14 days.
Two matches in 14 days from the same teacher, in the same category,
create a safeguarding flag.

### 5.3 Routing — principal only

Safeguarding flags are routed to **principal scope only**. The
`resolveAssistantScope()` function for safeguarding queries returns
principal + admin roles — never the teacher, never other teachers,
never counselors (unless the counselor also has principal authority
in the institution).

The teacher is **not notified** when a safeguarding flag is raised
about them. This is the **one deliberate exception** to the
"insight stays with caller" rule that governs the rest of the
platform.

### 5.4 Principal review

When the principal opens a safeguarding flag, they see:

- The flag category (e.g. `aggressive_language`)
- The message references (not the full text — just enough context
  to locate the message)
- The AI's explanation of why the pattern is concerning
- The pattern history (how many corroborating signals, over what
  period)
- Guidance: "Review the evidence references before acting.
  Consider the pattern, not just individual messages — single
  messages may have context; a pattern is the signal."

The principal's action options:

- **Investigate** — Open the actual messages in context, talk to
  the student, talk to the teacher.
- **Dismiss** — Mark the flag dismissed with a required note
  explaining why. The flag persists in the audit trail.
- **Escalate** — Route to HR / formal disciplinary process. The
  flag is marked `escalated` and visible to admin role.

### 5.5 What safeguarding does NOT do

- It does not monitor student-to-student communication (peer chat
  is out of scope).
- It does not monitor teacher-to-teacher communication.
- It does not auto-fire on profanity (the patterns are specifically
  about aggression toward students, neglect, and dismissiveness
  about distress).
- It does not notify the teacher being flagged.
- It does not delete flagged messages. The messages stay where they
  are; the flag references them by ID.
- It does not auto-resolve. Every flag must be explicitly dismissed
  or escalated by a human principal.

---

## 6. Counsellor role in the cycle

The counsellor is the wellbeing specialist. Their dashboard
(`CounselorDashboard.tsx`) is a **command center** — not a batch
view, not a course view, but an institution-wide caseload view.

### 6.1 What the counsellor sees

- **All students** in the institution (scoped via `AccessGrant` —
  can be `full`, `wellbeing_only`, `crisis_only`, or
  `content_only`)
- **Green/amber/red tier distribution** across the institution
- **Open crisis flags** with immediate-response queue
- **Case reviews** — formal case-review records for students
  requiring multi-stakeholder coordination
- **Mentorship touchpoint history** for any student on their
  caseload
- **Teacher load tiers** (so they know which teachers might be
  under-resourced for student support)

### 6.2 What the counsellor does NOT see

- Curriculum data (test scores are visible, but not detailed
  answers unless `AccessGrant` is `full`)
- Other counselors' private notes (each counselor's case reviews
  are their own unless explicitly shared)
- Safeguarding flags about teachers (principal-only)
- Other institutions' data (multi-tenant isolation)

### 6.3 Counsellor-initiated actions

- Open a case review (formal record for a student needing
  multi-stakeholder coordination)
- Create a crisis flag manually
- Schedule a counseling session (recorded as a `MentorshipTouchpoint`
  with type `psychological`)
- Escalate to principal (for safeguarding concerns about staff)
- Recommend a student take a leave of absence (recorded as a
  touchpoint with outcome `escalated`)

---

## 7. Guardian role in the cycle

The guardian (parent) dashboard is intentionally **limited**. It
shows:

- The child's weekly test scores
- The child's attendance (last login, current week)
- The child's report cards (auto-generated)
- A **sanitized** wellbeing signal (green/amber/red tier only, no
  reasons)
- The child's capstone project summary

It does **not** show:

- Psychological evidence details
- Teacher notes or mentorship touchpoint notes
- Crisis flag details (only that the school is "providing support"
  if the principal has authorized this disclosure)
- Safeguarding flags
- Other students' data
- Internal staff discussions

This boundary is critical. Parents deserve transparency about their
child's progress, but the mentorship process requires
confidentiality to function. If students knew their mentorship notes
were visible to parents, they would stop being honest with their
mentors.

---

## 8. Principal role in the cycle

The principal is the only role that sees **everything** within their
institution:

- All students, all batches, all courses
- All teacher load tiers
- All safeguarding flags (exclusive)
- All audit log entries
- Wellbeing tier distribution across the institution
- Academic performance distribution
- Crisis flag history and resolution

The principal's role in the cycle is **oversight and intervention**:

- Review safeguarding flags and decide investigate / dismiss /
  escalate
- Review teacher load flags and decide co-teacher / redistribute /
  document
- Review crisis flag trends and decide if institutional policy
  changes are needed
- Audit mentorship touchpoints to ensure teachers are following up
  on alerts

The principal does **not**:

- Directly mentor students (that's the teacher's role)
- Directly counsel students (that's the counselor's role)
- Modify psychological evidence (the evidence is what it is)
- Override safeguarding flags silently (every dismissal requires a
  note)

---

## 9. The action-dialog contract

Every alert — student or teacher, psychological or load or
safeguarding — opens into the same **Action Dialog** component
(`src/components/shared/action-dialog.tsx`). This consistency is
deliberate: staff learn one workflow, not six.

### Required fields

- **Headline** (AI-drafted, plain language, color-coded by tier)
- **Why** (specific trigger data — which signal, when, what
  threshold)
- **Suggested action** (AI-drafted, editable)
- **Note** (free text, with 3 AI-drafted one-tap presets) —
  **REQUIRED to confirm**
- **Guidance** (collapsed, flag-type-specific principles)

### Action options

- **Confirm** — Records a `MentorshipTouchpoint`, optionally
  schedules a follow-up. The flag's status moves to
  `acknowledged`.
- **Schedule session** — Opens the GROW session scheduler,
  pre-filled with the suggested action.
- **Escalate** — Routes the flag to the next role in the chain
  (teacher → counselor → principal). Requires a note explaining
  why escalation is needed.
- **Dismiss** — Marks the flag `dismissed` with a required note.
  The flag persists in the audit trail.
- **Cancel** — Closes the dialog without action. No penalty, no
  record. The flag remains open.

### The required-note rule

The confirm button is **disabled** until the note field has
content. This is the most important UX decision in the action
dialog. It ensures:

- Every intervention is documented
- Every dismissal is justified
- The audit trail has human-readable context, not just timestamps
- Teachers are nudged to articulate their reasoning, which improves
  mentorship quality over time

The 3 AI-drafted one-tap presets lower the friction: a teacher
who's short on time can accept a well-drafted preset with one
click, but they still have to read it and click confirm.

---

## 10. Audit trail

Every action in the mentorship cycle is recorded:

| Action | Recorded in |
|---|---|
| Alert fired | `StudentAlert` (with type, tier, trigger data) |
| Touchpoint logged | `MentorshipTouchpoint` (with note, outcome, followUpAt) |
| Crisis flag opened | `CrisisFlag` (with category, severity, status) |
| Safeguarding flag raised | `StudentAlert` (type `safeguarding`, principal-only) |
| Action dialog confirmed | `MentorshipTouchpoint` + `AuditLog` entry |
| Flag escalated | `AuditLog` entry (with from-tier, to-tier, reason) |
| Flag dismissed | `AuditLog` entry (with dismissal note) |
| Co-teacher assigned | `BatchTeacher` + `AuditLog` entry |
| Role change | `AuditLog` entry (admin-only) |

The `AuditLog` is principal-readable institution-wide. Admins can
export it for compliance reviews. Records are never deleted —
dismissed flags are marked `dismissed`, not removed.

---

## 11. What this cycle is NOT

- **Not therapy.** The cycle surfaces signals and structures
  mentorship conversations. It does not provide counseling.
  Students in crisis are referred to human professionals.
- **Not surveillance.** The cycle observes learning behavior
  (tests, tutor chat, project progress). It does not monitor
  student communication outside the platform. It does not track
  student location, device usage, or off-platform activity.
- **Not punishment.** The cycle is designed to trigger support,
  not discipline. Even safeguarding flags are framed as
  "requires principal judgment", not "teacher misconduct".
- **Not a replacement for human relationships.** The AI drafts
  suggested actions, but the mentorship session is between two
  humans. The AI does not mediate, does not join the session,
  does not record the conversation beyond what the teacher
  chooses to log.
- **Not deterministic.** The system makes recommendations; humans
  make decisions. A teacher can ignore every alert, dismiss every
  flag, skip every follow-up. The system will record that
  inaction in the audit trail, but it will not force action.
- **Not a substitute for institutional policy.** The crisis
  protocol, the safeguarding escalation process, the
  counselor-on-call rotation — these are institutional decisions.
  ExaminerAI surfaces signals; the institution defines the
  response.

---

## 12. Where to read more

- `docs/PSYCHOLOGICAL-CYCLE.md` — How evidence is gathered, the 7
  dimensions, the wellbeing tier algorithm, the escalation engine.
- `docs/SEVEN-DIMENSIONS.md` — Per-dimension reference: what each
  value means and how to interpret it.
- `docs/SYSTEM-DOCUMENTATION.md` — Full system architecture, role
  permissions, feature inventory.
- `docs/POSITIONING.md` — Why this product exists and who it
  serves.
