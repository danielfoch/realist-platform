#!/usr/bin/env bash
# Agent postflight — run after implementing a queue item, BEFORE push.
# Verifies the diff respects the agents/AGENT.md contract mechanically.
set -euo pipefail

fail() { echo "POSTFLIGHT FAIL: $1" >&2; exit 1; }

BRANCH=$(git branch --show-current)

# 1. Branch discipline.
case "$BRANCH" in
  agent/*|clyde/*) : ;;
  *) fail "branch '$BRANCH' does not match agent/* or clyde/*" ;;
esac
[ "$BRANCH" != "main" ] || fail "on main"
git merge-base --is-ancestor origin/main HEAD || fail "branch is not based on current origin/main"

# 2. Path whitelist: changed files must all be inside allowed areas.
ALLOWED='^(docs/content/|docs/reports/|docs/email-drafts/|server/data/content/|agents/queue\.yml$)'
VIOLATIONS=$(git diff origin/main --name-only | grep -vE "$ALLOWED" || true)
[ -z "$VIOLATIONS" ] || fail "diff touches forbidden paths:
$VIOLATIONS"

# 3. No forbidden commands smuggled into any changed file.
if git diff origin/main -U0 | grep -nE '^\+' | grep -E 'db:push|drizzle-kit push|migrate|--force|force-push' >/dev/null; then
  fail "diff contains forbidden command text (db:push/migrate/--force)"
fi

# 4. No conflict markers in the diff.
if git diff origin/main -U0 | grep -E '^\+(<{7}|>{7}|={7})( |$)' >/dev/null; then
  fail "diff introduces conflict markers"
fi

# 5. Tree clean after commit (nothing half-staged or untracked left behind).
[ -z "$(git status --porcelain)" ] || fail "uncommitted/untracked files left in tree"

echo "postflight ok"
