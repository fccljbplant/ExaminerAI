# TraineesAI Agent Pack

This directory is the canonical, repository-hosted home for agent operating instructions. Contributors should not need to maintain a local copy. Read root `AGENTS.md` first, then this guide.

## Canonical files
- `/AGENTS.md` — mandatory repository-wide agent policy and session-start checklist.
- `docs/agent-pack/SAFETY.md` — operational safeguards and prohibited actions.
- `docs/agent-pack/QUEUE.md` — approved task-card workflow and current queue state.
- `scripts/agent/run-logged.mjs` — narrow, logged command runner for supported validation commands.

## Authority and precedence
1. Current explicit owner decisions.
2. Current repository source, tests, workflows and approved project docs.
3. `AGENT-INSTRUCTIONS.md` and `docs/PROJECT-CONTINUITY.md`.
4. This pack and the upgrade specifications.
5. Historical session notes.

Where instructions conflict, stop and record the conflict in `docs/UPGRADE-2026-10/QUESTIONS.md`; do not silently choose a destructive interpretation. The continuity guide's restriction to the existing PR #3 branch takes precedence over any generic instruction to create a branch.

## Session protocol
1. Read `AGENTS.md`, `AGENT-INSTRUCTIONS.md`, `docs/PROJECT-CONTINUITY.md`, `docs/PROJECT-STATUS.md`, latest `docs/SESSION-LOG.md`, and `proj_progress.md`.
2. Recheck GitHub and CI/deployment state live.
3. Read the approved task card and its referenced specs.
4. Make only the approved scoped change.
5. Run supported checks and inspect the diff.
6. Append continuity records; preserve all history.

## Installation status
This Agent Pack is now maintained in the repository. Do not ask the owner to re-upload or maintain local agent files. Update these canonical files directly in GitHub on the authorised PR #3 branch. Do not overwrite the existing `QUESTIONS.md` or replace historical continuity logs.

## Important limitation
The logged runner is deliberately restrictive and does not replace the project CI workflow. It does not authorise database mutation, production operations, merges, deployments, or branch operations.
