"""Maps DRF exceptions onto the error envelope in api-contract.md §0.

Every non-2xx response that is not a HOLD must look like:

    {"error": {"code": "...", "message": "...", "field": "..."}}
"""

from rest_framework.views import exception_handler as drf_exception_handler

STATUS_TO_CODE = {
    400: "VALIDATION_ERROR",
    404: "NOT_FOUND",
    409: "CONFLICT",
    # Without this a throttled request came back as INTERNAL_ERROR, which reads
    # as "the server is broken" for something that is working exactly as meant.
    429: "RATE_LIMITED",
    504: "UPSTREAM_TIMEOUT",
}


def _first_field_error(detail):
    """Pull one (field, message) pair out of a DRF error detail structure."""
    if isinstance(detail, dict):
        for field, value in detail.items():
            if field == "detail":
                return None, str(value)
            nested_field, message = _first_field_error(value)
            return (nested_field or field), message
    if isinstance(detail, list) and detail:
        return _first_field_error(detail[0])
    return None, str(detail)


def contract_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        # Unhandled exception: let Django's 500 path deal with it so the
        # traceback still reaches the logs in DEBUG.
        return None

    # A HOLD is a successful evaluation that happens to use 403. It sets this
    # flag on the request so we never wrap it in an error envelope.
    if getattr(context.get("request"), "_veto_is_hold", False):
        return response

    field, message = _first_field_error(response.data)
    error = {
        "code": STATUS_TO_CODE.get(response.status_code, "INTERNAL_ERROR"),
        "message": message,
    }
    if field:
        error["field"] = field
    response.data = {"error": error}
    return response
