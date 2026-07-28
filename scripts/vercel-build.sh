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
bunx prisma generate --schema=prisma/schema.prod.prisma

# Step 2: SAFELY push schema — NEVER force-reset, NEVER accept-data-loss.
# This will only ADD new tables and nullable columns.
# It will NEVER drop tables, columns, or modify existing data.
echo "Safely syncing schema (add-only, data preserved)..."
bunx prisma db push --schema=prisma/schema.prod.prisma --skip-generate

# Step 3: Seed demo data ONLY if the database is empty
# (idempotent — re-deploys never wipe or duplicate data)
echo "Seeding demo data (if empty)..."
bun run scripts/seed-demo.ts --skip-if-populated

# Step 4: Build Next.js
echo "Building Next.js..."
bunx next build

echo "Vercel build complete!"
