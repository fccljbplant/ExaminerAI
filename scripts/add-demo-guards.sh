#!/usr/bin/env bash
# Adds demo-write guard to key API write endpoints.
# For each file, adds: import { demoWriteBlock } from "@/lib/demo-guard";
# And at the start of each write handler: const _demo = await demoWriteBlock("..."); if (_demo) return _demo;
set -e

declare -A FILES
FILES["src/app/api/users/route.ts"]="creating users"
FILES["src/app/api/users/[id]/route.ts"]="editing users"
FILES["src/app/api/users/[id]/approve/route.ts"]="approving users"
FILES["src/app/api/users/[id]/block/route.ts"]="blocking users"
FILES["src/app/api/users/[id]/role/route.ts"]="changing user roles"
FILES["src/app/api/users/batch-approve/route.ts"]="batch-approving users"
FILES["src/app/api/courses/route.ts"]="creating courses"
FILES["src/app/api/courses/[id]/route.ts"]="editing courses"
FILES["src/app/api/courses/generate/route.ts"]="generating courses"
FILES["src/app/api/grades/override/route.ts"]="overriding grades"
FILES["src/app/api/comments/route.ts"]="posting comments"
FILES["src/app/api/events/route.ts"]="creating events"
FILES["src/app/api/group-tasks/route.ts"]="managing group tasks"
FILES["src/app/api/group-tasks/submit/route.ts"]="submitting group tasks"
FILES["src/app/api/batches/route.ts"]="creating batches"
FILES["src/app/api/batches/[id]/route.ts"]="editing batches"
FILES["src/app/api/batches/[id]/duplicate/route.ts"]="duplicating batches"
FILES["src/app/api/batches/[id]/teachers/route.ts"]="managing batch teachers"

for f in "${!FILES[@]}"; do
  action="${FILES[$f]}"
  if [ ! -f "$f" ]; then
    echo "SKIP (missing): $f"
    continue
  fi
  if grep -q "demoWriteBlock" "$f"; then
    echo "SKIP (already guarded): $f"
    continue
  fi

  # Add import at the top (after the last existing import line)
  # Find the last import line
  LAST_IMPORT=$(grep -n "^import " "$f" | tail -1 | cut -d: -f1)
  if [ -z "$LAST_IMPORT" ]; then
    echo "SKIP (no imports found): $f"
    continue
  fi

  # Insert the import after the last import
  sed -i "${LAST_IMPORT}a\\import { demoWriteBlock } from \"@/lib/demo-guard\";" "$f"

  # For each write handler (POST/PUT/PATCH/DELETE), add the guard right after the opening brace
  # We need to find lines like: export async function POST(req: Request) {
  # and insert the guard on the next line
  for METHOD in POST PUT PATCH DELETE; do
    # Find the line number of the handler
    while IFS= read -r line_num; do
      [ -z "$line_num" ] && continue
      # Insert the guard after the opening brace (which is on the same line typically)
      # The guard line:
      GUARD="  const _demoBlock = await demoWriteBlock(\"${action}\"); if (_demoBlock) return _demoBlock;"
      sed -i "${line_num}a\\${GUARD}" "$f"
    done < <(grep -n "export async function ${METHOD}" "$f" | cut -d: -f1)
  done

  echo "✓ Guarded: $f"
done

echo ""
echo "Done! Demo guard added to key write endpoints."
