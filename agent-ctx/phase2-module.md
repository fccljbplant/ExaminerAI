# Phase 2 — Learn Module: Types + Library

## Work record
- **Agent**: main
- **Task ID**: phase2
- **Status**: ✅ Complete

## Files created

### `src/modules/learn/types/index.ts`
- `TeachingLevel = 1 | 2 | 3 | 4` (kindergarten / school / college / university)
- `TEACHING_LEVELS` array (label + description for each)
- `LEARNER_LEVELS` array: Rookie(0), Learner(100), Scholar(300), Specialist(700), Expert(1500), Master(3000), Legend(7000)
- `XP_AMOUNTS`: slide_taught:5, probe_correct:10, quiz_correct:15, daily_test_done:30, weekly_test_done:100, streak_day:20, level_raise:75, project_step:15, course_completion:500
- `SlideData` interface (title, bullets, visualSpec, keyTerms, checkQuestion, realWorldExample, analogy)
- `TopicContext`, `TodayTopicResult`, `MasteryMap` interfaces
- `LEVEL_DIRECTIVES` — per-level AI prompt directive strings

### `src/modules/learn/lib/today-topic.ts`
- `SLIDES_PER_TOPIC = 4`
- `getTopicByWeekDay(week, day)` — pure lookup from WEEKLY_TOPICS
- `getNextTopic(week, day)` — pure: returns `{week, day}` or null at course end
- `getPrevTopic(week, day)` — pure: returns `{week, day}` or null at start
- `isLastTopicInCourse(week, day)` — pure
- `getTodayTopic(userId, courseId)` — DB-backed; reads/initializes masteryMap.current (defaults to W1D1)
- `incrementSlideViewed(userId, courseId)` — bumps slidesViewed counter
- `markResourcesShown(userId, courseId)` — marks resourcesShown=true
- `completeTopicAndAdvance(userId, courseId)` — moves current → history, advances, awards 15 XP; on last topic awards 500 XP + journey plan marked complete
- `buildTopicContextForAI(userId, courseId, topic)` — builds context string for AI prompts
- `jumpToTopic(userId, courseId, week, day)` — for JourneyPanel re-navigation (only to completed or current topics)

### `src/modules/learn/lib/xp-ledger.ts`
- `awardXP({userId, courseId, amount, reason, referenceId})` — appends XPLedger row + updates LearnProfile.totalXP + learnerLevel
  - Level-up bonus: when an award crosses a level boundary, awards an extra 75 XP (XP_AMOUNTS.level_raise)
- `getTotalXP(userId)` — sum of all XPLedger rows
- `getLearnerLevel(totalXP)` — pure function returning level name
- `getXPHistory(userId, courseId?, limit=50)` — recent XP entries
- `awardTypedXP(userId, reason, courseId?, referenceId?)` — convenience wrapper using XP_AMOUNTS

### `src/modules/learn/lib/learner-profile.ts`
- `getOrCreateProfile(userId, courseId)` — idempotent
- `updateStreak(userId, courseId)` — timezone-safe (local YYYY-MM-DD key)
  - Same day: no change
  - Next day: streak++
  - 2+ day gap: reset to 1
  - Awards 20 XP (streak_day) on new-day activity
- `setLanguage(userId, courseId, language)`
- `setTeachingLevel(userId, courseId, level)`
- `setLeaderboardOptIn(userId, courseId, optIn)`

### `src/modules/learn/lib/tts-filter.ts` (CLIENT-ONLY)
- `prepareForTTS(text)` — strips:
  - Fenced code blocks → "I've included the code snippet in the chat window below."
  - URLs → "I've added a link in the chat."
  - Markdown tables → "I've prepared a table for you in the chat."
  - Inline code backticks, headings, bold/italic, list markers, blockquotes, horizontal rules, image syntax
- `speakTTS(text)` — `speechSynthesis.speak(new SpeechSynthesisUtterance(text))`
- `stopTTS()` — `speechSynthesis.cancel()`
- `isTTSAvailable()` — feature detection

### `src/modules/learn/index.ts`
- Barrel re-exports types + all lib functions.
- Notes that client components should import from `types` or `tts-filter` directly to avoid bundling db.

## Verification
- `npx tsc --noEmit` will be run at the end of all phases.

## Notes for next phases
- All learn-module logic is in place — API routes can call these functions directly.
- `awardXP` is safe to call inside a `db.$transaction()` (it does its own writes).
- `getTodayTopic` returns `null` if the user has no LearnProfile — API routes should auto-enroll on first visit.
