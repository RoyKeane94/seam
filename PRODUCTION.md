# Production Deployment Guide

## Overview

This Django project is configured for production deployment with:
- PostgreSQL database (Railway)
- Tailwind CSS (django-tailwind v4 standalone - no npm required)
- WhiteNoise for static file serving
- Gunicorn as WSGI server

## Environment Variables

Create a `.env` file in the project root with:

```env
# Environment
ENVIRONMENT=production
DEBUG=False

# Secret Key (generate a new one for production!)
SECRET_KEY=your-production-secret-key-here

# Allowed Hosts (comma-separated)
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database (PostgreSQL - Railway)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=HFhgrvnJvLqsOUQxPNUyichERcuOutMW
DB_HOST=interchange.proxy.rlwy.net
DB_PORT=20603
```

## Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t seam-website .

# Run the container
docker run -d \
  --name seam-website \
  -p 8000:8000 \
  --env-file .env \
  seam-website
```

### Using Docker Compose

```bash
docker-compose up -d
```

## Manual Deployment (without Docker)

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Build Tailwind CSS

```bash
python manage.py tailwind build
```

### 3. Run Migrations

```bash
python manage.py migrate
```

### 4. Collect Static Files

```bash
python manage.py collectstatic --noinput
```

### 5. Create Superuser (for admin)

```bash
python manage.py createsuperuser
```

### 6. Run with Gunicorn

```bash
gunicorn --bind 0.0.0.0:8000 --workers 3 seam_website.wsgi:application
```

## Railway Deployment

Railway will automatically detect and use the configuration files:

1. **`nixpacks.toml`** - Tells Railway how to build (includes Tailwind build)
2. **`railway.json`** - Alternative Railway configuration
3. Connect your GitHub repository to Railway
4. Set environment variables in Railway dashboard

Railway will automatically:
- Install dependencies from `requirements.txt`
- **Run `python manage.py tailwind build`** (configured in nixpacks.toml)
- **Run `python manage.py collectstatic --noinput`** (configured in nixpacks.toml)
- Run migrations (if you add a migrate command)
- Start the app with Gunicorn

### Manual Railway Configuration (if needed)

If Railway doesn't auto-detect, set these in Railway dashboard:

**Build Command:**
```bash
python manage.py tailwind build && python manage.py collectstatic --noinput
```

**Start Command:**
```bash
gunicorn --bind 0.0.0.0:$PORT --workers 3 seam_website.wsgi:application
```

### Using the Build Script

You can also use the provided `build.sh` script:
```bash
chmod +x build.sh
./build.sh
```

## Important Notes

### Tailwind CSS Build During Deployment

**✅ Already Configured For:**
- **Docker**: Tailwind builds in Dockerfile (line 28)
- **Railway**: Configured in `nixpacks.toml` and `railway.json`
- **Manual**: Use `build.sh` script or run commands manually

**How It Works:**
- **No npm required!** django-tailwind v4 standalone uses a Python-based Tailwind CLI
- Run `python manage.py tailwind build` **before** `collectstatic`
- The built CSS is automatically included in `collectstatic`
- Build happens automatically during Docker build or Railway deployment

**For Other Platforms:**
- **Heroku**: Add to `Procfile` or use buildpack
- **Render**: Add build command in dashboard
- **Fly.io**: Add to `fly.toml` or Dockerfile
- **Any platform**: Use the `build.sh` script in your build process

### Static Files

- Static files are collected to `staticfiles/` directory
- WhiteNoise middleware serves them in production
- No need for nginx or separate static file server

### Database

- Development: Uses SQLite (`db.sqlite3`) when `DB_ENGINE` is not set
- Production: Uses PostgreSQL when `ENVIRONMENT=production` or `DB_ENGINE` is set

## Security Checklist

- [ ] Generate a new `SECRET_KEY` for production
- [ ] Set `DEBUG=False` in production
- [ ] Set `ALLOWED_HOSTS` to your domain(s)
- [ ] Use HTTPS in production
- [ ] Keep `.env` file secure and never commit it
- [ ] Use strong database passwords

## Troubleshooting

### Static files not loading?

1. Check `STATIC_ROOT` is set correctly
2. Run `python manage.py collectstatic --noinput`
3. Ensure WhiteNoise middleware is in `MIDDLEWARE` (after SecurityMiddleware)
4. Check `STATIC_URL` starts with `/`

### Tailwind styles not working?

1. Run `python manage.py tailwind build`
2. Check `theme/static/css/dist/styles.css` exists
3. Run `python manage.py collectstatic --noinput` again

### Database connection errors?

1. Verify `.env` file has correct database credentials
2. Check `ENVIRONMENT=production` is set
3. Ensure PostgreSQL is accessible from your server

