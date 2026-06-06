web: gunicorn seam_website.wsgi:application --bind 0.0.0.0:$PORT --workers 3
celery: celery -A seam_website worker -l info
