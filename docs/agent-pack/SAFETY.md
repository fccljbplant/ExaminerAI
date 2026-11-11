# Agent execution safety

## Hard stops
- Branch must already be `ux-audit/fix-dashboard-truthfulness-and-agent-safety`. No branch creation, checkout, switching, merging, rebasing, deleting, resetting or force updates.
- Never inspect or access `.env`, `.env.*`, secrets, credentials, private learner data, or remote production databases.
- Never run production sync, destructive reset/drop, seed, migration, schema push, or data mutation unless the exact local target and operation have explicit owner approval in the active task card. The default is blocked.
- No dependency/provider/billing changes, paid services, spending or external data processing without approval.
- No push to main, merge, deploy, production-setting change, or protected-branch action without explicit owner approval.

## Database policy
- The repository's production stack uses PostgreSQL/Neon and local development may use SQLite; never infer the active target.
- Read only non-secret configuration names and code paths. Do not print environment values.
- Any permitted local SQLite operation must be isolated, backed up where applicable, reversible, and covered by tests. A `file:` URL alone is not sufficient proof that a DB is safe to mutate.
- Additive schema changes require migration review, preservation of legacy rows, rollback notes, and owner approval. Production schema/history/backup/restore are release gates.

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
