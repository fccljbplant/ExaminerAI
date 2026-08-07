#!/usr/bin/env bash
# Vercel build script for TraineesAI
set -e

echo "=== TraineesAI Vercel Build ==="

# Step 1: Generate Prisma client using prod schema
echo "Generating Prisma client (prod schema)..."
npx prisma generate --schema=prisma/schema.prod.prisma

# Step 2: Push schema to DB
echo "Syncing schema (data preserved)..."
npx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss --skip-generate

# Step 3: Seed marketplace metadata on existing courses
echo "Seeding marketplace metadata..."
node scripts/seed-marketplace-prod.js || echo "Seed skipped (already done or error)"

# Step 4: Build Next.js
echo "Building Next.js..."
npx next build

echo "Vercel build complete!"
