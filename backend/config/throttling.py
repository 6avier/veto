"""Throttles shared across the apps.

The rates themselves live in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].
"""

from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle


class DispatchRateThrottle(AnonRateThrottle):
    """The rate for POST /validate.

    A class rather than a `throttle_scope` on the view, because @api_view builds
    its own view class behind the function: an attribute set on the name the
    decorator returns lands on the generated `as_view` result, which is not the
    object ScopedRateThrottle reads its scope from. Baking the scope in leaves
    nothing to line up.
    """

    scope = "dispatch"


class WriteScopedRateThrottle(ScopedRateThrottle):
    """A scoped throttle that ignores reads.

    Some views answer both a list and a create on one URL. The write half wants
    a tight ceiling; the read half is what the page calls on every render and
    must not share it. Only the methods that change something are counted.
    """

    def allow_request(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return super().allow_request(request, view)
