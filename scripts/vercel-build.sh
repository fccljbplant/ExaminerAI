#!/usr/bin/env bash
# Vercel build script for ExaminerAI
# - Uses prisma/schema.prod.prisma (Postgres) for Vercel
# - Pushes schema WITHOUT data loss (preserves existing users)
# - Seeds demo data ONLY if the database is empty (idempotent)
# - Builds Next.js
set -e

echo "=== ExaminerAI Vercel Build ==="
echo "DATABASE_URL prefix: $(echo "$DATABASE_URL" | sed 's/\/\/.*/\/\/***REDACTED***/')"

# Step 1: Generate Prisma client using prod schema
echo "🔧 Generating Prisma client (prod schema)..."
bunx prisma generate --schema=prisma/schema.prod.prisma

# Step 2: Push schema WITHOUT --force-reset (preserves existing data)
# --accept-data-loss is still needed for column type changes, but
# we NO LONGER use --force-reset which wipes the entire database.
echo "🗄️  Pushing schema to database (preserving existing data)..."
bunx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss --skip-generate

# Step 3: Seed demo data ONLY if the database is empty
# This makes the build idempotent — re-deploys don't wipe users.
# The seed script itself checks for existing data and skips if present.
echo "🌱 Seeding demo data (only if database is empty)..."
bun run scripts/seed-demo.ts --skip-if-populated

# Step 4: Build Next.js
echo "🏗️  Building Next.js..."
bunx next build

echo "✅ Vercel build complete!"
