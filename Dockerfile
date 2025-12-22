# Use Python 3.12 slim image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Build Tailwind CSS (django-tailwind v4 standalone doesn't need npm)
# This must run before collectstatic
RUN python manage.py tailwind build || echo "Warning: Tailwind build failed, continuing..."

# Collect static files (includes the built Tailwind CSS)
RUN python manage.py collectstatic --noinput || echo "Warning: collectstatic failed, continuing..."

# Expose port
EXPOSE 8000

# Run gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "seam_website.wsgi:application"]

