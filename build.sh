#!/bin/bash
# Build script for production deployment
# This ensures Tailwind CSS is built before collecting static files

set -e  # Exit on any error

echo "🔨 Building Tailwind CSS..."
python manage.py tailwind build

echo "📦 Collecting static files..."
python manage.py collectstatic --noinput

echo "✅ Build complete!"

