# Project Plan — Bootcamp Curriculum

## Curriculum (6 Weeks)

The curriculum is **fixed** — shared by all students. It lives in `src/lib/course-topics.ts`. Each week has 5 daily topics, each with a learning objective + 1-2 curated resource links.

| Week | Phase | Daily Topics |
|:---|:---|:---|
| 1 | Planning & Dev Environment | Project planning, dev environment (VS Code, Git, LocalWP), version control, WordPress setup, sprint review |
| 2 | Website & Database Fundamentals | Homepage with WordPress blocks, CSS + responsive design, databases (phpMyAdmin), SQL basics, WordPress + MySQL |
| 3 | APIs, Automation & AI Agents | REST APIs, Make.com automation, automation workflows, AI agents, webhooks |
| 4 | Prompt Engineering & AI | LLMs, prompt engineering, Gemini API, first API integration, AI-powered website feature |
| 5 | Testing, Security & Deployment | Testing + debugging, performance optimization, WordPress security, live deployment, final testing |
| 6 | Career Prep & Final Capstone | Project audit, GitHub portfolio, interview prep, final presentation, career next steps |

---

## Student Journey

```
Day 1 (Week 1):
├── Sign up → admin approves → log in
├── Journey Wizard: Welcome → Read outline → Plan project → Configure timeline
│   └── Choose 3-20 weeks → AI generates tasks + week plan (animated modal)
├── Review project plan → Set up dev environment
├── First daily check-in (with reflection questions)
└── First practice question

Weeks 1-5: Build Phase
├── Learning Hub: mark curriculum days complete, check-in with reflections
├── Practice: AI Socratic questions (4 pillars, topic snapshotted)
├── Weekly Test: 10 questions, conversation saved, auto-advances week
├── Project: add/edit/delete tasks, track milestones, view Gantt
└── Project Reports: submit weekly reports, AI analyzes them

Week 6: Capstone
├── Final project audit
├── Submit final project report (AI analyzes)
├── Teacher generates final project analysis
└── Final result: performance + participation + project analysis
```

---

## Project Tab Structure

1. **Project Description Card** — AI summary + key features + GitHub/deploy links + Generate Tasks button
2. **Project Progress Chart** — bar chart: tasks completed per week
3. **Compact Gantt** — horizontal task bars spanning multiple weeks (color-coded by status)
4. **Project Week Plan** — collapsible weeks with tasks grouped inside:
   - All collapsed on load except current week
   - Each week: custom title (editable), summary, milestones, tasks
   - Task CRUD: add/edit/delete, status change, day assignment, milestone flag, time estimate, due date, notes

---

## Weekly Test Flow

1. Student completes all week's tasks → test unlocks
2. AI asks 10 questions (max 5 replies each), 4 pillars + reflection
3. Conversation is SAVED (not deleted) — student can review Q&A
4. On completion: psychAnalysis + examinerComment + score + plagiarismScore
5. `currentWeek` auto-advances to the next week
6. Student can retake only if teacher explicitly allows

---

## Report Cards

- **Auto-generated** from student data (80% weekly test + 20% practice)
- **Project Reports**: student submits weekly/final reports, AI analyzes (4 dimensions + feedback)
- **Final Result**: performance score + participation rate + project reports + project task stats + project analysis (teacher-generated)
- Teacher can: generate for any week, edit grade/score/observations, add comments
