# TraineesAI — Owner Decisions and Approval Register

**Date:** 11 November 2026  
**Authority:** Current owner decisions and uploaded upgrade prompts.  
**Rule:** An approved default is not permission for production data mutation, new spending, legal processing or deployment.

## 1. Locked product principles

| Decision | Current direction |
|---|---|
| Product principle | AI trains; humans mentor. |
| Roles | Learner, Instructor, Organisation Admin, Platform Admin. |
| Learner pacing | Learner controls pace; weeks/days organise curriculum, not calendar deadlines. |
| Assessment sequence | Daily test after study session; weekly test unlocks only after the week's final content day, enforced server-side. |
| Adaptive difficulty | Five levels: Warm-up, Core, Stretch, Advanced, Expert. |
| Instructor privacy | Never psychologically or behaviourally monitor/profile instructors. No message-tone scanning, behavioral profiles or admin usage surveillance. |
| Learner support | Learner support indicators are scoped to the learner's instructor, subject to consent and org enablement. |
| Crisis oversight | Designated org Learner Support Leads oversee crisis cases and the case-handling process record only. Platform Admins see no individual learner support/psychology signals. |
| Missing evidence | Missing, failed or stale evidence is unavailable, never silently zero or success. |
| Instructor Copilot | Model receives pseudonyms only; authorized server code restores identity after validating scope. |
| Sound | Off by default; user opt-in. |
| Slides | Caption/text first; optional Listen only where the existing owner decision permits. |
| Tutor | Text-first, does not claim to see files/media unless a supported, explicitly approved pipeline exists. |
| UI | Preserve existing theme packs and tokens; no copied Star Admin or UXPeak assets/code. |
| UI localization | Interface translation with next-intl is not a current phase-one requirement; re-evaluate after audit. |
| Mainline | After reset, main is the only active branch; implementation is direct on main in scoped commits. |

## 2. Defaults from the uploaded specification

These are retained as planning defaults and must be reverified against current code and owner decisions:
- Primary AI provider: DeepSeek; Z.ai retained as fallback only if the current owner configuration and API terms remain approved.
- Model identifier: use current official model discovery. DeepSeek's current documentation lists deepseek-flash; do not rely on dated identifiers or permanently pin a checkpoint without evidence.
- Thinking: explicitly disabled by default. An exception requires a measured quality benefit and owner approval.
- Voice: browser voice first; Roman Urdu and Roman Hindi priority; a paid cloud voice requires a listening test, privacy review and budget approval.
- Course “class”: CourseDay.
- Presentation authorship: platform admins, org admins and authorized course leads/instructors within their course scope.
- Presentation import v1: PowerPoint, PDF, Word and Markdown; do not add Google OAuth without approval.
- Instructor scope: learners enrolled in courses the instructor teaches, within the instructor's organisation scope.
- Cohorts: optional per course; org courses default to approval-required enrollment; marketplace enrollment is open, subject to verified product rules.
- Email provider: not selected in the source specification. Do not implement paid delivery until the owner chooses the provider and budget.
- MFA: TOTP for staff roles is a target requirement; verify existing implementation before adding.
- SSO: later scope, not a prerequisite for current core learning improvements.
- Legacy tables: backfill only what approved read models require; keep legacy data read-only for the approved period; deletion requires a separate decision.

## 3. Sensitive learner-support approvals

The support/crisis layer remains disabled by default per organisation until all of the following are complete:
- Owner-approved consent and transparency notice.
- Jurisdiction-specific legal/data-protection review.
- Confirmed lawful purpose and data-processing terms for every external processor.
- Field-level minimization and role/tenant access tests.
- Approved retention/deletion and learner rights workflow.
- Qualified professional review of learner-facing safety text and resource lists.
- Human case ownership, audit logging, SLA and escalation tests.
- Owner-approved tabletop exercise before crisis-case production activation.

The source prompt proposed 180-day signal retention and S1/S2/S3 service targets. Treat them as proposed defaults requiring legal, professional and operational review before enablement, not as permission to collect data now.

## 4. Separate approvals still required

| Topic | Approval needed before implementation/activation |
|---|---|
| Production database | Exact target, read/write operation, backup, restore verification, migration, window and rollback. |
| Production deployment | Explicit release authorization; inspect Vercel auto-deploy behavior for main commits. |
| AI provider/data | Customer/org terms, data residency, DPA, data categories, budget and external processing approval. |
| New paid services | Provider, plan, spend cap, billing owner and fallback. |
| Email/SMS/WhatsApp | Provider, templates, consent, delivery budget and legal review. |
| Object storage/queues | Provider, retention, access, cost and security controls. |
| Learner support/crisis | Section 3 gates, owner approval and professional review. |
| Destructive schema/legacy retirement | Data mapping, backup, reconciliation, rollback, read-only period and separate approval. |
| Pricing/packaging | Customer research, unit economics and owner approval. |
| SSO/OIDC/SAML | Customer requirements, IdP scope, security and provider decision. |

## 5. Decision questions to resolve during the audit

1. Which customer segment is the first commercial priority: single training organisations, enterprise L&D, individual learners or a defined combination?
2. Which course/credential outcomes are the first measurable business promise?
3. What is the canonical source of learner progress where legacy and Learn* models coexist?
4. Which existing organization/course/learner data may be sent to each AI provider, and under what customer terms?
5. Which AI features must be available offline/low-bandwidth or with provider outage?
6. Which voice locales and devices are the first supported targets?
7. Which storage and job provider decisions are required for Presentation Studio and bulk operations?
8. What exactly is visible to an organisation's designated Learner Support Lead, and who holds that capability?
9. Which legacy data must be retained for compliance, learner records and business reporting?
10. What production deployment mechanism is acceptable while direct development happens on main?

Record each answer with date, owner, rationale and affected workstreams. Do not silently decide legal, clinical, provider or spending questions.
