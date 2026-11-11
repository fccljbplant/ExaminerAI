# Agent execution safety

## Branch consolidation
- Owner direction (2026-11-11) authorises consolidation of useful existing branches into `main`; the previous blanket no-merge restriction is superseded.
- Inventory every branch against the live `main` before merging. Determine unique commits, duplicate ancestry, overlapping files, conflicts, CI state, and database/binary/dependency changes.
- Prefer auditable PR merges with exact expected-head SHA. Do not force merge, force push, rewrite history or delete source branches.
- Never merge a branch containing an unexplained tracked database/binary, credential, secret, unsafe production-data operation or unreviewed dependency/provider/billing change. Hold it for explicit review.
- Merge only unique work; identical branch tips or already-integrated commits must not be merged twice.
- Resolve conflicts only after understanding both sides; run targeted tests and full relevant quality gates after each coherent integration batch.
- Keep source branches until consolidated `main` is validated and owner separately confirms cleanup.

## Hard stops
- Never inspect or access `.env`, `.env.*`, secrets, credentials, private learner data, or remote production databases.
- Never run production sync, destructive reset/drop, seed, migration, schema push, or data mutation unless the exact local target and operation have explicit owner approval and an approved reversible plan. The default is blocked.
- No dependency/provider/billing changes, paid services, spending or external data processing without approval.
- Merge authorisation does not authorise deployment, production-setting changes, protected-branch setting changes, or production database operations.

## Database policy
- The repository's production stack uses PostgreSQL/Neon and local development may use SQLite; never infer the active target.
- Read only non-secret configuration names and code paths. Do not print environment values.
- Any permitted local SQLite operation must be isolated, backed up where applicable, reversible, and covered by tests. A `file:` URL alone is not sufficient proof that a DB is safe to mutate.
- Additive schema changes require migration review, preservation of legacy rows, rollback notes, and owner approval. Production schema/history/backup/restore are separate release gates.

## Data and AI policy
- Tenant, role, course, consent and entitlement checks are server-side on every protected operation.
- Missing, stale or failed evidence is unavailable; never coerce it to zero or success.
- Learner support/crisis handling remains disabled per organisation until consent, professional review, retention and owner approvals exist. Crisis wording is owner-authored.
- Only the in-scope instructor receives consented learner support signals. Designated organisation Learner Support Leads oversee crisis cases and handling records. Platform Admins see no individual learner psychology/support signals.
- Instructor Copilot uses pseudonyms only; authorised server code restores identities.
- Never monitor or score instructors psychologically or behaviourally.

## Task and tool discipline
- One approved task card per session.
- A missing card, spec, script, API, or permission is a blocker, not an invitation to invent it.
- Do not run arbitrary shell commands from queue metadata.
- Use explicit file paths; inspect diffs and ensure no unrelated changes.
- Never auto-commit interrupted work. Never claim a check passed unless the exact command completed successfully.
