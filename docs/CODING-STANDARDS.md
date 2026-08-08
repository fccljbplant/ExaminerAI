# TraineesAI · Coding Standards

> **The definitive coding conventions for this project.**
> Every PR must follow these rules. Reviewers reject violations.
> Updated: August 2026

---

## 1. Project structure

### 1.1 The module pattern

Every feature lives in `src/modules/<feature>/`. A module has:

```
src/modules/<feature>/
  ├── index.ts           ← Barrel file — the public API
  ├── lib/               ← Pure logic (no React, no DOM)
  │   ├── <feature>.ts
  │   └── <feature>-helpers.ts
  └── components/        ← React components (UI only)
      ├── <Component>.tsx
      └── <Component>.test.tsx
```

**Rules**:
- `index.ts` re-exports the public API. Consumers import from `@/modules/<feature>`, never from internal paths.
- `lib/` has NO React imports. Pure TypeScript — testable, tree-shakeable.
- `components/` has NO business logic. They call `lib/` functions, render UI, handle user events.
- A module NEVER imports from another module's internal files — only from its `index.ts`.

### 1.2 What lives where

| Location | What | Example |
|---|---|---|
| `src/modules/<feature>/lib/` | Business logic, DB queries, AI calls | `learner-xp.ts`, `course-db.ts` |
| `src/modules/<feature>/components/` | React components for that feature | `LearnerXPBar.tsx`, `B2BPanel.tsx` |
| `src/app/api/` | Next.js API route handlers (thin — call lib, return JSON) | `route.ts` |
| `src/app/(public)/` | Public-facing pages (landing, courses, pricing) | `page.tsx` |
| `src/app/app/` | The authenticated app shell | `page.tsx` |
| `src/components/ui/` | shadcn/ui primitives (shared across ALL modules) | `button.tsx`, `card.tsx` |
| `src/components/shared/` | Cross-module shared components (used by 2+ modules) | `stat-card.tsx`, `dashboard-shell.tsx` |
| `src/lib/` | Cross-module infrastructure (auth, db, logger, utils) | `auth.ts`, `db.ts`, `logger.ts` |
| `src/content/` | Centralized copy/voice constants | `copy.ts` |

### 1.3 What does NOT belong in `src/lib/`

**Feature-specific logic** does NOT belong in `src/lib/`. If it's only used by one module, it goes in that module's `lib/`.

| Wrong | Right |
|---|---|
| `src/lib/learner-xp.ts` | `src/modules/gamification/lib/learner-xp.ts` |
| `src/lib/course-db.ts` | `src/modules/course/lib/course-db.ts` |
| `src/lib/ai-provider.ts` | `src/modules/assessment/lib/ai-provider.ts` |

**Cross-module infrastructure** stays in `src/lib/`:
- `auth.ts` — JWT, password hashing, getCurrentUser
- `db.ts` — Prisma client
- `logger.ts` — structured logger
- `rbac.ts` — role definitions
- `utils.ts` — cn(), formatters
- `constants.ts` — TEST_QUESTION_COUNT, GRADING, MARKETPLACE_CATEGORIES

---

## 2. TypeScript rules

### 2.1 No `any`

`any` is forbidden. Use `unknown` + type narrowing, or define a proper interface.

```ts
// ❌ BAD
function processData(data: any) { return data.users; }

// ✅ GOOD
interface UserData { users: User[] }
function processData(data: unknown): User[] {
  if (typeof data !== "object" || data === null) return [];
  const { users } = data as UserData;
  return Array.isArray(users) ? users : [];
}
```

### 2.2 Explicit return types on exported functions

```ts
// ❌ BAD — implicit return type
export function getUser(id: string) {
  return db.user.findUnique({ where: { id } });
}

// ✅ GOOD — explicit return type
export async function getUser(id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}
```

### 2.3 Interface vs type

- Use `interface` for object shapes (extensible, better error messages).
- Use `type` for unions, intersections, utility types.

```ts
// ✅ interface for object shapes
interface User { id: string; name: string; }

// ✅ type for unions
type Role = "learner" | "instructor" | "org_admin" | "platform_admin";
```

---

## 3. Error handling

### 3.1 No silent catches

`.catch(() => {})` is forbidden. Every catch must log.

```ts
// ❌ BAD
fetch("/api/foo").then(...).catch(() => {});

// ✅ GOOD
import { logger } from "@/lib/logger";
fetch("/api/foo")
  .then(...)
  .catch((err) => {
    logger.warn("Foo fetch failed", { err });
  });
```

### 3.2 API routes return structured errors

```ts
// ✅ GOOD
return NextResponse.json(
  { error: "Course not found", code: "NOT_FOUND" },
  { status: 404 }
);
```

### 3.3 Frontend shows ErrorState, not blank screens

Every data-loading component handles: loading → skeleton, error → retry, empty → CTA.

---

## 4. React rules

### 4.1 "use client" directive

Every file that uses hooks (useState, useEffect, etc.) OR event handlers (onClick) MUST start with `"use client"`.

### 4.2 Server components by default

Default to server components. Only add "use client" when you need interactivity.

### 4.3 No inline styles for layout

Use Tailwind classes. Inline styles only for dynamic values (e.g., `style={{ width: `${progress}%` }}`).

### 4.4 Props interface defined above component

```tsx
// ✅ GOOD
interface ButtonProps {
  variant: "primary" | "outline";
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ variant, onClick, children }: ButtonProps) { ... }
```

---

## 5. Color + theme rules

### 5.1 No hardcoded Tailwind palette colors

Never use `text-emerald-600`, `bg-amber-500`, `text-rose-600`, etc. Use the global theme tokens:

| Hardcoded | Theme token | Use |
|---|---|---|
| `text-emerald-600` | `text-growth-sage` | Success |
| `text-amber-600` | `text-growth-amber` | Warning |
| `text-rose-600` | `text-destructive` | Error |
| `bg-emerald-600` | `bg-primary` | Primary button |

The migration script (`scripts/migrate-colors.py`) enforces this.

### 5.2 No `dark:` overrides for semantic colors

The CSS variables in `globals.css` already have light/dark variants. `text-growth-sage` works in both modes — no `dark:text-growth-sage` needed.

---

## 6. API route rules

### 6.1 Thin handlers

API routes are thin — they validate input, call lib functions, return JSON. No business logic in routes.

```ts
// ✅ GOOD — thin handler
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = await awardXP({ userId: user.id, reason: body.reason });
  return NextResponse.json(result);
}
```

### 6.2 Auth check first

Every route starts with auth:

```ts
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### 6.3 Rate limit on public endpoints

```ts
const ip = getClientIp(req);
if (!checkRateLimit(`signup:${ip}`, 3, 3_600_000)) {
  return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
}
```

---

## 7. Commenting rules

### 7.1 File header

Every file starts with a one-line description:

```ts
// src/modules/gamification/lib/learner-xp.ts — Evidence-Locked XP system.
```

### 7.2 Why, not what

Comments explain WHY, not WHAT. The code shows what; comments show why.

```ts
// ❌ BAD — describes what the code does
// Increment the counter
counter++;

// ✅ GOOD — explains why
// Idempotency check: if the same test ID has already been awarded,
// skip — prevents double-XP on webhook retry or page refresh.
if (refId && existingAwards.has(refId)) return null;
```

### 7.3 JSDoc on exported functions

```ts
/**
 * Award XP to a learner. Idempotent — safe to call multiple times.
 *
 * @param params.userId - The learner's user ID
 * @param params.reason - Why the XP is being awarded
 * @param params.refId - Optional dedupe key (e.g., test ID)
 * @returns The award result, or null if already awarded
 */
export async function awardXP(params: { userId: string; reason: XPAwardReason; refId?: string }): Promise<{ awarded: number; newTotal: number; level: Level } | null> {
```

---

## 8. Naming conventions

| Element | Convention | Example |
|---|---|---|
| Files (components) | PascalCase.tsx | `LearnerXPBar.tsx` |
| Files (lib) | kebab-case.ts | `learner-xp.ts` |
| Files (API routes) | route.ts | `route.ts` |
| Functions | camelCase | `awardXP()` |
| Components | PascalCase | `<LearnerXPBar />` |
| Types/Interfaces | PascalCase | `interface BadgeDef` |
| Constants | UPPER_SNAKE | `XP_AWARDS` |
| CSS variables | kebab-case | `--growth-sage` |

---

## 9. Import order

```ts
// 1. React/Next
import { useState, useEffect } from "react";
import Link from "next/link";

// 2. External libraries
import { z } from "zod";
import { toast } from "sonner";

// 3. Internal lib
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// 4. Internal modules
import { awardXP } from "@/modules/gamification";
import { B2BPanel } from "@/modules/b2b";

// 5. UI components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// 6. Types
import type { User } from "@/lib/auth";
```

---

## 10. Git commit rules

### Commit message format

```
type: short description

Longer description explaining what changed and why.
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

```
feat: add badge system with 18 evidence-locked badges

fix: remove duplicate 'Students' nav entry for instructors

refactor: modularize B2B/B2C/gamification into src/modules/

docs: update all 5 living docs + eslint --fix cleanup
```

---

## 11. The audit gate

Before merging, run:

```bash
bash scripts/ui-backend-audit.sh
```

Every count above zero is a red line. The script checks:
- Build config safe (`ignoreBuildErrors: false`, `reactStrictMode: true`)
- No dead/redirect components
- No oversized headings in app pages
- States kit adoption
- No interrupting popups
- No silent catches, no `console.log`, no test-count mismatch
- IDOR guards on `?userId` routes

---

## 12. Living docs

| Doc | Purpose |
|---|---|
| `CODING-STANDARDS.md` (this file) | How to write code in this project |
| `PROJECT-STRUCTURE.md` | Directory map — where everything lives |
| `BLUEPRINT.md` | Product vision, roles, features, roadmap |
| `ARCHITECTURE.md` | Module map, API inventory, data model, AI chain |
| `LOGIC-CALCULATIONS.md` | Every formula, one source of truth |
| `ERROR-HANDLING.md` | Failure policy: degraded mode, no silent catches |
| `UI-STANDARDS.md` | Header rule (96px), spacing grid, color system |
