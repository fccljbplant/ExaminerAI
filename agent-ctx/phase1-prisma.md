# Phase 1 — Prisma Schema (Learn Models)

## Work record
- **Agent**: main
- **Task ID**: phase1
- **Status**: ✅ Complete

## Changes
- Added 15 new models to end of `prisma/schema.prisma`:
  - LearnProfile, JourneyPlan, JourneyStep, LearnSlide, LearnNarration,
    TutorSession, TutorMessage, LearnDailyTest, LearnWeeklyTest,
    LearnProject, ProjectMilestone, ProjectHelpSession, XPLedger,
    BadgeDefinition, UserBadge, LearnNote, EngagementEvent
- Added reverse relations to `User` model (10 fields):
  learnProfiles, journeyPlans, tutorSessions, learnProjects, xpLedger,
  userBadges, learnNotes, engagementEvents, learnDailyTests, learnWeeklyTests
- Added reverse relations to `Course` model (7 fields):
  learnProfiles, journeyPlans, learnSlides, tutorSessions, learnDailyTests,
  learnWeeklyTests, learnNotes
- Spec was missing `helpSessions ProjectHelpSession[]` on LearnProject
  (Prisma requires bidirectional relation). Added it.

## Verification
- `bun x prisma@6.11.1 generate` → ✔ Generated Prisma Client (v6.11.1)
- No migrations run (SQLite dev — `prisma generate` is sufficient).

## Notes for next phases
- All Learn models now available via `@prisma/client` and the `db` export.
- `masteryMap` JSON field on LearnProfile stores `{ topicProgress: { current, history[] } }`.
- `@@unique([userId, courseId])` on LearnProfile/JourneyPlan means one active plan per user per course.
- `@@unique([userId, courseId, date])` on LearnDailyTest → one test per user/course/day.
