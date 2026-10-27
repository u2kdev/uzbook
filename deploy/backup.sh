#!/usr/bin/env bash
# Creates a PostgreSQL dump and an uploads archive under ./backups/<timestamp>/.
# Usage: ./deploy/backup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

STAMP="$(date +%F_%H%M%S)"
OUT="backups/${STAMP}"
mkdir -p "$OUT"

echo "Dumping PostgreSQL to ${OUT}/db.sql..."
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "${OUT}/db.sql"

echo "Copying uploads..."
docker compose cp app:/app/.data/uploads "${OUT}/uploads"
tar -czf "${OUT}/uploads.tar.gz" -C "$OUT" uploads
rm -rf "${OUT}/uploads"

echo "Backup written to ${OUT}"
echo "Restore: psql < ${OUT}/db.sql and extract uploads.tar.gz into the uploads volume."
