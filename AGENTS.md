# TraineesAI Agent Instructions

Read this file first in every session. This repository is the durable source of truth; chat context and local workspaces may reset.

## Required session start
1. Read `AGENT-INSTRUCTIONS.md`, `docs/PROJECT-CONTINUITY.md`, `docs/PROJECT-STATUS.md`, the latest `docs/SESSION-LOG.md`, and `proj_progress.md`.
2. Verify live GitHub default branch, the existing PR #3 branch, PR head/base/state, exact-head Actions and Vercel checks, reviews, and unresolved threads.
3. Read the active task card and only its referenced specification sections. If no approved card exists, do not implement application changes.
4. Inspect current source and diffs. No assumptions from old sessions.

## Branch and Git policy
- Work only on `ux-audit/fix-dashboard-truthfulness-and-agent-safety`.
- Never create, restore, rename, switch, rebase, merge, delete or force-update branches.
- Never push directly to `main`; do not merge PRs or deploy without explicit owner approval.
- Preserve unrelated work. Stage explicit paths only. Never use `git add -A`, `git add .`, hard reset, clean, or force push.
- Do not auto-stage or commit interrupted work.

## Security and data
- Never read, print, copy, modify or commit `.env*` files or secrets. Do not place credentials in source, docs, logs, remotes or chat.
- Never access remote production databases. No destructive DB operation, schema drop, force reset, production sync, migration or production-data change without exact-target owner approval and an approved reversible plan.
- Local SQLite development work is permitted only when the active approved task explicitly scopes it. Do not infer a safe target from an absent/missing URL.
- Enforce auth, RBAC, tenant, course, consent and entitlements server-side. Missing/error/stale evidence is unavailable, never zero or success.
- Instructor Copilot receives pseudonyms only; server-authorised code restores identity. Platform Admins do not see individual learner psychology/support signals. Never psychologically or behaviourally profile instructors.
- Learners set their pace; weeks/days organise content, not calendar deadlines. Daily tests follow study sessions; weekly tests unlock only after the week's final content day.

## Engineering and UX
- Verify package versions, scripts, schema, provider APIs and workflows before use. No new dependencies, provider/billing changes, spending or external data processing without approval.
- Prefer small, reversible, typed changes and additive migrations with rollback notes.
- WCAG AA, keyboard/focus, reduced motion, zoom/reflow, 360px–4K responsive behaviour, existing design tokens, and honest loading/empty/error/stale/denied/success states are required.
- Do not fabricate metrics, progress, outcomes, activity, testimonials or notifications. Label fixtures/demo data.

## Execution and reporting
- Use `scripts/agent/run-logged.mjs` for supported checks; inspect its allowlist before extending it.
- Run relevant tests, lint, typecheck, build and security/accessibility checks where available. Report exact commands/results; never claim unrun checks passed.
- If scope, consent, data classification, migration safety, or required tooling is unclear, append the question to `docs/UPGRADE-2026-10/QUESTIONS.md`, mark the card blocked and stop.
- After meaningful work append `proj_progress.md` and `docs/SESSION-LOG.md`; update `docs/PROJECT-STATUS.md`. Preserve history; never replace these files wholesale.

## Current execution boundary
The only authorised working branch is the existing PR #3 branch above. Keep PR #3 draft, unmerged and undeployed unless the owner explicitly changes that decision. Agent Pack installation is documentation/tooling-only; it does not authorise application work, schema changes, merging, branch deletion or deployment.

See [the maintained Agent Pack](docs/agent-pack/README.md) and [task queue](docs/agent-pack/QUEUE.md).
