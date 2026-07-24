#!/usr/bin/env bash
# Vercel build script for ExaminerAI (original project)
# - Uses prisma/schema.prod.prisma (Postgres) for Vercel
# - Force-resets DB to apply schema cleanly
# - Runs the comprehensive demo seed
# - Builds Next.js
set -e

echo "=== ExaminerAI Vercel Build ==="
echo "DATABASE_URL prefix: $(echo "$DATABASE_URL" | sed 's/\/\/.*/\/\/***REDACTED***/')"

# Step 1: Generate Prisma client using prod schema
echo "🔧 Generating Prisma client (prod schema)..."
bunx prisma generate --schema=prisma/schema.prod.prisma

# Step 2: Force-reset DB and push schema (clean state for demo)
echo "🗄️  Pushing schema to database (force-reset for clean demo state)..."
bunx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss --force-reset --skip-generate

# Step 3: Run demo seed
echo "🌱 Seeding demo data (50 students, 2 courses, alerts, mentor sessions, etc.)..."
bun run scripts/seed-demo.ts

# Step 4: Build Next.js
echo "🏗️  Building Next.js..."
bunx next build

echo "✅ Vercel build complete!"
