#!/usr/bin/env bash
# Vercel build script for TraineesAI
set -e

echo "=== TraineesAI Vercel Build ==="

# Step 1: Generate Prisma client using prod schema
echo "Generating Prisma client (prod schema)..."
npx prisma generate --schema=prisma/schema.prod.prisma

# Step 1b: Generate the SQLite demo client (demo accounts route to the
# bundled local demo db — the prod client is Postgres and can't open it)
echo "Generating demo (SQLite) client..."
npx prisma generate --schema=prisma/.demo.prisma

# Production schema changes are deliberately NOT applied during a Vercel
# build. A build is not a reviewed migration window: Prisma db push can
# alter production constraints/tables, and a non-blocking failure can leave
# the deployed application running against an unknown schema version.
# Apply a reviewed, versioned migration separately after backup, preflight,
# and explicit owner approval. Never add --accept-data-loss here.

# Step 2: Ensure admin + demo accounts exist (safe to run every build)
echo "Ensuring admin + demo accounts..."
timeout 60 node scripts/ensure-accounts.js || echo "⚠️  Account seeding failed (non-blocking)"

# NOTE (2026-08-17): the roleplay scenario library is lazily seeded at
# runtime (GET /api/v2/roleplay/scenarios → ensureRoleplayScenarios) — it
# does not need a build-time schema push.

# Step 3: Seed marketplace metadata on existing courses (non-blocking)
echo "Seeding marketplace metadata..."
timeout 60 node scripts/seed-marketplace-prod.js || echo "Seed skipped (already done or error)"
# Step 4: Build Next.js
echo "Building Next.js..."
npx next build

echo "Vercel build complete!"
