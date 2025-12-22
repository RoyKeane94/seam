# Docker Compose Explained

## What is Docker Compose?

**Docker Compose** is a tool for defining and running multi-container Docker applications. Instead of running multiple `docker run` commands, you define everything in a `docker-compose.yml` file.

## Simple Analogy

Think of it like a recipe:
- **Docker** = A single container (like cooking one dish)
- **Docker Compose** = A full meal with multiple dishes that work together

## Your docker-compose.yml

Your file defines two services:

1. **`web`** - Your Django application
   - Builds from your Dockerfile
   - Runs on port 8000
   - Uses your `.env` file for configuration
   - Depends on the database

2. **`db`** - PostgreSQL database
   - Uses the official PostgreSQL image
   - Stores data in a volume (persists between restarts)
   - Exposes port 5432

## How to Use

### Start everything:
```bash
docker-compose up
```

### Start in background (detached):
```bash
docker-compose up -d
```

### Stop everything:
```bash
docker-compose down
```

### View logs:
```bash
docker-compose logs -f
```

### Rebuild after changes:
```bash
docker-compose up --build
```

## Do You Need It?

**For local development:** Yes, it's helpful - runs both your app and database together.

**For production (Railway/Heroku/etc):** Usually NO - these platforms handle containers differently. You mainly need the `Dockerfile`.

## When to Use Docker Compose

✅ **Use it when:**
- Developing locally and want to run database + app together
- Testing the full stack locally
- Running multiple services (app, database, redis, etc.)

❌ **Don't use it when:**
- Deploying to Railway, Heroku, or similar platforms
- They have their own container orchestration

