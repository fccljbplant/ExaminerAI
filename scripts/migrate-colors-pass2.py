#!/usr/bin/env python3
"""
migrate-colors-pass2.py — Remove redundant dark: overrides.

After pass 1, many elements have:
  text-growth-sage-foreground dark:text-emerald-300

The `dark:text-emerald-300` is redundant because --growth-sage-foreground
already has a dark-mode value baked into the CSS variable. This script
strips the redundant overrides.

Also fixes:
  dark:text-rose-300 / dark:text-rose-400 → remove (use text-destructive)
  dark:bg-rose-950/30 → remove (use bg-destructive/5)
  dark:bg-emerald-950/40 → remove (use bg-growth-sage-soft)
  dark:border-rose-800 → remove (use border-destructive/30)
"""

import os
import re
import sys

RULES = [
    # Remove redundant dark: emerald overrides (sage handles both modes)
    (r' text-growth-sage-foreground dark:text-emerald-300\b', ' text-growth-sage-foreground'),
    (r'text-growth-sage-foreground dark:text-emerald-300\b', 'text-growth-sage-foreground'),
    (r' dark:text-emerald-300 text-growth-sage-foreground\b', ' text-growth-sage-foreground'),
    (r' dark:bg-emerald-950/40\b', ''),
    (r'dark:bg-emerald-950/40\b', ''),
    
    # Remove redundant dark: rose overrides (destructive handles both modes)
    (r' text-destructive dark:text-rose-300\b', ' text-destructive'),
    (r'text-destructive dark:text-rose-300\b', 'text-destructive'),
    (r' text-destructive dark:text-rose-400\b', ' text-destructive'),
    (r'text-destructive dark:text-rose-300/70\b', ' text-destructive/70'),
    (r' dark:bg-rose-950/30\b', ''),
    (r'dark:bg-rose-950/30\b', ''),
    (r' dark:border-rose-800\b', ''),
    (r'dark:border-rose-800\b', ''),
    (r' dark:border-rose-700\b', ''),
    (r'dark:border-rose-700\b', ''),
    
    # Remove redundant dark: amber overrides
    (r' text-growth-amber dark:text-amber-400\b', ' text-growth-amber'),
    (r'text-growth-amber dark:text-amber-400\b', 'text-growth-amber'),
    (r' text-growth-amber-foreground dark:text-amber-300\b', ' text-growth-amber-foreground'),
    (r'text-growth-amber-foreground dark:text-amber-300\b', 'text-growth-amber-foreground'),
    
    # Remove redundant dark: blue overrides (if paired with text-primary)
    (r' text-primary dark:text-blue-400\b', ' text-primary'),
    (r'text-primary dark:text-blue-400\b', 'text-primary'),
]

COMPILED = [(re.compile(p), r) for p, r in RULES]

def migrate_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return 0
    
    original = content
    total = 0
    for pattern, replacement in COMPILED:
        content, count = pattern.subn(replacement, content)
        total += count
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return total
    return 0

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "src"
    total = 0
    files_changed = 0
    
    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '__pycache__')]
        for f in files:
            if not f.endswith(('.tsx', '.ts')):
                continue
            path = os.path.join(root, f)
            count = migrate_file(path)
            if count > 0:
                total += count
                files_changed += 1
                print(f"  {os.path.relpath(path)}: {count} overrides removed")
    
    print(f"\nTotal: {total} redundant dark: overrides removed across {files_changed} files")

if __name__ == "__main__":
    main()
