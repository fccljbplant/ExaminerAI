#!/usr/bin/env python3
"""
fix-silent-catches.py — Replace .catch(() => {}) with logger.warn calls.

Finds patterns like:
  .catch(() => {})
  .catch(() => { /* ignore */ })
  .catch(() => { /* non-blocking */ })
  .catch(() => { /* silent */ })

Replaces with:
  .catch((err) => { logger.warn("Operation failed", { err }); })

Adds `import { logger } from "@/lib/logger";` if not already present.
"""

import os
import re
import sys

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return 0

    # Pattern: .catch(() => { ... }) where ... is a comment or empty
    # Also matches .catch(() => {}) with no body
    pattern = r'\.catch\(\(\)\s*=>\s*\{\s*(?:/\*[^*]*\*/)?\s*\}\)'

    matches = list(re.finditer(pattern, content))
    if not matches:
        return 0

    # Check if logger is already imported
    has_logger = 'from "@/lib/logger"' in content

    # Replace each match
    new_content = content
    for match in reversed(matches):  # reverse to preserve indices
        replacement = '.catch((err) => { logger.warn("Operation failed", { err }); })'
        new_content = new_content[:match.start()] + replacement + new_content[match.end():]

    # Add logger import if not present
    if not has_logger:
        # Find the last import line and add after it
        lines = new_content.split('\n')
        last_import = -1
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        if last_import >= 0:
            lines.insert(last_import + 1, 'import { logger } from "@/lib/logger";')
            new_content = '\n'.join(lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return len(matches)

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "src"
    total = 0
    files_changed = 0

    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '__pycache__')]
        for f in files:
            if not f.endswith(('.ts', '.tsx')):
                continue
            filepath = os.path.join(root, f)
            count = fix_file(filepath)
            if count > 0:
                total += count
                files_changed += 1
                print(f"  {os.path.relpath(filepath)}: {count} catches fixed")

    print(f"\nTotal: {total} silent catches fixed across {files_changed} files")

if __name__ == "__main__":
    main()
