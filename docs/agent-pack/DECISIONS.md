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
