# Upgrade questions and unresolved product decisions

## 2026-11-09 — Comprehensive learner report field classification

**Status:** Blocked pending owner clarification; do not broaden visibility or change the report schema without a decision.

The current `src/modules/comprehensive-report/index.ts` describes the report as academic-only and states that behavioral/psychological/mentorship monitoring has been removed. However, its report type and AI prompt still generate `managementAttitude` fields, including productivity signals, professionalism signals, leadership potential, manager readiness, and focus areas. The GET route currently authorizes staff with `content_only` access and platform admins have global operational access.

This is a mismatch between the module's stated scope and the actual generated fields. The fields may be intended as educational coaching feedback, but they may also constitute behavioural profiling or learner-support signals. The project invariants require learner-support signals to remain with the in-scope instructor under the approved consent pathway and prohibit platform admins from viewing individual learner psychology/support signals.

**Owner decision required:**
1. Should `managementAttitude` and its derived narrative content be removed from the report entirely, retained only in the learner's own report, or exposed to the in-scope instructor only after the approved consent/feature-gate pathway exists?
2. Should organisation admins and platform admins receive only the educational score/mastery/project sections from this endpoint?

Until clarified, keep learner-support features default-off, do not add new staff exposure, and do not use these fields for formal decisions. Treat this as an unresolved access/privacy risk, not as a completed implementation.
