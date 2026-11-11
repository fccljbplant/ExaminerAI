# TraineesAI Agent Pack

This directory is the canonical, repository-hosted home for agent operating instructions. Contributors should not need to maintain a local copy. Read root `AGENTS.md` first, then this guide.

## Canonical files
- `/AGENTS.md` — mandatory repository-wide agent policy and session-start checklist.
- `docs/agent-pack/SAFETY.md` — operational safeguards and branch-consolidation rules.
- `docs/agent-pack/QUEUE.md` — approved task-card workflow and current queue state.

## Authority and precedence
1. Current explicit owner decisions.
2. Current repository source, tests, workflows and approved project docs.
3. `AGENT-INSTRUCTIONS.md` and `docs/PROJECT-CONTINUITY.md`.
4. This pack and the upgrade specifications.
5. Historical session notes.

The owner decision dated 2026-11-11 supersedes historical no-merge instructions: consolidate useful existing branch work into `main`, then stabilise the application. Historical session entries remain immutable records of what was authorised at that time.

## Session protocol
1. Read `AGENTS.md`, `AGENT-INSTRUCTIONS.md`, `docs/PROJECT-CONTINUITY.md`, `docs/PROJECT-STATUS.md`, latest `docs/SESSION-LOG.md`, and `proj_progress.md`.
2. Recheck all GitHub branches, PRs, CI and deployment state live.
3. Read the active consolidation card and its referenced specifications.
4. Compare every branch with current `main`; map unique commits, duplicate tips, overlap, conflicts and risky files.
5. Integrate useful unique work in a dependency-aware order, preferably through existing PRs and auditable merge commits.
6. Run targeted tests and full quality gates; append continuity records and preserve history.

## Installation status
This Agent Pack is maintained in the repository. Do not ask the owner to re-upload or maintain local agent files. Update canonical files directly in GitHub. Preserve the existing `QUESTIONS.md` and historical continuity logs.

## Important limitations
Branch merge authorisation does not authorise source-branch deletion, force pushes, production database operations, production settings changes or deployment. Keep branches until consolidated `main` is validated. The previously proposed local logged runner is deliberately not installed on `main`: its hard-coded PR #3 branch guard is incompatible with consolidation branches. Use GitHub Actions until a safe, branch-neutral runner is reviewed and tested.
