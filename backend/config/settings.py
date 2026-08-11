"""Django settings for VETO.

Environment-driven. Copy .env.example to .env and fill it in.
Local dev runs on SQLite so the backend lane is never blocked on Supabase.
"""

from pathlib import Path
import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")

# Canonical request/response fixtures shared with the frontend. See /contract.
CONTRACT_DIR = REPO_ROOT / "contract"


def env_bool(key, default=False):
    return os.getenv(key, str(default)).strip().lower() in ("1", "true", "yes", "on")


DEBUG = env_bool("DJANGO_DEBUG", False)

DEV_SECRET_KEY = "dev-only-insecure-do-not-use-in-production"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", DEV_SECRET_KEY)
if not DEBUG and SECRET_KEY == DEV_SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off. "
        "Generate one with: uv run python -c "
        "'from django.core.management.utils import get_random_secret_key as k; print(k())'"
    )

ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.validation",
    "apps.rules",
    "apps.audit",
    "apps.profiles",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# DATABASE_URL is the Supabase connection string in deployed environments.
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Jakarta"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "EXCEPTION_HANDLER": "config.exceptions.contract_exception_handler",
    "UNAUTHENTICATED_USER": None,
}
if DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"].append(
        "rest_framework.renderers.BrowsableAPIRenderer"
    )

# The frontend dev server. Deployed origins come from the env var.
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]

# Rule Studio uploads: PDF only, 10 MB, per api-contract.md §4.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_BYTES
FILE_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_BYTES

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Rule Studio only, never the dispatch path. Kept configurable because Google
# retires model ids from under existing keys: gemini-2.5-flash is still listed
# by models.list() but refuses generateContent for keys created after its
# cutoff. "latest" aliases keep working.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = 3600
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
