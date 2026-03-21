#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "[replit] booting Realist Platform"

if [[ ! -d node_modules ]]; then
  echo "[replit] installing dependencies"
  npm ci
fi

if [[ -n "${DATABASE_URL:-}" && "${SKIP_MIGRATIONS:-false}" != "true" ]]; then
  echo "[replit] running migrations"
  npm run migrate
else
  echo "[replit] skipping migrations (set DATABASE_URL to enable)"
fi

echo "[replit] starting dev server"
exec npm run dev
