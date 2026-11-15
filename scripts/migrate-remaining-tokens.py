#!/usr/bin/env python3
"""Migrate the last 23 non-ui files off legacy shadcn token classes onto
v2 tokens (UI-STANDARDS §12) — the final step before the P5 cutover
deletes the legacy layer from globals.css.

Same mapping as scripts/migrate-ui-tokens.py phases 1–6 (verified there
to be visually neutral: v2 values mirror legacy). Error text uses
text-danger-on (the alert/form convention), destructive surfaces use
danger/danger-subtle.
"""
import re
import glob

PAIRS = [
    # destructive family (error text = danger-on per ui/alert+form)
    ("hover:bg-destructive/10 hover:text-destructive", "hover:bg-danger-subtle hover:text-danger-on"),
    ("focus:text-destructive", "focus:text-danger-on"),
    ("hover:text-destructive", "hover:text-danger-on"),
    ("hover:bg-destructive/10", "hover:bg-danger-subtle"),
    ("bg-destructive/10", "bg-danger-subtle"),
    ("bg-destructive/5", "bg-danger-subtle"),
    ("border-destructive/60", "border-danger/60"),
    ("border-destructive/30", "border-danger/30"),
    ("border-destructive/20", "border-danger/20"),
    ("text-destructive", "text-danger-on"),
    ("bg-destructive", "bg-danger"),
    ("border-destructive", "border-danger"),
    # foreground / background
    ("text-foreground/10", "text-fg/10"),
    ("text-foreground", "text-fg"),
    ("bg-background", "bg-bg"),
    ("hover:text-foreground", "hover:text-fg"),
    # primary
    ("bg-primary/20", "bg-brand-subtle"),
    ("bg-primary/10", "bg-brand-subtle"),
    ("border-primary/40", "border-brand/40"),
    ("border-primary/20", "border-brand/20"),
    ("text-primary", "text-brand"),
    ("bg-primary", "bg-brand"),
    # muted
    ("hover:bg-muted/40", "hover:bg-bg-subtle/40"),
    ("text-muted-foreground", "text-fg-muted"),
    ("bg-muted", "bg-bg-subtle"),
    # card / border / secondary
    ("bg-card/50", "bg-surface/50"),
    ("bg-card/30", "bg-surface/30"),
    ("bg-card", "bg-surface"),
    ("border-border", "border-line"),
    ("text-secondary-foreground", "text-fg"),
]

FILES = [
    "src/app/(public)/courses/EnrollButton.tsx",
    "src/app/(public)/courses/FAQSection.tsx",
    "src/app/(public)/courses/ReviewSection.tsx",
    "src/app/(public)/courses/[id]/CheckoutButton.tsx",
    "src/app/(public)/courses/[id]/CourseProgressPreview.tsx",
    "src/app/(public)/for-business/page.tsx",
    "src/app/(public)/signup/b2b/page.tsx",
    "src/app/(public)/verify/[credentialId]/page.tsx",
    "src/app/layout.tsx",
    "src/app/not-found.tsx",
    "src/components/landing/modern-landing.tsx",
    "src/modules/assessment/components/DailyTestPanel.tsx",
    "src/modules/assessment/components/PracticePanel.tsx",
    "src/modules/assessment/components/WeeklyTestPanel.tsx",
    "src/modules/auth/ForgotPassword.tsx",
    "src/modules/b2b/components/B2BPanel.tsx",
    "src/modules/b2b/components/OrgCourseAssigner.tsx",
    "src/modules/b2c/components/B2CPanel.tsx",
    "src/modules/learn/components/classroom/ActivityRail.tsx",
    "src/modules/learn/components/classroom/LessonStage.tsx",
    "src/modules/learn/components/classroom/VoiceBar.tsx",
    "src/modules/platform-portal/tenants.tsx",
    "src/modules/platform-portal/users.tsx",
]

if __name__ == "__main__":
    changed = 0
    for f in FILES:
        src = open(f).read()
        orig = src
        for old, new in PAIRS:
            src = re.sub(rf"(?<![\w/]){re.escape(old)}(?![\w-])", new, src)
        src = re.sub(r"  +", " ", src)
        if src != orig:
            open(f, "w").write(src)
            changed += 1
    print(f"{changed}/{len(FILES)} files migrated")
