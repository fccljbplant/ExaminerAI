# AI Integration — Socratic Assessment

## Overview

AI powers the Socratic examiner using **DeepSeek** (`deepseek-chat` V3 via OpenAI-compatible API). If `DEEPSEEK_API_KEY` is not set, it falls back to `z-ai-web-dev-sdk` (sandbox), then to heuristic responses. All AI calls go through `/api/ai/*` or `/api/project/*` routes — the SDK is never imported on the client.

Every AI call is logged to the `AIUsageLog` table for token quota tracking, cost analysis, and error monitoring.

---

## AI Endpoints

| Endpoint | Purpose | Token Budget |
|:---|:---|:---|
| `POST /api/ai/generate` | Generate a Socratic practice question | 300 |
| `POST /api/ai/evaluate` | Evaluate a student's answer with behavioral + plagiarism analysis | 500 |
| `POST/GET /api/ai/weekly-test` | Socratic chatbot agent (10 questions, max 5 replies each) | 500/reply |
| `GET /api/ai/stats` | AI usage stats (admin only) | — |
| `POST /api/project/setup` | Save project + auto-generate AI summary + key features | 400 |
| `POST /api/project/generate-tasks` | AI generates custom tasks + week plan tailored to the project | 2000+1500 |
| `POST /api/project/reports` | Submit project report + AI analyzes it (4 dimensions + feedback) | 600 |
| `POST /api/students/[id]/generate-project-analysis` | Teacher generates final project analysis | 800 |
| `GET /api/daily-motivation` | AI-generated daily quote (cached per day) | 30 |

---

## Provider Priority

```
1. DeepSeek (deepseek-chat V3, OpenAI-compatible API)
   - Requires: DEEPSEEK_API_KEY env var
   - Model: deepseek-chat (configurable via DEEPSEEK_MODEL)
   - Base URL: https://api.deepseek.com (configurable)
   - Rate limits: AI_RPM_LIMIT (50), AI_RPD_LIMIT (1000)

2. z-ai-web-dev-sdk (sandbox/dev fallback)
   - No env var needed
   - Used when DEEPSEEK_API_KEY is not set

3. Heuristic (empty response)
   - Caller generates a template response
   - Never blocks the UX
```

---

## AI Features

### Practice Questions
- 4 pillars: Why Probe, Break-It, Client Translation, Edge Case
- Auto-rotates through the week's 5 daily topics
- Topic is snapshotted at generation time (prevents mismatched evaluation)
- Plagiarism detection: markdown artifacts, AI-typical phrases, response time, contraction ratio

### Weekly Test
- 10 questions (not 5), max 5 student replies each
- Conversation is SAVED on completion (not deleted) so students can review Q&A
- Auto-advances the student's `currentWeek` after completion
- Generates: psychAnalysis, examinerComment, score (0-100), plagiarismScore

### Project Task Generation
- AI reads project definition (name, scope, objectives, requirements, business case)
- Generates N weeks × 5 tasks/week, each with: week, day (1-5), description, isMilestone
- Also generates week titles + summaries + milestones (ProjectWeek rows)
- Fallback: 6-phase generic project tasks if AI fails
- Animated generation modal with progress bar + cycling status messages
- Timeout scales with weeks: max(60s, weeks × 8s)

### Project Report Analysis
- Student submits weekly or final project report
- AI evaluates on 4 dimensions: projectUnderstanding, technicalDepth, progress, clarity
- Returns: score (0-100), strengths[], weaknesses[], feedback
- Similar to practice-question evaluation

### Final Project Analysis (teacher-triggered)
- Reads: project definition, all project reports, task completion stats, custom week summaries
- Evaluates: projectExecution, technicalCompetence, projectQuality, careerReadiness
- Returns: score, summary, strengths[], weaknesses[], recommendations[]

---

## Token Tracking

Every AI call writes a row to `AIUsageLog`:
- `provider` (deepseek / z-ai / fallback)
- `model`, `feature`, `promptTokens`, `completionTokens`, `totalTokens`
- `success` + `errorMessage`, `durationMs`

The admin dashboard shows: daily quota, 24h/30d stats, provider breakdown, feature breakdown, recent errors.
