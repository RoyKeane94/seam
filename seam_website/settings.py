"""
Django settings for seam_website project.
"""

from pathlib import Path
from urllib.parse import urlparse

from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='build-time-key-not-for-production-use')
DEBUG = config('DEBUG', cast=bool)

ALLOWED_HOSTS = list(config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1',
    cast=Csv(),
))
# Railway health checks hit localhost / healthcheck.railway.app
for _host in ('healthcheck.railway.app', '.railway.app', '.up.railway.app', 'localhost', '127.0.0.1'):
    if _host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_host)

CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'apps.accounts',
    'apps.notes',
    'apps.retrieval',
    'apps.errors',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.errors.middleware.ErrorLoggingMiddleware',
]

ROOT_URLCONF = 'seam_website.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'seam_website' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'seam_website.wsgi.application'

AUTH_USER_MODEL = 'accounts.User'

DATABASE_URL = config('DATABASE_URL', default='')

if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': parsed.path.lstrip('/'),
            'USER': parsed.username,
            'PASSWORD': parsed.password,
            'HOST': parsed.hostname,
            'PORT': parsed.port or '5432',
        }
    }
elif config('DB_ENGINE', default=''):
    DATABASES = {
        'default': {
            'ENGINE': config('DB_ENGINE', default='django.db.backends.postgresql'),
            'NAME': config('DB_NAME'),
            'USER': config('DB_USER'),
            'PASSWORD': config('DB_PASSWORD'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'EXCEPTION_HANDLER': 'apps.errors.exceptions.api_exception_handler',
}

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv(),
)

_redis_url = config('REDIS_URL', default='redis://localhost:6379/0')
if DEBUG and 'railway.internal' in _redis_url:
    _redis_url = 'redis://localhost:6379/0'

CELERY_BROKER_URL = _redis_url
CELERY_RESULT_BACKEND = _redis_url
# Local dev runs tasks in-process; production uses a Celery worker + Redis.
USE_CELERY = config('USE_CELERY', default=not DEBUG, cast=bool)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TASK_IGNORE_RESULT = True

OPENAI_API_KEY = config('OPENAI_API_KEY', default='')
ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY', default='')
ANTHROPIC_MODEL = config('ANTHROPIC_MODEL', default='claude-haiku-4-5')
ANTHROPIC_TAGGING_MODEL = config(
    'ANTHROPIC_TAGGING_MODEL',
    default='claude-haiku-4-5-20251001',
)

WHISPER_PAUSE_THRESHOLD = config('WHISPER_PAUSE_THRESHOLD', default=2.0, cast=float)
SEMANTIC_CHUNK_THRESHOLD = config('SEMANTIC_CHUNK_THRESHOLD', default=0.80, cast=float)
STALE_PROCESSING_MINUTES = config('STALE_PROCESSING_MINUTES', default=5, cast=int)
VOICE_MIN_WORDS = config('VOICE_MIN_WORDS', default=5, cast=int)
MAX_VOICE_DURATION_SECS = config('MAX_VOICE_DURATION_SECS', default=300, cast=int)

# Leave empty to accept any invite code during development
INVITE_CODE = config('INVITE_CODE', default='')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
