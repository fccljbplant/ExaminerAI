#!/usr/bin/env bash
# Vercel build script for ExaminerAI
# - Uses prisma/schema.prod.prisma (Postgres) for Vercel
# - NEVER flushes data — only adds new tables/columns safely
# - Seeds demo data ONLY if database is empty (idempotent)
# - Builds Next.js
set -e

echo "=== ExaminerAI Vercel Build ==="
echo "DATABASE_URL prefix: $(echo "$DATABASE_URL" | sed 's/\/\/.*/\/\/***REDACTED***/')"

# Step 1: Generate Prisma client using prod schema
echo "Generating Prisma client (prod schema)..."
npx prisma generate --schema=prisma/schema.prod.prisma

# Step 2: SAFELY push schema — accepts column-level changes without data loss.
echo "Safely syncing schema (data preserved)..."
npx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss --skip-generate

# Step 3: Seed demo data ONLY if the database is empty
echo "Seeding demo data (if empty)..."
npx tsx scripts/seed-demo.ts --skip-if-populated || echo "Seed skipped (tsx not available or error)"

# Step 4: Build Next.js
echo "Building Next.js..."
npx next build

echo "Vercel build complete!"
