#!/usr/bin/env python3
"""Migrate the remaining learn surfaces (4 classroom panels + LearnerHome)
from the legacy shadcn token system to the v2 tokens (UI-STANDARDS §12).

Class-by-class, order matters (longest first). Idempotent: running it
twice changes nothing the second time. After this, no legacy token
classes remain outside src/components/ui and modules/ui.
"""
import re
import sys

FILES = [
    "src/components/learn/panels/JourneyPanel.tsx",
    "src/components/learn/panels/ProjectPanel.tsx",
    "src/components/learn/panels/GrowPanel.tsx",
    "src/components/learn/panels/LibraryPanel.tsx",
    "src/modules/learn/components/dashboard/LearnerHome.tsx",
]

# legacy class -> v2 class. Word-boundary replaced, longest-first where
# one class name contains another (bg-primary-foreground vs bg-primary).
REPLACEMENTS = [
    ("bg-primary-foreground", "bg-brand"),
    ("text-primary-foreground", "text-on-brand"),
    ("hover:bg-primary/90", "hover:bg-brand-hover"),
    ("bg-primary/10", "bg-brand-subtle"),
    ("bg-primary/5", "bg-brand-subtle"),
    ("ring-primary/30", "ring-brand/30"),
    ("hover:text-primary", "hover:text-brand"),
    ("text-primary", "text-brand"),
    ("bg-primary", "bg-brand"),
    ("border-primary", "border-brand"),
    ("text-muted-foreground", "text-fg-muted"),
    ("bg-muted/60", "bg-bg-subtle/60"),
    ("hover:bg-muted", "hover:bg-bg-subtle"),
    ("hover:bg-muted/60", "hover:bg-bg-subtle/60"),
    ("bg-muted", "bg-bg-subtle"),
    ("text-foreground", "text-fg"),
    ("bg-background", "bg-bg"),
    ("hover:bg-accent", "hover:bg-bg-subtle"),
    ("bg-accent/50", "bg-bg-subtle/50"),
    ("bg-accent", "bg-bg-subtle"),
    ("text-accent-foreground", "text-fg"),
    ("bg-card", "bg-surface"),
    ("border-input", "border-line"),
    ("border-ring", "border-line-strong"),
    ("ring-ring", "ring-line-strong"),
    ("bg-popover", "bg-surface-overlay"),
    ("text-destructive", "text-danger-on"),
    ("bg-destructive", "bg-danger"),
    ("hover:bg-destructive/90", "hover:bg-danger/90"),
    ("border-destructive/40", "border-danger/40"),
    ("border-destructive", "border-danger"),
    ("focus:ring-2 focus:ring-primary", "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"),
    ("focus:ring-2 focus:ring-ring", "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"),
    ("focus:ring-2", "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"),
    ("focus:outline-none focus:ring-2", "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"),
]

# Focus ring: the v2 pattern. Appended to controls that lack any ring.
RING = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"


def migrate(path: str) -> int:
    with open(path) as f:
        src = f.read()
    orig = src
    for old, new in REPLACEMENTS:
        src = re.sub(rf"(?<![a-zA-Z0-9:/-]){re.escape(old)}(?![a-zA-Z0-9-])", new, src)
    if src != orig:
        with open(path, "w") as f:
            f.write(src)
    return sum(1 for a, b in REPLACEMENTS if b in src)


if __name__ == "__main__":
    for f in FILES:
        n = migrate(f)
        print(f"{f}: migrated, v2 token classes now present: {n}")
