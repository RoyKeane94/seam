#!/bin/bash
# Migration script for Railway
# Run this after deployment to ensure database is migrated

set -e

echo "🔄 Running database migrations..."
python manage.py migrate --noinput

echo "✅ Migrations complete!"

