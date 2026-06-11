#!/usr/bin/env bash
# Agent preflight — run before ANY nightly-agent work. Exits non-zero with
# a reason if the environment is not safe to work in. Mechanical layer of
# the agents/AGENT.md contract.
set -euo pipefail

fail() { echo "PREFLIGHT FAIL: $1" >&2; exit 1; }

# 1. Clean tree — never start on someone else's mess, never sweep it up.
[ -z "$(git status --porcelain)" ] || fail "working tree is dirty; a human must look first"

# 2. Fresh main.
git fetch origin --quiet || fail "cannot fetch origin"

# 3. Not on main, or about to branch off current origin/main.
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ]; then
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "local main has diverged from origin/main"
fi

# 4. No leftover conflict markers anywhere in tracked files.
if git grep -nIE '^(<{7}|>{7}|={7})( |$)' -- ':!*.lock' ':!package-lock.json' >/dev/null 2>&1; then
  fail "tracked files contain conflict markers"
fi

echo "preflight ok"
