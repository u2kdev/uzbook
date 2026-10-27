#!/usr/bin/env bash
# Restores a PostgreSQL dump and uploads from a backup folder created by backup.sh.
# Usage: ./deploy/restore.sh backups/2026-10-28_120000
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${1:-}"

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "Usage: $0 <path-to-backup-dir>" >&2
  echo "Example: $0 backups/2026-10-28_120000" >&2
  exit 1
fi

DB_SQL="${BACKUP_DIR}/db.sql"
UPLOADS_ARCHIVE="${BACKUP_DIR}/uploads.tar.gz"

if [ -f "$DB_SQL" ]; then
  echo "Restoring database from ${DB_SQL}..."
  docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$DB_SQL"
  echo "Database restored successfully."
else
  echo "Warning: ${DB_SQL} not found, skipping DB restore."
fi

if [ -f "$UPLOADS_ARCHIVE" ]; then
  echo "Restoring uploads from ${UPLOADS_ARCHIVE}..."
  TEMP_UPLOADS="$(mktemp -d)"
  tar -xzf "$UPLOADS_ARCHIVE" -C "$TEMP_UPLOADS"
  docker compose cp "${TEMP_UPLOADS}/uploads/." app:/app/.data/uploads/
  rm -rf "$TEMP_UPLOADS"
  echo "Uploads restored successfully."
else
  echo "Warning: ${UPLOADS_ARCHIVE} not found, skipping uploads restore."
fi

echo "Restore from ${BACKUP_DIR} completed."
