# TraineesAI Agent Instructions

Read this file first in every session. This repository is the durable source of truth; chat context and local workspaces may reset.

## Required session start
1. Read `AGENT-INSTRUCTIONS.md`, `docs/PROJECT-CONTINUITY.md`, `docs/PROJECT-STATUS.md`, the latest `docs/SESSION-LOG.md`, and `proj_progress.md`.
2. Verify live GitHub default branch, all existing branches, open/closed PRs, exact heads/bases, Actions and Vercel checks, reviews, and unresolved threads.
3. Read the active consolidation card and its referenced specifications. If no approved card exists, do not implement unrelated application changes.
4. Inspect each branch's unique commits, file-level diff, conflicts, database/binary changes, dependency changes and overlap before integration.

## Owner-approved consolidation direction (2026-11-11)
The owner has superseded the previous blanket no-merge rule: consolidate all useful existing branch work into `main`, then stabilise the application before starting new roadmap work. The previous instruction to keep PR #3 unmerged is obsolete.

- Merge is authorised for existing branches/PRs as part of this consolidation, using auditable PR merges where available.
- Do not blindly merge every branch tip. First compare it with current `main`, identify unique work and duplicate ancestry, then integrate in a dependency-aware order.
- Preserve unique useful work. Resolve conflicts deliberately and test the resulting integration. Do not discard branch-only code merely to obtain a clean merge.
- Never merge a branch containing an unexplained tracked database/binary, generated secret, credential, unsafe production-data operation, or unreviewed dependency/provider/billing change. Isolate and report it for explicit review.
- Do not merge duplicate branches twice (for example, identical branch tips). A branch with no unique commits needs no merge.
- Do not delete source branches as part of consolidation; retain them until the consolidated `main` is validated and the owner separately confirms cleanup.
- Use expected-head protections for PR merges. If GitHub reports conflicts/non-mergeable state, stop and prepare a conflict-resolution/integration path; never force merge, force push or rewrite history.
- Direct writes to `main` are not the default. Prefer existing PRs and their review/CI gates; any exceptional direct integration must be limited to owner-approved consolidation and auditable commits.

## Branch and Git policy
- Existing branches may be inspected and consolidated under the owner direction above. Do not create, restore, rename, switch, rebase, reset, clean or force-update branches without a separately justified and approved need.
- Preserve unrelated work. Stage explicit paths only. Never use `git add -A`, `git add .`, hard reset, clean, or force push.
- Do not auto-stage or commit interrupted work.

## Security and data
- Never read, print, copy, modify or commit `.env*` files or secrets. Do not place credentials in source, docs, logs, remotes or chat.
- Never access remote production databases. No destructive DB operation, schema drop, force reset, production sync, migration or production-data change without exact-target owner approval and an approved reversible plan.
- Local SQLite development work is permitted only when the active approved task explicitly scopes it. Do not infer a safe target from an absent/missing URL.
- Enforce auth, RBAC, tenant, course, consent and entitlements server-side. Missing/error/stale evidence is unavailable, never zero or success.
- Instructor Copilot receives pseudonyms only; server-authorised code restores identities. Platform Admins do not see individual learner psychology/support signals. Never psychologically or behaviourally profile instructors.
- Learners set their pace; weeks/days organise content, not calendar deadlines. Daily tests follow study sessions; weekly tests unlock only after the week's final content day.

## Engineering and UX
- Verify package versions, scripts, schema, provider APIs and workflows before use. No new dependencies, provider/billing changes, spending or external data processing without approval.
- Prefer small, reversible, typed changes and additive migrations with rollback notes.
- WCAG AA, keyboard/focus, reduced motion, zoom/reflow, 360px–4K responsive behaviour, existing design tokens, and honest loading/empty/error/stale/denied/success states are required.
- Do not fabricate metrics, progress, outcomes, activity, testimonials or notifications. Label fixtures/demo data.

## Execution and reporting
- Use repository CI for validation. The proposed local logged runner is not installed on `main`; do not invoke it until separately reviewed and adapted to the consolidation workflow.
- Run relevant tests, lint, typecheck, build and security/accessibility checks where available. Report exact commands/results; never claim unrun checks passed.
- If scope, consent, data classification, migration safety, or required tooling is unclear, append the question to `docs/UPGRADE-2026-10/QUESTIONS.md`, mark the card blocked and stop.
- After meaningful work append `proj_progress.md` and `docs/SESSION-LOG.md`; update `docs/PROJECT-STATUS.md`. Preserve history; never replace these files wholesale.

## Current execution boundary
The active authorised workstream is branch consolidation into `main`, followed by application stabilisation. Merge existing useful branch work carefully under the rules above. This does not authorise production database changes, destructive schema operations, production settings changes or deployment. Stabilise and report first; obtain separate release approval for production data operations and deployment.

See [the maintained Agent Pack](docs/agent-pack/README.md) and [task queue](docs/agent-pack/QUEUE.md).
