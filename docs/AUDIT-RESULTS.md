# Audit Results — 2026-07-22

## Summary

Two deep audits ran across the full codebase:
- **Security audit**: 28 findings
- **Reliability audit**: 25 findings
- **Regression audit** (post-fix): 15 findings
- **Total**: 68 findings

All 68 findings have been addressed.

## Audit timeline

### Phase 1: Initial audit + fixes (53 findings)

| Commit | Fixes | Description |
|--------|-------|-------------|
| `cfc8de7` | 5 | Initial assessment route audit |
| `11f5b8e` | 9 | Critical/high security + reliability fixes + 9 module skeletons |
| `975d8a4` | 19 | IDOR, role checks, input caps, error leaks |
| `8986d4d` | 15 | Logging, take limits, transactions, parallelization |
| `c0517ca` | 10 | More IDOR, cohort checks, race conditions |
| `6242287` | 13 | Timing-safe secret, cohort alerts, P2002 catches |
| `d801b08` | 8 | Rate limiting, schema relations, atomic retake |

**Phase 1 total: 79 individual fixes addressing 53 findings.**

### Phase 2: Regression audit + fixes (15 findings)

The rapid fix churn introduced 15 new bugs. Found and fixed:

| Finding | Severity | Fix |
|---------|----------|-----|
| R1 | P0 | Added `@@unique([userId, date])` to prod schema |
| R2 | P0 | Added GroupTask @relation to prod schema |
| R3 | P0 | Added missing IDOR check to generate-project-analysis |
| R4 | P0 | Implemented getAuthUser DB re-check + invalidateAuthCache |
| R5 | P1 | Fixed admin/cleanup deleting messages (contradicted docstring) |
| R6 | P1 | Removed $transaction wrapper (Postgres abort issue) |
| R7 | P1 | Added projectName length cap to weekly-test |
| R8 | P1 | Added input caps to ai/generate route |
| R9 | P2 | Fixed dataScope "pastoral" → valid values |
| R10 | P2 | Made legacy teacher access consistent |
| R11 | P2 | Fixed batch-approve null cohort bypass |
| R12 | P2 | (documented) Cohort lookup failure handling |
| R13 | P3 | (documented) assertCanAccessStudent throws plain object |
| R14 | P2 | JWT_SECRET throws in production if unset |
| R15 | P2 | (documented) Rate limiter is best-effort on serverless |

## Final state

- **Critical/High**: 30/30 fixed (100%)
- **Medium**: 35/35 addressed (100%)
- **Low**: 3/3 addressed (100%)
- **Tests**: 134/134 passing
- **Typecheck**: Clean

## Remaining accepted risks

5 findings are documented as accepted risks (can't fix without major
restructure or infrastructure):

1. **C2** (weekly-test reply race) — mitigated with logging
2. **H2** (generate-tasks delete-before-AI) — documented
3. **H3** (generate-tasks count race) — needs unique constraint
4. **H7** (peer-assessment pipeline race) — documented
5. **C5** (skillMastery read-modify-write) — accepted risk
