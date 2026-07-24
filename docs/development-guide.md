# Development Guide

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
# Edit .env — set DEEPSEEK_API_KEY for real AI, ADMIN_PASSWORD for admin

# 3. Push Prisma schema to SQLite (creates db/custom.db)
npm run db:push

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

Admin account is auto-created on first load (if `ADMIN_PASSWORD` is set):
- `admin@examiner.ai` / password from `ADMIN_PASSWORD` (defaults to `helloworld` in dev)

**Note:** The old `POST /api/seed` admin-login backdoor has been removed. Use `POST /api/auth/login` with admin credentials.

---

## Commands

```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint check
npm run db:push          # Push schema to SQLite (dev)
npm run db:push:prod     # Push schema to Postgres (prod)
npm run db:generate      # Regenerate Prisma client
```

---

## Deploying to Vercel

1. Create a free Neon database: https://neon.tech
2. Set env vars on Vercel (Settings → Environment Variables):
   - `DATABASE_URL` = Neon Postgres URL
   - `ADMIN_EMAIL` = admin email
   - `ADMIN_PASSWORD` = strong password
   - `JWT_SECRET` = `openssl rand -hex 32`
   - `DEEPSEEK_API_KEY` = DeepSeek API key
3. Push to GitHub — Vercel auto-deploys with build command:
   ```
   rm -f .env &&
   npx prisma generate --schema=prisma/schema.prod.prisma &&
   npx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss &&
   next build
   ```

AI routes have extended timeouts: `/api/ai/*` (60s), `/api/project/generate-tasks` (180s).

---

## Conventions

- **TypeScript strict** — no `any` in app code
- **ESLint** — must pass with zero errors
- **Imports** — ordered: React → external → `@/` internal
- **`"use client"`** — only on components using hooks or browser APIs
- **Error handling** — all API routes have try/catch, return proper HTTP status codes
- **Cascade deletes** — deleting any entity deletes its comments first

### API Route Pattern
```typescript
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
try {
  // ... handler logic ...
  return NextResponse.json({ data });
} catch (err) {
  console.error("[endpoint] failed:", err);
  return NextResponse.json({ error: "Failed", details: err.message }, { status: 500 });
}
```

---

## Production Checklist

- [ ] `npm run lint` passes with zero errors
- [ ] `DATABASE_URL` set to Postgres URL on Vercel
- [ ] `JWT_SECRET` set to a strong random value
- [ ] `ADMIN_PASSWORD` set (or admin login disabled)
- [ ] `DEEPSEEK_API_KEY` set (or falls back to z-ai sandbox)
- [ ] Vercel Authentication disabled (Settings → Deployment Protection)
