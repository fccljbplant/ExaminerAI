#!/usr/bin/env python3
"""Add demo-write guard to API route handlers, handling multi-line function signatures."""
import re
import os
import sys

FILES = {
    "src/app/api/users/route.ts": "creating users",
    "src/app/api/users/[id]/route.ts": "editing users",
    "src/app/api/users/[id]/approve/route.ts": "approving users",
    "src/app/api/users/[id]/block/route.ts": "blocking users",
    "src/app/api/users/[id]/role/route.ts": "changing user roles",
    "src/app/api/users/batch-approve/route.ts": "batch-approving users",
    "src/app/api/courses/route.ts": "creating courses",
    "src/app/api/courses/[id]/route.ts": "editing courses",
    "src/app/api/courses/generate/route.ts": "generating courses",
    "src/app/api/grades/override/route.ts": "overriding grades",
    "src/app/api/comments/route.ts": "posting comments",
    "src/app/api/events/route.ts": "creating events",
    "src/app/api/group-tasks/route.ts": "managing group tasks",
    "src/app/api/group-tasks/submit/route.ts": "submitting group tasks",
    "src/app/api/batches/route.ts": "creating batches",
    "src/app/api/batches/[id]/route.ts": "editing batches",
    "src/app/api/batches/[id]/duplicate/route.ts": "duplicating batches",
    "src/app/api/batches/[id]/teachers/route.ts": "managing batch teachers",
}

def add_guard(filepath, action):
    with open(filepath, 'r') as f:
        content = f.read()

    if 'demoWriteBlock' in content:
        return "SKIP (already guarded)"

    # Add import after the last import line
    lines = content.split('\n')
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import = i
    if last_import == 0:
        return "SKIP (no imports)"
    lines.insert(last_import + 1, 'import { demoWriteBlock } from "@/lib/demo-guard";')

    # Rejoin
    content = '\n'.join(lines)

    # For each write method, find the function and insert guard after the opening brace
    for method in ['POST', 'PUT', 'PATCH', 'DELETE']:
        # Pattern: export async function METHOD( ... ) {
        # The { could be on the same line or after the closing paren
        pattern = rf'(export async function {method}\([^)]*\)[^\n]*\{{)'
        # Try same-line brace
        match = re.search(pattern, content)
        if match:
            insert_pos = match.end()
            guard = f'\n  const _demoBlock = await demoWriteBlock("{action}"); if (_demoBlock) return _demoBlock;'
            content = content[:insert_pos] + guard + content[insert_pos:]
            continue

        # Multi-line: find the function signature, then the first { after it
        pattern2 = rf'(export async function {method}\()'
        match2 = re.search(pattern2, content)
        if match2:
            # Find the closing ) and then {
            start = match2.end()
            # Find matching closing paren (handle nested parens)
            depth = 1
            i = start
            while i < len(content) and depth > 0:
                if content[i] == '(':
                    depth += 1
                elif content[i] == ')':
                    depth -= 1
                i += 1
            # Now find the first { after the closing paren
            brace_pos = content.find('{', i)
            if brace_pos != -1:
                insert_pos = brace_pos + 1
                guard = f'\n  const _demoBlock = await demoWriteBlock("{action}"); if (_demoBlock) return _demoBlock;'
                content = content[:insert_pos] + guard + content[insert_pos:]

    with open(filepath, 'w') as f:
        f.write(content)
    return "✓ Guarded"


for filepath, action in FILES.items():
    if not os.path.exists(filepath):
        print(f"SKIP (missing): {filepath}")
        continue
    result = add_guard(filepath, action)
    print(f"{result}: {filepath}")
