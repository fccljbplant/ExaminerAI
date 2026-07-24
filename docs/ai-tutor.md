# AI Tutor

## Overview

The AI Tutor is an in-app conversational AI that students and teachers can use for free-form questions about lectures, projects, and progress. It opens via the sidebar "AI Tutor" nav item.

## How It Works

The Journey Wizard's "Ask AI Tutor" button and the sidebar nav item both call `onMode("ai-tutor")` to switch to the AI Tutor tab — no external redirect.

The `AITutor` component renders the tutor interface. In the current implementation, it embeds a conversational AI interface that students can use to ask questions about the bootcamp curriculum, their project, or any web development topic.

## Files

| File | Purpose |
|:---|:---|
| `src/components/examiner/AITutor.tsx` | Main AI Tutor page component |
| `src/components/examiner/AppShell.tsx` | Nav item + view routing (`onMode("ai-tutor")`) |
| `src/components/examiner/StudentDashboard.tsx` | Journey wizard "Ask AI Tutor" button calls `onMode("ai-tutor")` |

## Journey Wizard Integration

When a journey step has an `aiTutorTopic` field (e.g., "Setting up VS Code, Git, and LocalWP"), the "Ask AI Tutor" button switches to the AI Tutor tab. The topic context is available for the tutor to use.

## Admin Access

Admins can access the AI Tutor via the sidebar (visible to all roles: student, teacher, admin).
