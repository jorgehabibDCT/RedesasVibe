#!/usr/bin/env bash
# Apply db/migrations/001_bitacora.sql to the database in DATABASE_URL.
# Safe to run only on an empty database (CREATE TABLE will fail if tables already exist).
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "bitacora-db-migrate: set DATABASE_URL to your Postgres connection string." >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="${ROOT}/db/migrations/001_bitacora.sql"
if [[ ! -f "$SQL" ]]; then
  echo "bitacora-db-migrate: missing ${SQL}" >&2
  exit 1
fi
echo "Applying ${SQL} ..."
psql "$DATABASE_URL" -f "$SQL"
echo "bitacora-db-migrate: done."
