#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env file. Copy .env.example and configure values first."
  exit 1
fi

echo "[1/6] Installing dependencies"
npm ci

echo "[2/6] Running database migrations"
npm run migrate

echo "[3/6] Testing DDF connection"
npm run test:ddf

echo "[4/6] Running quality checks"
npm run check

echo "[5/6] Building backend"
npm run build

echo "[6/6] Starting services"
npm run start
