#!/usr/bin/env python3
"""Add demo-write guard to ALL remaining API route handlers."""
import re
import os
import sys

# Map file paths to action descriptions
def get_action(filepath):
    """Generate a human-readable action description from the file path."""
    if "users" in filepath and "approve" in filepath: return "approving users"
    if "users" in filepath and "block" in filepath: return "blocking users"
    if "users" in filepath and "role" in filepath: return "changing user roles"
    if "users" in filepath and "batch-approve" in filepath: return "batch-approving users"
    if "users" in filepath: return "managing users"
    if "courses" in filepath and "generate" in filepath: return "generating courses"
    if "courses" in filepath and "seed" in filepath: return "seeding courses"
    if "courses" in filepath: return "managing courses"
    if "batches" in filepath and "duplicate" in filepath: return "duplicating batches"
    if "batches" in filepath and "teachers" in filepath: return "managing batch teachers"
    if "batches" in filepath: return "managing batches"
    if "grades" in filepath: return "overriding grades"
    if "comments" in filepath: return "posting comments"
    if "events" in filepath: return "creating events"
    if "group-tasks" in filepath and "submit" in filepath: return "submitting group tasks"
    if "group-tasks" in filepath: return "managing group tasks"
    if "ai/" in filepath: return "running AI operations"
    if "cache" in filepath: return "clearing cache"
    if "cleanup" in filepath: return "cleaning up data"
    if "certificates" in filepath: return "generating certificates"
    if "course-outline" in filepath: return "editing course outlines"
    if "crisis-flags" in filepath: return "managing crisis flags"
    if "curriculum" in filepath: return "updating curriculum progress"
    if "daily-logs" in filepath: return "managing daily logs"
    if "daily-test" in filepath: return "submitting daily tests"
    if "institutions" in filepath: return "managing institutions"
    if "interactions" in filepath: return "managing interactions"
    if "journey" in filepath: return "updating journey"
    if "case-review" in filepath: return "reviewing cases"
    if "touchpoints" in filepath and "parse" in filepath: return "parsing touchpoints"
    if "touchpoints" in filepath: return "managing mentorship touchpoints"
    if "messages" in filepath and "read" in filepath: return "marking messages as read"
    if "messages" in filepath: return "sending messages"
    if "password-reset" in filepath: return "managing password resets"
    if "peer-assessment" in filepath: return "submitting peer assessments"
    if "project" in filepath and "generate-tasks" in filepath: return "generating project tasks"
    if "project" in filepath and "reports" in filepath: return "generating project reports"
    if "project" in filepath and "setup" in filepath: return "setting up projects"
    if "project" in filepath and "weeks" in filepath: return "managing project weeks"
    if "psych-evidence" in filepath: return "managing psychology evidence"
    if "report-cards" in filepath: return "generating report cards"
    if "role-nav-config" in filepath: return "managing role nav config"
    if "seed" in filepath: return "seeding data"
    if "settings" in filepath: return "managing settings"
    if "allow-retake" in filepath: return "allowing retakes"
    if "draft-checkin" in filepath: return "saving draft check-ins"
    if "edit-weekly-test" in filepath: return "editing weekly tests"
    if "generate-project-analysis" in filepath: return "generating project analysis"
    if "generate-report-card" in filepath: return "generating report cards"
    if "rehearse" in filepath: return "rehearsing"
    if "unlock-test" in filepath: return "unlocking tests"
    if "alerts" in filepath and "check" in filepath: return "checking alerts"
    if "alerts" in filepath: return "managing alerts"
    if "tasks" in filepath: return "managing tasks"
    if "copilot" in filepath: return "using teacher copilot"
    if "rules" in filepath: return "managing teacher rules"
    if "topic-guidance" in filepath: return "managing topic guidance"
    if "access-grants" in filepath: return "managing access grants"
    return "this action"

def find_unguarded_files():
    """Find all API route files with write handlers that don't have the demo guard."""
    api_dir = "src/app/api"
    files = []
    for root, dirs, filenames in os.walk(api_dir):
        for fname in filenames:
            if fname == "route.ts":
                filepath = os.path.join(root, fname)
                with open(filepath, 'r') as f:
                    content = f.read()
                # Has a write handler?
                has_write = bool(re.search(r'export async function (POST|PUT|PATCH|DELETE)', content))
                # Already guarded?
                already_guarded = 'demoWriteBlock' in content or 'demo-guard' in content
                # Skip auth routes (login, logout, password reset — should work for demo)
                is_auth = any(x in filepath for x in ['/auth/login', '/auth/logout', '/auth/me', '/auth/forgot', '/auth/reset', '/auth/change', '/auth/set-security'])
                if has_write and not already_guarded and not is_auth:
                    files.append(filepath)
    return sorted(files)

def add_guard(filepath, action):
    """Add demo-write guard to all write handlers in the file."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Add import after the last import line
    lines = content.split('\n')
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import = i
    if last_import == 0:
        return "SKIP (no imports)"
    lines.insert(last_import + 1, 'import { demoWriteBlock } from "@/lib/demo-guard";')
    content = '\n'.join(lines)

    # For each write method, find the function and insert guard after the opening brace
    for method in ['POST', 'PUT', 'PATCH', 'DELETE']:
        # Try same-line brace first: export async function METHOD(...) {
        pattern = rf'(export async function {method}\([^)]*\)[^\n]*\{{)'
        match = re.search(pattern, content)
        if match:
            insert_pos = match.end()
            guard = f'\n  const _demoBlock = await demoWriteBlock("{action}"); if (_demoBlock) return _demoBlock;'
            content = content[:insert_pos] + guard + content[insert_pos:]
            continue

        # Multi-line signature: find matching closing paren then first {
        pattern2 = rf'(export async function {method}\()'
        match2 = re.search(pattern2, content)
        if match2:
            start = match2.end()
            depth = 1
            i = start
            while i < len(content) and depth > 0:
                if content[i] == '(':
                    depth += 1
                elif content[i] == ')':
                    depth -= 1
                i += 1
            brace_pos = content.find('{', i)
            if brace_pos != -1:
                insert_pos = brace_pos + 1
                guard = f'\n  const _demoBlock = await demoWriteBlock("{action}"); if (_demoBlock) return _demoBlock;'
                content = content[:insert_pos] + guard + content[insert_pos:]

    with open(filepath, 'w') as f:
        f.write(content)
    return "✓ Guarded"

if __name__ == "__main__":
    files = find_unguarded_files()
    print(f"Found {len(files)} unguarded files\n")
    for filepath in files:
        action = get_action(filepath)
        result = add_guard(filepath, action)
        print(f"{result}: {filepath}")
    print(f"\nDone! Processed {len(files)} files.")
