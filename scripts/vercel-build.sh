#!/usr/bin/env bash
# Vercel build script for TraineesAI.
# IMPORTANT: builds are intentionally read-only with respect to application data.
# Database migrations and development/bootstrap seeds must be run explicitly
# through reviewed operational workflows, never as a side effect of deployment.
set -euo pipefail

echo "=== TraineesAI Vercel Build (read-only) ==="

echo "Generating Prisma client (prod schema)..."
npx prisma generate --schema=prisma/schema.prod.prisma

echo "Generating demo (SQLite) client..."
npx prisma generate --schema=prisma/.demo.prisma

echo "Building Next.js..."
npx next build

echo "Vercel build complete!"
