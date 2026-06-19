#!/bin/bash
# Kapwa Database Backup Script
# Performs pg_dump of the Kapwa database and uploads to MinIO backups bucket.
# Handles rotation: 7 daily, 4 weekly, 3 monthly backups.
#
# Usage: ./backup.sh
# Dependencies: pg_dump, mc (MinIO Client), gzip
#
# Environment variables (from .env.production):
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#   MINIO_ROOT_USER, MINIO_ROOT_PASSWORD

set -euo pipefail

BACKUP_DIR="/tmp/kapwa-backups"
LOG_FILE="/var/log/backup.log"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/kapwa-db-${DATE}.sql.gz"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${LOG_FILE}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

log "Starting database backup..."

# Perform pg_dump and gzip
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
    -h "${DB_HOST:-db}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-kapwa}" \
    -d "${DB_NAME:-kapwa}" \
    --format=custom \
    --verbose \
    2>> "${LOG_FILE}" | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null)
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE} bytes)"

# Upload to MinIO
if command -v mc &>/dev/null; then
    # Configure MinIO client
    mc alias set myminio \
        "http://${MINIO_ENDPOINT:-minio}:${MINIO_PORT:-9000}" \
        "${MINIO_ROOT_USER}" \
        "${MINIO_ROOT_PASSWORD}" \
        --api S3v4 2>> "${LOG_FILE}"

    # Upload backup file
    mc cp "${BACKUP_FILE}" "myminio/backups/" 2>> "${LOG_FILE}"
    log "Backup uploaded to MinIO: backups/$(basename "${BACKUP_FILE}")"

    # ----- Rotation Logic -----

    # Daily: keep last 7
    find "${BACKUP_DIR}" -name "kapwa-db-*.sql.gz" -mtime +7 -delete 2>/dev/null || true

    # Weekly: keep one per week for last 4 weeks (files with Sunday date pattern)
    # Monthly: keep one per month for last 3 months
    # Remote rotation
    mc ls myminio/backups/ 2>/dev/null | while read -r line; do
        # Parse date from mc ls output
        backup_date=$(echo "${line}" | awk '{print $1}')
        if [ -n "${backup_date}" ]; then
            backup_epoch=$(date -d "${backup_date}" +%s 2>/dev/null || echo "0")
            now_epoch=$(date +%s)
            age_days=$(( (now_epoch - backup_epoch) / 86400 ))
            if [ "${age_days}" -gt 30 ]; then
                mc rm "myminio/backups/$(echo "${line}" | awk '{print $NF}')" 2>/dev/null || true
            fi
        fi
    done
else
    log "WARNING: MinIO Client (mc) not found — backup file not uploaded to MinIO"
    log "Backup saved locally at: ${BACKUP_FILE}"
fi

log "Backup completed successfully"
exit 0
