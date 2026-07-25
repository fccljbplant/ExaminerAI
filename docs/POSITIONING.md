# ExaminerAI — Product Positioning

> **The one-sentence pitch:** ExaminerAI is an AI-powered bootcamp and short-course management platform where students learn software skills by building a real capstone project — with AI as the primary teacher, automated milestone tracking, and institutional visibility for every role.

---

## What this product IS

ExaminerAI is a **vocational training platform for software bootcamps and short courses (typically 8–24 weeks, up to 6 months)**. It is **not** a university LMS, a corporate training portal, or a generic course-delivery platform.

The platform is purpose-built around three convictions:

1. **Software skills are learned by building, not by watching.** Every student defines a capstone project on day one. The AI generates a custom week-by-week task plan, daily milestones, and progress reports tied to that specific project. There is no "watch this video, take this quiz" path.

2. **AI is the primary teacher — human staff mentor.** The in-app AI Tutor teaches today's topic in the student's own language, connects every concept to their capstone project, and handles disengagement with empathy. Teachers don't deliver content; they triage, coach, and unblock. This lets one teacher support 50–500+ students without burning out.

3. **Institutions need signal, not noise.** A bootcamp owner, principal, or programme director needs to know — in real time — which students are at risk, which teachers are overloaded, which cohorts are trending off-pace, and whether safeguarding concerns exist. ExaminerAI surfaces that signal through six role-specific dashboards, automated alerts, and a natural-language AI Assistant.

---

## Who it's for

### Primary audience

| Audience | Use case |
|---|---|
| **Software bootcamps** (8–24 weeks) | Full-stack web dev, mobile dev, data science, AI/ML — anywhere from 20 to 5,000+ students per cohort |
| **Vocational short courses** (up to 6 months) | Digital marketing, IT support, cybersecurity, cloud certifications — any course with a capstone project |
| **Hybrid vocational programmes** | Government skills programmes, NGO-funded training, corporate reskilling cohorts |

### Not for

- University degree programmes (use Canvas / Moodle)
- K-12 schools (the psych models are calibrated for adult learners)
- Self-paced MOOCs (ExaminerAI assumes a cohort + teacher structure)
- Pure corporate LMS use (it's optimized for capstone-project learning, not compliance training)

---

## The learning loop

Every student moves through the same weekly loop:

```
Week starts
   ↓
Student opens app → sees today's topic + today's project task
   ↓
AI Tutor teaches today's topic (connects to their project)
   ↓
Daily check-in (3 Socratic questions + confidence rating)
   ↓
Student works on today's project task (AI tracks status)
   ↓
Weekly test (15 Socratic questions, full 7-dimension analysis)
   ↓
Weekly project report submitted → AI analyzes 4 dimensions
   ↓
Milestone tracked → Gantt chart updates → progress visible to teacher
   ↓
Teacher triages: who needs help? AI Assistant answers batch questions
   ↓
Counselor sees wellbeing signals (psych evidence, crisis flags)
   ↓
Principal sees institution-wide trends + audit trail
   ↓
Guardian sees child's progress (without internal psych notes)
   ↓
Week ends → certificate auto-generated on completion
```

---

## Project-based learning — the differentiator

This is the feature most LMS platforms lack. Every student gets:

1. **Project definition** (week 1) — student describes their capstone: name, type (web app / mobile app / data pipeline / research paper), scope, objectives, requirements, business case.

2. **AI-generated task plan** — the AI reads the project definition and generates N weeks × 5 tasks/week, each with description, scheduled day (Mon–Fri), estimated time, and a `isMilestone` flag for key deliverables.

3. **Weekly milestones** — every week has a title, AI-generated summary, and a list of milestones (e.g., "Week 4: Database schema finalized + first API endpoint deployed").

4. **Gantt chart** — visual timeline of all tasks across all weeks, with milestone tasks highlighted. Students update task status (planned → in-progress → completed → blocked).

5. **Weekly project reports** — student submits a short report each week: what they did, what blocked them, what's next. The AI analyzes it on 4 dimensions: project understanding, technical depth, progress, clarity. Returns score + strengths + weaknesses + feedback.

6. **Final capstone analysis** — at course end, the teacher triggers a comprehensive AI analysis across 4 dimensions: project execution, technical competence, project quality, career readiness. This becomes the basis for the certificate and the student's portfolio.

7. **Auto-generated report cards** — final grade = 80% weekly test scores + 20% practice test scores. Certificates are publicly verifiable via shareable URL.

---

## The six roles (everyone gets their own dashboard)

Every role has its **own dedicated dashboard component, navigation, and API surface**. No shared views. No "one size fits all" dashboards.

| Role | Job-to-be-done |
|---|---|
| **Student** | Learn by building. Daily tasks, AI tutor, tests, project planning, certificates. |
| **Teacher** | Triage the batch. Who needs help today? Mentor, don't just grade. |
| **Counsellor** | Wellbeing caseload. Crisis response, mentorship touchpoints, scoped access. |
| **Guardian** | Parent-friendly view of their child's progress — no internal notes leaked. |
| **Principal** | Institution-wide signal. Academic, wellbeing, safeguarding, audit. |
| **Admin** | Platform operations. Users, courses, feature flags, AI config, audit log. |

The **Demo role** (read-only) can switch into any of the above for evaluation.

---

## Why this is different from a university LMS

| Concern | University LMS (Canvas, Moodle) | ExaminerAI |
|---|---|---|
| Primary teaching | Recorded lectures + reading | AI Tutor (chat, in student's language, project-connected) |
| Assessment | Multiple-choice + essays | Socratic dialogue + per-question explanations + plagiarism + 7-dimension psychology |
| Project tracking | Optional, manual | Mandatory, AI-generated, weekly milestones, Gantt chart, weekly AI-analyzed reports |
| Teacher visibility | Gradebook + analytics | Attention-scored triage + AI Assistant for natural-language batch queries |
| Wellbeing | None | 7-dimension psychology per student + green/amber/red tiers + crisis flags + GROW coaching |
| Safeguarding | None | Pre-filter + AI explains + 2+ corroborating signals + principal-only visibility |
| Roles | 1-2 (teacher, student) | 6 dedicated dashboards + RBAC with AccessGrant scoping |
| Audit | Basic | Every sensitive action logged + principal-only audit log view |
| Scale | Slow, heavy | 1 DB upsert per AI Tutor message (not 15-20). Scales to 10,000+ students. |

---

## Why this is different from generic "AI course builder" tools

| Concern | AI course builder (Coursebox, Mindsmith, etc.) | ExaminerAI |
|---|---|---|
| Focus | Generate course content | Manage the entire bootcamp operation |
| AI role | Generate slides / quizzes | Be the primary teacher + mentor at scale |
| Project tracking | None | Mandatory capstone with milestones, Gantt, weekly AI reports |
| Wellbeing | None | 7-dimension psychology + safeguarding + crisis response |
| Multi-role | Single-tenant | 6 role dashboards + RBAC + AccessGrant scoping |
| Production-ready | No | Yes — production deployment, Socratic assessment + AI mentorship live |

---

## Deployment reality

This is not a prototype. It is in production:

- **Live deployment:** https://examiner-ai-tau.vercel.app
- **Operator:** Inzet Enterprises (`inzet.enterprises@gmail.com`) — software bootcamp platform
- **Stack:** Next.js 16, Prisma, PostgreSQL (Neon), DeepSeek V4 Flash (primary AI), Z.ai (fallback)
- **Code:** https://github.com/fccljbplant/ExaminerAI
- **Demo login:** `demo@examiner.ai` / `demo123` (read-only, can switch into any role)

---

## The story we tell on the marketing page

1. **Hook:** This is for bootcamps and short courses (up to 6 months). Software training. Project-based.
2. **Promise:** AI teaches. Students build a real capstone project. We track every milestone.
3. **Proof:** Six role dashboards. Real screenshots. Live demo.
4. **Depth:** 7-dimension psychology. AI Assistant with 7 systems. GROW coaching. Safeguarding. Audit log.
5. **CTA:** Launch the demo. No signup. Switch roles.

---

## What we don't say

- We don't position as a "university LMS alternative" — that confuses the audience.
- We don't lead with "Socratic assessment" — that's a method, not the value.
- We don't promise "replace teachers" — AI teaches content, humans mentor.
- We don't list every feature upfront — lead with project-based learning + AI teaching, then layer in psych + mentorship + safeguarding as differentiators.
