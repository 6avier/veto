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
    # The API carries no authentication by design (docs/ENGINEERING.md §4: auth is
    # deprioritised for the event). That is defensible for a demo but not for a
    # demo whose URL is published, so the endpoints are rate limited per client
    # address instead. The ceilings are set well above what a booth visitor or a
    # judge clicking through the flow will ever reach, and well below what a
    # script pointed at the host would want.
    # Both subclasses of DRF's own, differing only in how they identify the
    # caller — see config/throttling.client_ident.
    "DEFAULT_THROTTLE_CLASSES": [
        "config.throttling.IdentifiedAnonRateThrottle",
        "config.throttling.IdentifiedScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        # Dispatch validation is the demo's hot path — someone trying the form
        # repeatedly must never hit this.
        "anon": "120/min",
        # Each upload puts a 10 MB file on a disk Render wipes anyway.
        "upload": "12/hour",
        # The only endpoint that spends money. See EXTRACT_DAILY_CAP below for
        # the ceiling that does not depend on the caller keeping one address.
        "extract": "10/hour",
        # Destructive or state-changing: profile writes and the register reset.
        "write": "30/hour",
        # Each dispatch writes an audit row, and the audit trail is the demo.
        "dispatch": "40/min",
    },
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

# Throttle state lives here. The default backend is per-process and in-memory,
# which is stated rather than inherited: it resets when the service restarts,
# and Render's free plan restarts on every wake from sleep. That is the right
# trade for one gunicorn worker serving a demo — it holds for as long as
# traffic keeps arriving, which is exactly when it is needed.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "veto-throttle",
    }
}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
# Rule Studio only, never the dispatch path.
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# A per-address throttle bounds one caller; it does not bound a caller willing
# to change address. This is the ceiling on total extractions per day across
# everyone, and so the ceiling on what the OpenAI key can be made to spend.
# Raise it before a demo that needs more; it is an env var so that does not
# need a deploy.
EXTRACT_DAILY_CAP = int(os.getenv("EXTRACT_DAILY_CAP", "60"))

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = 3600
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
