"""Root URL config. All product routes live under /api/v1 per api-contract.md."""

from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok", "service": "veto-api"})


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
