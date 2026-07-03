#!/usr/bin/env bash
# Tripwire: fail if customer-data export files are tracked in git.
#
# Real customer PII (leads_export.csv, users_export.csv) was committed to the
# repo root in the past. This guard rejects:
#   1. Any tracked *_export.csv anywhere in the tree (exports are data dumps
#      by nature and never belong in git).
#   2. Any tracked .csv at the repo root (legitimate CSV fixtures live under
#      data/, server/data/, attached_assets/ — never at the root).
#
# Run locally: bash scripts/check-no-pii.sh
# CI: called from the hygiene job in .github/workflows/ci-cd.yml
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

BAD=$(git ls-files | grep -E '(^|/)[^/]*_export\.csv$|^[^/]+\.csv$' || true)

if [ -n "$BAD" ]; then
  echo "::error::Customer-data export files must not be committed:"
  echo "$BAD"
  echo "Remove them with 'git rm' (they are gitignored going forward)."
  exit 1
fi

echo "No PII export files tracked. Clean."
