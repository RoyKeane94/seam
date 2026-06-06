#!/bin/sh
set -e

# Run a Celery worker in the same container so voice/text jobs are not left queued
# when Railway only provisions the web service (no separate worker process).
celery -A seam_website worker -l info --concurrency=2 &
CELERY_PID=$!

cleanup() {
  if kill -0 "$CELERY_PID" 2>/dev/null; then
    kill "$CELERY_PID" 2>/dev/null || true
    wait "$CELERY_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM

exec gunicorn seam_website.wsgi:application \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers 3
