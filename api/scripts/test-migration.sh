#!/bin/bash

# Test migration script with local PostgreSQL container
set -e

echo "🐳 Starting PostgreSQL container for migration testing..."

# Start PostgreSQL container
docker run --name grammysnaps-test-db -d \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -e POSTGRES_DB=grammysnaps_test \
  -p 5433:5432 \
  postgres:16

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Test connection
echo "🔍 Testing database connection..."
until docker exec grammysnaps-test-db pg_isready -U test_user -d grammysnaps_test; do
  echo "Database not ready, waiting..."
  sleep 2
done

echo "✅ Database is ready!"

# Set environment variables for migration
export DB_HOST=localhost
export DB_PORT=5433
export DB_NAME=grammysnaps_test
export DB_USER=test_user
export DB_PASSWORD=test_password
export NODE_ENV=local

# Run migration
echo "🚀 Running migration script..."
cd "$(dirname "$0")"
npm run migrate

# Clean up
echo "🧹 Cleaning up test database..."
docker stop grammysnaps-test-db
docker rm grammysnaps-test-db

echo "✅ Migration test completed successfully!"
