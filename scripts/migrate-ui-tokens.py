#!/usr/bin/env python3
"""Migrate src/modules/ui (shared v2-era primitives) off the legacy
shadcn token classes onto the v2 tokens (UI-STANDARDS §12), the
strangler step documented in globals.css ("legacy vars KEPT for
strangulation, deleted at cutover REDESIGN-P5").

Visually neutral by construction: the v2 semantic tokens mirror the
legacy values (--brand == old --primary, --text-muted == old
--muted-foreground, --surface == old --card, ...) — verified against
src/modules/theme/tokens/semantic.css before running.

Idempotent; longest-first, word-boundary-guarded replacements.
Focus-ring rule (UI-STANDARDS §0): focus:ring-* becomes
focus-visible:outline-* (the v2 ring pattern) — controls keep their
keyboard indicator.
"""
import re
import glob

RING = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"

# legacy class -> v2 class. Order matters: longest/most-specific first.
REPLACEMENTS = [
    # focus rings first (contain "ring" + color classes)
    ("focus-visible:ring-2 focus-visible:ring-ring", RING),
    ("focus-visible:ring-2 focus-visible:ring-primary", RING),
    ("focus-visible:ring-2 focus-visible:ring-offset-2", RING),
    ("focus:ring-2 focus:ring-primary", RING),
    ("focus:ring-2 focus:ring-ring", RING),
    ("focus:ring-2 focus:ring-offset-2", RING),
    ("focus-visible:ring-2", RING),
    ("focus:ring-2", RING),
    ("focus:ring-inset", RING),
    ("ring-offset-background", ""),
    # foreground-of variants (before their bases)
    ("text-primary-foreground", "text-on-brand"),
    ("bg-primary-foreground", "bg-on-brand"),
    ("text-secondary-foreground", "text-fg"),
    ("bg-secondary-foreground", "bg-surface"),
    ("text-popover-foreground", "text-fg"),
    ("text-card-foreground", "text-fg"),
    ("text-accent-foreground", "text-fg"),
    ("text-destructive-foreground", "text-danger-on"),
    ("bg-destructive-foreground", "bg-danger-on"),
    # primary family
    ("hover:bg-primary/90", "hover:bg-brand-hover"),
    ("hover:bg-primary/80", "hover:bg-brand-hover"),
    ("bg-primary/10", "bg-brand-subtle"),
    ("bg-primary/5", "bg-brand-subtle"),
    ("ring-primary/30", "ring-brand/30"),
    ("ring-primary", "ring-brand"),
    ("hover:text-primary", "hover:text-brand"),
    ("text-primary", "text-brand"),
    ("bg-primary", "bg-brand"),
    ("border-primary", "border-brand"),
    ("focus-visible:border-primary", "focus-visible:border-brand"),
    # muted family
    ("text-muted-foreground", "text-fg-muted"),
    ("hover:bg-muted/60", "hover:bg-bg-subtle/60"),
    ("hover:bg-muted/50", "hover:bg-bg-subtle/50"),
    ("hover:bg-muted", "hover:bg-bg-subtle"),
    ("bg-muted/60", "bg-bg-subtle/60"),
    ("bg-muted/50", "bg-bg-subtle/50"),
    ("bg-muted/30", "bg-bg-subtle/30"),
    ("bg-muted", "bg-bg-subtle"),
    ("border-muted", "border-bg-subtle"),
    # background/foreground
    ("text-foreground", "text-fg"),
    ("bg-background", "bg-bg"),
    ("hover:bg-background/80", "hover:bg-bg/80"),
    # accent family (shadcn accent = subtle hover surface)
    ("hover:bg-accent/50", "hover:bg-bg-subtle/50"),
    ("hover:bg-accent", "hover:bg-bg-subtle"),
    ("bg-accent/50", "bg-bg-subtle/50"),
    ("bg-accent", "bg-bg-subtle"),
    # card/popover family
    ("bg-card", "bg-surface"),
    ("bg-popover", "bg-surface-overlay"),
    # border family
    ("border-input", "border-line"),
    ("border-border", "border-line"),
    ("border-ring", "border-line-strong"),
    ("ring-ring", "ring-line-strong"),
    # destructive family
    ("hover:bg-destructive/90", "hover:bg-danger/90"),
    ("hover:bg-destructive/80", "hover:bg-danger/80"),
    ("bg-destructive/90", "bg-danger/90"),
    ("bg-destructive/10", "bg-danger-subtle"),
    ("bg-destructive/15", "bg-danger-subtle"),
    ("border-destructive/50", "border-danger/50"),
    ("border-destructive/40", "border-danger/40"),
    ("border-destructive/30", "border-danger/30"),
    ("text-destructive", "text-danger-on"),
    ("bg-destructive", "bg-danger"),
    ("border-destructive", "border-danger"),
    # secondary family (shadcn secondary = surface)
    ("hover:bg-secondary/80", "hover:bg-surface/80"),
    ("hover:bg-secondary", "hover:bg-surface"),
    ("bg-secondary", "bg-surface"),
    ("text-secondary", "text-fg-secondary"),
    ("border-secondary", "border-line"),
]


def migrate(path: str) -> tuple[int, int]:
    with open(path) as f:
        src = f.read()
    orig = src
    for old, new in REPLACEMENTS:
        src = re.sub(rf"(?<![a-zA-Z0-9:/-]){re.escape(old)}(?![a-zA-Z0-9-])", new, src)
    if src != orig:
        with open(path, "w") as f:
            f.write(src)
        return 1, len(src.splitlines())
    return 0, len(src.splitlines())


if __name__ == "__main__":
    files = sorted(glob.glob("src/modules/ui/**/*.tsx", recursive=True))
    touched = 0
    for f in files:
        did, lines = migrate(f)
        touched += did
    print(f"{touched}/{len(files)} files migrated")
