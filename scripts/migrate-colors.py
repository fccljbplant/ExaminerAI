#!/usr/bin/env python3
"""
migrate-colors.py — Replace hardcoded Tailwind colors with theme tokens.

Maps:
  emerald (success/growth)    → growth-sage
  amber (attention/warning)   → growth-amber  
  rose/red (danger/error)     → destructive (for text) / destructive/10 (for bg)
  sky/blue (info)             → primary (or keep with dark: variant for decorative)

The growth-* tokens are defined in globals.css as our semantic palette:
  --growth-sage    = success, progress, growth
  --growth-amber   = attention, in-progress, energy
  --growth-coral   = alerts, needs-care (soft, not alarming red)

Usage: python3 scripts/migrate-colors.py [directory]
"""

import os
import re
import sys
from pathlib import Path

# ── Color mapping rules ────────────────────────────────────────────
# Each rule: (regex_pattern, replacement)
# Order matters — more specific patterns first.

RULES = [
    # ── EMERALD → GROWTH-SAGE (success/growth) ───────────────────
    # Text
    (r'\btext-emerald-600\b', 'text-growth-sage'),
    (r'\btext-emerald-500\b', 'text-growth-sage'),
    (r'\btext-emerald-700\b', 'text-growth-sage-foreground'),
    (r'\btext-emerald-400\b', 'text-growth-sage'),
    # Background (tinted → soft variant)
    (r'\bbg-emerald-50\b', 'bg-growth-sage-soft'),
    (r'\bbg-emerald-500/15\b', 'bg-growth-sage-soft'),
    (r'\bbg-emerald-500/10\b', 'bg-growth-sage-soft'),
    (r'\bbg-emerald-500/5\b', 'bg-growth-sage-soft'),
    (r'\bbg-emerald-100\b', 'bg-growth-sage-soft'),
    (r'\bbg-emerald-500\b', 'bg-growth-sage'),
    # Border
    (r'\bborder-emerald-500/30\b', 'border-growth-sage'),
    (r'\bborder-emerald-500/40\b', 'border-growth-sage'),
    (r'\bborder-emerald-300\b', 'border-growth-sage'),
    (r'\bborder-emerald-500/20\b', 'border-growth-sage'),
    # Ring
    (r'\bring-emerald-500\b', 'ring-growth-sage'),

    # ── AMBER → GROWTH-AMBER (attention/warning) ─────────────────
    # Text
    (r'\btext-amber-600\b', 'text-growth-amber'),
    (r'\btext-amber-500\b', 'text-growth-amber'),
    (r'\btext-amber-700\b', 'text-growth-amber-foreground'),
    (r'\btext-amber-400\b', 'text-growth-amber'),
    (r'\btext-amber-300\b', 'text-growth-amber'),
    # Background
    (r'\bbg-amber-50\b', 'bg-growth-amber-soft'),
    (r'\bbg-amber-500/15\b', 'bg-growth-amber-soft'),
    (r'\bbg-amber-500/10\b', 'bg-growth-amber-soft'),
    (r'\bbg-amber-500/5\b', 'bg-growth-amber-soft'),
    (r'\bbg-amber-100\b', 'bg-growth-amber-soft'),
    (r'\bbg-amber-500\b', 'bg-growth-amber'),
    # Border
    (r'\bborder-amber-500/30\b', 'border-growth-amber'),
    (r'\bborder-amber-500/40\b', 'border-growth-amber'),
    (r'\bborder-amber-300\b', 'border-growth-amber'),
    (r'\bborder-amber-500/20\b', 'border-growth-amber'),
    (r'\bborder-amber-500/50\b', 'border-growth-amber'),
    # Ring
    (r'\bring-amber-500\b', 'ring-growth-amber'),

    # ── ROSE/RED → DESTRUCTIVE (danger/error) ────────────────────
    # Text
    (r'\btext-rose-600\b', 'text-destructive'),
    (r'\btext-rose-500\b', 'text-destructive'),
    (r'\btext-rose-700\b', 'text-destructive'),
    (r'\btext-rose-400\b', 'text-destructive'),
    (r'\btext-rose-200\b', 'text-destructive/70'),
    (r'\btext-rose-200/70\b', 'text-destructive/70'),
    (r'\btext-red-600\b', 'text-destructive'),
    (r'\btext-red-500\b', 'text-destructive'),
    (r'\btext-red-700\b', 'text-destructive'),
    (r'\btext-red-400\b', 'text-destructive'),
    # Background
    (r'\bbg-rose-50\b', 'bg-destructive/5'),
    (r'\bbg-rose-500/15\b', 'bg-destructive/5'),
    (r'\bbg-rose-500/10\b', 'bg-destructive/5'),
    (r'\bbg-rose-500/5\b', 'bg-destructive/5'),
    (r'\bbg-rose-100\b', 'bg-destructive/5'),
    (r'\bbg-red-50\b', 'bg-destructive/5'),
    (r'\bbg-red-500/15\b', 'bg-destructive/5'),
    (r'\bbg-red-500/10\b', 'bg-destructive/5'),
    (r'\bbg-red-500/5\b', 'bg-destructive/5'),
    (r'\bbg-rose-400/30\b', 'bg-destructive/10'),
    # Border
    (r'\bborder-rose-500/30\b', 'border-destructive/30'),
    (r'\bborder-rose-500/40\b', 'border-destructive/30'),
    (r'\bborder-rose-400/30\b', 'border-destructive/30'),
    (r'\bborder-rose-300\b', 'border-destructive/30'),
    (r'\bborder-red-500/30\b', 'border-destructive/30'),
    (r'\bborder-red-300\b', 'border-destructive/30'),
    (r'\bborder-rose-500/20\b', 'border-destructive/20'),
    # Ring
    (r'\bring-rose-500\b', 'ring-destructive'),
    (r'\bring-red-500\b', 'ring-destructive'),

    # ── ROSE/RED with dark: variants → simplify to destructive ───
    (r'\btext-rose-600 dark:text-rose-400\b', 'text-destructive'),
    (r'\btext-rose-600 dark:text-rose-300\b', 'text-destructive'),
    (r'\btext-red-600 dark:text-red-400\b', 'text-destructive'),
    (r'\btext-red-600 dark:text-red-300\b', 'text-destructive'),

    # ── EMERALD with dark: variants → simplify to growth-sage ─────
    (r'\btext-emerald-600 dark:text-emerald-400\b', 'text-growth-sage'),
    (r'\btext-emerald-600 dark:text-emerald-300\b', 'text-growth-sage'),
    (r'\btext-emerald-500 dark:text-emerald-400\b', 'text-growth-sage'),

    # ── AMBER with dark: variants → simplify to growth-amber ──────
    (r'\btext-amber-600 dark:text-amber-400\b', 'text-growth-amber'),
    (r'\btext-amber-600 dark:text-amber-300\b', 'text-growth-amber'),
    (r'\btext-amber-500 dark:text-amber-400\b', 'text-growth-amber'),
]

# Compile all rules
COMPILED_RULES = [(re.compile(p), r) for p, r in RULES]

def migrate_file(filepath: str) -> tuple[int, int]:
    """Migrate colors in a single file. Returns (replacements_made, lines_changed)."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return (0, 0)
    
    original = content
    total_replacements = 0
    
    for pattern, replacement in COMPILED_RULES:
        new_content, count = pattern.subn(replacement, content)
        content = new_content
        total_replacements += count
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        # Count lines that changed
        changed_lines = sum(
            1 for o, n in zip(original.splitlines(), content.splitlines()) if o != n
        )
        return (total_replacements, changed_lines)
    
    return (0, 0)

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "src/components/examiner"
    
    if not os.path.isdir(target_dir):
        print(f"Error: {target_dir} is not a directory")
        sys.exit(1)
    
    print(f"Migrating hardcoded colors → theme tokens in {target_dir}/")
    print(f"  emerald → growth-sage (success/growth)")
    print(f"  amber   → growth-amber (attention/warning)")
    print(f"  rose/red → destructive (danger/error)")
    print()
    
    total_files_changed = 0
    total_replacements = 0
    file_stats = []
    
    for root, dirs, files in os.walk(target_dir):
        # Skip node_modules, .next, etc.
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '__pycache__')]
        
        for filename in files:
            if not filename.endswith(('.tsx', '.ts')):
                continue
            
            filepath = os.path.join(root, filename)
            replacements, lines_changed = migrate_file(filepath)
            
            if replacements > 0:
                total_files_changed += 1
                total_replacements += replacements
                rel_path = os.path.relpath(filepath, '.')
                file_stats.append((rel_path, replacements, lines_changed))
    
    # Sort by most replacements
    file_stats.sort(key=lambda x: x[1], reverse=True)
    
    print(f"{'File':<65} {'Replacements':>12} {'Lines':>8}")
    print("-" * 88)
    for path, reps, lines in file_stats[:30]:
        print(f"{path:<65} {reps:>12} {lines:>8}")
    if len(file_stats) > 30:
        print(f"... and {len(file_stats) - 30} more files")
    print("-" * 88)
    print(f"Total: {total_replacements} replacements across {total_files_changed} files")
    print()
    print("NOTE: Review the changes. Some semantic mappings may need manual")
    print("adjustment (e.g. decorative blue/violet colors were left as-is).")

if __name__ == "__main__":
    main()
