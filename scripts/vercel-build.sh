#!/usr/bin/env bash
# Vercel build script — auto-detects DB type and sets up everything
# Used as the `vercel-build` script in package.json
set -e

echo "=== ExaminerAI Vercel Build ==="
echo "DATABASE_URL prefix: $(echo "$DATABASE_URL" | sed 's/\/\/.*/\/\/***REDACTED***/')"

# Step 1: Detect DB provider from DATABASE_URL
if [[ "$DATABASE_URL" == postgres://* ]] || [[ "$DATABASE_URL" == postgresql://* ]]; then
  echo "📦 Detected PostgreSQL — updating schema provider"
  sed -i 's|provider = "sqlite"|provider = "postgresql"|' prisma/schema.prisma
elif [[ "$DATABASE_URL" == file:* ]]; then
  echo "📦 Detected SQLite (local dev mode) — keeping sqlite provider"
else
  echo "⚠️  Unknown DATABASE_URL format, defaulting to PostgreSQL"
  sed -i 's|provider = "sqlite"|provider = "postgresql"|' prisma/schema.prisma
fi

# Step 2: Generate Prisma client
echo "🔧 Generating Prisma client..."
bunx prisma generate

# Step 3: Push schema to DB (creates tables if needed)
echo "🗄️  Pushing schema to database..."
bunx prisma db push --accept-data-loss --skip-generate

# Step 4: Run seed (only if DB is empty — checked inside seed script)
echo "🌱 Seeding demo data (if DB is empty)..."
bun run scripts/seed.ts --if-empty 2>/dev/null || bun run scripts/seed.ts 2>/dev/null || echo "⚠️  Seed skipped (may already have data)"

# Step 5: Build Next.js
echo "🏗️  Building Next.js..."
bunx next build

echo "✅ Vercel build complete!"
