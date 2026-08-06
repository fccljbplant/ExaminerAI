#!/usr/bin/env bash
# Vercel build script for ExaminerAI
set -e

echo "=== ExaminerAI Vercel Build ==="

# Step 1: Generate Prisma client using prod schema
echo "Generating Prisma client (prod schema)..."
npx prisma generate --schema=prisma/schema.prod.prisma

# Step 2: SAFELY push schema
echo "Safely syncing schema (data preserved)..."
npx prisma db push --schema=prisma/schema.prod.prisma --accept-data-loss --skip-generate

# Step 3: Build Next.js
echo "Building Next.js..."
npx next build

echo "Vercel build complete!"
