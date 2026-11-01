"""Root URL config. All product routes live under /api/v1 per api-contract.md."""

from django.conf import settings
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    # Says which database the process actually reached, so a host that never
    # passed DATABASE_URL through (and fell back to SQLite) is visible from a
    # browser. Only the vendor and the error class: never the connection string.
    # Stays 200 either way; this is a liveness check, not a readiness one.
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db = connection.vendor
    except Exception as exc:
        db = f"error: {type(exc).__name__}"
    return JsonResponse({"status": "ok", "service": "veto-api", "db": db})


api_v1 = [
    path("", include("apps.validation.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.rules.urls")),
    path("", include("apps.profiles.urls")),
]

urlpatterns = [
    path("health/", health, name="health"),
    path("api/v1/", include(api_v1)),
]

# The admin is a login form on a published hostname, and nothing in this repo
# creates a superuser for it — so deployed it is a brute-force surface guarding
# an empty room, and the moment anyone does create an account it guards the
# whole database with whatever password they picked. It stays available locally,
# where it is genuinely useful for inspecting seeded rules.
if settings.DEBUG:
    urlpatterns.insert(0, path("admin/", admin.site.urls))
