#!/usr/bin/env bash
# TraineesAI UI + backend audit — run BEFORE and AFTER cleanup.
# Usage: bash scripts/ui-backend-audit.sh
set -uo pipefail

H() { echo -e "\n\033[1;36m── $1\033[0m"; }

cd "$(dirname "$0")/.." || exit 1

H "A) DANGEROUS BUILD CONFIG"
grep -n "ignoreBuildErrors" next.config.ts 2>/dev/null || echo "  clean"
grep -n "reactStrictMode" next.config.ts 2>/dev/null || echo "  clean"

H "B) DEAD / REDIRECT UI (remove candidates)"
find src/components -name "*Redirect*" -o -name "*redirect*" 2>/dev/null | sed 's/^/  redirect hack: /' || echo "  clean"
git grep -ln "never rendered\|dead code\|DEPRECATED" -- src 2>/dev/null | sed 's/^/  dead marker: /' || echo "  clean"

H "C) OVERSIZED HEADINGS INSIDE APP PAGES (not landing)"
# Only flag actual oversized hero patterns (text-6xl/7xl in app pages).
# Scroll containers (max-h-[60vh]) and full-screen error fills (min-h-[60vh])
# are legitimate UI patterns, not heading bugs — exclude them.
git grep -n "text-6xl\|text-7xl\|text-8xl" -- "src/app/**" "src/components/**" 2>/dev/null \
  | grep -v "landing\|public\|not-found\|error" | sed 's/^/  oversized: /' || echo "  clean (text-6xl/7xl only in landing/error pages — OK)"

H "D) MISSING STATES (panels without skeleton/empty/error)"
echo "  skeleton usages: $(git grep -c 'SkeletonPanel\|animate-pulse' -- src/components 2>/dev/null | wc -l)"
echo "  empty-state usages: $(git grep -c 'EmptyState' -- src/components 2>/dev/null | wc -l)"

H "E) INTERRUPTING POPUPS"
# Only flag actual JSX usage (not comments). A JSX usage looks like
# `<DailyTaskReminder` — a comment would be `// DailyTaskReminder` or
# `* DailyTaskReminder`.
git grep -n "<DailyTaskReminder" -- src 2>/dev/null | sed 's/^/  popup ref: /' || echo "  clean (no JSX mounts — comment references are OK)"

H "F) BACKEND HYGIENE"
echo "  silent catches: $(git grep -c '\.catch(() => {})' -- src 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}')"
echo "  console.log:    $(git grep -c 'console.log\|console.error\|console.warn' -- src 2>/dev/null | grep -v logger.ts | awk -F: '{s+=$NF} END {print s+0}')"
echo "  any types:      $(git grep -c ': any\b\|as any\|<any>' -- src 2>/dev/null | grep -v node_modules | grep -v __tests__ | awk -F: '{s+=$NF} END {print s+0}')"
echo "  API routes without logger: $(find src/app/api -name 'route.ts' -exec sh -c 'grep -l "catch" {} 2>/dev/null' \; | while read f; do grep -q logger "$f" || echo "$f"; done | wc -l)"
git grep -n "15 questions\|questionCount: 15" -- src 2>/dev/null | sed 's/^/  test-count mismatch: /' || echo "  test-count clean"
git grep -ln "psychologyObs.create\|psychEvidence.create" -- src 2>/dev/null | sed 's/^/  psych write leftover: /' || echo "  psych writes clean"

H "G) SECURITY SWEEP"
echo "  ?userId routes: $(git grep -ln 'userId' -- 'src/app/api/**/route.ts' 2>/dev/null | wc -l)"
echo "  IDOR guards:    $(git grep -ln 'assertCanAccessStudent' -- src/app/api 2>/dev/null | wc -l)"
echo "  → every file in list 1 that serves another user's data needs a guard"

H "H) VERIFY GATES (must all pass before tagging release)"
echo "  npx tsc --noEmit && npm run lint && npm run test && npm run build"

echo
echo "Audit complete. Counts above zero are red lines to fix before release."
