# TraineesAI — Agent and Engineering Operating Contract

**Current authority:** Owner direction dated 11 November 2026.  
**Product:** TraineesAI. **Repository:** fccljbplant/ExaminerAI.

## Required start

1. Read docs/UPGRADE-2026-11/START-HERE.md and MASTER-PLAN.md.
2. Read RESET-BASELINE.md and DECISIONS-REGISTER.md.
3. Read docs/PROJECT-CONTINUITY.md, docs/PROJECT-STATUS.md, latest docs/SESSION-LOG.md and proj_progress.md.
4. Verify live GitHub main HEAD, every branch, PR, workflow/check, ruleset and Vercel deployment behavior. Historical SHAs are not current evidence.
5. Follow the reset-first programme. The reset has NOT happened merely because this file describes it.

## Current owner direction

The owner has directed:
- Retire all remote branches except main, including the PR #3 source branch.
- Close the open PRs that are being retired, including PR #3 and PR #6. GitHub keeps PR records as history; closing is not erasing the record.
- Archive the pre-reset state privately and securely before deleting branch refs.
- Perform a deep audit of main after cleanup.
- Implement approved gaps directly on main, with small scoped commits. Do not create replacement feature branches or PRs.

This supersedes the old consolidation queue and the previous instruction to preserve all source branches indefinitely. It does NOT authorize force-push, history rewrite, production database changes, paid services, external data processing, protected-branch setting changes or production deployment.

## Reset safety

Before any deletion:
- Re-fetch live branch and PR inventory.
- Record all refs, SHAs, PR metadata, unique unmerged work and changed-file inventories.
- Securely archive recoverable history outside the repository; verify restore.
- Inspect the tracked SQLite file in backup/v3-ui in an isolated no-network workspace. Do not copy potentially sensitive DB contents into an uncontrolled archive.
- Close open PRs whose branches are being removed.
- Delete remote branches except main. Retain tags and merged history.
- Verify exactly one remote branch remains. If safe archive, permissions or cleanup cannot be verified, stop.

Never force update main, rewrite history or delete tags/releases.

## Main-only implementation

After the read-only audit is complete:
- Work only in a clean checkout of main.
- One approved task and one focused commit at a time.
- No feature branches and no PRs unless the owner changes this direction.
- No force push, rebase, hard reset, git clean or broad staging.
- Inspect the diff and run checks before every commit.
- Check whether main writes automatically trigger a production deployment. Direct-main authorization is not blanket release approval. Stop before source-code commits if a production release would happen without approval.
- If branch protection blocks direct commits, do not bypass or change settings. Report the blocker.

## Product invariants

- AI trains; humans mentor.
- Roles: Learner, Instructor, Organisation Admin, Platform Admin.
- Learners control their pace; weeks/days organise content, not calendar deadlines.
- Daily tests follow study sessions; weekly tests unlock only after the final content day, enforced server-side.
- Difficulty has five evidence-derived levels: Warm-up, Core, Stretch, Advanced, Expert.
- Missing/error/stale evidence is unavailable, never zero or success.
- Enforce authentication, RBAC, tenant, course, consent and entitlement scope on every protected operation.
- Learner support is off per organisation until consent, legal/data-processing review, professional safety-copy review, retention and owner approvals are complete.
- Support indicators go only to the in-scope instructor under the approved policy; designated org Learner Support Leads oversee crisis cases and handling records only.
- Platform Admins see no individual learner psychology/support signals.
- Never monitor, score or profile instructors psychologically or behaviorally.
- Instructor Copilot receives pseudonyms only; authorized server code restores identity.
- AI never diagnoses or declares a crisis. Humans confirm and handle cases.
- Do not fabricate progress, metrics, outcomes, activity, testimonials or notifications.

## Engineering and privacy controls

- Never read, print, copy, edit or commit .env files, secrets, credentials or private learner records.
- Never access remote production databases.
- No destructive DB operation, schema drop, force reset, production sync, migration, seed or data mutation without exact-target owner approval and a reviewed reversible plan.
- No new dependencies, model/provider, email, storage, queue, billing, paid service or external processing without approval.
- Verify current APIs, packages, schemas, scripts and model/pricing documentation before use.
- Use deterministic code for authorization, arithmetic, scores, entitlements and aggregates; AI is for language and constrained synthesis.
- Validate AI output with schemas; apply rate/budget/step limits; protect against prompt injection and cross-tenant retrieval.
- Prefer small, typed, reversible changes and additive migrations with rollback notes.

## UX and quality

- Use existing tokens, theme packs and components; do not create a second design system.
- WCAG 2.2 AA target; keyboard, visible focus, reduced motion, zoom/reflow, screen-reader semantics and responsive behavior from 360px to 4K.
- Use genuine loading, empty, stale, error, denied, success and retry states.
- Validate role journeys on phone and desktop. Automated screenshots are not an accessibility sign-off.
- Tests must cover behavior, permissions, tenant/course boundaries, failures and concurrency where applicable.
- Run and report exact lint, typecheck, tests, build, route smoke, security and accessibility checks. Never claim an unrun check passed.

## Project records

The new programme is in docs/UPGRADE-2026-11/. It is the active plan. The prior docs/agent-pack/QUEUE.md is historical and must not be used to start consolidation cards.

After meaningful work:
- Append docs/SESSION-LOG.md and proj_progress.md.
- Update docs/PROJECT-STATUS.md and docs/PROJECT-CONTINUITY.md.
- Keep decisions, evidence, exact SHAs, tests, gaps and next step current.
- Preserve historical logs. Clean old plans only after proving they are superseded and contain no unique requirements or decisions.

If a consent, privacy, migration, safety, provider, deployment or commercial decision is unresolved, record it in docs/UPGRADE-2026-11/DECISIONS-REGISTER.md and stop that affected task.
