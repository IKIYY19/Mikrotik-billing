#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
while ! nc -z ${DB_HOST:-postgres} ${DB_PORT:-5432}; do
  sleep 1
  echo "Waiting for database connection..."
done
echo "PostgreSQL is ready!"

# Run RADIUS schema migration if needed
if [ "${RUN_RADIUS_MIGRATIONS:-true}" = "true" ]; then
  echo "Running RADIUS database migrations..."
  PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${RADIUS_DB_NAME:-radius_db} -f /docker-entrypoint-initdb.d/radius_schema.sql || true
fi

# Link mods if needed
if [ ! -L /etc/freeradius/3.0/mods-enabled/sql ]; then
  ln -s /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql 2>/dev/null || true
fi

# Execute the CMD
exec "$@"
