#!/bin/bash
# Render deployment build script
# This runs automatically on Render

set -eu

echo "🚀 Starting Render deployment..."

# Run migrations
echo "📦 Running database migrations..."
cd /app/server
node src/db/migrate.js

# Seed database
echo "🌱 Seeding database..."
node src/db/seed.js

# Start server
echo "🚀 Starting server..."
exec node src/index.js
