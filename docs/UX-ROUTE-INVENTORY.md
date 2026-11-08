# ExaminerAI route and role inventory

**Snapshot:** commit 2790483ba5f6bfae799dfbe56cfd35c5e141ef29
**Total:** 83 App Router page routes

This is a structural inventory derived from route files, portal layouts and navigation configuration. It is not a claim that every screen has been visually inspected or usability-tested. Route purpose is inferred from its path and should be confirmed against page content during the authenticated browser audit.

## Route counts

| Area | Routes |
|---|---:|
| Classroom | 2 |
| Instructor | 16 |
| Learner | 18 |
| Organisation admin | 11 |
| Platform admin | 17 |
| Public / marketing | 15 |
| Shared / authentication | 4 |
| **Total** | **83** |

## Complete route inventory

### Classroom (2)

| Route | Primary task inferred from route |
|---|---|
| `/(classroom)/learn/[courseId]/page.tsx` | Detail view: [courseId] |
| `/(classroom)/learn/page.tsx` | Learning catalogue and course discovery |

### Instructor (16)

| Route | Primary task inferred from route |
|---|---|
| `/(portals)/instructor/analytics/page.tsx` | Analytics and reporting |
| `/(portals)/instructor/certificates/page.tsx` | Certificate management |
| `/(portals)/instructor/courses/page.tsx` | Course catalogue and management |
| `/(portals)/instructor/earnings/page.tsx` | Earnings overview |
| `/(portals)/instructor/help/page.tsx` | Help and support |
| `/(portals)/instructor/more/page.tsx` | Secondary navigation hub |
| `/(portals)/instructor/page.tsx` | Home / overview |
| `/(portals)/instructor/payouts/page.tsx` | Payout management |
| `/(portals)/instructor/projects/page.tsx` | Project management |
| `/(portals)/instructor/review/[submissionId]/page.tsx` | Detail view: [submissionId] |
| `/(portals)/instructor/review/page.tsx` | Submission review and grading |
| `/(portals)/instructor/settings/page.tsx` | Role settings |
| `/(portals)/instructor/students/[studentId]/page.tsx` | Detail view: [studentId] |
| `/(portals)/instructor/students/page.tsx` | Student roster and learner detail |
| `/(portals)/instructor/studio/courses/page.tsx` | Course catalogue and management |
| `/(portals)/instructor/studio/page.tsx` | Course authoring studio |

### Learner (18)

| Route | Primary task inferred from route |
|---|---|
| `/(portals)/learner/assignments/[id]/page.tsx` | Detail view: [id] |
| `/(portals)/learner/assignments/page.tsx` | Assignments and submissions |
| `/(portals)/learner/courses/[id]/page.tsx` | Detail view: [id] |
| `/(portals)/learner/exams/[id]/page.tsx` | Detail view: [id] |
| `/(portals)/learner/exams/[id]/results/page.tsx` | Detail view: Exam results and feedback |
| `/(portals)/learner/exams/daily/page.tsx` | Daily exam practice |
| `/(portals)/learner/exams/page.tsx` | Exam discovery and execution |
| `/(portals)/learner/exams/weekly/page.tsx` | Weekly exam practice |
| `/(portals)/learner/help/page.tsx` | Help and support |
| `/(portals)/learner/learn/page.tsx` | Learning catalogue and course discovery |
| `/(portals)/learner/messages/page.tsx` | Learner messaging |
| `/(portals)/learner/page.tsx` | Home / overview |
| `/(portals)/learner/practice/page.tsx` | Practice activities |
| `/(portals)/learner/profile/page.tsx` | Learner profile |
| `/(portals)/learner/progress/page.tsx` | Learning progress |
| `/(portals)/learner/projects/[id]/page.tsx` | Detail view: [id] |
| `/(portals)/learner/projects/page.tsx` | Project management |
| `/(portals)/learner/study/page.tsx` | Study planning |

### Organisation admin (11)

| Route | Primary task inferred from route |
|---|---|
| `/(portals)/org/analytics/page.tsx` | Analytics and reporting |
| `/(portals)/org/audit/page.tsx` | Audit and activity records |
| `/(portals)/org/billing/page.tsx` | Billing and seats |
| `/(portals)/org/compliance/page.tsx` | Compliance management |
| `/(portals)/org/control/page.tsx` | Organisation controls and configuration |
| `/(portals)/org/help/page.tsx` | Help and support |
| `/(portals)/org/more/page.tsx` | Secondary navigation hub |
| `/(portals)/org/page.tsx` | Home / overview |
| `/(portals)/org/people/page.tsx` | Organisation people and membership |
| `/(portals)/org/registries/page.tsx` | Organisation registries |
| `/(portals)/org/settings/page.tsx` | Role settings |

### Platform admin (17)

| Route | Primary task inferred from route |
|---|---|
| `/(portals)/platform/access/page.tsx` | Platform access controls |
| `/(portals)/platform/ai/page.tsx` | AI configuration and operations |
| `/(portals)/platform/audit/page.tsx` | Audit and activity records |
| `/(portals)/platform/b2c/page.tsx` | Independent learner operations |
| `/(portals)/platform/courses/page.tsx` | Course catalogue and management |
| `/(portals)/platform/courses/planner/page.tsx` | Home / overview |
| `/(portals)/platform/features/page.tsx` | Feature flags and rollout |
| `/(portals)/platform/help/page.tsx` | Help and support |
| `/(portals)/platform/nav-config/page.tsx` | Navigation configuration |
| `/(portals)/platform/orgs/page.tsx` | Tenant management |
| `/(portals)/platform/page.tsx` | Home / overview |
| `/(portals)/platform/resets/page.tsx` | Administrative reset workflows |
| `/(portals)/platform/revenue/page.tsx` | Revenue operations |
| `/(portals)/platform/settings/page.tsx` | Role settings |
| `/(portals)/platform/support/page.tsx` | Support operations |
| `/(portals)/platform/system/page.tsx` | System health and operations |
| `/(portals)/platform/users/page.tsx` | Home / overview |

### Public / marketing (15)

| Route | Primary task inferred from route |
|---|---|
| `/(public)/[orgSlug]/page.tsx` | Detail view: [orgSlug] |
| `/(public)/courses/[id]/page.tsx` | Detail view: [id] |
| `/(public)/courses/category/[category]/page.tsx` | Detail view: [category] |
| `/(public)/courses/page.tsx` | Course catalogue and management |
| `/(public)/for-business/page.tsx` | Business marketing |
| `/(public)/for-learners/page.tsx` | Learner marketing |
| `/(public)/instructors/[instructorName]/page.tsx` | Detail view: [instructorName] |
| `/(public)/page.tsx` | Home / overview |
| `/(public)/paths/[id]/page.tsx` | Detail view: [id] |
| `/(public)/paths/page.tsx` | Learning paths |
| `/(public)/pricing/page.tsx` | Pricing and plans |
| `/(public)/signup/b2b/page.tsx` | Home / overview |
| `/(public)/support/page.tsx` | Support operations |
| `/(public)/verify/[credentialId]/page.tsx` | Detail view: [credentialId] |
| `/(public)/verify/page.tsx` | Credential verification |

### Shared / authentication (4)

| Route | Primary task inferred from route |
|---|---|
| `/dashboard/page.tsx` | Legacy/shared dashboard |
| `/forgot-password/page.tsx` | Password recovery |
| `/login/page.tsx` | Sign in |
| `/register/page.tsx` | Account registration |

## Access boundaries observed in portal layouts

| Portal | Accepted roles observed | Feature gate / fallback | Additional boundary |
|---|---|---|---|
| Learner | `learner`, `student` | `portal_learner_v2`; disabled routes to `/learn` | Active organisation membership is used to resolve the flag override. |
| Instructor | `instructor`, `org_admin` | `portal_instructor_v2`; disabled routes to `/learn` | Organisation admins are admitted to instructor portal. |
| Organisation admin | `org_admin`, `platform_admin` | `portal_org_v2`; disabled routes org admins to `/learn`, platform admins to `/platform` | Requires active org membership; org admins without one see an in-shell recovery message. |
| Platform admin | `platform_admin`, legacy `admin` | `portal_platform_v2`; disabled routes to `/learn` | Platform-wide control plane. |

These are layout-level guards; page-specific authorization and API checks still need route-by-route verification.

## Navigation model and observed friction

- Shared shell breakpoints: `xs <768`, `md 768–1023`, `lg 1024–1279`, `xl ≥1280`.
- Mobile bottom navigation displays at most five slots; when there are more than five items, the first four are inline and the rest are in a More sheet.
- Learner has six destinations, so Progress and Profile are in More on mobile. This is a design trade-off to validate with learner tasks, not automatically a defect.
- Instructor and organisation-admin use five mobile slots including More. Their secondary destinations are also represented in their More hubs.
- Platform admin has 15 destinations. Mobile presents four primary items plus a large More sheet; tablet currently renders all destinations in a horizontally scrollable section nav; desktop condenses into inline links plus overflow. Validate information scent, active state, and findability at each breakpoint.
- **Fixed in the current UX branch:** Instructor More active matching now includes Projects and Certificates as well as Analytics, Earnings, Studio and Payouts. Regression tests cover all six secondary destinations, nested grading review and student detail routes.
- Learner messaging and project routes are not explicitly assigned to a primary nav match in `LEARNER_NAV`; confirm the expected information architecture and avoid neutral/orphaned active states where a parent destination is appropriate.
- Org reports groups Audit and Analytics; More groups Registries, Billing and Compliance. Confirm labels reflect the actual user task and avoid hiding high-frequency operations.
- Platform settings/help are reached through the user menu rather than primary navigation; validate consistency with the other portals.

## Design-system validation finding

- `ThemeV2Provider` supports eight user-facing modes: light, dark, bed, classic, zinc, ocean, forest and sunset. Zinc, ocean, forest and sunset have separate light/dark CSS states, so there are 12 effective states to validate.
- **Fixed in the current UX branch; CI passed in run `42528457633`:** the contrast validator parses all 12 effective states, checks the shipped default palette as well as generated organisation-brand palettes, and recognizes `rgba()` scrim tokens for completeness. The run passed 31 test files / 374 tests, lint, TypeScript, and production build.
- The expanded gate found and prompted fixes for low-contrast default text, focus rings and chart series in Classic, Modern Slate, Zinc, Ocean, Forest and Sunset presets. The thresholds remain WCAG AA (4.5:1 text, 3:1 UI/large graphics); they were not lowered.
- Keep the real CSS cascade in the validator. Adding theme names without parsing light/dark selector overrides would not provide valid coverage.

## Current CI evidence (2026-11-09)

- Workflow: [run 42528457633](https://github.com/fccljbplant/ExaminerAI/actions/runs/42528457633) — all quality-job steps completed successfully.
- Unit tests: **374 passed across 31 test files**; lint, `tsc --noEmit`, and production build passed.
- Production-server smoke test requested **83/83 discovered page routes**. Statuses: 14×200, 64×307 redirects, 5×404 dynamic-route placeholders. No 5xx responses or missing static routes were reported.
- Important limitation: this smoke job had no authenticated synthetic users, so 307 responses are not proof that role routes render correctly. It produces no screenshots and does not run Playwright, axe, or real interactions. Do not call this visual or authenticated UX QA.
- [UXPeak source research](./UPGRADE-2026-10/design/UX-REFERENCE-RESEARCH.md) now records official-site review and precisely labels video-description access versus full playback/transcript access.

## Next validation required

1. Run authenticated journeys for each portal role; confirm role redirects, feature-flag fallbacks, tenant scoping and permission-denied states.
2. Test all route families at 360px, 768px, 1024px and 1440px; record screenshots and horizontal overflow.
3. Test primary/More navigation active states, keyboard focus, touch target sizes, and browser back/forward behavior.
4. Verify each data surface's loading, empty, error/retry, stale and success states.
5. Run axe or equivalent accessibility checks and inspect keyboard/screen-reader semantics.
6. Confirm the page purpose inferred here against the actual page content before finalizing user journey maps.

## Reference-learning guardrail

UX Peak video lessons inform hierarchy, choice, trust, feedback and ethical motivation. They are design inputs, not a substitute for observing TraineesAI users completing real tasks. Prefer task success, error rate, time-on-task and user feedback over aesthetic preference alone.
