#!/bin/bash
# Render deployment build script
# This runs automatically on Render

set -e

echo "🚀 Starting Render deployment..."

# Run migrations
echo "📦 Running database migrations..."
cd /app/server
node src/db/migrate.js || echo "⚠️  Migrations failed, continuing..."

# Seed database
echo "🌱 Seeding database..."
node src/db/seed.js || echo "⚠️  Seed failed, continuing..."

# Start server
echo "🚀 Starting server..."
node src/index.js
