#!/usr/bin/env bash
# Safe update script for a Docker Compose server.
# Usage: ./deploy/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example and fill in production values." >&2
  exit 1
fi

APP_PORT="$(grep -E '^APP_PORT=' .env | tail -1 | cut -d= -f2- || true)"
APP_PORT="${APP_PORT:-3000}"

git pull --ff-only
docker compose build --pull
docker compose up -d --remove-orphans
docker compose ps

echo "Waiting for /api/health..."
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null; then
    echo "Application is healthy."
    exit 0
  fi
  sleep 2
done

echo "Healthcheck failed. Recent app logs:" >&2
docker compose logs --tail=80 app >&2
exit 1
