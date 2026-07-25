#!/usr/bin/env python3
"""Add UserRole.DEVELOPER to all requireRole calls that are missing it."""
import re
import os
import glob

FILES_TO_FIX = [
    "src/app/api/access-grants/route.ts",
    "src/app/api/audit-log/route.ts",
    "src/app/api/batches/question-outliers/route.ts",
    "src/app/api/events/route.ts",
    "src/app/api/grades/override/route.ts",
    "src/app/api/group-tasks/route.ts",
    "src/app/api/mentorship/case-review/route.ts",
    "src/app/api/messages/outreach/route.ts",
    "src/app/api/psych-evidence/route.ts",
    "src/app/api/teacher/assistant/route.ts",
    "src/app/api/teacher/load/route.ts",
    "src/app/api/teacher/rules/route.ts",
    "src/app/api/teacher/topic-guidance/route.ts",
    "src/app/api/users/[id]/approve/route.ts",
    "src/app/api/users/[id]/role/route.ts",
    "src/app/api/users/batch-approve/route.ts",
]

for filepath in FILES_TO_FIX:
    if not os.path.exists(filepath):
        print(f"SKIP (missing): {filepath}")
        continue

    with open(filepath, 'r') as f:
        content = f.read()

    if 'UserRole.DEVELOPER' in content:
        print(f"SKIP (already has DEVELOPER): {filepath}")
        continue

    # Find all requireRole([...]) calls and add DEVELOPER
    # Pattern: requireRole([UserRole.XXX, UserRole.YYY, ...])
    # We add UserRole.DEVELOPER before the closing ])

    def add_developer(match):
        roles_str = match.group(1)
        # Don't add if already has DEVELOPER
        if 'DEVELOPER' in roles_str:
            return match.group(0)
        # Add DEVELOPER at the end
        # Handle trailing comma or no comma
        roles_str = roles_str.rstrip()
        if roles_str.endswith(','):
            roles_str += ' UserRole.DEVELOPER'
        else:
            roles_str += ', UserRole.DEVELOPER'
        return f'requireRole([{roles_str}])'

    new_content = re.sub(
        r'requireRole\(\[([^\]]+)\]\)',
        add_developer,
        content
    )

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"✓ Fixed: {filepath}")
    else:
        print(f"SKIP (no changes): {filepath}")

print("\nDone!")
