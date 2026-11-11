# TraineesAI — Safety Rules (current)

This file supplements root AGENTS.md. When in doubt, root AGENTS.md and docs/UPGRADE-2026-11/START-HERE.md govern.

## Reset and Git

- The owner has directed a reset to main only.
- First archive the live refs/PR metadata in a private, owner-controlled, encrypted and restore-verified backup outside the repository.
- Inspect the tracked SQLite artifact on backup/v3-ui in an isolated workspace; never place sensitive learner/production data in an uncontrolled archive.
- Close open PRs whose branches are being retired. PR records remain as GitHub history.
- Delete all remote branches except main. Retain main, tags and merged history.
- After reset, audit main read-only, then implement approved gaps directly on main in small commits.
- Do not create new branches/PRs, force-push, rewrite history, reset or bypass branch protection.
- Check main-to-production deployment automation before the first source-code commit. Main-write authorization is not automatic production-release authorization.

## Data, privacy and security

- Never inspect or use .env files, secrets, credentials or private learner records.
- Never access remote production databases.
- Never run production migrations, seeds, syncs, destructive schema operations or data changes without exact-target approval and a reversible plan.
- Enforce auth, role, tenant, course, consent and entitlement scope server-side.
- Error, missing or stale data is unavailable, never fabricated as zero/success.
- Learner support/crisis features remain off until consent, legal review, professional review and owner gates are complete.
- No instructor psychological or behavioral monitoring.
- Instructor Copilot receives pseudonyms only; server-authorized code restores identities.

## AI security and economics

- Verify current model IDs, capabilities, thinking controls, terms and pricing using official provider docs at implementation time.
- Explicitly disable thinking by default.
- Use stable prompt prefixes, minimal course-scoped context, validated output and budget/step limits.
- Deterministic code owns permissions, metrics, grades, entitlements and crisis decisions.
- Treat user text and retrieved material as untrusted; test prompt injection, hidden-context leakage and cross-tenant retrieval.
- No new provider, paid plan, model spend or external processing without approval.

## Delivery

- One scoped task per commit on main.
- Add tests for permissions, tenant boundaries, failures and concurrency.
- Run exact lint, typecheck, tests, build, smoke and accessibility checks; report missing checks honestly.
- Update project status, continuity, progress and session log after meaningful work.
