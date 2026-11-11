# TraineesAI — Mainline Reset and Upgrade: Start Here

**Programme:** Mainline Reset & Evidence-Led Product Upgrade  
**Owner direction:** 11 November 2026  
**Repository:** fccljbplant/ExaminerAI  
**Product:** TraineesAI  
**Authority:** This file is the operating entry point. Read MASTER-PLAN.md, RESET-BASELINE.md, DECISIONS-REGISTER.md, UXPEAK-RESEARCH-AND-DESIGN.md and AI-AND-DATA-STRATEGY.md before acting.

## Mission

Create one coherent, secure, evidence-led TraineesAI product on the existing main branch. Reset the branch/PR clutter, audit what is actually implemented, then improve the real product without rebuilding completed work.

The product principle remains:

**AI trains; humans mentor.**

Think like a cross-functional leadership team: venture/product strategy, SaaS economics, engineering architecture, UX/product design, behavioural science, higher education, curriculum planning, learner support governance, data science, AI engineering, security, privacy, QA and operations. These are decision lenses, not permission to invent facts or make clinical/legal determinations.

## Non-negotiable execution sequence

### Stage 0 — Verify and archive before reset

1. Confirm the repository identity, default branch, live main HEAD, permissions, branch-protection/rulesets, open PRs, closed/merged PRs, tags and CI/deployment behavior.
2. Produce a dated inventory of every remote branch and every PR, including head SHA, base SHA, commit divergence, changed files, unique work, DB/binary artifacts, dependencies and checks.
3. Create a private, owner-controlled, encrypted, recoverable pre-reset archive outside the repository. Include branch refs/commit metadata and PR metadata. Never upload it to the public repository or paste source archives into chat.
4. Inspect the tracked SQLite artifact on backup/v3-ui in an isolated, no-network workspace before copying it. If it may contain personal, production or otherwise sensitive records, do not place it in an unsecured archive. Sanitize or exclude it under an owner-approved retention process. Do not open production databases.
5. Verify the archive can be listed and restored in a disposable workspace. Record its location and integrity hash without exposing its contents.
6. Close every open PR whose work will be retired, including PR #3 and PR #6. GitHub PR records are historical records; they cannot be erased through ordinary repository actions. Closing the PR and deleting its source branch is the practical reset.
7. Delete every remote branch except main, including the PR #3 source branch. Do not delete main, tags, releases or historical merged commits. Do not force-push, rewrite main history or alter default-branch settings.
8. Verify that the remote branch list contains exactly main and that no PR remains open. If the archive, permissions, branch rules or ref deletion cannot be verified, stop and report the exact blocker. Do not pretend cleanup succeeded.

This is a destructive reset explicitly directed by the owner. The private archive is the recovery mechanism; it must not become another active branch or another public source of truth.

### Stage 1 — Read-only forensic audit of main

After the reset, check out the live main branch and audit it without changing application code.

Read the complete source specifications supplied by the owner and the repository guidance. Reconcile them with actual code, tests, schema, workflows and product behavior. Do not trust stale status documents or old branch descriptions.

Produce the audit deliverables in MASTER-PLAN.md. Every significant finding must have:
- Severity and user/business impact.
- Exact file path and line/function evidence.
- Actual behavior and the expected behavior.
- Whether it is implemented, partially implemented, missing, broken, legacy, duplicate or unverified.
- Existing tests and missing regression coverage.
- Data/privacy/security implications.
- A recommended smallest reversible fix.
- Acceptance criteria and rollback notes.

Explicitly classify every Workstream A–L requirement as implemented, partial, missing, blocked, obsolete or owner decision. A feature is not “implemented” because a component or route exists; verify the complete user journey, server-side enforcement, persistence, error behavior, tests and role scope.

### Stage 2 — Build the gap-only implementation register

Create a dependency-aware P0/P1/P2/P3 implementation register. Each task must cite its evidence and be small enough to deliver and test as an independent commit.

Do not recreate features already working. Improve them only where the audit proves a measurable gap.

### Stage 3 — Implement approved safe work directly on main

The owner has directed implementation on main, without new feature branches or PRs.

- Work in a clean local checkout of main only.
- Make one scoped, reversible change per commit; never bundle unrelated features.
- Do not create replacement branches or PRs.
- Do not force-push, reset, rebase or rewrite history.
- Before the first main commit, inspect whether a push to main automatically triggers a production deployment. Main-write authorization is not blanket authorization for production deployment. If a main commit cannot be validated without an unapproved production release, stop and present the deployment dependency for owner decision.
- If branch protection prevents direct commits, do not change protection settings or bypass controls. Report the blocker.
- Run the exact relevant tests, lint, typecheck, build, route smoke, security and accessibility checks. Use CI as evidence; never claim a check that did not run.
- Keep production DB access, migrations, seeds, billing/provider changes, external data processing and production settings separately gated.
- Update the audit, implementation register, project status, progress and session log after each meaningful milestone.

### Stage 4 — Validate and release by explicit gate

A task is complete only when behavior, permissions, tenant/course scope, failure states, tests and UX are verified. A phase is not release-ready merely because the code compiles.

No production migration, data mutation, deployment, provider/billing change, support/crisis activation or external processing of new sensitive data without the specific approvals stated in DECISIONS-REGISTER.md.

## Professional decision framework

1. **Venture/product:** validate customer problem, segment, willingness to pay, sales cycle, retention, implementation cost, gross margin and support burden. Never invent TAM, revenue, LTV, CAC or conversion.
2. **Education:** align objectives, instruction, practice, assessment and feedback. Learners control their pace. Use evidence-based retrieval, spacing, worked examples and useful feedback.
3. **UX and behavioural science:** make the product clear, motivating and confidence-building. Support autonomy, competence and human connection. Never use shame, fake urgency, dark patterns, manipulative streaks or anxiety-based retention.
4. **Learner support:** use consented, minimal indicators only under the approved owner policy. AI is not a clinician and never declares a crisis. Professional review is required for safety wording and procedures.
5. **Data science:** distinguish observation from inference, show uncertainty and evidence, validate fairness and measure real learning outcomes.
6. **AI engineering:** use deterministic code for permissions, arithmetic, grading rules, entitlements and aggregation. Use models for language, tutoring and constrained synthesis. Optimize cost only after measuring quality, privacy, latency and token spend.
7. **Security and operations:** deny by default, enforce authorization server-side and preserve auditability and rollback.

## Session rules

- One approved task at a time, on main.
- Verify files, functions, scripts, APIs and package versions before use.
- Never read, copy, print or edit .env files or secrets.
- Never use remote production databases.
- Do not run destructive schema commands or production data operations.
- Missing/error/stale evidence is unavailable, never zero or success.
- If a legal, consent, safety, migration or owner decision is missing, record it in DECISIONS-REGISTER.md or the project questions log and stop that task.
- Preserve historical logs. Do not delete documents merely because they are old; retire only after proving they are superseded and contain no unique decisions or evidence.

## First session instruction

Start with Stage 0. Do not code. Do not merge. Do not create branches. Return the reset evidence, archive verification, exact branch/PR cleanup result and main HEAD. Then perform Stage 1 audit on main. Continue only with safe, approved implementation tasks after the audit and gap register exist.
