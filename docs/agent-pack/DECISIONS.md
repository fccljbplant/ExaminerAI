# Agent operating decisions

## 2026-11-11 — Repository-hosted Agent Pack
- Keep agent instructions and operational settings in GitHub, not in a user-maintained local archive.
- Root `AGENTS.md` is the first-read entry point; canonical detail lives in `docs/agent-pack/`.
- Preserve `AGENT-INSTRUCTIONS.md`, project continuity, questions and historical logs. This pack supplements them; it does not erase or silently override project decisions.
- Work only on the existing PR #3 branch. No branch restoration, creation, switching, deletion, merge or deployment.
- Installation is docs/tooling-only. The remaining application issues are not implicitly approved by installing the pack.
- Runner commands are restricted to validation; DB mutation is excluded.

## Conflicts to retain
- Generic instructions in older agent material may suggest creating a feature branch. The project continuity guide mandates the existing PR #3 branch; the latter governs.
- Historical Agent Pack content included unsafe branch-changing and dotenv-reading behaviour. Do not copy or execute those behaviours.
- The current project status and historical logs contain older heads. Recheck live GitHub state before treating any recorded SHA or CI result as current.


## 2026-11-11 — Owner supersedes blanket no-merge policy
- Owner explicitly directed: consolidate all useful existing branches into `main`, then stabilise the application before cautiously proceeding with further upgrades.
- This supersedes earlier blanket no-merge/keep-PR-3-draft instructions. Agent instructions and queue must follow this current decision.
- Consolidation means integrate unique useful work, not blindly merge every branch tip. Avoid duplicate ancestry; review conflicts and risky files; preserve source branches until main is validated and cleanup is separately approved.
- The merge decision does not authorise force pushes, history rewrites, production DB operations, production settings changes or deployment.


## 2026-11-11 — Agent Pack mainline reconciliation
- The earlier note requiring work only on PR #3 is historical and superseded by the owner's consolidation decision.
- The proposed `scripts/agent/run-logged.mjs` is not integrated into `main`; its hard-coded branch restriction is not compatible with the approved consolidation workflow. GitHub Actions remains the validation source until a safe replacement is reviewed.
- Agent Pack documentation is being brought to `main` through a dedicated auditable PR; no app code, database, schema, dependency or deployment change is included.
