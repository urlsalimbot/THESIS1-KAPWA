#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-kapwa}"
DB_PASSWORD="${DB_PASSWORD:-kapwa}"
DB_NAME="${DB_NAME:-kapwa}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
MINIO_USER="${MINIO_USER:-minioadmin}"
MINIO_PASSWORD="${MINIO_PASSWORD:-minioadmin}"
BUCKET="${BACKUP_BUCKET:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

FILENAME="kapwa-db-${TIMESTAMP}.sql.gz"
ENCRYPTED_FILENAME="kapwa-db-${TIMESTAMP}.sql.gz.enc"

PGPASSWORD="${DB_PASSWORD}" pg_dump -h "${DB_HOST}" -U "${DB_USER}" "${DB_NAME}" | gzip > "/tmp/${FILENAME}"

openssl enc -aes-256-cbc -salt -pbkdf2 -pass "env:BACKUP_ENCRYPTION_KEY" -in "/tmp/${FILENAME}" -out "/tmp/${ENCRYPTED_FILENAME}"

mc alias set minio "http://${MINIO_ENDPOINT}" "${MINIO_USER}" "${MINIO_PASSWORD}"
mc mb "minio/${BUCKET}" --ignore-existing
mc cp "/tmp/${ENCRYPTED_FILENAME}" "minio/${BUCKET}/"

mc ls "minio/${BUCKET}/" | while IFS= read -r line; do
  DATE=$(echo "$line" | awk '{print $1}')
  if [[ $(date -d "$DATE" +%s) -lt $(date -d "-${RETENTION_DAYS} days" +%s) ]]; then
    FILE=$(echo "$line" | awk '{print $NF}')
    mc rm "minio/${BUCKET}/${FILE}"
  fi
done

rm "/tmp/${FILENAME}" "/tmp/${ENCRYPTED_FILENAME}"

echo "Backup completed: ${ENCRYPTED_FILENAME}"
