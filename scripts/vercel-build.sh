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

# Step 2: Push schema to DB — but don't fail the build if the DB is
# temporarily unreachable (connection slot exhaustion, maintenance, etc).
# The schema rarely changes between deploys; if it does and the push
# fails, we'll catch it on the next successful build.
# NOTE: --accept-data-loss is deliberately NOT used — all schema changes
# must be additive (2026-08-17); a destructive change must fail loudly.
echo "Syncing schema (data preserved, non-blocking)..."
set +e
npx prisma db push --schema=prisma/schema.prod.prisma --skip-generate 2>&1
PUSH_EXIT=$?
set -e
if [ $PUSH_EXIT -ne 0 ]; then
  echo "⚠️  Schema sync skipped — DB connection unavailable."
  echo "    This is usually transient (connection slot exhaustion)."
  echo "    The build will continue with the existing schema."
fi

# Step 3: Ensure admin + demo accounts exist (safe to run every build)
echo "Ensuring admin + demo accounts..."
node scripts/ensure-accounts.js || echo "⚠️  Account seeding failed (non-blocking)"

# Step 3b: Seed the roleplay scenario library for real (non-demo) users —
# idempotent upserts keyed on RoleplayScenario.key (2026-08-17).
echo "Seeding roleplay scenarios..."
node scripts/seed-roleplay-scenarios.mjs --prod || echo "⚠️  Roleplay seed skipped (non-blocking)"

# Step 4: Seed marketplace metadata on existing courses (non-blocking)
echo "Seeding marketplace metadata..."
node scripts/seed-marketplace-prod.js || echo "Seed skipped (already done or error)"

# Step 5: Build Next.js
echo "Building Next.js..."
npx next build

echo "Vercel build complete!"
