#!/bin/bash
# Kapwa Database Restore Script
#
# The counterpart of backup.sh: fetch an encrypted dump from the MinIO backups
# bucket (or take one from disk), decrypt it, and restore it into a database.
#
# Usage:
#   CONFIRM=yes ./restore.sh                       # newest backup in the bucket
#   CONFIRM=yes ./restore.sh kapwa-db-20261016_020000.sql.gz.enc
#   CONFIRM=yes ./restore.sh /tmp/local-dump.sql.gz   # an already-plain dump
#
#   DRILL=1 CONFIRM=yes ./restore.sh                # restore into kapwa_restore_drill
#
# Dependencies: pg_restore/psql, mc (MinIO Client), gzip, openssl
#
# Environment variables (from .env.production):
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#   MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, BACKUP_BUCKET
#   BACKUP_ENCRYPTION_KEY   (the same key backup.sh encrypted with)
#
# A backup that has never been restored is a hope. Run the drill at least once a
# quarter — it takes a minute and it is the only thing that proves the dumps are
# readable, complete and decryptable:
#   DRILL=1 CONFIRM=yes ./restore.sh
#   psql -d kapwa_restore_drill -c "select count(*) from cases"

set -euo pipefail

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-kapwa}"
DB_PASSWORD="${DB_PASSWORD:-kapwa}"
DB_NAME="${DB_NAME:-kapwa}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET="${BACKUP_BUCKET:-backups}"

if [[ "${CONFIRM:-no}" != "yes" ]]; then
  echo "Refusing to run without CONFIRM=yes." >&2
  echo "This drops and reloads objects in ${DB_NAME} on ${DB_HOST}." >&2
  echo "For a rehearsal that touches nothing: DRILL=1 CONFIRM=yes $0" >&2
  exit 1
fi

# A drill restores into a scratch database: it proves the dump is good without
# putting production data at risk.
if [[ "${DRILL:-0}" == "1" ]]; then
  DB_NAME="${DRILL_DB:-kapwa_restore_drill}"
  export PGPASSWORD="${DB_PASSWORD}"
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -q \
    -c "DROP DATABASE IF EXISTS ${DB_NAME}" -c "CREATE DATABASE ${DB_NAME}"
  echo "Drill database ${DB_NAME} recreated."
fi

SOURCE="${1:-}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

if [[ -z "${SOURCE}" ]]; then
  echo "No file named — taking the newest dump from minio/${BUCKET}."
  mc alias set kapwa-restore "http://${MINIO_ENDPOINT}" "${MINIO_USER}" "${MINIO_PASSWORD}" >/dev/null
  SOURCE="$(mc ls --json "kapwa-restore/${BUCKET}/" | grep -o '"key":"[^"]*"' | cut -d'"' -f4 | sort | tail -1)"
  [[ -n "${SOURCE}" ]] || { echo "No backups found in ${BUCKET}." >&2; exit 1; }
  mc cp "kapwa-restore/${BUCKET}/${SOURCE}" "${WORKDIR}/${SOURCE}" >/dev/null
  FILE="${WORKDIR}/${SOURCE}"
  echo "Fetched ${SOURCE}."
else
  FILE="${SOURCE}"
  [[ -f "${FILE}" ]] || { echo "File not found: ${FILE}" >&2; exit 1; }
fi

# Decrypt when the dump is still encrypted (backup.sh always encrypts).
if [[ "${FILE}" == *.enc ]]; then
  : "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY must be set to decrypt this dump}"
  DECRYPTED="${WORKDIR}/dump.sql.gz"
  openssl enc -d -aes-256-cbc -pbkdf2 -pass "env:BACKUP_ENCRYPTION_KEY" -in "${FILE}" -out "${DECRYPTED}"
  FILE="${DECRYPTED}"
fi

if [[ "${FILE}" == *.gz ]]; then
  gunzip -c "${FILE}" > "${WORKDIR}/dump.sql"
  SQL="${WORKDIR}/dump.sql"
else
  SQL="${FILE}"
fi

echo "Restoring into ${DB_NAME} on ${DB_HOST}…"
export PGPASSWORD="${DB_PASSWORD}"

# backup.sh produces a PLAIN SQL dump (pg_dump without -Fc) piped through gzip,
# so psql is the loader. A custom-format archive can be restored the same way
# with `pg_restore --no-owner --no-privileges -d <db> <file>` instead.
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -q \
  -c "DROP SCHEMA IF EXISTS public CASCADE" -c "CREATE SCHEMA public"
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -q -f "${SQL}" >/dev/null

# Smoke assertion: a restore that produced no rows is a failure, not a success.
CASES=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -At -c "select count(*) from cases" 2>/dev/null || echo 0)
echo "Restore finished: ${CASES} cases in ${DB_NAME}."
[[ "${CASES}" -gt 0 ]] || { echo "…but the cases table is empty or missing — treat this restore as FAILED." >&2; exit 1; }
