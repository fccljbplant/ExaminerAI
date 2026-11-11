# TraineesAI Agent Pack — legacy reference

The active source of truth is now root AGENTS.md plus docs/UPGRADE-2026-11/.

## Current entry points
- [Agent contract](../../AGENTS.md)
- [Reset and upgrade runbook](../UPGRADE-2026-11/START-HERE.md)
- [Master plan](../UPGRADE-2026-11/MASTER-PLAN.md)
- [Baseline](../UPGRADE-2026-11/RESET-BASELINE.md)
- [Decision register](../UPGRADE-2026-11/DECISIONS-REGISTER.md)

## Status

This Agent Pack was created for the earlier branch-consolidation workflow. Its old task queue and branch-preservation rules are historical; they are not executable instructions. The owner has replaced that workflow with a reset-first, main-only programme.

Do not run any local agent tooling merely because it appears in historical documentation. Verify that the exact script exists, inspect it for branch switching, dotenv access, network, secret and production-data behavior, and obtain approval before use.

Preserve historical session records and approved product requirements. Do not delete them as generic cleanup.
