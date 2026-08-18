"""Throttles shared across the apps.

The rates themselves live in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].
"""

from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle


def client_ident(request):
    """The address a rate limit should be counted against.

    DRF's own answer is the whole X-Forwarded-For chain joined together, which
    is correct for a service talking straight to one proxy and wrong here. Render
    fronts its services with Cloudflare, so the chain that reaches gunicorn
    carries intermediate hops as well as the caller — and those hops change
    between requests. Every request therefore got its own bucket, and a throttle
    verified locally counted to one forever in production.

    CF-Connecting-IP is asked for first because Cloudflare sets it to the real
    caller and overwrites whatever arrived under that name, so unlike the
    leftmost X-Forwarded-For entry it is not simply whatever the caller typed.
    The X-Forwarded-For fallback is spoofable and is here for environments
    without Cloudflare in front; REMOTE_ADDR covers local development, where
    neither header exists.
    """
    meta = request.META
    for header in ("HTTP_CF_CONNECTING_IP", "HTTP_TRUE_CLIENT_IP"):
        value = meta.get(header)
        if value:
            return value.strip()
    forwarded = meta.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return meta.get("REMOTE_ADDR", "")


class ClientIdentMixin:
    def get_ident(self, request):
        return client_ident(request)


class DispatchRateThrottle(ClientIdentMixin, AnonRateThrottle):
    """The rate for POST /validate.

    A class rather than a `throttle_scope` on the view, because @api_view builds
    its own view class behind the function: an attribute set on the name the
    decorator returns lands on the generated `as_view` result, which is not the
    object ScopedRateThrottle reads its scope from. Baking the scope in leaves
    nothing to line up.
    """

    scope = "dispatch"


class IdentifiedAnonRateThrottle(ClientIdentMixin, AnonRateThrottle):
    """The global anonymous rate, counted against the caller rather than the chain."""


class IdentifiedScopedRateThrottle(ClientIdentMixin, ScopedRateThrottle):
    """A scoped rate, counted against the caller rather than the chain."""


class WriteScopedRateThrottle(IdentifiedScopedRateThrottle):
    """A scoped throttle that ignores reads.

    Some views answer both a list and a create on one URL. The write half wants
    a tight ceiling; the read half is what the page calls on every render and
    must not share it. Only the methods that change something are counted.
    """

    def allow_request(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return super().allow_request(request, view)
