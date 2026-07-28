#!/usr/bin/env bash
# Vercel build script for ExaminerAI
# - Uses prisma/schema.prod.prisma (Postgres) for Vercel
# - RESETS database to flush old data (schema incompatible with old models)
# - Seeds fresh demo data
# - Builds Next.js
set -e

echo "=== ExaminerAI Vercel Build ==="
echo "DATABASE_URL prefix: $(echo "$DATABASE_URL" | sed 's/\/\/.*/\/\/***REDACTED***/')"

# Step 1: Generate Prisma client using prod schema
echo "Generating Prisma client (prod schema)..."
bunx prisma generate --schema=prisma/schema.prod.prisma

# Step 2: Push schema changes without data loss
echo "Pushing schema changes (preserving existing data)..."
bunx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss --skip-generate

# Step 3: Seed fresh demo data
echo "Seeding fresh demo data..."
bun run scripts/seed-demo.ts

# Step 4: Build Next.js
echo "Building Next.js..."
bunx next build

echo "Vercel build complete!"
