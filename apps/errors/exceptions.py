from rest_framework.views import exception_handler

from .models import ErrorLog
from .services import log_error


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)

    request = context.get('request')
    if response is not None:
        if response.status_code >= 500 or response.status_code == 404:
            log_error(
                request=request,
                kind=ErrorLog.Kind.API,
                status_code=response.status_code,
                exception=exc,
                message=str(exc),
            )
        return response

    log_error(
        request=request,
        kind=ErrorLog.Kind.API,
        status_code=500,
        exception=exc,
        message=str(exc),
    )
    return response
