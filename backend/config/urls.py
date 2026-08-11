"""Root URL config. All product routes live under /api/v1 per api-contract.md."""

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
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/v1/", include(api_v1)),
]
